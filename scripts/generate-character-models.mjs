/**
 * Deterministic, offline portraits of the real Beerio meshes, not reference art.
 * Run: node scripts/generate-character-models.mjs
 * Requires only Node and the project's existing TypeScript dependency.
 * A supersampled orthographic z-buffer keeps occlusion correct without adding
 * 37 WebGL contexts, a 3D dependency, or frame-loop work to the selection screen.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const require = createRequire(import.meta.url), ts = require('typescript');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const loaded = { exports: {} }; modules.set(file, loaded.exports);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', source)(
    name => name.startsWith('.') ? load(resolve(dirname(file), name + '.ts')) : require(name), loaded, loaded.exports,
  );
  return loaded.exports;
}
const { characterShowroomGeometry, racerGeometry, dancerGeometry, twerkGeometry, parseColor } = load(resolve(root, 'src/app/beerio/game/renderer.ts'));
const { CHARACTERS, ANIMAL_CHARACTERS, PALETTE } = load(resolve(root, 'src/app/beerio/appearance.ts'));
const SIZE = 320, AA = 2, WIDTH = SIZE * AA;
const output = resolve(root, 'public/beerio/models'); mkdirSync(output, { recursive: true });
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function chunk(type, data) {
  const tag = Buffer.from(type), body = Buffer.concat([tag, data]); let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const head = Buffer.alloc(4), tail = Buffer.alloc(4); head.writeUInt32BE(data.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([head, body, tail]);
}
function png(rgba) {
  const header = Buffer.alloc(13); header.writeUInt32BE(SIZE); header.writeUInt32BE(SIZE, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) rows.set(rgba.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), y * (SIZE * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function render(data, angle = -.24, tilt = .075) {
  const pixels = new Uint8ClampedArray(WIDTH * WIDTH * 4), depth = new Float32Array(WIDTH * WIDTH); depth.fill(-Infinity);
  const ca = Math.cos(angle), sa = Math.sin(angle), ct = Math.cos(tilt), st = Math.sin(tilt);
  const vertices = [];
  let lowX = Infinity, highX = -Infinity, lowY = Infinity, highY = -Infinity;
  for (let i = 0; i < data.length; i += 6) {
    const x = ca * data[i] - sa * data[i + 2], forward = sa * data[i] + ca * data[i + 2];
    const y = data[i + 1] * ct - forward * st, z = forward * ct + data[i + 1] * st;
    vertices.push([x, y, z]); lowX = Math.min(lowX, x); highX = Math.max(highX, x); lowY = Math.min(lowY, y); highY = Math.max(highY, y);
  }
  // One consistent scale makes silhouettes and relative head sizes legible.
  // Tall ears and horns may reduce scale slightly but are never cropped.
  const scale = Math.min(WIDTH * .87 / (highY - lowY), WIDTH * .78 / (highX - lowX), WIDTH / 3.35);
  const centerX = (lowX + highX) / 2, bottom = WIDTH * .94;
  const screen = vertices.map(([x, y, z]) => [(x - centerX) * scale + WIDTH / 2, bottom - (y - lowY) * scale, z]);
  const edge = (a, b, x, y) => (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
  for (let i = 0; i < screen.length; i += 3) {
    const a = screen[i], b = screen[i + 1], c = screen[i + 2], area = edge(a, b, c[0], c[1]);
    if (Math.abs(area) < 1e-8) continue;
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxX = Math.min(WIDTH - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxY = Math.min(WIDTH - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const wa = edge(b, c, x + .5, y + .5) / area, wb = edge(c, a, x + .5, y + .5) / area, wc = 1 - wa - wb;
      if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
      const z = wa * a[2] + wb * b[2] + wc * c[2], at = y * WIDTH + x;
      if (z < depth[at]) continue;
      depth[at] = z;
      for (let channel = 0; channel < 3; channel++) pixels[at * 4 + channel] = Math.round(data[i * 6 + 3 + channel] * 255);
      pixels[at * 4 + 3] = 255;
    }
  }
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let count = 0; const sum = [0, 0, 0];
    for (let dy = 0; dy < AA; dy++) for (let dx = 0; dx < AA; dx++) {
      const offset = ((y * AA + dy) * WIDTH + x * AA + dx) * 4;
      if (pixels[offset + 3]) { count++; for (let c = 0; c < 3; c++) sum[c] += pixels[offset + c]; }
    }
    const at = (y * SIZE + x) * 4;
    for (let c = 0; c < 3; c++) rgba[at + c] = count ? Math.round(sum[c] / count) : 0;
    rgba[at + 3] = Math.round(count * 255 / (AA * AA));
  }
  return png(rgba);
}
const manifest = [];
for (const [index, character] of CHARACTERS.entries()) {
  const color = PALETTE[index % PALETTE.length], data = characterShowroomGeometry(parseColor(color), character.id).data;
  if (!data.every(Number.isFinite)) throw new Error(`Non-finite model: ${character.id}`);
  const bytes = render(data), filename = `${character.id}.png`; writeFileSync(resolve(output, filename), bytes);
  manifest.push({ id: character.id, file: filename, color, vertices: data.length / 6, meshSha256: createHash('sha256').update(JSON.stringify(data)).digest('hex'), imageSha256: createHash('sha256').update(bytes).digest('hex') });
}
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ source: 'characterShowroomGeometry in game/renderer.ts; shared racing character meshes', width: SIZE, height: SIZE, characters: manifest }, null, 2) + '\n');
console.log(`Rendered ${manifest.length} real character models to public/beerio/models.`);

// Optional offline visual QA of the exact exported race/animation meshes.
// These are software captures of geometry, not browser/device screenshots.
// node scripts/generate-character-models.mjs --qa-dir=/tmp/beerio-character-qa
const qaArgument = process.argv.find(value => value.startsWith('--qa-dir='));
if (qaArgument) {
  const qaDir = resolve(qaArgument.slice('--qa-dir='.length)); mkdirSync(qaDir, { recursive: true });
  const captures = [];
  for (const [index, { id }] of ANIMAL_CHARACTERS.entries()) {
    const color = parseColor(PALETTE[index % PALETTE.length]);
    const poses = [
      ['showroom', characterShowroomGeometry(color, id), -.4, .075],
      ['race-front', racerGeometry(color, id), -.55, .16],
      ['race-rear', racerGeometry(color, id), Math.PI + .5, .18],
      ['dance', dancerGeometry(color, .7, id), -.45, .1],
      ['twerk-rear', twerkGeometry(color, .7, id), Math.PI + .45, .13],
    ];
    for (const [pose, mesh, angle, tilt] of poses) {
      const file = `${id}-${pose}.png`; writeFileSync(resolve(qaDir, file), render(mesh.data, angle, tilt));
      captures.push({ id, pose, file, vertices: mesh.data.length / 6 });
    }
  }
  writeFileSync(resolve(qaDir, 'captures.json'), JSON.stringify({ source: 'Software projection of actual renderer geometry, not browser screenshots', captures }, null, 2));
  console.log(`Rendered ${captures.length} actual-geometry QA views to ${qaDir}.`);
}
