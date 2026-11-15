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

// Every course uses the same source of truth for rendering, driving and gates.
import { TRACKS, getTrack, isTrackId, orbitalCourse, ROAD_WIDTH } from './course.ts';

test('track registry preserves Seattle and exposes a genuinely different orbital circuit', () => {
  assert.deepEqual(TRACKS.map((track) => track.id), ['seattle', 'orbit']);
  assert.equal(getTrack('seattle').points, course);
  assert.equal(getTrack('orbit').points, orbitalCourse);
  assert.equal(orbitalCourse.length, 216);
  assert.equal(getTrack('orbit').roadWidth, ROAD_WIDTH);
  assert.ok(Math.max(...orbitalCourse.map((point) => point.y)) > 26);
  assert.ok(Math.max(...orbitalCourse.map((point) => point.x)) > 119);
  assert.notDeepEqual(orbitalCourse, course);
  for (const id of ['seattle', 'orbit']) assert.equal(isTrackId(id), true);
  for (const id of ['space', '', null, undefined, {}, 1]) assert.equal(isTrackId(id), false);
});

test('orbital road is continuous, smooth enough to drive, and has unambiguous progress', () => {
  let distance = 0;
  for (let i = 0; i < orbitalCourse.length; i++) {
    const p = orbitalCourse[i], q = orbitalCourse[(i + 1) % orbitalCourse.length];
    const gap = Math.hypot(q.x - p.x, q.z - p.z);
    distance += Math.hypot(gap, q.y - p.y);
    assert.ok(gap > 2 && gap < 5, `uniformly detailed segment ${i}`);
    assert.ok(Math.abs(q.y - p.y) / gap < 0.22, `drivable grade at ${i}`);
    const difference = heading(i + 1, orbitalCourse) - heading(i, orbitalCourse);
    assert.ok(Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))) < 0.22,
      `smooth bend at ${i}`);
    const point = locate(p.x, p.z, orbitalCourse);
    assert.ok(Math.abs(point.progress - i) < 1e-7);
    assert.ok(Math.abs(point.y - p.y) < 1e-7);
    assert.ok(point.distance < 1e-7);
  }
  assert.ok(distance > 790 && distance < 810);
  assert.equal(heading(-1, orbitalCourse), heading(orbitalCourse.length - 1, orbitalCourse));
  assert.equal(heading(orbitalCourse.length, orbitalCourse), heading(0, orbitalCourse));
});

test('orbital racing surface does not cross or fold over itself', () => {
  const { positions, indices } = roadTriangles(orbitalCourse);
  const point = (i) => ({ x: positions[i * 3], z: positions[i * 3 + 2] });
  const orient = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const n = orbitalCourse.length;
  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let side = 0; side < 2; side++) {
      edges.push({ a: point(i * 2 + side), b: point(((i + 1) % n) * 2 + side), i, side });
    }
  }
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i], b = edges[j];
      if (a.side === b.side && (a.i === b.i || (a.i + 1) % n === b.i || (b.i + 1) % n === a.i)) continue;
      const crosses = orient(a.a, a.b, b.a) * orient(a.a, a.b, b.b) < 0 &&
        orient(b.a, b.b, a.a) * orient(b.a, b.b, a.b) < 0;
      assert.equal(crosses, false, `edges ${i} and ${j} intersect`);
    }
  }
  for (let i = 0; i < indices.length; i += 3) {
    // A consistent winding also detects an inner edge folded by a tight turn.
    assert.ok(orient(point(indices[i]), point(indices[i + 1]), point(indices[i + 2])) < -1);
  }
});

test('orbital gates use their own circuit length and reject backwards laps', () => {
  const length = orbitalCourse.length;
  for (const gate of [54, 108, 162]) {
    assert.equal(crossedForward(gate - 0.3, gate + 0.2, gate, length), true);
    assert.equal(crossedForward(gate + 0.2, gate - 0.3, gate, length), false);
  }
  assert.equal(crossedForward(length - 0.3, 0.2, 0, length), true);
  assert.equal(crossedForward(0.2, length - 0.3, 0, length), false);
});

test('Rapier orbital surface matches centerline, hills, both road edges and finish seam', async () => {
  await R.init();
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  try {
    const { positions, indices } = roadTriangles(orbitalCourse, getTrack('orbit').roadWidth);
    world.createCollider(R.ColliderDesc.trimesh(positions, indices));
    world.step();
    for (let i = 0; i < orbitalCourse.length; i++) {
      // Interior segment samples avoid Rapier's float32 shared-edge ray ambiguity.
      // Include the closing segment, so this also verifies the finish-line seam.
      const a = orbitalCourse[i], b = orbitalCourse[(i + 1) % orbitalCourse.length];
      const p = { x: a.x * .57 + b.x * .43, y: a.y * .57 + b.y * .43, z: a.z * .57 + b.z * .43 };
      for (const offset of [-4.9, 0, 4.9]) {
        const x = p.x + Math.cos(heading(i, orbitalCourse)) * offset;
        const z = p.z - Math.sin(heading(i, orbitalCourse)) * offset;
        const hit = world.castRay(new R.Ray({ x, y: 45, z }, { x: 0, y: -1, z: 0 }), 50, true);
        assert.ok(hit, `surface at orbital sample ${i}, offset ${offset}`);
        assert.ok(Math.abs(45 - hit.timeOfImpact - p.y) < 0.65);
      }
    }
    assert.equal(world.castRay(new R.Ray({ x: 0, y: 45, z: 0 }, { x: 0, y: -1, z: 0 }), 50, true), null);
  } finally {
    world.free();
  }
});
