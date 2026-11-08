import assert from 'node:assert/strict';
import test from 'node:test';
import { createRace, raceResults, stepRace, type GamePlayer } from './simulation';
import { ACTIVE_SHORTCUT, BARRIER_OFFSET, SHORTCUT_LENGTH, SHORTCUT_POINTS, TRACK_LENGTH, TRACK_POINTS, clamp, sampleTrack, selectTrack, shortcutPose, trackPose, wrap, type Vec3 } from './track';
import { SPACE_COURSE, SPACE_LANDMARKS, SPACE_SECTORS } from './spaceCourse';
import { addSpaceScenery, spaceAsteroidLayout, type SceneryGeometry } from './spaceScenery';

test('orbital course is an original continuous 3D route with safe grades and separated ribbons', () => {
  selectTrack('space');
  assert.equal(SPACE_COURSE.controlPoints.length, 24);
  assert.equal(SPACE_COURSE.elevations?.length, 24);
  assert.ok(TRACK_LENGTH > 1600 && TRACK_LENGTH < 1750);
  const sampled = sampleTrack(SPACE_COURSE);
  assert.deepEqual(sampled[0], { ...sampled[sampled.length - 1], distance: 0 });
  assert.ok(Math.max(...sampled.map(point => point.y)) > 60);
  assert.ok(Math.min(...sampled.map(point => point.y)) > 10);
  for (let i = 0; i < sampled.length - 1; i++) {
    const a = sampled[i], b = sampled[i + 1];
    assert.ok(b.distance > a.distance);
    assert.ok(Math.abs(b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z) < 0.19, `grade at ${i}`);
    for (let j = i + 1; j < sampled.length - 1; j++) {
      const other = sampled[j], along = Math.abs(a.distance - other.distance);
      if (Math.min(along, TRACK_LENGTH - along) < 45) continue;
      assert.ok(Math.hypot(a.x - other.x, a.z - other.z) > BARRIER_OFFSET * 2 + 8, `separated roads ${i}/${j}`);
    }
  }
  const beforeSeam = trackPose(TRACK_LENGTH - 0.001), afterSeam = trackPose(0.001);
  assert.ok(Math.hypot(...beforeSeam.position.map((value, i) => value - afterSeam.position[i])) < 0.003);
  // Poses follow the sampled polyline; the two adjacent 4 m segments at the
  // seam may differ slightly, but must never create a visible heading flip.
  assert.ok(Math.abs(Math.atan2(Math.sin(beforeSeam.yaw - afterSeam.yaw), Math.cos(beforeSeam.yaw - afterSeam.yaw))) < 0.05);
  selectTrack('sunset');
});

test('orbital maintenance bridge is genuinely shorter without unrelated road crossings or altitude jumps', () => {
  selectTrack('space');
  const { start, end, side } = ACTIVE_SHORTCUT;
  const mainSpan = (end - start) * TRACK_LENGTH;
  assert.ok(SHORTCUT_LENGTH > mainSpan * 0.65 && SHORTCUT_LENGTH < mainSpan * 0.8);
  for (const fraction of [start, end]) {
    const main = trackPose(fraction * TRACK_LENGTH), branch = shortcutPose(fraction * TRACK_LENGTH);
    assert.ok(Math.hypot(...main.position.map((value, i) => value - branch.position[i])) < 0.01);
    assert.ok(Math.abs(main.forward[1] - branch.forward[1]) < 0.02, 'pitch tangent matches');
  }
  const a = trackPose(start * TRACK_LENGTH), branch = SHORTCUT_POINTS[16];
  assert.ok(((branch.x - a.position[0]) * a.right[0] + (branch.z - a.position[2]) * a.right[2]) * side > 0);
  for (const point of SHORTCUT_POINTS.slice(20, -20)) {
    for (const other of TRACK_POINTS) {
      const f = other.distance / TRACK_LENGTH;
      if (f > start - 0.025 && f < end + 0.025) continue;
      assert.ok(Math.hypot(point.x - other.x, point.z - other.z) > 40);
    }
  }
  // A branch that cuts an S bend can accidentally cross its own main road.
  // A visually unmarked low overpass is unsafe even if collision code rejects it.
  const orientation = (a: { x: number; z: number }, b: { x: number; z: number }, c: { x: number; z: number }) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  for (let i = 2; i < SHORTCUT_POINTS.length - 3; i++) {
    const a = SHORTCUT_POINTS[i], b = SHORTCUT_POINTS[i + 1];
    for (let j = 0; j < TRACK_POINTS.length - 1; j++) {
      const c = TRACK_POINTS[j], d = TRACK_POINTS[j + 1];
      if (Math.min(Math.abs(c.distance / TRACK_LENGTH - start), Math.abs(c.distance / TRACK_LENGTH - end)) < 0.008) continue;
      assert.ok(!(orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0), `branch crosses main at ${i}/${j}`);
    }
  }
  selectTrack('sunset');
});

test('orbital landmarks are tied to the route and every asteroid clears both driving corridors', () => {
  selectTrack('space');
  assert.equal(SPACE_SECTORS[0].start, 0);
  assert.equal(SPACE_SECTORS[SPACE_SECTORS.length - 1].end, 1);
  SPACE_SECTORS.slice(1).forEach((sector, index) => assert.equal(sector.start, SPACE_SECTORS[index].end));
  assert.ok(SPACE_LANDMARKS.station.halfWidth > BARRIER_OFFSET + 1);
  assert.ok(SPACE_LANDMARKS.station.roofHeight > 10);
  const planet = SPACE_LANDMARKS.ringedPlanet;
  for (const fraction of [0.4, 0.44, 0.48, 0.52]) {
    const p = trackPose(fraction * TRACK_LENGTH).position;
    const distance = Math.hypot(...p.map((value, i) => value - planet.center[i]));
    assert.ok(distance > planet.radius + 20 && distance < 290, 'planet safely beside and visible from the sweep');
  }
  const asteroids = spaceAsteroidLayout();
  assert.ok(asteroids.length >= 30 && asteroids.length <= 52);
  assert.deepEqual(asteroids, spaceAsteroidLayout());
  for (const { center, radius } of asteroids) {
    for (const point of [...TRACK_POINTS, ...SHORTCUT_POINTS]) {
      assert.ok(Math.hypot(center[0] - point.x, center[2] - point.z) >= radius + 13);
    }
  }
  selectTrack('sunset');
});

/** A structural sink measures actual primitive budgets without a DOM or GPU. */
function geometryProbe() {
  let vertices = 0, calls = 0, signature = 0;
  const positions: Vec3[] = [];
  const inspect = (points: Vec3[], triangles: number) => {
    calls++;
    vertices += triangles * 3;
    for (const p of points) {
      assert.ok(p.every(Number.isFinite));
      positions.push(p);
      signature += p[0] * 0.17 + p[1] * 0.3 + p[2] * 0.43;
    }
  };
  const geometry: SceneryGeometry = {
    triangle(a, b, c) { inspect([a, b, c], 1); },
    quad(a, b, c, d) { inspect([a, b, c, d], 2); },
    box(center, size) { assert.ok(size.every(value => value > 0)); inspect([center, size], 12); },
    cylinder(center, radius, height, _color, sides = 8) { assert.ok(radius > 0 && height > 0); inspect([center], sides * 3); },
    sphere(center, radius, _color, slices = 10, rings = 6) { assert.ok(radius > 0); inspect([center], slices * rings * 2); },
    beam(a, b, width) { assert.ok(width > 0); inspect([a, b], 8); },
  };
  return { geometry, result: () => ({ vertices, calls, signature, positions }) };
}

test('space scenery is deterministic, finite and under a fixed batched geometry budget', () => {
  selectTrack('space');
  const a = geometryProbe(), b = geometryProbe();
  addSpaceScenery(a.geometry);
  addSpaceScenery(b.geometry);
  assert.deepEqual(a.result(), b.result());
  const { vertices, calls } = a.result();
  assert.ok(vertices > 30000, 'substantial authored geometry');
  assert.ok(vertices < 70000, `static scenery budget, got ${vertices}`);
  assert.ok(calls < 2200, `build-time calls, got ${calls}`);
  // The renderer uploads this entire helper into one world buffer. Increasing
  // the roster to ten does not rebuild or allocate these primitives per viewport.
  selectTrack('sunset');
});

test('ten orbital racers complete three legal laps deterministically, using both routes', () => {
  const run = () => {
    selectTrack('space');
    const players: GamePlayer[] = Array.from({ length: 10 }, (_, i) => ({ id: `orbiter-${i}`, name: `Orbiter ${i}`, color: '#67ddeb', input: { steer: 0, accelerate: true, brake: false } }));
    const race = createRace(players, 3);
    race.countdown = 0;
    const shortcuts = new Set<string>();
    for (let step = 0; step < 60 * 220 && !race.complete; step++) {
      const before = race.karts.map(kart => kart.distance);
      race.karts.forEach((kart, i) => {
        const untilEntrance = ACTIVE_SHORTCUT.start * TRACK_LENGTH - wrap(kart.distance);
        const target = i % 2 === 0 && untilEntrance > 0 && untilEntrance < 45 ? ACTIVE_SHORTCUT.side * 4 : 0;
        players[i].input.steer = clamp((kart.lane - target) * 0.6, -1, 1);
        if (kart.onShortcut) shortcuts.add(kart.id);
      });
      stepRace(race, players, 1 / 60);
      race.karts.forEach((kart, i) => {
        assert.ok(kart.distance >= before[i], 'progress is monotonic');
        assert.ok(kart.distance - before[i] < 2, 'no branch or lap teleports');
        assert.ok([kart.distance, kart.lane, kart.speed, kart.heading].every(Number.isFinite));
        if (kart.finishTime !== null) assert.ok(kart.distance >= 3 * TRACK_LENGTH, 'only full laps finish');
      });
    }
    assert.equal(race.karts.length, 10);
    assert.equal(race.complete, true);
    assert.equal(race.karts.filter(kart => kart.finishTime !== null).length, 10);
    assert.ok(shortcuts.size >= 4 && shortcuts.size < 10, 'both physical routes raced');
    return { results: raceResults(race), shortcuts: [...shortcuts] };
  };
  assert.deepEqual(run(), run());
  selectTrack('sunset');
});
