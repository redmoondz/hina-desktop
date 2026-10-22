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

test("removed streaming audio providers: assemblyai-streaming-warmup is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("assemblyai-streaming-warmup", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("removed streaming audio providers: assemblyai-streaming-start is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("assemblyai-streaming-start", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("removed streaming audio providers: corti-streaming-warmup is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("corti-streaming-warmup", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("removed streaming audio providers: corti-streaming-start is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("corti-streaming-start", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("removed streaming audio providers: deepgram-streaming-start is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("deepgram-streaming-start", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("removed streaming audio providers: gemini-streaming-start is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("gemini-streaming-start", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});
