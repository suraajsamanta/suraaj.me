import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const require = createRequire(import.meta.url), ts = require('typescript');
const root = fileURLToPath(new URL('../../../../', import.meta.url)), cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const loaded = { exports: {} }; cache.set(path, loaded.exports);
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', js)(name => name.startsWith('.') ? load(resolve(dirname(path), name + '.ts')) : require(name), loaded, loaded.exports);
  return loaded.exports;
}
const { CHARACTERS, ANIMAL_CHARACTERS } = load(resolve(root, 'src/app/beerio/appearance.ts'));
const { characterShowroomGeometry, animalBodyGeometry, racerGeometry, dancerGeometry, twerkGeometry, parseColor } = load(resolve(root, 'src/app/beerio/game/renderer.ts'));
const manifest = JSON.parse(readFileSync(resolve(root, 'public/beerio/models/manifest.json'), 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');

test('every menu image is a verified render of its current in-game character mesh', () => {
  assert.deepEqual(manifest.characters.map(character => character.id), CHARACTERS.map(character => character.id));
  const meshes = new Set(), images = new Set();
  for (const character of manifest.characters) {
    const mesh = characterShowroomGeometry(parseColor(character.color), character.id).data;
    assert.ok(mesh.every(Number.isFinite), character.id);
    assert.equal(mesh.length % 18, 0, 'complete 3D colored triangles');
    assert.ok(mesh.length / 6 < 10000, `${character.id} is a lightweight model`);
    assert.equal(mesh.length / 6, character.vertices);
    assert.equal(sha256(JSON.stringify(mesh)), character.meshSha256, `${character.id}: regenerate portraits after model changes`);
    const png = readFileSync(resolve(root, 'public/beerio/models', character.file));
    assert.equal(sha256(png), character.imageSha256, `${character.id}: image provenance matches generated asset`);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 320); assert.equal(png.readUInt32BE(20), 320);
    assert.equal(png[25], 6, 'transparent RGBA, not a reference-sheet crop');
    assert.ok(png.length > 1000 && png.length < 50000, `${character.id} has a bounded image payload`);
    meshes.add(character.meshSha256); images.add(character.imageSha256);
  }
  assert.equal(meshes.size, CHARACTERS.length, 'every character has distinct 3D geometry');
  assert.equal(images.size, CHARACTERS.length, 'every image is distinct');
});

test('undefined and invalid model identities use a safe legacy fallback, never prototype properties', () => {
  const color = parseColor('#ffce58');
  const fallback = characterShowroomGeometry(color, 'fox').data;
  for (const unknown of [undefined, 'missing', '__proto__', 'toString']) assert.deepEqual(characterShowroomGeometry(color, unknown).data, fallback);
});

test('all 24 animals have different full-body geometry even without heads or color differences', () => {
  const bodies = new Set(), color = parseColor('#4ce4f3');
  for (const { id } of ANIMAL_CHARACTERS) {
    const body = animalBodyGeometry(color, id).data;
    assert.ok(body.length > 1000 && body.every(Number.isFinite));
    const positions = body.filter((_, index) => index % 6 < 3);
    bodies.add(sha256(JSON.stringify(positions)));
    const full = characterShowroomGeometry(color, id).data;
    assert.ok(full.length > body.length, `${id} keeps its species head attached to the body`);
    assert.ok(full.length / 6 < 9500, `${id} fits the static full-body budget`);
  }
  assert.equal(bodies.size, 24, 'species are not identical human bodies with different heads or textures');
  const fish = animalBodyGeometry(color, 'fish').data;
  assert.ok(fish.filter((_, index) => index % 6 === 1).every(y => y > .3), 'fish has fins/tail, not ground-reaching human legs');
  assert.equal(animalBodyGeometry(color, '__proto__').data.length, 0);
});

test('the same animal body rig is present in showroom, seated, motorcycle, dance and twerk meshes', () => {
  const color = parseColor('#4ce4f3'), phase = .7;
  const triangles = data => {
    const result = new Set(); for (let at = 0; at < data.length; at += 18) result.add(data.slice(at, at + 18).join(','));
    return result;
  };
  for (const { id } of ANIMAL_CHARACTERS) {
    const poses = [
      ['showroom', characterShowroomGeometry(color, id)], ['seated', racerGeometry(color, id)],
      ['motorcycle', racerGeometry(color, id, 'motorcycle')], ['dance', dancerGeometry(color, phase, id)],
      ['twerk', twerkGeometry(color, phase, id)],
    ];
    for (const [pose, full] of poses) {
      const body = animalBodyGeometry(color, id, pose, phase).data, actual = triangles(full.data);
      for (const triangle of triangles(body)) assert.ok(actual.has(triangle), `${id}/${pose} includes the shared body rig, not a stand-in`);
      assert.ok(full.data.every(Number.isFinite));
    }
    const frames = Array.from({ length: 8 }, (_, frame) => animalBodyGeometry(color, id, 'dance', frame * Math.PI / 4).data);
    assert.equal(new Set(frames.map(data => sha256(JSON.stringify(data)))).size, 8, `${id}'s body articulates with the animation`);
  }
});
