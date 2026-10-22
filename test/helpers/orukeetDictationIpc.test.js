const test = require("node:test");
const assert = require("node:assert/strict");
const { registerLocalIpc } = require("./harness/localIpcRegistry");
const registry = registerLocalIpc({
  environmentManager: new Proxy(
    {},
    {
      get: () => () => assert.fail("a removed provider read credentials"),
    }
  ),
});

test("managed and self-hosted realtime dictation: dictation-realtime-warmup is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("dictation-realtime-warmup", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("managed and self-hosted realtime dictation: dictation-realtime-start is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("dictation-realtime-start", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("managed and self-hosted realtime dictation: cloud-reason is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("cloud-reason", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("managed and self-hosted realtime dictation: cloud-streaming-usage is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("cloud-streaming-usage", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("managed and self-hosted realtime dictation: cloud-transcribe is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("cloud-transcribe", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});
