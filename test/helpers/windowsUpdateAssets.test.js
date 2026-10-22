const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const yaml = require("js-yaml");

function assets(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hina-release-assets-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const name = "Hina-Desktop-Setup-0.3.1-x64.exe";
  const bytes = Buffer.from("installer fixture");
  fs.writeFileSync(path.join(root, name), bytes);
  fs.writeFileSync(path.join(root, `${name}.blockmap`), "block map fixture");
  fs.writeFileSync(
    path.join(root, "latest.yml"),
    yaml.dump({
      version: "0.3.1",
      files: [
        {
          url: name,
          size: bytes.length,
          sha512: crypto.createHash("sha512").update(bytes).digest("base64"),
        },
      ],
    })
  );
  return { root, name };
}

test("Windows release assets match the exact updater URL, version, size and SHA512", (t) => {
  const { root, name } = assets(t);
  const { verifyWindowsUpdateAssets } = require("../../scripts/verify-windows-update-assets.cjs");
  assert.deepEqual(verifyWindowsUpdateAssets(root, "0.3.1"), {
    version: "0.3.1",
    installers: [name],
  });
});

test("a renamed or corrupted installer cannot be released with stale metadata", (t) => {
  const { root, name } = assets(t);
  const { verifyWindowsUpdateAssets } = require("../../scripts/verify-windows-update-assets.cjs");
  fs.renameSync(path.join(root, name), path.join(root, name.replaceAll("-", " ")));
  assert.throws(() => verifyWindowsUpdateAssets(root, "0.3.1"), /missing/);
  fs.writeFileSync(path.join(root, name), "corrupted payload");
  assert.throws(() => verifyWindowsUpdateAssets(root, "0.3.1"), /size|checksum/);
});

test("missing blockmaps and mismatched versions fail publication validation", (t) => {
  const { root, name } = assets(t);
  const { verifyWindowsUpdateAssets } = require("../../scripts/verify-windows-update-assets.cjs");
  assert.throws(() => verifyWindowsUpdateAssets(root, "0.3.2"), /version/);
  fs.unlinkSync(path.join(root, `${name}.blockmap`));
  assert.throws(() => verifyWindowsUpdateAssets(root, "0.3.1"), /blockmap/);
});
