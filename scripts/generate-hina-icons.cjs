// Derive platform icons from the original logo using Electron's image codecs.
const fs = require("node:fs");
const path = require("node:path");

if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require("electron"), [__filename], { env, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

const { app, nativeImage } = require("electron");
const root = path.join(__dirname, "../src/assets");
const source = nativeImage.createFromPath(path.join(root, "logo.png"));
if (source.isEmpty()) throw new Error("Cannot decode src/assets/logo.png");
const { width, height } = source.getSize();
if (width !== height) throw new Error("The application logo must be square");
const icon = (size) => source.resize({ width: size, height: size, quality: "best" });
fs.writeFileSync(path.join(root, "icon.png"), icon(512).toPNG());

// Extract the white emblem for macOS template tinting; discard the red tile.
const template = icon(72);
const pixels = template.toBitmap();
for (let offset = 0; offset < pixels.length; offset += 4) {
  const white = Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
  pixels[offset + 3] = Math.round((pixels[offset + 3] * white) / 255);
  pixels.fill(0, offset, offset + 3);
}
fs.writeFileSync(
  path.join(root, "iconTemplate@3x.png"),
  nativeImage.createFromBitmap(pixels, { width: 72, height: 72 }).toPNG()
);

const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map((size) => icon(size).toPNG());
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let imageOffset = directory.length;
sizes.forEach((size, index) => {
  const entry = 6 + index * 16;
  directory[entry] = size === 256 ? 0 : size;
  directory[entry + 1] = size === 256 ? 0 : size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(images[index].length, entry + 8);
  directory.writeUInt32LE(imageOffset, entry + 12);
  imageOffset += images[index].length;
});
fs.writeFileSync(path.join(root, "icon.ico"), Buffer.concat([directory, ...images]));

const chunks = [
  ["ic08", 256],
  ["ic09", 512],
  ["ic10", 1024],
].map(([type, size]) => {
  const png = icon(size).toPNG();
  const header = Buffer.alloc(8);
  header.write(type);
  header.writeUInt32BE(png.length + 8, 4);
  return Buffer.concat([header, png]);
});
const header = Buffer.alloc(8);
header.write("icns");
header.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
fs.writeFileSync(path.join(root, "icon.icns"), Buffer.concat([header, ...chunks]));
const composerAssets = path.join(root, "hina.icon", "Assets");
fs.mkdirSync(composerAssets, { recursive: true });
fs.writeFileSync(path.join(composerAssets, "ICON.png"), icon(1024).toPNG());
app.exit(0);
