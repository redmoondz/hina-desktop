const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAudioManager } = require("./harness/audioManager");

test("dictation and assistant capture disable native AGC in favor of shared application gain", async (t) => {
  const { createManager, window } = await loadAudioManager(t, {
    cachePrefix: "hina-windows-capture-gain-",
    settingsKey: "__hinaWindowsCaptureGainSettings",
  });
  window.electronAPI.localOnly = true;
  window.electronAPI.getPlatform = () => "win32";
  for (const voiceAgentRequested of [false, true]) {
    const manager = createManager({ cachedMicDeviceId: "selected-mic", voiceAgentRequested });
    const { audio } = await manager.getAudioConstraints();
    assert.equal(audio.autoGainControl, false);
    assert.equal(audio.echoCancellation, false);
    assert.equal(audio.noiseSuppression, false);
    assert.equal(audio.channelCount, 2);
    assert.deepEqual(audio.deviceId, { exact: "selected-mic" });
  }
});

test("other platforms and upstream Windows capture retain their processing settings", async (t) => {
  const { createManager, window } = await loadAudioManager(t, {
    cachePrefix: "hina-other-capture-gain-",
    settingsKey: "__hinaOtherCaptureGainSettings",
  });
  for (const [platform, localOnly] of [
    ["linux", true],
    ["darwin", true],
    ["win32", false],
  ]) {
    window.electronAPI.localOnly = localOnly;
    window.electronAPI.getPlatform = () => platform;
    const manager = createManager({ cachedMicDeviceId: "selected-mic" });
    assert.equal((await manager.getAudioConstraints()).audio.autoGainControl, false);
  }
});
