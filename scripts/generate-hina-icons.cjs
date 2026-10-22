// Neutral microphone placeholder, generated without image tooling dependencies.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const root = path.join(__dirname, "../src/assets");
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tag = Buffer.from(type);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([header, tag, data, crc]);
}
function icon(size, template = false) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x = (col + 0.5) / size;
      const y = (row + 0.5) / size;
      const capsule =
        Math.hypot(Math.max(Math.abs(x - 0.5) - 0.075, 0), Math.max(Math.abs(y - 0.38) - 0.13, 0)) <
        0.065;
      const radius = Math.hypot(x - 0.5, y - 0.45);
      const arc = y >= 0.44 && radius > 0.195 && radius < 0.24;
      const sides =
        y >= 0.39 && y <= 0.46 && (Math.abs(x - 0.28) < 0.023 || Math.abs(x - 0.72) < 0.023);
      const stem = Math.abs(x - 0.5) < 0.023 && y >= 0.65 && y <= 0.79;
      const foot = Math.abs(x - 0.5) < 0.14 && Math.abs(y - 0.8) < 0.023;
      const microphone = capsule || arc || sides || stem || foot;
      const bg =
        !template &&
        Math.hypot(Math.max(Math.abs(x - 0.5) - 0.31, 0), Math.max(Math.abs(y - 0.5) - 0.31, 0)) <
          0.17;
      const offset = row * (size * 4 + 1) + 1 + col * 4;
      const color = template ? [0, 0, 0] : microphone ? [244, 247, 251] : [37, 49, 66];
      pixels.set([...color, microphone || bg ? 255 : 0], offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const png = icon(512);
fs.writeFileSync(path.join(root, "icon.png"), png);
fs.writeFileSync(path.join(root, "iconTemplate@3x.png"), icon(72, true));
const icoPng = icon(256);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(icoPng.length, 14);
ico.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(root, "icon.ico"), Buffer.concat([ico, icoPng]));
const icnsHeader = Buffer.alloc(16);
icnsHeader.write("icns");
icnsHeader.writeUInt32BE(png.length + 16, 4);
icnsHeader.write("ic09", 8);
icnsHeader.writeUInt32BE(png.length + 8, 12);
fs.writeFileSync(path.join(root, "icon.icns"), Buffer.concat([icnsHeader, png]));

const composerAssets = path.join(root, "hina.icon", "Assets");
fs.mkdirSync(composerAssets, { recursive: true });
fs.writeFileSync(path.join(composerAssets, "ICON.png"), icon(1024));
