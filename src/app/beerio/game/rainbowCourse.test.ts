import assert from 'node:assert/strict';
import test from 'node:test';
import { createRace, stepRace, kartWorldPose, FALL_SECONDS, type GamePlayer, type RaceState } from './simulation';
import { ACTIVE_SHORTCUT, ACTIVE_TRACK, BARRIER_OFFSET, ROAD_HALF_WIDTH, SHORTCUT_LENGTH, SHORTCUT_POINTS, TRACK_LENGTH, TRACK_POINTS, TRACKS, clamp, selectTrack, shortcutPose, trackCurve, trackPose, wrap, type Vec3 } from './track';
import { RAINBOW_COURSE, RAINBOW_COLORS, rainbowPanel } from './rainbowCourse';
import { addRainbowScenery, type RainbowGeometry } from './rainbowScenery';
import { kartCameraTargets } from './renderer';
import { createCircuitMap } from './minimap';
import { collectPowerups, stepPowers } from './powerups';

const driver = (id = 'a'): GamePlayer => ({ id, name: id, color: '#fd3', input: { steer: 0, accelerate: true, brake: false, action: 0 } });
function setup(count = 1) {
  selectTrack('rainbow');
  const players = Array.from({ length: count }, (_, i) => driver(String(i)));
  const race = createRace(players); race.countdown = 0;
  return { players, race, kart: race.karts[0] };
}
function advance(race: RaceState, players: GamePlayer[], seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepRace(race, players, 1 / 60);
}

test('Prism Skyway is a unique continuous elevated ribbon with safe road geometry and a real bypass', () => {
  selectTrack('rainbow');
  assert.equal(ACTIVE_TRACK, RAINBOW_COURSE);
  assert.equal(TRACKS.length, 7);
  assert.equal(RAINBOW_COURSE.edgeBehavior, 'fall');
  assert.equal(RAINBOW_COURSE.controlPoints.length, RAINBOW_COURSE.elevations?.length);
  assert.ok(TRACK_LENGTH > 1700 && TRACK_LENGTH < 2300, `${TRACK_LENGTH}m course`);
  assert.deepEqual(TRACK_POINTS[0], { ...TRACK_POINTS.at(-1), distance: 0 });
  assert.ok(Math.min(...TRACK_POINTS.map(p => p.y)) > 30);
  assert.ok(Math.max(...TRACK_POINTS.map(p => p.y)) > 90);
  for (let i = 0; i < TRACK_POINTS.length - 1; i++) {
    const a = TRACK_POINTS[i], b = TRACK_POINTS[i + 1];
    assert.ok(b.distance > a.distance);
    assert.ok(Math.abs(b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z) < .25, `grade ${i}`);
    assert.ok(Math.abs(trackCurve(a.distance)) < 1 / 9, `unfolded road at ${i}`);
    for (let j = i + 1; j < TRACK_POINTS.length - 1; j++) {
      const c = TRACK_POINTS[j], along = Math.abs(a.distance - c.distance);
      if (Math.min(along, TRACK_LENGTH - along) < 35) continue;
      assert.ok(Math.hypot(a.x - c.x, a.z - c.z) > 24, `separated road ${i}/${j}`);
    }
  }
  const span = (ACTIVE_SHORTCUT.end - ACTIVE_SHORTCUT.start) * TRACK_LENGTH;
  assert.ok(SHORTCUT_LENGTH < span * .95 && SHORTCUT_LENGTH > span * .5, `bypass ${SHORTCUT_LENGTH}/${span}`);
  for (const f of [ACTIVE_SHORTCUT.start, ACTIVE_SHORTCUT.end]) {
    const a = trackPose(f * TRACK_LENGTH), b = shortcutPose(f * TRACK_LENGTH);
    assert.ok(Math.hypot(...a.position.map((v, i) => v - b.position[i])) < 1e-6);
    assert.ok(Math.abs(a.forward[1] - b.forward[1]) < .025);
  }
  for (const branch of SHORTCUT_POINTS) for (const main of TRACK_POINTS) {
    if (Math.hypot(branch.x - main.x, branch.z - main.z) < 14) assert.ok(Math.abs(branch.y - main.y) < .2, 'level joins cannot slice through a kart');
  }
  const map = createCircuitMap(RAINBOW_COURSE);
  assert.ok(!map.path.includes('NaN') && !map.branch.includes('NaN'));
});

test('both exposed edges cause a visible gravity-driven fall with assist on or off', () => {
  for (const assisted of [true, false]) for (const side of [-1, 1]) {
    const { race, players, kart } = setup();
    kart.distance = 35; kart.lane = side * 6.95; kart.speed = 35; kart.lateral = side * 8; kart.heading = side * .4;
    players[0].input.steer = -side;
    stepRace(race, players, 1 / 60, assisted);
    assert.ok(kart.fall, `${side} edge, assist ${assisted}`);
    const initial = kartWorldPose(kart).position;
    assert.ok(Math.abs(kart.lane) > ROAD_HALF_WIDTH && Math.abs(kart.lane) < BARRIER_OFFSET);
    advance(race, players, .8);
    const falling = kartWorldPose(kart).position, camera = kartCameraTargets(kart);
    assert.ok(falling[1] < initial[1] - 7, 'physical descent, not just a timer');
    assert.ok(Math.hypot(falling[0] - initial[0], falling[2] - initial[2]) > 15, 'retains launch momentum');
    assert.ok(camera.eye[1] > initial[1] && camera.target[1] < initial[1], 'camera watches kart drop below road');
    assert.ok([...falling, ...camera.eye, ...camera.target].every(Number.isFinite));
    assert.equal(kart.distance, 35, 'falling cannot earn race progress');
  }
});

test('falling respawns centered on the same route without a free boost or a phantom lap or finish', () => {
  for (const branch of [false, true]) {
    const { race, players, kart } = setup();
    race.laps = 1;
    kart.distance = branch ? (ACTIVE_SHORTCUT.start + .04) * TRACK_LENGTH : TRACK_LENGTH - .1;
    kart.onShortcut = branch; kart.lane = ROAD_HALF_WIDTH + .2; kart.speed = 58; kart.boost = 3; kart.drifting = true; kart.driftCharge = 2;
    const progress = kart.distance;
    advance(race, players, FALL_SECONDS);
    assert.equal(kart.fall, null);
    assert.equal(kart.distance, progress); assert.equal(kart.onShortcut, branch);
    assert.equal(kart.finishTime, null); assert.equal(race.firstFinish, null); assert.equal(race.complete, false);
    assert.equal(kart.lane, 0); assert.equal(kart.speed, 0); assert.equal(kart.heading, 0); assert.equal(kart.boost, 0); assert.equal(kart.driftCharge, 0);
    assert.ok(kart.respawnGrace > 1);
    assert.deepEqual(kartWorldPose(kart).position, (branch ? shortcutPose : trackPose)(progress).position);
    stepRace(race, players, 1 / 60);
    assert.ok(kart.distance > progress, 'normal driving resumes');
  }
});

test('falling and respawn teleports cannot sweep boxes or collide with grounded racers', () => {
  const { race, players, kart } = setup(2);
  const box = race.powers.boxes[1]; kart.distance = box.distance; kart.lane = 7.1;
  race.karts[1].distance = box.distance; race.karts[1].lane = 0;
  players.forEach(p => { p.input.accelerate = false; });
  stepRace(race, players, 1 / 60);
  // Use a fresh center box and retain the second driver's inventory to prove the fallen kart cannot consume it.
  box.cooldown = 0; race.karts[1].power.item = 'guard';
  advance(race, players, FALL_SECONDS - 1 / 60);
  assert.equal(kart.fall, null); assert.equal(kart.power.item, null); assert.equal(box.cooldown, 0);
  assert.equal(kart.lane, 0); assert.equal(race.karts[1].lane, 0, 'respawn overlap is temporarily non-colliding');
  collectPowerups(race, new Map([[kart.id, box.distance - 10]]), undefined, undefined, new Map([[kart.id, -7]]));
  assert.equal(kart.power.item, null); assert.equal(box.cooldown, 0, 'teleport segment is not a pickup sweep');
});

test('falling excludes item activations, targeting, hazards and projectiles, while consuming stale input', () => {
  const { race, players, kart } = setup(2);
  kart.distance = 100; kart.lane = 7.2; kart.power.item = 'fizz';
  const rival = race.karts[1]; rival.distance = 90; rival.lane = 0;
  players[0].input.action = 1;
  stepRace(race, players, 1 / 60);
  assert.ok(kart.fall); assert.equal(kart.power.item, 'fizz'); assert.equal(kart.power.used, 0); assert.equal(kart.power.lastAction, 1); assert.equal(kart.power.hitLabel, 'Wait until back on track');
  for (const item of ['dance', 'twerk', 'lightning', 'splat', 'diddy', 'bolt', 'crown'] as const) {
    rival.power.item = item; players[1].input.action = (players[1].input.action ?? 0) + 1;
    stepPowers(race, players, 1 / 60);
    assert.equal(kart.power.dance, 0); assert.equal(kart.power.lightning, 0); assert.equal(kart.power.splatter, 0); assert.equal(kart.power.oil, 0);
  }
  race.powers.hazards.push({ id: 90, ownerId: rival.id, distance: 100, lane: kart.lane, life: 3 });
  race.powers.projectiles.push({ id: 91, ownerId: rival.id, distance: 99, lane: kart.lane, life: 3 }, { id: 92, ownerId: rival.id, distance: 99, lane: kart.lane, life: 3, kind: 'crown', targetId: kart.id });
  stepPowers(race, players, .02);
  assert.equal(kart.power.slow, 0); assert.equal(kart.power.leaderWarning, 0);
  assert.ok(race.powers.hazards.some(h => h.id === 90), 'falling racers do not consume surface hazards');
  assert.ok(!race.powers.projectiles.some(p => p.id === 92), 'comet cancels a target in the void');
  players[1].input.accelerate = false;
  advance(race, players, 3.2);
  assert.equal(kart.power.used, 0, 'a held action does not fire after recovery');
  players[0].input.action = 2;
  stepRace(race, players, 1 / 60);
  assert.equal(kart.power.used, 1, 'a fresh press after recovery activates the held item');
  stepRace(race, players, 1 / 60);
  assert.equal(kart.power.used, 1, 'the same action sequence cannot activate twice');
});

test('ordinary contact can push racers off but a protective item is not an invisible edge rail', () => {
  const { race, players, kart } = setup(2);
  players.forEach(p => { p.input.accelerate = false; });
  kart.distance = 40; kart.lane = 6.9;
  race.karts[1].distance = 40; race.karts[1].lane = 5.8;
  stepRace(race, players, 1 / 60); assert.ok(kart.fall);
  for (const effect of ['shield', 'prism'] as const) {
    const next = setup(); next.kart.power[effect] = 4; next.kart.lane = 7.2;
    stepRace(next.race, next.players, 1 / 60); assert.ok(next.kart.fall, effect);
  }
});

test('fall timers pause during countdown, reject invalid dt, and reset for a rematch or course change', () => {
  const { race, players, kart } = setup(); kart.lane = 7.2;
  stepRace(race, players, 1 / 60); assert.ok(kart.fall);
  const snapshot = JSON.stringify(race);
  for (const dt of [0, -1, NaN, Infinity]) stepRace(race, players, dt);
  assert.equal(JSON.stringify(race), snapshot);
  race.countdown = 1; const elapsed = kart.fall.elapsed;
  stepRace(race, players, .5); assert.equal(kart.fall.elapsed, elapsed);
  const rematch = createRace(players); assert.equal(rematch.karts[0].fall, null); assert.equal(rematch.karts[0].respawnGrace, 0);
  for (const track of TRACKS.filter(t => t.id !== 'rainbow')) {
    selectTrack(track.id);
    const old = createRace(players); old.countdown = 0; old.karts[0].lane = 12;
    stepRace(old, players, 1 / 60);
    assert.equal(old.karts[0].fall, null); assert.ok(Math.abs(old.karts[0].lane) <= BARRIER_OFFSET - 1.15 + 1e-6);
  }
  selectTrack('rainbow'); assert.equal(createRace(players).karts[0].fall, null);
});

test('rainbow scenery and colors are deterministic with no props in either driving corridor', () => {
  selectTrack('rainbow');
  const probe = () => {
    let vertices = 0;
    const points: Vec3[] = [];
    const check = (p: Vec3, margin = 0) => {
      assert.ok(p.every(Number.isFinite)); points.push(p);
      for (const road of [...TRACK_POINTS, ...SHORTCUT_POINTS]) assert.ok(Math.hypot(p[0] - road.x, p[1] - road.y, p[2] - road.z) > margin + 16);
    };
    const g: RainbowGeometry = {
      sphere(p, radius, _color, slices = 10, rings = 6) { check(p, radius); vertices += slices * rings * 6; },
      beam(a, b) { check(a); check(b); vertices += 24; },
      triangle(a, b, c) { check(a); check(b); check(c); vertices += 3; },
    };
    addRainbowScenery(g); return { vertices, points };
  };
  const first = probe(); assert.deepEqual(first, probe());
  assert.ok(first.vertices > 15000 && first.vertices < 30000);
  assert.equal(new Set(RAINBOW_COLORS.map(c => c.join(','))).size, 7);
  for (let i = 0; i < 7; i++) for (const panel of [0, 5]) assert.ok(rainbowPanel(i, panel).every(n => n >= 0 && n <= 1));
});

test('ten drivers can complete the original course on both routes without automatic falls', () => {
  const { race, players } = setup(10); race.laps = 1;
  const branches = new Set<string>();
  for (let frame = 0; frame < 60 * 100 && !race.complete; frame++) {
    race.karts.forEach((kart, i) => {
      const untilBranch = ACTIVE_SHORTCUT.start * TRACK_LENGTH - wrap(kart.distance);
      const target = i % 2 === 0 && untilBranch > 0 && untilBranch < 40 ? ACTIVE_SHORTCUT.side * 3.8 : 0;
      players[i].input.steer = clamp((kart.lane - target) * .6, -1, 1);
      if (kart.onShortcut) branches.add(kart.id);
    });
    stepRace(race, players, 1 / 60);
    for (const kart of race.karts) { assert.equal(kart.fall, null, `driver ${kart.id} can follow the road`); assert.ok([kart.lane, kart.distance, kart.speed].every(Number.isFinite)); }
  }
  assert.equal(race.complete, true); assert.equal(race.karts.filter(k => k.finishTime !== null).length, 10);
  assert.ok(branches.size > 0 && branches.size < 10);
  selectTrack('sunset');
});
