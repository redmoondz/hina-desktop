const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { installBrowserGlobals, installHookDom } = require("../lib/rendererTestHarness");
const gpuExports = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/utils/whisperGpuPack.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: gpuExports }
);
const { pickWhisperGpuBackend } = gpuExports;

function find(node, predicate) {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== "object") return null;
  return predicate(node) ? node : find(node.props?.children, predicate);
}

async function mount(t, file, api, props = {}) {
  let root;
  t.after(() => React.act(async () => root?.unmount()));
  installBrowserGlobals(t, { window: { electronAPI: api } });
  const container = installHookDom(t);
  const exports = {};
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const dashboard = () => null;
  vm.runInNewContext(outputText, {
    exports,
    window: globalThis.window,
    setInterval: () => 1,
    clearInterval: () => {},
    require(name) {
      if (name === "react" || name === "react/jsx-runtime") return require(name);
      if (name === "react-i18next")
        return { useTranslation: () => ({ t: (key) => key, i18n: { language: "en" } }) };
      if (name.endsWith("whisperGpuPack")) return { pickWhisperGpuBackend };
      if (name.endsWith("UsageDashboard")) return { UsageDashboard: dashboard };
      if (name.endsWith("button")) return { Button: "button" };
      if (name.endsWith("/icons"))
        return { BarChart3: "chart", Flame: "flame", Gauge: "gauge", Mic2: "mic" };
      if (name.endsWith("/analytics")) return require("../../src/helpers/analytics.js");
      if (name.endsWith("/lib/utils")) return { cn: (...parts) => parts.filter(Boolean).join(" ") };
      if (name.endsWith("/skeleton")) return { Skeleton: "skeleton" };
      if (name.endsWith("/tooltip")) return { Tooltip: "tooltip" };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  let tree;
  function Harness() {
    tree = (exports.default ?? exports.UsageDashboard)(props);
    return null;
  }
  root = createRoot(container);
  await React.act(async () => root.render(React.createElement(Harness)));
  return { find: (predicate) => find(tree, predicate), dashboard };
}

const cuda = {
  downloaded: false,
  downloading: false,
  path: null,
  gpuInfo: { hasNvidiaGpu: false },
};
const vulkan = {
  downloaded: true,
  downloading: false,
  inUse: true,
  vulkan: { available: true },
  hasNvidiaGpu: false,
};

test("GPU reinstall and remove act on the Vulkan pack selected by main", async (t) => {
  const calls = [];
  const panel = await mount(t, "src/components/settings/HinaGpuSettings.tsx", {
    getCudaWhisperStatus: async () => cuda,
    getVulkanWhisperStatus: async () => vulkan,
    whisperServerStatus: async () => ({ gpuAccelerated: true, gpuBackend: "vulkan" }),
    downloadVulkanWhisperBinary: async () => {
      calls.push("download-vulkan");
      return { success: true };
    },
    deleteVulkanWhisperBinary: async () => {
      calls.push("remove-vulkan");
      return { success: true };
    },
  });
  const click = async (label) => {
    const button = panel.find((node) => node.props?.children === label && node.props.onClick);
    assert.ok(button, label);
    await React.act(async () => button.props.onClick());
  };
  await click("Reinstall GPU pack");
  assert.deepEqual(calls, ["download-vulkan"]);
  await click("Remove GPU pack");
  assert.deepEqual(calls, ["download-vulkan", "remove-vulkan"]);
});

test("local statistics show actual zero usage without requesting an account", async (t) => {
  let reads = 0;
  const summary = {
    totalWords: 0,
    totalDictations: 0,
    totalSpokenDurationMs: 0,
    averageWpm: null,
    currentStreakDays: 0,
    longestStreakDays: 0,
    wpmCoveragePercent: 0,
    daily: [],
  };
  const panel = await mount(t, "src/components/settings/HinaDictationStats.tsx", {
    getAnalyticsSummary: async () => {
      reads++;
      return summary;
    },
  });
  assert.equal(reads, 1);
  assert.equal(panel.find((node) => node.type === panel.dashboard)?.props.summary, summary);
});

test("failed GPU reinstall displays the IPC error and preserves remove access", async (t) => {
  const panel = await mount(t, "src/components/settings/HinaGpuSettings.tsx", {
    getCudaWhisperStatus: async () => cuda,
    getVulkanWhisperStatus: async () => vulkan,
    whisperServerStatus: async () => ({ gpuAccelerated: false }),
    downloadVulkanWhisperBinary: async () => ({ success: false, error: "Download interrupted" }),
  });
  const button = panel.find((node) => node.props?.children === "Reinstall GPU pack");
  await React.act(async () => button.props.onClick());
  assert.equal(
    panel.find((node) => node.props?.role === "alert")?.props.children,
    "Download interrupted"
  );
  assert.equal(
    panel.find((node) => node.props?.children === "Remove GPU pack")?.props.disabled,
    false
  );
});

test("the standalone usage dashboard displays zero counts and unknown speed without account services", async (t) => {
  const panel = await mount(
    t,
    "src/components/UsageDashboard.tsx",
    {},
    {
      summary: {
        totalWords: 0,
        totalDictations: 0,
        averageWpm: null,
        currentStreakDays: 0,
        longestStreakDays: 0,
        wpmCoveragePercent: 0,
        daily: [],
      },
    }
  );
  assert.equal(
    panel.find((node) => node.props?.label === "insights.wordsSpoken")?.props.value,
    "0"
  );
  assert.equal(panel.find((node) => node.props?.label === "insights.dictations")?.props.value, "0");
  assert.equal(
    panel.find((node) => node.props?.label === "insights.wordsPerMinute")?.props.value,
    "—"
  );
});
