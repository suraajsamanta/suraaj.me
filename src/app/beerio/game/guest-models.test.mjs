import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = process.env.BEERIO_REPO || resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(resolve(root, 'package.json')), ts = require('typescript'), cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  let source = readFileSync(file.endsWith('/renderer.ts') && process.env.BEERIO_RENDERER_SOURCE ? process.env.BEERIO_RENDERER_SOURCE : file, 'utf8');
  if (file.endsWith('/renderer.ts')) source += '\nexport { Geometry as TestGeometry, figureProp as testFigureProp, figureWaist as testFigureWaist, figureSleeve as testFigureSleeve, figureShowroomGeometry as testFigureShowroom };\n';
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', output)(name => name.startsWith('.') ? load(resolve(dirname(file), name + '.ts')) : require(name), mod, mod.exports);
  return mod.exports;
}
const renderer = load(resolve(root, 'src/app/beerio/game/renderer.ts'));
const figures = ['bezos', 'trump', 'musk', 'zuckerberg', 'ye', 'huang'];
const color = [.9, .6, .2];
const axis = (data, a) => data.filter((_, index) => index % 6 === a);

test('six guests retain finite, volumetric, bounded meshes in every vehicle and animation frame', () => {
  for (const id of figures) {
    const poses = [renderer.characterShowroomGeometry(color, id)];
    for (const vehicle of ['kart', 'buggy', 'motorcycle', 'roadster']) poses.push(renderer.racerGeometry(color, id, vehicle));
    for (const method of [renderer.dancerGeometry, renderer.twerkGeometry]) for (let frame = 0; frame < 8; frame++) poses.push(method(color, frame * Math.PI / 4, id));
    for (const mesh of poses) {
      assert.ok(mesh.data.every(Number.isFinite), `${id} contains invalid vertices`);
      assert.equal(mesh.data.length % 18, 0, `${id} is not triangle geometry`);
      assert.ok(mesh.data.length / 6 < 9000, `${id} exceeds the per-mesh vertex budget`);
      for (let a = 0; a < 3; a++) assert.ok(Math.max(...axis(mesh.data, a)) - Math.min(...axis(mesh.data, a)) > .5, `${id} is flat on axis ${a}`);
    }
  }
});

test('waist volumes span both hip and jacket anchors, including forward-leaning twerk poses', () => {
  for (const id of figures) for (const [hip, chest] of [[[.17, 1.1, 0], [-.1, 1.75, 0]], [[.25, .92, -.37], [-.15, 1.42, .43]]]) {
    const links = [], volumes = [];
    renderer.testFigureWaist({ beam(a, b, width) { links.push({ a, b, width }); }, ellipsoid(center, radius) { volumes.push({ center, radius }); } }, id, hip, chest);
    assert.deepEqual(links[0].a, hip);
    assert.deepEqual(links[0].b, [chest[0], chest[1] - .29, chest[2]]);
    assert.ok(links[0].width >= .22, 'waist must join the upper legs with a real volume');
    assert.ok(volumes.some(v => Math.abs(v.center[1] - hip[1]) < v.radius[1]), 'pelvis must enclose the hip anchor');
  }
});

test('Bezos rocket, pedestal and laser all follow the hand instead of the torso', () => {
  const hand = [.67, 1.52, .17], delta = [.4, .8, -.3];
  const a = new renderer.TestGeometry(), b = new renderer.TestGeometry();
  renderer.testFigureProp(a, 'bezos', hand);
  renderer.testFigureProp(b, 'bezos', hand.map((value, i) => value + delta[i]));
  assert.equal(a.data.length, b.data.length);
  for (let i = 0; i < a.data.length; i++) assert.ok(Math.abs(b.data[i] - a.data[i] - (i % 6 < 3 ? delta[i % 6] : 0)) < 1e-8, `prop vertex ${i} broke its hand attachment`);
});

test('Musk showroom boots hover without clipping flames below ground', () => {
  const mesh = renderer.testFigureShowroom(color, 'musk');
  assert.ok(Math.min(...axis(mesh.data, 1)) >= 0);
  assert.ok(Math.min(...axis(mesh.data, 1)) < .2, 'thruster plume should remain close to the ground');
  assert.deepEqual(renderer.characterShowroomGeometry(color, 'musk').data, mesh.data, 'selection must route through the dedicated full-body pose');
});

test('Ye sleeves are padded readable volumes rather than thin dark arms', () => {
  const bands = [];
  renderer.testFigureSleeve({ beam() {}, ellipsoid(center, radius, color) { bands.push({ center, radius, color }); } }, 'ye', [.3, 1.5, 0], [.8, 1.1, .1]);
  assert.equal(bands.length, 2);
  assert.ok(bands.every(band => band.radius[0] >= .23 && band.color.every(channel => channel >= .16)));
});
