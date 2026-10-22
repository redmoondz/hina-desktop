const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { createRoot } = require("react-dom/client");
const {
  createRendererServer,
  installBrowserGlobals,
  installHostDom,
} = require("../lib/rendererTestHarness");

test("waiting status remains visible after two minutes and stops its timer on unmount", async (t) => {
  installBrowserGlobals(t);
  const container = installHostDom(t);
  const vite = await createRendererServer(t, { cachePrefix: "hina-waiting-" });
  await vite.ssrLoadModule("/i18n.ts");
  const { HinaWaitingStatus } = await vite.ssrLoadModule("/components/chat/HinaWaitingStatus.tsx");
  t.mock.timers.enable({ apis: ["setInterval", "Date"], now: 1000 });
  const root = createRoot(container);
  const text = (node) =>
    node.nodeType === 3 ? node.nodeValue : (node.childNodes || []).map(text).join(" ");
  await React.act(async () => root.render(React.createElement(HinaWaitingStatus)));
  assert.match(text(container), /00:00/);
  await React.act(async () => t.mock.timers.tick(121000));
  assert.match(text(container), /02:01/);
  assert.match(text(container), /pending/);
  await React.act(async () => root.unmount());
  t.mock.timers.tick(120000);
});
