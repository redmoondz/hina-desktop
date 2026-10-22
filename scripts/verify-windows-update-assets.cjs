const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const yaml = require("js-yaml");

function verifyWindowsUpdateAssets(directory, expectedVersion) {
  const metadata = yaml.load(fs.readFileSync(path.join(directory, "latest.yml"), "utf8"));
  if (!metadata || metadata.version !== expectedVersion)
    throw new Error("Update metadata version mismatch");
  const files = Array.isArray(metadata.files) ? metadata.files : [];
  const installers = [];
  for (const entry of files) {
    if (typeof entry.url !== "string" || !entry.url.endsWith(".exe")) continue;
    if (path.basename(entry.url) !== entry.url || /[\\/]/.test(entry.url))
      throw new Error("Invalid installer asset name");
    const filename = path.join(directory, entry.url);
    if (!fs.existsSync(filename)) throw new Error(`Installer asset is missing: ${entry.url}`);
    const size = fs.statSync(filename).size;
    if (size !== entry.size || size <= 0) throw new Error(`Installer size mismatch: ${entry.url}`);
    const hash = crypto.createHash("sha512");
    const handle = fs.openSync(filename, "r");
    try {
      const chunk = Buffer.alloc(1024 * 1024);
      let bytes;
      while ((bytes = fs.readSync(handle, chunk, 0, chunk.length, null)) > 0)
        hash.update(chunk.subarray(0, bytes));
    } finally {
      fs.closeSync(handle);
    }
    if (hash.digest("base64") !== entry.sha512)
      throw new Error(`Installer checksum mismatch: ${entry.url}`);
    const blockmap = `${filename}.blockmap`;
    if (!fs.existsSync(blockmap) || fs.statSync(blockmap).size <= 0)
      throw new Error(`Installer blockmap is missing: ${entry.url}`);
    installers.push(entry.url);
  }
  if (!installers.length) throw new Error("No Windows installers in update metadata");
  if (metadata.path && !installers.includes(metadata.path))
    throw new Error("Legacy installer asset is missing");
  return { version: metadata.version, installers };
}

if (require.main === module) {
  try {
    const version = process.argv[3] || require("../package.json").version;
    console.log(JSON.stringify(verifyWindowsUpdateAssets(process.argv[2] || "dist", version)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { verifyWindowsUpdateAssets };
