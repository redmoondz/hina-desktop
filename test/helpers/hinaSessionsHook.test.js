const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { createRoot } = require("react-dom/client");
const {
  createRendererServer,
  installBrowserGlobals,
  installHostDom,
} = require("../lib/rendererTestHarness");

test("closing a pending submission preserves its result in history and sends the next message to a new session", async (t) => {
  const actions = [];
  let resolveSend;
  let saved = [];
  installBrowserGlobals(t, {
    initialStorage: { hinaConnectorEnabled: "true" },
    window: {
      electronAPI: {
        async getDictationAgentCustomKey() {
          return "test-token";
        },
        async hinaConnectorRequest(args) {
          actions.push(args);
          if (args.sessionAction === "list") return { ok: true, sessions: saved };
          if (args.sessionAction === "close") return { ok: true };
          return new Promise((resolve) => {
            resolveSend = () => {
              const session = {
                id: args.sessionId,
                messages: [{ id: args.requestId, text: args.text, status: "running" }],
              };
              saved = [session];
              resolve({ ok: true, session });
            };
          });
        },
      },
    },
  });
  const container = installHostDom(t);
  const vite = await createRendererServer(t, {
    mockModules: {
      "/stores/settingsStore": `export function getSettings() { return { dictationAgentRemoteUrl: "http://127.0.0.1:3210" }; }`,
      "react-i18next": `const t = key => key; export function useTranslation() { return { t }; }`,
    },
  });
  const { useHinaSessions } = await vite.ssrLoadModule("/hooks/useHinaSessions.js");
  let model;
  function Probe() {
    model = useHinaSessions(true);
    return null;
  }
  const root = createRoot(container);
  try {
    await React.act(async () => root.render(React.createElement(Probe)));
    let first;
    await React.act(async () => {
      first = model.send("first question");
    });
    const firstId = model.activeId;
    await React.act(async () => model.close());
    assert.equal(model.activeId, null);
    await React.act(async () => {
      resolveSend();
      await first;
    });
    assert.equal(model.activeId, null, "a background result must not select or reopen the session");
    assert.equal(model.sessions[0].id, firstId);
    assert.ok(
      actions.some((action) => action.sessionAction === "close" && action.sessionId === firstId)
    );
    let second;
    await React.act(async () => {
      second = model.send("second question");
    });
    assert.notEqual(model.activeId, firstId);
    await React.act(async () => {
      resolveSend();
      await second;
    });
    assert.ok(actions.every((action) => ["list", "send", "close"].includes(action.sessionAction)));
  } finally {
    await React.act(async () => root.unmount());
  }
});
