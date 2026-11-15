import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { course, roadTriangles, getTrack } from './course.ts';

// Compile the isolated browser scene module without a DOM, WebGL, or generated files.
const source = await readFile(new URL('./track.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const compiled = outputText.replace(/from '(@babylonjs[^']+)'/g,
  (_, specifier) => `from '${import.meta.resolve(`${specifier}.js`)}'`);
const { buildTrack } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('Seattle scenery renders as a small static material batch set', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const camera = new FreeCamera('camera', new Vector3(0, 10, -100), scene);
    camera.setTarget(Vector3.Zero());
    new HemisphericLight('light', Vector3.Up(), scene);
    buildTrack(scene, course.map(p => new Vector3(p.x, p.y, p.z)));
    scene.render();
    assert.ok(scene.meshes.length <= 22, `mobile batch budget: ${scene.meshes.length}`);
    assert.ok(scene.materials.some(m => m.name === 'seattle-conservatory-glass'));
    for (const mesh of scene.meshes) {
      assert.equal(mesh.isPickable, false);
      assert.ok(mesh.isWorldMatrixFrozen);
      assert.ok(mesh.getVerticesData('position').every(Number.isFinite));
    }
    const road = scene.meshes.find(m => m.material.name === 'seattle-wet-asphalt');
    const positions = road.getVerticesData('position');
    const physics = roadTriangles().positions;
    assert.equal(positions.length, physics.length);
    // Same centerline, width, elevation, and closing seam as the physics collider.
    // Render vertices run in the opposite side order with a 2.5 cm surface lift.
    for (let i = 0; i < course.length; i++) {
      for (let side = 0; side < 2; side++) {
        for (let axis = 0; axis < 3; axis++) {
          const visual = positions[i * 6 + side * 3 + axis];
          const collider = physics[i * 6 + (1 - side) * 3 + axis];
          assert.ok(Math.abs(visual - collider - (axis === 1 ? .025 : 0)) < .0001,
            `road/collider alignment at ${i}, side ${side}, axis ${axis}`);
        }
      }
    }
    assert.ok(road.getVerticesData('normal').filter((_, i) => i % 3 === 1).every(y => y > .8));
  } finally {
    engine.dispose();
  }
});


test('Orbital set is distinct, finite, static, and aligned to its own collider', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const config = getTrack('orbit');
    const camera = new FreeCamera('camera', new Vector3(0, 18, -120), scene);
    camera.setTarget(Vector3.Zero());
    new HemisphericLight('light', Vector3.Up(), scene);
    buildTrack(scene, config.points.map(p => new Vector3(p.x, p.y, p.z)), config.id);
    scene.render();
    assert.ok(scene.meshes.length <= 14, `orbital draw budget: ${scene.meshes.length}`);
    assert.ok(scene.materials.some(m => m.name === 'orbit-planet-ocean'));
    assert.ok(!scene.materials.some(m => m.name.startsWith('seattle-')));
    for (const mesh of scene.meshes) {
      assert.equal(mesh.isPickable, false);
      assert.ok(mesh.isWorldMatrixFrozen);
      assert.ok(mesh.getVerticesData('position').every(Number.isFinite));
    }
    const road = scene.meshes.find(m => m.material.name === 'orbit-racing-surface');
    const positions = road.getVerticesData('position');
    const physics = roadTriangles(config.points).positions;
    assert.equal(positions.length, physics.length);
    for (let i = 0; i < config.points.length; i++) {
      for (let side = 0; side < 2; side++) {
        for (let axis = 0; axis < 3; axis++) {
          const visual = positions[i * 6 + side * 3 + axis];
          const collider = physics[i * 6 + (1 - side) * 3 + axis];
          assert.ok(Math.abs(visual - collider - (axis === 1 ? .025 : 0)) < .0001,
            `orbital alignment at ${i}, side ${side}, axis ${axis}`);
        }
      }
    }
    assert.ok(road.getVerticesData('normal').filter((_, i) => i % 3 === 1).every(y => y > .8));
    assert.ok(scene.meshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0) < 80000, 'mobile geometry budget');
  } finally { engine.dispose(); }
});
