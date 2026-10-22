const test = require("node:test");
const assert = require("node:assert/strict");
const { registerLocalIpc } = require("./harness/localIpcRegistry");

function fixture({
  audio = Buffer.from("stored recording"),
  result = { text: "Local transcript" },
} = {}) {
  const calls = [];
  const registry = registerLocalIpc({
    managers: {
      audioStorageManager: { getAudioBuffer: () => audio },
      whisperManager: {
        serverManager: { isAvailable: () => true },
        transcribeLocalWhisper: async (buffer, options) => {
          calls.push({ buffer, options });
          return result;
        },
      },
      _resolveWhisperVadOptions: () => ({}),
      databaseManager: {
        updateTranscriptionText() {},
        updateTranscriptionStatus() {},
        updateTranscriptionAudio() {},
        getTranscriptionById: () => null,
      },
    },
  });
  return { ...registry, calls };
}

test("retry overrides every legacy cloud lane and sends stored audio only to local Whisper", async () => {
  for (const transcriptionMode of ["openwhispr", "providers", "self-hosted", "enterprise"]) {
    const { invoke, calls } = fixture();
    const result = await invoke("retry-transcription", 1, {
      useLocalWhisper: false,
      transcriptionMode,
      cloudTranscriptionMode: "openwhispr",
      cloudTranscriptionProvider: "openai",
      remoteTranscriptionUrl: "https://remote.example.test",
      managed: { provider: "azure" },
      localTranscriptionProvider: "whisper",
      whisperModel: "large-v3-turbo",
      preferredLanguage: "ru",
    });
    assert.equal(result.success, true, transcriptionMode);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].buffer.toString(), "stored recording");
    assert.equal(calls[0].options.model, "large-v3-turbo");
    assert.equal(calls[0].options.language, "ru");
  }
});

test("a failed local retry never falls back to a cloud provider", async () => {
  const { invoke, calls } = fixture({ result: { success: false, error: "model unavailable" } });
  const result = await invoke("retry-transcription", 1, {
    localTranscriptionProvider: "whisper",
    whisperModel: "large-v3-turbo",
  });
  assert.equal(result.success, false);
  assert.equal(calls.length, 1);
});

test("retry without a stored recording performs no inference", async () => {
  const { invoke, calls } = fixture({ audio: null });
  const result = await invoke("retry-transcription", 1, {});
  assert.equal(result.success, false);
  assert.equal(result.error, "Audio file not found");
  assert.deepEqual(calls, []);
});
