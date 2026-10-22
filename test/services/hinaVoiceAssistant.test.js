const test = require("node:test");
const assert = require("node:assert/strict");
const { createRendererServer, installBrowserGlobals } = require("../lib/rendererTestHarness");

test("local desktop routes stale cloud selections to Hina and never initializes provider access", async (t) => {
  const calls = [];
  installBrowserGlobals(t, {
    initialStorage: {
      hinaConnectorEnabled: "true",
      dictationAgentRemoteUrl: "http://127.0.0.1:3210",
    },
    window: {
      electronAPI: {
        localOnly: true,
        getDictationAgentCustomKey: async () => "saved-token",
        hinaConnectorRequest: async (args) => {
          calls.push(args);
          return { ok: true, reply: "OK" };
        },
      },
    },
  });
  const vite = await createRendererServer(t, { cachePrefix: "hina-local-only-" });
  const service = (await vite.ssrLoadModule("/services/ReasoningService.ts")).default;
  t.after(() => service.destroy());
  const chunks = [];
  for await (const chunk of service.processTextStreamingAI(
    [{ role: "user", content: "Hello Hina" }],
    "old-cloud-model",
    "openai",
    { inferenceScope: "dictationAgent", systemPrompt: "Assistant" },
    {}
  ))
    chunks.push(chunk);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].text, "Hello Hina");
  assert.equal(chunks[0].text, "OK");
});

test("local desktop without a configured Connector refuses the voice command", async (t) => {
  installBrowserGlobals(t, { window: { electronAPI: { localOnly: true } } });
  const vite = await createRendererServer(t, { cachePrefix: "hina-not-configured-" });
  const service = (await vite.ssrLoadModule("/services/ReasoningService.ts")).default;
  t.after(() => service.destroy());
  await assert.rejects(async () => {
    for await (const chunk of service.processTextStreamingAI(
      [{ role: "user", content: "Hello" }],
      "cloud",
      "openai",
      { inferenceScope: "dictationAgent", systemPrompt: "Assistant" }
    ))
      assert.fail(JSON.stringify(chunk));
  }, /Hina Connector/);
});

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
