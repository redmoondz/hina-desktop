const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => require("../../src/helpers/hinaPortableSettings");

test("custom agent timeout is portable and invalid values are rejected before writes", async () => {
  const { applySettings, exportSettings, parseSettings } = load();
  const file = exportSettings({}, { timeoutSeconds: 900 });
  const storage = new Map();
  await applySettings(file, {}, { setItem: (key, value) => storage.set(key, value) });
  assert.equal(storage.get("hinaConnectorTimeoutSeconds"), "900");
  for (const timeoutSeconds of [0, -1, 1.5, 3601, "300", null])
    assert.throws(() =>
      parseSettings(
        JSON.stringify({
          format: "hina-desktop",
          version: 1,
          settings: {},
          connector: { timeoutSeconds },
        })
      )
    );
});

test("speech language and Windows voice round trip through JSON without installing voices", async () => {
  const { applySettings, exportSettings } = load();
  const speech = { enabled: true, language: "en-US", voice: "Microsoft David Desktop" };
  const file = exportSettings({}, {}, speech);
  const storage = new Map();
  await applySettings(file, {}, { setItem: (key, value) => storage.set(key, value) });
  assert.equal(storage.get("hinaSpeechLanguage"), "en-US");
  assert.equal(storage.get("hinaSpeechVoice"), "Microsoft David Desktop");
  assert.equal(storage.get("hinaSpeechEnabled"), "true");
});

test("connection JSON authenticates before applying and never exports its token", async () => {
  const { applySettings, exportSettings, parseSettings } = load();
  const connector = { url: "http://localhost:3210", token: "test-token", transport: "local" };
  const config = parseSettings(
    JSON.stringify({ format: "hina-desktop", version: 1, settings: {}, connector })
  );
  const changes = [];
  const storage = new Map();
  const store = Object.fromEntries(
    [
      "DictationAgentRemoteUrl",
      "DictationAgentModel",
      "DictationAgentMode",
      "UseDictationAgent",
      "DictationAgentCustomApiKey",
    ].map((key) => [`set${key}`, (value) => changes.push([key, value])])
  );
  const api = {
    hinaConnectorRequest: async (args) => {
      assert.equal(args.check, true);
      return { ok: true };
    },
    saveDictationAgentCustomKey: async (token) => changes.push(["saved", token]),
  };
  await applySettings(config, store, { setItem: (key, value) => storage.set(key, value) }, api);
  assert.equal(storage.get("hinaConnectorEnabled"), "true");
  assert.ok(
    changes.some(([key, value]) => key === "DictationAgentRemoteUrl" && value === connector.url)
  );
  assert.ok(changes.some(([key, value]) => key === "saved" && value === connector.token));
  assert.ok(!JSON.stringify(exportSettings({}, connector)).includes("test-token"));
  changes.length = 0;
  api.hinaConnectorRequest = async () => ({ ok: false, error: "Unauthorized" });
  await assert.rejects(
    applySettings(
      config,
      store,
      {
        setItem() {
          assert.fail("No writes before authentication");
        },
      },
      api
    ),
    /Unauthorized/
  );
  assert.deepEqual(changes, []);
});

test("connection JSON rejects invalid credentials and ambiguous addresses", () => {
  const { parseSettings } = load();
  for (const connector of [{ token: "bad\nvalue" }, { url: "https://example.com" }, { token: 42 }])
    assert.throws(() =>
      parseSettings(JSON.stringify({ format: "hina-desktop", version: 1, settings: {}, connector }))
    );
});

test("portable settings round trip includes preferences but excludes secrets and session state", () => {
  const { exportSettings, parseSettings } = load();
  const file = exportSettings(
    {
      theme: "dark",
      pauseMediaOnDictation: true,
      keepTranscriptionInClipboard: true,
      dictationKey: "F8",
      activationMode: "tap",
      whisperModel: "large-v3-turbo",
      dictationAgentCustomApiKey: "private-value",
      isSignedIn: true,
    },
    { controlUrl: "http://127.0.0.1:18789/", transport: "wsl" }
  );
  assert.ok(!JSON.stringify(file).includes("private-value"));
  assert.ok(!JSON.stringify(file).includes("isSignedIn"));
  const parsed = parseSettings(JSON.stringify(file));
  assert.equal(parsed.settings.theme, "dark");
  assert.equal(parsed.settings.keepTranscriptionInClipboard, true);
  assert.equal(parsed.connector.transport, "wsl");
});

test("invalid settings are rejected before any setter runs", () => {
  const { parseSettings } = load();
  for (const patch of [
    { theme: "unknown" },
    { pauseMediaOnDictation: "true" },
    { micWarmHoldSeconds: -1 },
    { dictationAgentCustomApiKey: "secret" },
    { dictationAgentRemoteUrl: "http://user:password@localhost:3210" },
  ]) {
    assert.throws(() =>
      parseSettings(JSON.stringify({ format: "hina-desktop", version: 1, settings: patch }))
    );
  }
  assert.throws(() => parseSettings('{"format":"hina-desktop","version":99,"settings":{}}'));
});

test("dashboard links accept HTTP URLs without embedded secrets", () => {
  const { controlPanelUrl } = load();
  assert.equal(controlPanelUrl("http://127.0.0.1:18789"), "http://127.0.0.1:18789/");
  for (const value of [
    "file:///tmp",
    "javascript:alert(1)",
    "http://user:secret@localhost",
    "http://localhost/#token=secret",
    "http://localhost/?token=secret",
  ]) {
    assert.throws(() => controlPanelUrl(value));
  }
});

test("imports use preference setters and persist connector options without enabling it", async () => {
  const { applySettings } = load();
  const changes = [];
  const storage = new Map();
  await applySettings(
    {
      settings: { theme: "light", keepTranscriptionInClipboard: true },
      connector: { transport: "wsl", controlUrl: "http://localhost:18789/" },
    },
    {
      setTheme: (value) => changes.push(["theme", value]),
      setKeepTranscriptionInClipboard: (value) => changes.push(["clipboard", value]),
    },
    { setItem: (key, value) => storage.set(key, value) }
  );
  assert.deepEqual(changes, [
    ["theme", "light"],
    ["clipboard", true],
  ]);
  assert.equal(storage.get("hinaConnectorTransport"), "wsl");
  assert.equal(storage.has("hinaConnectorEnabled"), false);
});

test("changing an imported Connector destination requires authenticating it again", async () => {
  const { applySettings } = load();
  const storage = new Map([
    ["hinaConnectorEnabled", "true"],
    ["hinaConnectorTransport", "local"],
  ]);
  await applySettings(
    { settings: {}, connector: { transport: "wsl" } },
    {},
    {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    }
  );
  assert.equal(storage.get("hinaConnectorEnabled"), "false");
});
