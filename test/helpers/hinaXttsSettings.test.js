const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { installBrowserGlobals, installHookDom } = require("../lib/rendererTestHarness");

function find(node, predicate) {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== "object") return null;
  return predicate(node) ? node : find(node.props?.children, predicate);
}
async function mount(t, api = {}, initialStorage = {}, parent = false) {
  let root;
  t.after(() => React.act(async () => root?.unmount()));
  const { storage } = installBrowserGlobals(t, { initialStorage, window: { electronAPI: api } });
  const container = installHookDom(t);
  const exports = {};
  const calls = [];
  const translate = (key) => key;
  const file = parent ? "HinaSpeechSettings" : "XttsSpeechSettings";
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(`src/components/settings/${file}.tsx`, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      window: globalThis.window,
      localStorage: storage,
      require(name) {
        if (name === "react" || name === "react/jsx-runtime") return require(name);
        if (name === "react-i18next") return { useTranslation: () => ({ t: translate }) };
        if (name.endsWith("/button")) return { Button: "button" };
        if (name.endsWith("/XttsSpeechSettings"))
          return { __esModule: true, default: "xtts-settings" };
        if (name.endsWith("/hinaSpeechPlayback"))
          return {
            speakHinaReply: async (text) => {
              calls.push(text);
              return { ok: true };
            },
            stopHinaReply: async () => {
              calls.push("stop");
              return { ok: true };
            },
          };
        throw new Error(`Unexpected import ${name}`);
      },
    }
  );
  let tree;
  function Harness() {
    tree = exports.default();
    return null;
  }
  root = createRoot(container);
  await React.act(async () => root.render(React.createElement(Harness)));
  return { find: (predicate) => find(tree, predicate), storage, calls };
}
const label = (key) => (node) =>
  node.type === "button" && node.props.children === `hinaSettings.${key}`;

test("XTTS installation is explicit, license gated and starts no automatic downloads", async (t) => {
  const installs = [];
  const ui = await mount(t, {
    hinaXttsStatus: async () => ({ ok: true, installed: false, installing: false }),
    hinaXttsInstall: async (options) => {
      installs.push(options);
      return { ok: true };
    },
  });
  assert.equal(installs.length, 0);
  assert.equal(ui.find(label("xttsInstall")).props.disabled, true);
  await React.act(async () =>
    ui
      .find((node) => node.type === "input" && node.props.type === "checkbox")
      .props.onChange({ target: { checked: true } })
  );
  assert.equal(ui.find(label("xttsInstall")).props.disabled, false);
  await React.act(async () => ui.find(label("xttsInstall")).props.onClick());
  assert.equal(installs.length, 1);
  assert.equal(installs[0].acceptLicense, true);
  assert.equal(installs[0].device, "cpu");
});

test("XTTS voice sample and speed persist; selecting a built-in voice clears the sample", async (t) => {
  const ui = await mount(t, {
    hinaXttsStatus: async () => ({ ok: true, installed: true, installing: false }),
    hinaXttsSelectFile: async () => ({ canceled: false, path: "/voices/my voice.wav" }),
    hinaXttsVoices: async () => ({ ok: true, voices: [{ id: "Voice", name: "Voice" }] }),
  });
  await React.act(async () => ui.find(label("xttsChooseReference")).props.onClick());
  assert.equal(ui.storage.getItem("hinaSpeechReference"), "/voices/my voice.wav");
  await React.act(async () =>
    ui
      .find((node) => node.type === "input" && node.props.min === 0.5)
      .props.onChange({ target: { value: "1.3" } })
  );
  assert.equal(ui.storage.getItem("hinaSpeechSpeed"), "1.3");
  await React.act(async () => ui.find(label("xttsCheck")).props.onClick());
  await React.act(async () =>
    ui
      .find((node) => node.type === "select" && node.props.value === "__reference__")
      .props.onChange({ target: { value: "Voice" } })
  );
  assert.equal(ui.storage.getItem("hinaSpeechXttsVoice"), "Voice");
  assert.equal(ui.storage.getItem("hinaSpeechReference"), null);
  await React.act(async () => ui.find(label("speechTest")).props.onClick());
  assert.match(ui.calls[0], /Привет/);
});

test("engine selection persists and stops existing playback", async (t) => {
  const ui = await mount(
    t,
    {
      hinaSpeechVoices: async () => ({
        ok: true,
        voices: [{ id: "Windows", name: "Windows", language: "ru-RU" }],
      }),
    },
    {},
    true
  );
  await React.act(async () =>
    ui
      .find((node) => node.type === "select" && node.props.value === "windows")
      .props.onChange({ target: { value: "xtts" } })
  );
  assert.equal(ui.storage.getItem("hinaSpeechEngine"), "xtts");
  assert.equal(ui.calls[0], "stop");
  assert.ok(ui.find((node) => node.type === "xtts-settings"));
});
