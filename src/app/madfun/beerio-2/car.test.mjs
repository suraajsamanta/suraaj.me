import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = mkdtempSync(join(root, '.beerio2-car-tests-'));
after(() => rmSync(output, { recursive: true, force: true }));
const source = readFileSync(new URL('./car.ts', import.meta.url), 'utf8');
writeFileSync(join(output, 'car.mjs'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText.replace(/from '(@babylonjs[^']+)'/g, "from '$1.js'"));
const { buildCar, buildRival } = await import(pathToFileURL(join(output, 'car.mjs')).href);
function fixture(run) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try { run(scene); } finally { scene.dispose(); engine.dispose(); }
}
const visible = car => car.getChildMeshes().filter(mesh => mesh.isEnabled());
const draws = car => visible(car).reduce((total, mesh) => total + mesh.subMeshes.length, 0);
const triangles = car => visible(car).reduce((total, mesh) => total + mesh.getTotalIndices() / 3, 0);

test('hero coupe has four intact wheel pivots within a 28-draw / 2700-triangle budget', () => fixture(scene => {
  const car = buildCar(scene);
  assert.equal(car.metadata.wheels.length, 4);
  assert.equal(car.metadata.frontWheels.length, 2);
  assert.ok(draws(car) <= 28);
  assert.ok(triangles(car) <= 2700);
  for (const wheel of car.metadata.wheels) {
    assert.equal(wheel.getChildMeshes().length, 3);
    for (const mesh of wheel.getChildMeshes()) {
      mesh.computeWorldMatrix(true);
      const center = mesh.getBoundingInfo().boundingBox.centerWorld;
      assert.ok(Math.abs(center.x - wheel.parent.position.x) < .2, 'no doubled wheel x offset after batching');
      assert.ok(Math.abs(center.z - wheel.parent.position.z) < .05, 'no doubled axle offset after batching');
    }
  }
}));

test('rivals switch 6-draw detailed animated cars to 1-draw far silhouettes with hysteresis', () => fixture(scene => {
  const car = buildRival(scene, '#ffac44');
  assert.equal(draws(car), 6);
  const wheel = car.metadata.wheels[0];
  car.metadata.updateDetail(20, .016, 15, .2);
  assert.ok(wheel.rotation.x > 0);
  assert.equal(car.metadata.frontWheels[0].rotation.y, .2);
  car.metadata.updateDetail(66, .016, 15);
  assert.equal(draws(car), 1);
  assert.ok(triangles(car) <= 300);
  const spin = wheel.rotation.x;
  car.metadata.updateDetail(55, .016, 15);
  assert.equal(draws(car), 1);
  assert.equal(wheel.rotation.x, spin);
  car.metadata.updateDetail(49, .016, 15);
  assert.equal(draws(car), 6);
  car.metadata.updateDetail(55);
  assert.equal(draws(car), 6);
  for (const mesh of visible(car)) {
    assert.ok(mesh.getVerticesData('color').length === mesh.getTotalVertices() * 4);
    assert.ok(!mesh.isPickable);
  }
}));

test('rival disposal does not retain temporary materials or damage another car', () => fixture(scene => {
  const before = scene.materials.length;
  const a = buildRival(scene, '#ff4444');
  const b = buildRival(scene, '#44aaff');
  // Babylon may lazily add its scene-owned default material during merges.
  assert.ok(scene.materials.length <= before + 5);
  a.dispose(false, true);
  assert.equal(draws(b), 6);
  b.metadata.updateDetail(100);
  assert.equal(draws(b), 1);
  b.dispose(false, true);
  assert.ok(scene.materials.length <= before + 1);
}));
