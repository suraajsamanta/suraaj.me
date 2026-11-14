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

test('all garage cars are unique meshes with head-only drivers and four distinct fallback preview angles', () => {
  const { GARAGE_VEHICLES, currentGarageVehicle, validAppearance } = load(resolve(root, 'src/app/beerio/appearance.ts'));
  const { characterHeadGeometry } = load(resolve(root, 'src/app/beerio/game/renderer.ts'));
  const color = parseColor('#abc123'), meshes = new Set();
  assert.equal(GARAGE_VEHICLES.length, 13);
  for (const { id } of GARAGE_VEHICLES) {
    const vehicle = racerGeometry(color, 'gorilla', id, false).data;
    const driver = racerGeometry(color, 'gorilla', id, true).data;
    assert.ok(vehicle.length && vehicle.every(Number.isFinite), id);
    assert.ok(vehicle.length / 18 <= 4500, `${id}: vehicle stays under the split-screen triangle budget`);
    assert.equal(driver.length - vehicle.length, characterHeadGeometry(color, 'gorilla').data.length, id);
    meshes.add(sha256(JSON.stringify(vehicle)));
    const views = new Set();
    for (const suffix of ['', '-left', '-rear', '-right']) {
      const png = readFileSync(resolve(root, 'public/beerio/models/rides', id + suffix + '.png'));
      assert.equal(png.subarray(1, 4).toString(), 'PNG', id);
      views.add(sha256(png));
    }
    assert.equal(views.size, 4, id);
    assert.ok(validAppearance({ vehicle: id, character: 'gorilla', color: '#abc123' }), id);
  }
  assert.equal(meshes.size, GARAGE_VEHICLES.length);
  for (const legacy of ['kart', 'buggy', 'roadster', 'motorcycle']) {
    assert.ok(validAppearance({ vehicle: legacy, character: 'gorilla', color: '#abc123' }));
    assert.ok(GARAGE_VEHICLES.some(ride => ride.id === currentGarageVehicle(legacy)));
  }
});

test('garage orbit redraws a new camera without re-uploading geometry', t => {
  const w = globalThis.window;
  globalThis.window = { devicePixelRatio: 2 };
  t.after(() => { if (w === undefined) delete globalThis.window; else globalThis.window = w; });
  const { createGaragePreview } = load(resolve(root, 'src/app/beerio/game/renderer.ts'));
  const matrices = [], uploads = [], draws = [], drops = [];
  const gl = new Proxy({
    createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}),
    getShaderParameter: () => true, getProgramParameter: () => true,
    getAttribLocation: (_program, name) => name === 'a_color' ? 1 : 0,
    uniformMatrix4fv: (_location, _transpose, value) => matrices.push(Array.from(value)),
    bufferData: (_target, value) => uploads.push(value),
    drawArrays: (_mode, _offset, count) => draws.push(count),
    deleteProgram: () => drops.push('program'), deleteBuffer: () => drops.push('buffer'),
  }, { get: (target, prop) => Object.hasOwn(target, prop) ? target[prop] : prop === prop.toUpperCase() ? 42 : () => {} });
  const canvas = { clientWidth: 320, clientHeight: 160, width: 0, height: 0, getContext: () => gl };
  const preview = createGaragePreview(canvas);
  preview.setRide('bmw-m3', '#42b76c');
  for (const angle of [-.62, -Math.PI / 2, Math.PI, Math.PI / 2]) preview.draw(angle);
  assert.equal(uploads.length, 1);
  assert.equal(new Set(matrices.map(row => JSON.stringify(row))).size, 4);
  assert.ok(draws.every(count => count > 0 && count === uploads[0].length / 6));
  assert.deepEqual([canvas.width, canvas.height], [560, 280]);
  preview.dispose();
  assert.deepEqual(drops, ['buffer', 'program']);
  assert.equal(createGaragePreview({ getContext: () => null }), null);
});
