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

test("enterprise providers: test-enterprise-connection is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("test-enterprise-connection", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("enterprise providers: process-enterprise-reasoning is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("process-enterprise-reasoning", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("enterprise providers: enterprise-stream-start is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("enterprise-stream-start", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("enterprise providers: bedrock-list-models is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("bedrock-list-models", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("enterprise providers: get-managed-enterprise-config is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("get-managed-enterprise-config", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});
