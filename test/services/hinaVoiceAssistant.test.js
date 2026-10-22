const test = require("node:test");
const assert = require("node:assert/strict");
const { createRendererServer, installBrowserGlobals } = require("../lib/rendererTestHarness");

test("Voice Assistant reaches Hina through IPC even when local tools are offered", async (t) => {
  const calls = [];
  installBrowserGlobals(t, {
    window: {
      electronAPI: {
        getDictationAgentCustomKey: async () => "saved-token",
        hinaConnectorRequest: async (args) => {
          calls.push(args);
          return { ok: true, reply: "HINA_CONNECTION_OK" };
        },
      },
    },
  });
  localStorage.setItem("hinaConnectorEnabled", "true");
  const vite = await createRendererServer(t, { cachePrefix: "hina-voice-test-" });
  const service = (await vite.ssrLoadModule("/services/ReasoningService.ts")).default;
  const { usePolicyStore } = await vite.ssrLoadModule("/stores/policyStore.ts");
  usePolicyStore.setState({ status: "unmanaged", appVersion: "0.1.0", policy: null });
  t.after(() => service.destroy());
  const config = {
    inferenceScope: "dictationAgent",
    lanUrl: "http://127.0.0.1:3210",
    customApiKey: "stale-token",
    systemPrompt: "Assistant",
  };
  const chunks = [];
  for await (const chunk of service.processTextStreamingAI(
    [{ role: "user", content: "Hello Hina" }],
    "hina",
    "custom",
    config,
    {}
  ))
    chunks.push(chunk);
  assert.deepEqual(calls, [
    { url: "http://127.0.0.1:3210", token: "saved-token", text: "Hello Hina" },
  ]);
  assert.deepEqual(chunks, [
    { type: "content", text: "HINA_CONNECTION_OK" },
    { type: "done", finishReason: "stop" },
  ]);
});

test("Hina failures surface to the assistant instead of falling back to another provider", async (t) => {
  installBrowserGlobals(t, {
    window: {
      electronAPI: {
        hinaConnectorRequest: async () => ({
          ok: false,
          error: "Hina Connector returned HTTP 401",
        }),
      },
    },
  });
  localStorage.setItem("hinaConnectorEnabled", "true");
  const vite = await createRendererServer(t, { cachePrefix: "hina-error-test-" });
  const service = (await vite.ssrLoadModule("/services/ReasoningService.ts")).default;
  const { usePolicyStore } = await vite.ssrLoadModule("/stores/policyStore.ts");
  usePolicyStore.setState({ status: "unmanaged", appVersion: "0.1.0", policy: null });
  t.after(() => service.destroy());
  await assert.rejects(async () => {
    for await (const chunk of service.processTextStreamingAI(
      [{ role: "user", content: "Hello" }],
      "hina",
      "custom",
      {
        inferenceScope: "dictationAgent",
        lanUrl: "http://localhost:3210",
        customApiKey: "test",
        systemPrompt: "Assistant",
      }
    ))
      assert.fail(JSON.stringify(chunk));
  }, /HTTP 401/);
});
