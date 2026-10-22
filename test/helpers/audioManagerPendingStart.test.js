const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAudioManager } = require("./harness/audioManager");
const { deferred } = require("./harness/deferred");

test("Stop releases streaming capture while the provider connection is still pending", async (t) => {
  const { createManager } = await loadAudioManager(t, {
    cachePrefix: "hina-stop-pending-provider-",
    settingsKey: "__stopPendingProviderSettings",
  });
  const calls = [];
  const manager = createManager({
    streamingStartInProgress: true,
    isStreaming: true,
    isRecording: true,
    streamingStream: { getTracks: () => [{ stop: () => calls.push("track-stop") }] },
    streamingSource: { disconnect: () => calls.push("disconnect") },
    micRecovery: { stop: () => calls.push("recovery-stop") },
    _markCaptureStreamReleased: () => calls.push("released"),
    onStateChange: (state) => calls.push(state),
  });
  assert.equal(await manager.stopStreamingRecording(), true);
  assert.equal(manager.stopRequestedDuringStreamingStart, true);
  assert.equal(manager.isRecording, false);
  assert.equal(manager.isProcessing, true);
  assert.deepEqual(calls, [
    "recovery-stop",
    "track-stop",
    "released",
    "disconnect",
    { isRecording: false, isProcessing: true, isStreaming: true },
  ]);
});

for (const method of ["startRecording", "startStreamingRecording"]) {
  for (const outcome of ["opens", "fails"]) {
    test(`${method} abandons a microphone that ${outcome} after the user stops`, async (t) => {
      const { createManager } = await loadAudioManager(t, {
        cachePrefix: "hina-pending-recording-start-",
        settingsKey: "__pendingRecordingStartSettings",
      });
      const acquisition = deferred();
      const acquiring = deferred();
      let stopped = 0;
      let dropped = 0;
      let preparedCancelled = 0;
      let acquisitions = 0;
      const manager = createManager({
        isRecordingAllowedByPolicy: () => true,
        _beginActivationCapture: async () => true,
        _cancelActivationCapture() {},
        preparedMicCapture: {
          take: async () => null,
          cancel: () => preparedCancelled++,
        },
        micStreamHold: { drop: () => dropped++ },
        getAudioConstraints: async () => ({ audio: true }),
        _startPcmTap: () => null,
        _acquireCaptureStream: () => {
          acquisitions++;
          acquiring.resolve();
          return acquisition.promise.then((value) => {
            if (value instanceof Error) throw value;
            return value;
          });
        },
        _markCaptureStreamReleased() {},
        _settleStreamingStart() {
          this.streamingStartInProgress = false;
        },
        getStreamingProviderName: () => "test",
        onError: (error) => assert.fail(`A stopped start must not report an error: ${error.title}`),
      });
      const starting = manager[method]();
      await acquiring.promise;
      manager.cancelPendingRecordingStart();
      if (outcome === "opens") {
        acquisition.resolve({ getTracks: () => [{ stop: () => stopped++ }] });
      } else {
        acquisition.resolve(
          Object.assign(new Error("Disconnected microphone"), { name: "NotFoundError" })
        );
      }
      assert.equal(await starting, false);
      assert.equal(acquisitions, 1, "a canceled start must never retry the microphone");
      assert.equal(stopped, outcome === "opens" ? 1 : 0);
      assert.ok(dropped > 0);
      assert.equal(preparedCancelled, 1);
      assert.equal(manager._startInProgress, false);
    });
  }
}

test("batch stop releases the microphone before the recorder's asynchronous stop event", async (t) => {
  const { createManager } = await loadAudioManager(t, {
    cachePrefix: "hina-immediate-recording-stop-",
    settingsKey: "__immediateRecordingStopSettings",
  });
  const order = [];
  const manager = createManager({
    micRecovery: { stop() {} },
    mediaRecorder: {
      state: "recording",
      stop: () => order.push("recorder-stop"),
      stream: { getTracks: () => [{ stop: () => order.push("track-stop") }] },
    },
    _markCaptureStreamReleased: () => order.push("released"),
  });
  assert.equal(manager.stopRecording(), true);
  assert.deepEqual(order, ["recorder-stop", "track-stop", "released"]);
});
