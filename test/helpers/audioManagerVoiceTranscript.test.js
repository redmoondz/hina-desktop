const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAudioManager } = require("./harness/audioManager");

test("punctuation-only speech recognition does not become an assistant command", async (t) => {
  const { createManager } = await loadAudioManager(t, {
    cachePrefix: "hina-voice-empty-transcript-",
    settingsKey: "__hinaVoiceEmptyTranscriptSettings",
  });
  const manager = createManager({ voiceAgentRequested: true });
  for (const text of [".", " … ", "?!", "\n---\n"]) {
    assert.equal(await manager.processTranscriptionCore(text, "local", () => true), "");
  }
});

test("spoken words and numbers remain valid in every supported script", async (t) => {
  const { createManager } = await loadAudioManager(t, {
    cachePrefix: "hina-voice-valid-transcript-",
    settingsKey: "__hinaVoiceValidTranscriptSettings",
  });
  const manager = createManager({ voiceAgentRequested: true });
  for (const text of [" Привет! ", "Hello", "你好", "مرحبا", "42"]) {
    assert.equal(await manager.processTranscriptionCore(text, "local", () => true), text.trim());
  }
});

test("ordinary dictation retains punctuation-only transcripts", async (t) => {
  const { createManager } = await loadAudioManager(t, {
    cachePrefix: "hina-dictation-punctuation-",
    settingsKey: "__hinaDictationPunctuationSettings",
  });
  const manager = createManager({ voiceAgentRequested: false });
  assert.equal(await manager.processTranscriptionCore(" . ", "local", () => true), ".");
});
