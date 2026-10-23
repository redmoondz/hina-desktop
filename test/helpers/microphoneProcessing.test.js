const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function fixture({ fail = false, stallResume = false } = {}) {
  const raw = new EventTarget();
  raw.stops = 0;
  raw.stop = () => raw.stops++;
  raw.getSettings = () => ({ deviceId: "chosen-device" });
  const track = new EventTarget();
  track.stops = 0;
  track.stop = () => track.stops++;
  const output = { getAudioTracks: () => [track], getTracks: () => [track] };
  const input = { getAudioTracks: () => [raw], getTracks: () => [raw] };
  let state = { micGainPercent: 100, micAutoBoost: false };
  let listener;
  let unsubscribed = 0;
  let context;
  let processor;
  class Context {
    constructor() {
      context = this;
      this.closed = 0;
      this.audioWorklet = {
        addModule: async () => {
          if (fail) throw new Error("worklet failed");
        },
      };
    }
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} };
    }
    createMediaStreamDestination() {
      return { stream: output };
    }
    async resume() {
      if (stallResume) await new Promise(() => {});
    }
    async close() {
      this.closed++;
    }
  }
  class Processor {
    constructor() {
      processor = this;
      this.messages = [];
      this.port = { postMessage: (message) => this.messages.push(message), close() {} };
    }
    connect() {}
    disconnect() {}
  }
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/helpers/microphoneProcessing.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      AudioContext: Context,
      AudioWorkletNode: Processor,
      Event,
      setTimeout,
      clearTimeout,
      require(name) {
        if (name.includes("?worker")) return { default: "gain-worklet.js" };
        if (name.includes("settingsStore"))
          return {
            useSettingsStore: {
              getState: () => state,
              subscribe: (callback) => {
                listener = callback;
                return () => unsubscribed++;
              },
            },
          };
        if (name.includes("microphoneSelection")) return {};
        throw new Error(name);
      },
    }
  );
  return {
    ...exports,
    input,
    raw,
    track,
    get context() {
      return context;
    },
    get processor() {
      return processor;
    },
    get unsubscribed() {
      return unsubscribed;
    },
    update: (next) => {
      const previous = state;
      state = next;
      listener(next, previous);
    },
  };
}

test("stopping the processed stream releases the original mic and context exactly once", async () => {
  const f = fixture();
  const stream = await f.processMicrophoneStream(f.input);
  assert.equal(stream.getAudioTracks()[0].getSettings().deviceId, "chosen-device");
  stream.getTracks()[0].stop();
  stream.getTracks()[0].stop();
  assert.equal(f.raw.stops, 1);
  assert.equal(f.context.closed, 1);
  assert.equal(f.unsubscribed, 1);
});

test("a worklet startup failure releases the microphone", async () => {
  const f = fixture({ fail: true });
  await assert.rejects(f.processMicrophoneStream(f.input), /worklet failed/);
  assert.equal(f.raw.stops, 1);
  assert.equal(f.context.closed, 1);
});

test("device loss is forwarded to recovery and releases processing", async () => {
  const f = fixture();
  const stream = await f.processMicrophoneStream(f.input);
  let ended = 0;
  stream.getAudioTracks()[0].addEventListener("ended", () => ended++);
  f.raw.dispatchEvent(new Event("ended"));
  assert.equal(ended, 1);
  assert.equal(f.context.closed, 1);
});

test("gain updates reach the live worklet without reopening the mic", async () => {
  const f = fixture();
  const stream = await f.processMicrophoneStream(f.input);
  f.update({ micAutoBoost: true, micGainPercent: 100 });
  assert.equal(f.processor.messages.length, 1);
  assert.equal(f.processor.messages[0].micAutoBoost, true);
  stream.getTracks()[0].stop();
});

test("raw mute state and events remain visible to device recovery", async () => {
  const f = fixture();
  f.raw.muted = false;
  const stream = await f.processMicrophoneStream(f.input);
  const track = stream.getAudioTracks()[0];
  let muted = 0;
  track.addEventListener("mute", () => {
    if (track.muted) muted++;
  });
  f.raw.muted = true;
  f.raw.dispatchEvent(new Event("mute"));
  assert.equal(track.muted, true);
  assert.equal(muted, 1);
  f.raw.muted = false;
  f.raw.dispatchEvent(new Event("unmute"));
  assert.equal(track.muted, false);
  track.stop();
});

test("a hung audio context resume fails within a bounded time and releases the input", async () => {
  const f = fixture({ stallResume: true });
  await assert.rejects(f.processMicrophoneStream(f.input), /did not start/);
  assert.equal(f.raw.stops, 1);
  assert.equal(f.context.closed, 1);
  assert.equal(f.track.stops, 1);
  assert.equal(f.unsubscribed, 1);
});
