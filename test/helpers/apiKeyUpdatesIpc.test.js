const test = require("node:test");
const assert = require("node:assert/strict");
const { BYOK_API_KEYS } = require("../../src/config/secretKeys");
const { registerLocalIpc } = require("./harness/localIpcRegistry");

const keys = new Map();
const environmentManager = Object.fromEntries(
  BYOK_API_KEYS.flatMap(({ get, save, storeKey }) => [
    [get, () => keys.get(storeKey) || ""],
    [
      save,
      (key) => {
        keys.set(storeKey, key);
        return { success: true };
      },
    ],
  ])
);
const registry = registerLocalIpc({ environmentManager });

test("all cloud credential setters are denied without persistence or broadcasts", () => {
  for (const { base } of BYOK_API_KEYS.filter(({ base }) => base !== "dictation-agent-custom")) {
    const result = registry.invoke(`save-${base}-key`, "must-not-persist");
    assert.equal(result.code, "LOCAL_ONLY", base);
    assert.equal(result.success, false, base);
  }
  for (const suffix of [
    "corti-client-id",
    "corti-client-secret",
    "custom-transcription-key",
    "cleanup-custom-key",
    "bedrock-access-key-id",
    "bedrock-secret-access-key",
    "bedrock-session-token",
    "azure-api-key",
    "vertex-api-key",
  ]) {
    assert.equal(registry.invoke(`save-${suffix}`, "must-not-persist").code, "LOCAL_ONLY");
  }
  assert.equal(keys.size, 0);
  assert.deepEqual(registry.notifications, []);
});

test("the local Hina bearer token persists and broadcasts only its setting name", () => {
  for (const value of ["connector-test-token", ""]) {
    registry.notifications.length = 0;
    assert.deepEqual(registry.invoke("save-dictation-agent-custom-key", value), { success: true });
    assert.equal(registry.invoke("get-dictation-agent-custom-key"), value);
    assert.deepEqual(registry.notifications, [["api-key-updated", "dictationAgentCustomApiKey"]]);
    registry.notifications.length = 0;
    registry.invoke("save-dictation-agent-custom-key", value);
    assert.deepEqual(registry.notifications, []);
  }
  assert.throws(
    () => registry.invoke("save-dictation-agent-custom-key", { token: "invalid" }),
    TypeError
  );
});

test("removed streaming warmups and starts never wait for provider tokens", async () => {
  for (const prefix of [
    "assemblyai-streaming",
    "deepgram-streaming",
    "corti-streaming",
    "gemini-streaming",
    "dictation-realtime",
    "meeting-transcription",
  ]) {
    for (const action of prefix === "meeting-transcription"
      ? ["prepare", "start"]
      : ["warmup", "start"]) {
      for (const mode of ["byok", "openwhispr"]) {
        const result = await registry.invoke(`${prefix}-${action}`, { mode });
        assert.equal(result.code, "LOCAL_ONLY", `${prefix}-${action} ${mode}`);
        assert.equal(result.success, false);
      }
    }
  }
});
