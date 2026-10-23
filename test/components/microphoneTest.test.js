const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { installBrowserGlobals, installHookDom } = require("../lib/rendererTestHarness");

async function mount(t, openMicrophone) {
  let root;
  t.after(() => React.act(async () => root?.unmount()));
  installBrowserGlobals(t);
  const container = installHookDom(t);
  const revoked = [];
  const recorders = [];
  const timers = [];
  class Recorder {
    constructor() {
      this.state = "inactive";
      this.mimeType = "audio/webm";
      recorders.push(this);
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["audio"]) });
      this.onstop?.();
    }
  }
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/hooks/useMicrophoneTest.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      Blob,
      MediaRecorder: Recorder,
      URL: { createObjectURL: () => "blob:test", revokeObjectURL: (url) => revoked.push(url) },
      setTimeout: (fn, ms) => {
        timers.push({ fn, ms });
        return timers.length;
      },
      clearTimeout() {},
      require: (name) => (name === "react" ? React : { openMicrophone }),
    }
  );
  let current;
  function Harness({ deviceKey }) {
    current = exports.useMicrophoneTest(deviceKey);
    return null;
  }
  root = createRoot(container);
  const render = async (deviceKey) =>
    React.act(async () => root.render(React.createElement(Harness, { deviceKey })));
  await render("first");
  return {
    get current() {
      return current;
    },
    revoked,
    timers,
    recorders,
    render,
    unmount: () => React.act(async () => root.unmount()),
  };
}

const stream = () => {
  const track = new EventTarget();
  track.stopped = 0;
  track.stop = () => track.stopped++;
  return { track, getTracks: () => [track], getAudioTracks: () => [track] };
};

test("local test records processed input, stops the mic and revokes playback when device changes", async (t) => {
  const input = stream();
  let meter;
  const f = await mount(t, async (onLevel) => {
    meter = onLevel;
    return input;
  });
  await React.act(async () => f.current.start());
  assert.equal(f.current.status, "recording");
  await React.act(async () => meter({ rms: 0.2, peak: 0.5, gain: 2 }));
  assert.equal(f.current.level.peak, 0.5);
  assert.equal(f.timers[0].ms, 60000);
  await React.act(async () => f.current.stop());
  assert.equal(f.current.status, "idle");
  assert.equal(f.current.playbackUrl, "blob:test");
  assert.ok(input.track.stopped > 0);
  await f.render("second");
  assert.equal(f.current.playbackUrl, "");
  assert.deepEqual(f.revoked, ["blob:test"]);
});

test("an input resolving after leaving the settings is immediately stopped", async (t) => {
  let resolve;
  const pending = new Promise((r) => {
    resolve = r;
  });
  const f = await mount(t, () => pending);
  let start;
  await React.act(async () => {
    start = f.current.start();
  });
  await f.unmount();
  const input = stream();
  await React.act(async () => {
    resolve(input);
    await start;
  });
  assert.equal(input.track.stopped, 1);
  assert.equal(f.recorders.length, 0);
});

test("permission failure returns to idle and allows another attempt", async (t) => {
  let denied = true;
  const f = await mount(t, async () => {
    if (denied) throw new Error("denied");
    return stream();
  });
  await React.act(async () => f.current.start());
  assert.equal(f.current.status, "idle");
  assert.equal(f.current.failed, true);
  denied = false;
  await React.act(async () => f.current.start());
  assert.equal(f.current.status, "recording");
  assert.equal(f.current.failed, false);
});
