// Generates the BlockCreator app icon from its 16x16 pixel-art source.
//
//   node scripts/make-app-icon.mjs
//
// Writes app-icon.png (1024px master) and public/favicon.png (256px), runs
// `tauri icon` to derive every platform icon from the master, then re-renders
// each derived icon whose size is a multiple of 16 straight from the grid --
// Tauri resizes with Lanczos, which smears pixel art at small sizes.
//
// Motif: the classic SMW "?" block with a green "create" badge.
// Palette follows the app theme in ui/app.css (--accent, --filled).

import { deflateSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, resolve } from 'node:path';

const N = 16;

const OUTLINE = '#16191f';
const GOLD_HI = '#ffd873';
const GOLD = '#f2b233';
const GOLD_LO = '#c07d12';
const GREEN = '#3fbf7f';
const GREEN_LO = '#1f6b45';
const WHITE = '#f2fff8';

const QMARK = ['.####.', '##..##', '....##', '...##.', '..##..', '......', '..##..', '..##..'];
const PLUS = ['..#..', '..#..', '#####', '..#..', '..#..'];

const grid = () => Array.from({ length: N }, () => Array(N).fill(null));

function px(g, x, y, color) {
  if (x >= 0 && x < N && y >= 0 && y < N) g[y][x] = color;
}

function stamp(g, x0, y0, rows, color) {
  rows.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch === '#') px(g, x0 + dx, y0 + dy, color);
    });
  });
}

function clear(g, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(g, x, y, null);
}

// Solid square with its four corner pixels clipped, as a set of "x,y" keys.
function squareMask(x0, y0, x1, y1) {
  const mask = new Set();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = Math.min(x - x0, x1 - x);
      const dy = Math.min(y - y0, y1 - y);
      if (dx + dy < 1) continue;
      mask.add(`${x},${y}`);
    }
  }
  return mask;
}

const has = (mask, x, y) => mask.has(`${x},${y}`);

function erode(mask) {
  const out = new Set();
  for (const key of mask) {
    const [x, y] = key.split(',').map(Number);
    if (has(mask, x - 1, y) && has(mask, x + 1, y) && has(mask, x, y - 1) && has(mask, x, y + 1)) {
      out.add(key);
    }
  }
  return out;
}

// A block: dark outline, body fill, light top/left and dark bottom/right bevel.
// `line` of null drops the outline and lets the body run to the block's edge.
function paintBlock(g, x0, y0, x1, y1, body, hi, lo, line = OUTLINE) {
  const mask = squareMask(x0, y0, x1, y1);
  const inner = line === null ? mask : erode(mask);
  for (const key of mask) {
    const [x, y] = key.split(',').map(Number);
    px(g, x, y, line ?? body);
  }
  for (const key of inner) {
    const [x, y] = key.split(',').map(Number);
    px(g, x, y, body);
  }
  const core = erode(inner);
  for (const key of inner) {
    if (core.has(key)) continue;
    const [x, y] = key.split(',').map(Number);
    if (!has(inner, x, y - 1) || !has(inner, x - 1, y)) px(g, x, y, hi);
    if (!has(inner, x, y + 1) || !has(inner, x + 1, y)) px(g, x, y, lo);
  }
}

function icon() {
  const g = grid();
  paintBlock(g, 0, 0, 12, 12, GOLD, GOLD_HI, GOLD_LO);
  stamp(g, 3, 2, QMARK, OUTLINE);
  clear(g, 8, 8, 15, 15);
  // The badge carries no outline and only a shadow edge: at 16px an outline plus
  // the gap around it would leave barely any green, and a full bevel even less.
  paintBlock(g, 9, 9, 15, 15, GREEN, GREEN, GREEN_LO, null);
  stamp(g, 10, 10, PLUS, WHITE);
  return g;
}

function rgba(color) {
  if (color === null) return [0, 0, 0, 0];
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 0xff];
}

const CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0);
  return Buffer.concat([head, data, crc]);
}

// The same grid as an SVG: one <rect> per horizontal run of equal pixels. Stays
// sharp at any size, which the in-app header and the website need.
function svg(g) {
  const rects = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N;) {
      const color = g[y][x];
      if (color === null) {
        x++;
        continue;
      }
      let end = x;
      while (end + 1 < N && g[y][end + 1] === color) end++;
      rects.push(`<rect x="${x}" y="${y}" width="${end - x + 1}" height="1" fill="${color}"/>`);
      x = end + 1;
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">`,
    ...rects,
    '</svg>',
    '',
  ].join('\n');
}

// Nearest-neighbour upscale of the grid, encoded as an RGBA PNG.
function png(g, size) {
  if (size % N !== 0) throw new Error(`icon size must be a multiple of ${N}, got ${size}`);
  const scale = size / N;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let at = 0;
  for (let y = 0; y < size; y++) {
    raw[at++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, gr, b, a] = rgba(g[(y / scale) | 0][(x / scale) | 0]);
      raw[at++] = r;
      raw[at++] = gr;
      raw[at++] = b;
      raw[at++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- crisping the icon sets Tauri derives from the master -------------------

const pngSize = (buf) => (buf.readUInt32BE(16) === buf.readUInt32BE(20) ? buf.readUInt32BE(16) : 0);

const crispable = (size) => size > 0 && size % N === 0;

function crispPngs(g, dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      count += crispPngs(g, path);
    } else if (extname(entry.name) === '.png') {
      const size = pngSize(readFileSync(path));
      if (!crispable(size)) continue;
      writeFileSync(path, png(g, size));
      count++;
    }
  }
  return count;
}

// Device Independent Bitmap (DIB / BITMAPINFOHEADER) for Windows ICO.
// Windows Explorer requires standard DIB for icons < 256px; only 256x256 supports PNG.
function dib(g, size) {
  if (size % N !== 0) throw new Error(`icon size must be a multiple of ${N}, got ${size}`);
  const scale = size / N;
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight: double height for XOR + AND masks
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount: 32-bit BGRA
  header.writeUInt32LE(0, 16); // biCompression: BI_RGB (0)
  header.writeUInt32LE(size * size * 4, 20); // biSizeImage

  // Pixel data (XOR mask): bottom-to-top, left-to-right, BGRA
  const xorMask = Buffer.alloc(size * size * 4);
  let at = 0;
  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const [r, gr, b, a] = rgba(g[(y / scale) | 0][(x / scale) | 0]);
      xorMask[at++] = b;
      xorMask[at++] = gr;
      xorMask[at++] = r;
      xorMask[at++] = a;
    }
  }

  // 1-bit AND mask: bottom-to-top, 1 bit per pixel, padded to 32-bit (4 bytes) per row
  const rowBytes = Math.ceil(size / 32) * 4;
  const andMask = Buffer.alloc(rowBytes * size);
  for (let y = size - 1; y >= 0; y--) {
    const rowOffset = (size - 1 - y) * rowBytes;
    for (let x = 0; x < size; x++) {
      const [, , , a] = rgba(g[(y / scale) | 0][(x / scale) | 0]);
      if (a === 0) {
        const byteIndex = rowOffset + (x >> 3);
        const bitIndex = 7 - (x & 7);
        andMask[byteIndex] |= 1 << bitIndex;
      }
    }
  }

  return Buffer.concat([header, xorMask, andMask]);
}

// ICO: 6-byte header, one 16-byte directory entry per image, DIB (<256px) or PNG (>=256px) payloads.
function crispIco(g, path) {
  const ico = readFileSync(path);
  const count = ico.readUInt16LE(4);
  const images = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + 16 * i;
    const dir = Buffer.from(ico.subarray(at, at + 16));
    const size = ico.readUInt32LE(at + 8);
    const offset = ico.readUInt32LE(at + 12);
    const payload = ico.subarray(offset, offset + size);
    const edge = dir[0] || 256;
    const data = crispable(edge) ? (edge >= 256 ? png(g, edge) : dib(g, edge)) : Buffer.from(payload);
    images.push({ dir, data });
  }
  let offset = 6 + 16 * count;
  const dirs = images.map(({ dir, data }) => {
    dir.writeUInt32LE(data.length, 8);
    dir.writeUInt32LE(offset, 12);
    offset += data.length;
    return dir;
  });
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(count, 4);
  writeFileSync(path, Buffer.concat([head, ...dirs, ...images.map((i) => i.data)]));
  return count;
}

// ICNS: 8-byte header, then `type` + big-endian length (header included) chunks.
function crispIcns(g, path) {
  const icns = readFileSync(path);
  const out = [];
  let touched = 0;
  let at = 8;
  while (at + 8 <= icns.length) {
    const length = icns.readUInt32BE(at + 4);
    if (length < 8) break;
    const type = icns.subarray(at, at + 4);
    let data = icns.subarray(at + 8, at + length);
    if (data.subarray(0, 4).toString('hex') === '89504e47' && crispable(pngSize(data))) {
      data = png(g, pngSize(data));
      touched++;
    }
    const header = Buffer.alloc(8);
    type.copy(header, 0);
    header.writeUInt32BE(data.length + 8, 4);
    out.push(header, Buffer.from(data));
    at += length;
  }
  const body = Buffer.concat(out);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(body.length + 8, 4);
  writeFileSync(path, Buffer.concat([header, body]));
  return touched;
}

// --- pipeline ---------------------------------------------------------------

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const g = icon();

for (const [file, size] of [
  ['app-icon.png', 1024],
  ['public/favicon.png', 256],
]) {
  writeFileSync(resolve(root, file), png(g, size));
  console.log(`wrote ${file} (${size}x${size})`);
}

writeFileSync(resolve(root, 'ui/assets/app-icon.svg'), svg(g));
console.log('wrote ui/assets/app-icon.svg');

const tauri = spawnSync('npm', ['run', 'tauri', '--', 'icon', 'app-icon.png'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  shell: process.platform === 'win32',
});
if (tauri.status !== 0) {
  console.error('`tauri icon` failed -- platform icons left untouched');
  process.exit(1);
}
console.log('ran `tauri icon app-icon.png`');

const icons = resolve(root, 'src-tauri/icons');
console.log(`re-rendered ${crispPngs(g, icons)} png(s) pixel-crisp`);
for (const [file, crisp] of [
  ['icon.ico', crispIco],
  ['icon.icns', crispIcns],
]) {
  const path = join(icons, file);
  if (!existsSync(path)) continue;
  console.log(`re-rendered ${crisp(g, path)} image(s) in ${file}`);
}
