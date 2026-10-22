const test = require("node:test");
const assert = require("node:assert/strict");
const { BYOK_API_KEYS } = require("../../src/config/secretKeys");
const {
  isBlockedLocalOnlyChannel,
  createLocalOnlyIpc,
  shouldStartInTray,
} = require("../../src/helpers/localOnlyPolicy");

test("legacy remote inference, login, billing and integration requests are blocked", () => {
  const channels = [
    "download-diarization-models",
    "get-diarization-model-status",
    "request-system-audio-access",
    "cloud-transcribe",
    "cloud-reason",
    "cloud-agent-stream-start",
    "cloud-api-request",
    "transcribe-audio-file-cloud",
    "transcribe-audio-file-byok",
    "managed-transcribe",
    "proxy-xai-transcription",
    "process-anthropic-reasoning",
    "enterprise-stream-start",
    "process-enterprise-reasoning",
    "dictation-realtime-start",
    "assemblyai-streaming-start",
    "deepgram-streaming-warmup",
    "gemini-streaming-start",
    "corti-streaming-start",
    "auth-set-token",
    "auth-get-token",
    "cloud-checkout",
    "cloud-billing-portal",
    "get-stt-config",
    "get-workspace-policy",
    "get-managed-enterprise-config",
    "get-note-recording-config",
    "get-tinfoil-chat-models",
    "bedrock-list-models",
    "test-provider-connection",
    "test-enterprise-connection",
    "agent-web-search",
    "gcal-start-oauth",
    "mcal-start-oauth",
    "acal-connect",
    "connector-connect",
    "meeting-transcription-start",
    "update-translation-hotkey",
    "register-meeting-hotkey",
    "get-referral-stats",
    "download-url-audio",
    "check-for-updates",
    "set-auto-updates-enabled",
    ...BYOK_API_KEYS.filter(({ base }) => base !== "dictation-agent-custom").flatMap(({ base }) => [
      `get-${base}-key`,
      `save-${base}-key`,
    ]),
  ];
  for (const channel of channels) assert.equal(isBlockedLocalOnlyChannel(channel), true, channel);
});

test("local models, GPU downloads, hotkeys, clipboard and Hina remain usable", () => {
  for (const channel of [
    "get-dictation-agent-custom-key",
    "save-dictation-agent-custom-key",
    "hina-connector-request",
    "transcribe-local-whisper",
    "transcribe-local-parakeet",
    "transcribe-audio-file",
    "download-whisper-model",
    "download-cuda-whisper-binary",
    "whisper-server-start",
    "whisper-gpu-retry",
    "model-download",
    "llama-server-start",
    "process-local-reasoning",
    "paste-text",
    "update-hotkey",
    "get-dictation-key",
    "save-dictation-key",
    "get-voice-agent-key",
    "analytics-get-summary",
    "analytics-record-event",
    "open-settings-section",
    "get-active-account-scope",
  ])
    assert.equal(isBlockedLocalOnlyChannel(channel), false, channel);
});

test("denied handlers and event listeners cannot perform work or access credentials", () => {
  const handles = new Map();
  const listeners = new Map();
  const ipc = createLocalOnlyIpc({
    handle: (channel, fn) => handles.set(channel, fn),
    on: (channel, fn) => listeners.set(channel, fn),
  });
  const forbidden = () => assert.fail("remote handler executed");
  ipc.handle("cloud-checkout", forbidden);
  ipc.on("cloud-agent-stream-start", forbidden);
  assert.equal(handles.get("cloud-checkout")().code, "LOCAL_ONLY");
  assert.equal(handles.get("cloud-checkout")().success, false);
  listeners.get("cloud-agent-stream-start")({});
  ipc.handle("hina-connector-request", (event, text) => text);
  assert.equal(handles.get("hina-connector-request")({}, "hello"), "hello");
});

test("startup is tray-first unless settings were explicitly requested", () => {
  assert.equal(shouldStartInTray([]), true);
  assert.equal(shouldStartInTray(["app.exe", "--hidden"]), true);
  assert.equal(shouldStartInTray(["app.exe", "--settings"]), false);
});

test("startup restores only dictation and the local agent shortcuts", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const main = fs.readFileSync(path.join(__dirname, "../../main.js"), "utf8");
  const restored = [...main.matchAll(/hotkeyManager\.registerSlot\(\s*"([^"]+)"/g)].map(
    (match) => match[1]
  );
  assert.deepEqual(restored, ["voiceAgent"]);
  assert.equal(main.includes("getTranslationKey"), false);
  assert.equal(main.includes("getMeetingKey"), false);
});
