const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

test("local renderer startup releases recording hotkeys without a login", async () => {
  const { initializeLocalRenderer } = require("../../src/helpers/hinaRendererStartup");
  const values = new Map();
  const calls = [];
  await initializeLocalRenderer({
    storage: { setItem: (key, value) => values.set(key, value) },
    api: {
      setOnboardingActive: async (active) => calls.push(["hotkeys", active]),
      setOnboardingWindowMode: async (mode) => calls.push(["window", mode]),
    },
    isControlPanel: true,
  });
  assert.equal(values.get("onboardingCompleted"), "true");
  assert.deepEqual(calls, [
    ["hotkeys", false],
    ["window", "restore"],
  ]);
});

test("the production renderer cannot route into accounts or removed workspace surfaces", () => {
  const router = readFileSync("src/AppRouter.jsx", "utf8");
  for (const removed of [
    "useAuth",
    "SyncService",
    "OnboardingFlow",
    "ReauthenticationScreen",
    "ControlPanel.tsx",
    "MeetingNotificationOverlay",
  ]) {
    assert.equal(router.includes(removed), false, `Removed route dependency: ${removed}`);
  }
  assert.match(router, /HinaSettings/);
  assert.match(router, /<App\s*\/>/);
  assert.match(router, /initializeLocalRenderer/);
});

test("local settings expose local model management and Hina without generic provider configuration", () => {
  const panel = readFileSync("src/components/HinaSettings.tsx", "utf8");
  for (const capability of [
    "LocalWhisperPicker",
    "MicrophoneSettings",
    "HotkeyInput",
    "HinaConnectorSettings",
    "HinaGpuSettings",
    "setAutoStartEnabled",
  ]) {
    assert.ok(panel.includes(capability), `Missing local capability: ${capability}`);
  }
  for (const removed of [
    "SettingsModal",
    "TranscriptionModelPicker",
    "useAuth",
    "UpgradePrompt",
    "IntegrationsView",
    "ChatView",
  ]) {
    assert.equal(panel.includes(removed), false, `Unexpected hosted capability: ${removed}`);
  }
});
