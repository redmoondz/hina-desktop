const test = require("node:test");
const assert = require("node:assert/strict");
const {
  localDesktopSettings,
  persistLocalDesktopSettings,
} = require("../../src/helpers/localDesktopSettings");

test("legacy cloud preferences become local without losing the user's model and shortcuts", () => {
  const previous = {
    whisperModel: "large-v3-turbo",
    dictationKey: "F8",
    transcriptionMode: "providers",
    useLocalWhisper: false,
  };
  const current = { ...previous, ...localDesktopSettings };
  assert.equal(current.transcriptionMode, "local");
  assert.equal(current.useLocalWhisper, true);
  assert.equal(current.allowOpenAIFallback, false);
  assert.equal(current.useCleanupModel, false);
  assert.equal(current.whisperModel, "large-v3-turbo");
  assert.equal(current.dictationKey, "F8");
  assert.equal(current.dictationAgentMode, "self-hosted");
  assert.equal(current.dictationAgentModel, "hina");
  assert.equal(current.isSignedIn, false);
});

test("persisting local defaults preserves the Connector endpoint and never creates a token", () => {
  const values = new Map([
    ["dictationAgentRemoteUrl", "http://localhost:3210"],
    ["whisperModel", "large-v3-turbo"],
  ]);
  persistLocalDesktopSettings({ setItem: (key, value) => values.set(key, value) });
  assert.equal(values.get("useLocalWhisper"), "true");
  assert.equal(values.get("dictationAgentRemoteUrl"), "http://localhost:3210");
  assert.equal(values.get("whisperModel"), "large-v3-turbo");
  assert.equal(values.has("dictationAgentCustomApiKey"), false);
});
