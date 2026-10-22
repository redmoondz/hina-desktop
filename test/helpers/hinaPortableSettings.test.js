const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => require("../../src/helpers/hinaPortableSettings");

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
