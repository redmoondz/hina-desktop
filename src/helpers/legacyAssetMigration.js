const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

const CUDA_FILES = [
  "whisper-server-win32-x64-cuda.exe",
  "cublas64_12.dll",
  "cublasLt64_12.dll",
  "cudart64_12.dll",
  "msvcp140.dll",
  "vcruntime140.dll",
  "vcruntime140_1.dll",
  "vcomp140.dll",
];

async function regularFile(file) {
  try {
    const stat = await fsp.lstat(file);
    return stat.isFile() && stat.size > 0 ? stat : null;
  } catch {
    return null;
  }
}

async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function verifiedCopy(source, target) {
  await fsp.copyFile(source, target, fs.constants.COPYFILE_EXCL);
  const [sourceStat, targetStat] = await Promise.all([fsp.stat(source), fsp.stat(target)]);
  if (sourceStat.size !== targetStat.size || (await digest(source)) !== (await digest(target))) {
    throw new Error("Asset verification failed");
  }
}

async function exists(file) {
  try {
    await fsp.lstat(file);
    return true;
  } catch {
    return false;
  }
}

// Import only public model/runtime assets. Account state and credentials never
// cross profiles, and original downloads are always preserved for rollback.
async function migrateLegacyAssets({ legacyCacheRoot, cacheRoot, legacyUserData, userData }) {
  const result = { modelsCopied: 0, cudaCopied: false, failures: [] };
  const sourceModels = path.join(legacyCacheRoot, "whisper-models");
  const targetModels = path.join(cacheRoot, "whisper-models");
  const entries = await fsp.readdir(sourceModels, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || !/^ggml-[a-z0-9.-]+\.bin$/i.test(entry.name)) continue;
    const source = path.join(sourceModels, entry.name);
    const target = path.join(targetModels, entry.name);
    if (!(await regularFile(source)) || (await exists(target))) continue;
    const staging = `${target}.${process.pid}.importing`;
    try {
      await fsp.mkdir(targetModels, { recursive: true });
      await fsp.rm(staging, { force: true });
      await verifiedCopy(source, staging);
      // The application singleton guards startup; check again before publishing.
      if (!(await exists(target))) {
        await fsp.rename(staging, target);
        result.modelsCopied += 1;
      }
    } catch {
      result.failures.push(entry.name);
    } finally {
      await fsp.rm(staging, { force: true }).catch(() => {});
    }
  }

  const sourceCuda = path.join(legacyUserData, "bin", "whisper-cuda");
  const targetCuda = path.join(userData, "bin", "whisper-cuda");
  const complete = (
    await Promise.all(CUDA_FILES.map((name) => regularFile(path.join(sourceCuda, name))))
  ).every(Boolean);
  if (complete && !(await exists(targetCuda))) {
    const staging = `${targetCuda}.${process.pid}.importing`;
    try {
      await fsp.rm(staging, { recursive: true, force: true });
      await fsp.mkdir(staging, { recursive: true });
      for (const name of CUDA_FILES)
        await verifiedCopy(path.join(sourceCuda, name), path.join(staging, name));
      if (!(await exists(targetCuda))) {
        await fsp.rename(staging, targetCuda);
        result.cudaCopied = true;
      }
    } catch {
      result.failures.push("whisper-cuda");
    } finally {
      await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
    }
  }
  return result;
}

async function migrateOpenWhisprAssets() {
  const { app } = require("electron");
  const { getCacheRoot } = require("./modelDirUtils");
  const home =
    process.platform === "win32"
      ? process.env.USERPROFILE || app.getPath("home")
      : app.getPath("home");
  return migrateLegacyAssets({
    legacyCacheRoot: path.join(home, ".cache", "openwhispr"),
    cacheRoot: getCacheRoot(),
    legacyUserData: path.join(app.getPath("appData"), "open-whispr"),
    userData: app.getPath("userData"),
  });
}

module.exports = { migrateLegacyAssets, migrateOpenWhisprAssets };
