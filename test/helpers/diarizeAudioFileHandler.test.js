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

test("file upload speaker diarization: diarize-audio-file is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("diarize-audio-file", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("file upload speaker diarization: download-diarization-models is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("download-diarization-models", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("file upload speaker diarization: delete-diarization-models is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("delete-diarization-models", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});

test("file upload speaker diarization: get-diarization-model-status is denied before provider work", async () => {
  for (const mode of ["byok", "openwhispr", "self-hosted"]) {
    const result = await registry.invoke("get-diarization-model-status", {
      mode,
      language: "ru",
      provider: "bedrock",
      audioBuffer: new Uint8Array([1, 2]),
    });
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
});
