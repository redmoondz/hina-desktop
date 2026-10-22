const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { createRoot } = require("react-dom/client");
const {
  createRendererServer,
  installBrowserGlobals,
  installHookDom,
} = require("../lib/rendererTestHarness");
const { deferred } = require("./harness/deferred");

for (const action of ["stopRecording", "cancelRecording"]) {
  test(`${action} during target capture abandons preparation without reopening the mic`, async (t) => {
    let root;
    t.after(async () => {
      if (root) await React.act(async () => root.unmount());
    });
    const target = deferred();
    const calls = { starts: 0, cancellations: 0 };
    globalThis.__preparationStopCalls = calls;
    t.after(() => delete globalThis.__preparationStopCalls);
    installBrowserGlobals(t, {
      window: {
        electronAPI: {
          onToggleDictation: () => () => {},
          captureDictationTarget: () => target.promise,
        },
      },
    });
    const container = installHookDom(t);
    globalThis.requestAnimationFrame = (callback) => {
      callback();
      return 1;
    };
    const vite = await createRendererServer(t, {
      cachePrefix: "hina-preparation-stop-",
      mockModules: {
        "/helpers/audioManager": `
          export default class AudioManager {
            constructor() { this.sttConfig = {}; }
            getState() { return {}; }
            setCallbacks() {}
            prepareMicCapture() {}
            cancelPreparedMicCapture() { globalThis.__preparationStopCalls.cancellations++; }
            setVoiceAgentRequested() {}
            setAssistantSelectionContext() {}
            setTranslationRequested() {}
            isSttConfigStale() { return false; }
            shouldUseStreaming() { return false; }
            async startRecording() { globalThis.__preparationStopCalls.starts++; return false; }
            cancelRecording() { return false; }
            cleanup() {}
          }
        `,
      },
    });
    const { useAudioRecording } = await vite.ssrLoadModule("/hooks/useAudioRecording.js");
    let api;
    function Harness() {
      api = useAudioRecording(() => {}, { onDemoEvent: () => {} });
      return null;
    }
    root = createRoot(container);
    await React.act(async () => root.render(React.createElement(Harness)));
    let starting;
    await React.act(async () => {
      starting = api.startRecording();
      await Promise.resolve();
    });
    await React.act(async () => api[action]());
    await React.act(async () => {
      target.resolve();
      await starting;
    });
    assert.equal(calls.starts, 0);
    assert.ok(calls.cancellations > 0);
    assert.equal(api.isPreparing, false);
  });
}
