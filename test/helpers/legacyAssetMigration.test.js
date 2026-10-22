const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { migrateLegacyAssets } = require("../../src/helpers/legacyAssetMigration");

test("copies model and complete CUDA pack without copying credentials or deleting originals", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hina-migration-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const options = Object.fromEntries(
    ["legacyCacheRoot", "cacheRoot", "legacyUserData", "userData"].map((key) => [
      key,
      path.join(root, key),
    ])
  );
  const models = path.join(options.legacyCacheRoot, "whisper-models");
  const cuda = path.join(options.legacyUserData, "bin", "whisper-cuda");
  await fs.mkdir(models, { recursive: true });
  await fs.mkdir(cuda, { recursive: true });
  await fs.writeFile(path.join(models, "ggml-large-v3-turbo.bin"), "model-content");
  await fs.writeFile(path.join(models, ".env"), "do-not-copy");
  await fs.writeFile(path.join(options.legacyUserData, ".env"), "do-not-copy");
  for (const name of [
    "whisper-server-win32-x64-cuda.exe",
    "cublas64_12.dll",
    "cublasLt64_12.dll",
    "cudart64_12.dll",
    "msvcp140.dll",
    "vcruntime140.dll",
    "vcruntime140_1.dll",
    "vcomp140.dll",
  ])
    await fs.writeFile(path.join(cuda, name), name);
  const result = await migrateLegacyAssets(options);
  assert.equal(result.modelsCopied, 1);
  assert.equal(result.cudaCopied, true);
  assert.deepEqual(result.failures, []);
  assert.equal(
    await fs.readFile(
      path.join(options.cacheRoot, "whisper-models", "ggml-large-v3-turbo.bin"),
      "utf8"
    ),
    "model-content"
  );
  await fs.access(path.join(models, "ggml-large-v3-turbo.bin"));
  await assert.rejects(fs.access(path.join(options.userData, ".env")));
  await assert.rejects(fs.access(path.join(options.cacheRoot, "whisper-models", ".env")));
  const again = await migrateLegacyAssets(options);
  assert.equal(again.modelsCopied, 0);
  assert.equal(again.cudaCopied, false);
});

test("does not overwrite an existing model or accept an incomplete CUDA pack", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hina-migration-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const options = Object.fromEntries(
    ["legacyCacheRoot", "cacheRoot", "legacyUserData", "userData"].map((key) => [
      key,
      path.join(root, key),
    ])
  );
  for (const base of [options.legacyCacheRoot, options.cacheRoot])
    await fs.mkdir(path.join(base, "whisper-models"), { recursive: true });
  await fs.writeFile(
    path.join(options.legacyCacheRoot, "whisper-models", "ggml-large-v3-turbo.bin"),
    "original"
  );
  await fs.writeFile(
    path.join(options.cacheRoot, "whisper-models", "ggml-large-v3-turbo.bin"),
    "keep-existing"
  );
  const cuda = path.join(options.legacyUserData, "bin", "whisper-cuda");
  await fs.mkdir(cuda, { recursive: true });
  await fs.writeFile(path.join(cuda, "whisper-server-win32-x64-cuda.exe"), "incomplete");
  const result = await migrateLegacyAssets(options);
  assert.equal(result.modelsCopied, 0);
  assert.equal(result.cudaCopied, false);
  assert.equal(
    await fs.readFile(
      path.join(options.cacheRoot, "whisper-models", "ggml-large-v3-turbo.bin"),
      "utf8"
    ),
    "keep-existing"
  );
});

test("a corrupted copy never becomes an installed model and retries cleanly", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hina-migration-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const options = Object.fromEntries(
    ["legacyCacheRoot", "cacheRoot", "legacyUserData", "userData"].map((key) => [
      key,
      path.join(root, key),
    ])
  );
  const name = "ggml-large-v3-turbo.bin";
  const source = path.join(options.legacyCacheRoot, "whisper-models", name);
  const target = path.join(options.cacheRoot, "whisper-models", name);
  await fs.mkdir(path.dirname(source), { recursive: true });
  await fs.writeFile(source, "complete-model");
  const originalCopy = fs.copyFile;
  const mock = t.mock.method(fs, "copyFile", async (_source, destination) =>
    fs.writeFile(destination, "broken")
  );
  const failed = await migrateLegacyAssets(options);
  mock.mock.restore();
  assert.equal(fs.copyFile, originalCopy);
  assert.deepEqual(failed.failures, [name]);
  await assert.rejects(fs.access(target));
  assert.equal(await fs.readFile(source, "utf8"), "complete-model");
  const retried = await migrateLegacyAssets(options);
  assert.equal(retried.modelsCopied, 1);
  assert.deepEqual(retried.failures, []);
});

test("does not import a symlinked model", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hina-migration-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const options = Object.fromEntries(
    ["legacyCacheRoot", "cacheRoot", "legacyUserData", "userData"].map((key) => [
      key,
      path.join(root, key),
    ])
  );
  const models = path.join(options.legacyCacheRoot, "whisper-models");
  await fs.mkdir(models, { recursive: true });
  const original = path.join(root, "outside-model.bin");
  await fs.writeFile(original, "original");
  try {
    await fs.symlink(original, path.join(models, "ggml-small.bin"));
  } catch (error) {
    if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error.code)) {
      t.skip("Windows user does not have permission to create symbolic links");
      return;
    }
    throw error;
  }
  const result = await migrateLegacyAssets(options);
  assert.equal(result.modelsCopied, 0);
  await assert.rejects(fs.access(path.join(options.cacheRoot, "whisper-models", "ggml-small.bin")));
  assert.equal(await fs.readFile(original, "utf8"), "original");
});
