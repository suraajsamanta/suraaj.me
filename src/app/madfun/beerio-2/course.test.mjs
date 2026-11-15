import assert from 'node:assert/strict';
import test from 'node:test';
import { course, locate, roadTriangles, crossedForward, heading } from './course.ts';
import R from '@dimforge/rapier3d-compat';

test('Seattle circuit is contiguous and closed with an elevated section', () => {
  assert.equal(course.length, 180);
  assert.ok(Math.max(...course.map((p) => p.y)) >= 15);
  for (let i = 0; i < course.length; i++) {
    const p = course[i], q = course[(i + 1) % course.length];
    const gap = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
    assert.ok(gap > 0.3 && gap < 6);
    assert.ok(Math.abs(locate(p.x, p.z).progress - i) < 1e-7);
    assert.ok(Math.abs(locate(p.x, p.z).y - p.y) < 1e-7);
  }
});

test('ordered gates and final line count only in the forward direction', () => {
  assert.equal(crossedForward(44.7, 45.2, 45), true);
  assert.equal(crossedForward(45.2, 44.7, 45), false);
  assert.equal(crossedForward(179.7, 0.2, 0), true);
  assert.equal(crossedForward(0.2, 179.7, 0), false);
  assert.equal(crossedForward(0, 0.2, 0), false);
});

test('Rapier WASM detects road height on hill, straight, edges and closed seam', async () => {
  await R.init();
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  try {
    const { positions, indices } = roadTriangles();
    world.createCollider(R.ColliderDesc.trimesh(positions, indices));
    world.step();
    const cast = (x, z) => world.castRay(new R.Ray({ x, y: 45, z }, { x: 0, y: -1, z: 0 }), 50, true);
    for (let i = 0; i < course.length; i += 3) {
      const p = course[i];
      for (const offset of [-4.9, 0, 4.9]) {
        const result = cast(p.x + Math.cos(heading(i)) * offset, p.z - Math.sin(heading(i)) * offset);
        assert.ok(result, `expected surface at sample ${i}, offset ${offset}`);
        assert.ok(Math.abs(45 - result.timeOfImpact - p.y) < 0.65);
      }
    }
    assert.equal(cast(400, 400), null);
  } finally {
    world.free();
  }
});
