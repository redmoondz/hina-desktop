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

test("remote realtime dictation in every language: dictation-realtime-warmup is denied before provider work", async () => {
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

test("remote realtime dictation in every language: dictation-realtime-start is denied before provider work", async () => {
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

test("remote realtime dictation in every language: dictation-realtime-finalize is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("dictation-realtime-finalize", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("remote realtime dictation in every language: dictation-realtime-stop is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("dictation-realtime-stop", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});
