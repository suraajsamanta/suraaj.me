import assert from 'node:assert/strict';
import test from 'node:test';
import { createRace, currentLap, MAX_SPEED, raceResults, stepRace, type GamePlayer } from './simulation';
import { BARRIER_OFFSET, BOOST_FRACTIONS, BOOST_LANES, circularDistance, TRACK_LENGTH, trackPose, type Vec3 } from './track';

const driver = (id: string, steer = 0): GamePlayer => ({ id, name: `Racer ${id}`, color: '#ffbd59', input: { steer, accelerate: true, brake: false } });
const advance = (race: ReturnType<typeof createRace>, players: GamePlayer[], seconds: number, autoSteer = true) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) stepRace(race, players, 1 / 60, autoSteer);
};

// Match the renderer's right-handed chase-camera projection, not the misleading
// sign of trackPose's lane axis. Positive projected X is visually right.
function screenX(point: Vec3, distance: number, speed: number): number {
  const eye = trackPose(distance - 9 - speed * 0.06, 0, 5.6).position;
  const target = trackPose(distance + 13 + speed * 0.1, 0, 0.85).position;
  const backward = eye.map((value, axis) => value - target[axis]);
  const length = Math.hypot(...backward);
  const z = backward.map((value) => value / length);
  const rightLength = Math.hypot(z[0], z[2]);
  const right = [z[2] / rightLength, 0, -z[0] / rightLength];
  const delta = point.map((value, axis) => value - eye[axis]);
  const depth = -delta.reduce((sum, value, axis) => sum + value * z[axis], 0);
  return delta.reduce((sum, value, axis) => sum + value * right[axis], 0) / depth;
}

test('closed 3D circuit wraps at the start line', () => {
  assert.ok(TRACK_LENGTH > 600);
  assert.deepEqual(trackPose(0).position, trackPose(TRACK_LENGTH).position);
  assert.ok(Math.abs(circularDistance(TRACK_LENGTH - 1, 1) + 2) < 0.001);
});
test('up to six racers start behind the line and wait for the countdown', () => {
  const players = Array.from({ length: 6 }, (_, i) => driver(String(i)));
  const race = createRace(players);
  const positions = race.karts.map((kart) => kart.distance);
  advance(race, players, 2.9);
  assert.deepEqual(race.karts.map((kart) => kart.distance), positions);
  assert.equal(race.karts.length, 6);
  assert.ok(race.karts.every((kart) => currentLap(kart, 3) === 1));
});
test('accelerator, braking, and coasting produce bounded speed', () => {
  const players = [driver('a')], race = createRace(players); race.countdown = 0;
  advance(race, players, 1);
  assert.ok(race.karts[0].speed > 10);
  assert.ok(race.karts[0].speed <= MAX_SPEED);
  players[0].input.brake = true;
  advance(race, players, 1);
  assert.equal(race.karts[0].speed, 0);
});
test('right steering decreases the track lane; guard rails bound and slow impacts', () => {
  const players = [driver('a', 1)], race = createRace(players); race.countdown = 0;
  const initial = race.karts[0].lane;
  advance(race, players, 1);
  assert.ok(race.karts[0].lane < initial);
  race.karts[0].lane = BARRIER_OFFSET + 1; race.karts[0].speed = 30; race.karts[0].bump = 0;
  stepRace(race, players, 1 / 60);
  assert.ok(race.karts[0].lane <= BARRIER_OFFSET - 1.15);
  assert.ok(race.karts[0].speed < 25);
});
test('left and right controls move visually left and right around the full circuit in both modes', () => {
  for (const autoSteer of [true, false]) {
    for (let sample = 0; sample < 48; sample++) {
      const distance = sample / 48 * TRACK_LENGTH;
      const projected = [-1, 0, 1].map((steer) => {
        const players = [driver('a', steer)], race = createRace(players);
        race.countdown = 0;
        Object.assign(race.karts[0], { distance, lane: 0, speed: 20 });
        advance(race, players, 0.15, autoSteer);
        return screenX(trackPose(race.karts[0].distance, race.karts[0].lane).position, distance, 20);
      });
      assert.ok(projected[0] < projected[1], `Left should appear left at sample ${sample}, autoSteer=${autoSteer}`);
      assert.ok(projected[2] > projected[1], `Right should appear right at sample ${sample}, autoSteer=${autoSteer}`);
    }
  }
});
test('auto-steer is on by default and manual driving preserves heading through bends', () => {
  const players = [driver('a')];
  const assisted = createRace(players), explicit = createRace(players), manual = createRace(players);
  for (const race of [assisted, explicit, manual]) {
    race.countdown = 0;
    Object.assign(race.karts[0], { distance: 120, lane: 0, speed: 20 });
  }
  const startYaw = trackPose(manual.karts[0].distance).yaw;
  advance(assisted, players, 0.5);
  advance(explicit, players, 0.5, true);
  advance(manual, players, 0.5, false);
  assert.deepEqual(assisted, explicit);
  const manualYaw = trackPose(manual.karts[0].distance).yaw + manual.karts[0].heading;
  assert.ok(Math.abs(Math.atan2(Math.sin(manualYaw - startYaw), Math.cos(manualYaw - startYaw))) < 0.00001);
  assert.ok(Math.abs(manual.karts[0].heading) > Math.abs(assisted.karts[0].heading) + 0.03);
  assert.ok(Math.abs(manual.karts[0].lane) > Math.abs(assisted.karts[0].lane) + 0.1);
});
test('switching steering modes mid-race keeps progress and honors manual input', () => {
  const players = [driver('a', 1)], race = createRace(players); race.countdown = 0;
  advance(race, players, 1, true);
  const distance = race.karts[0].distance, elapsed = race.elapsed;
  advance(race, players, 0.15, false);
  assert.ok(race.karts[0].distance > distance);
  assert.ok(race.elapsed > elapsed);
  assert.ok(race.karts[0].heading < 0);
  players[0].input.steer = -1;
  const heading = race.karts[0].heading;
  advance(race, players, 0.15, false);
  assert.ok(race.karts[0].heading > heading);
  advance(race, players, 0.15, true);
  assert.ok(Number.isFinite(race.karts[0].heading));
  assert.equal(race.countdown, 0);
  assert.equal(race.karts[0].id, 'a');
});
test('neither steering mode accelerates or turns a parked kart without throttle', () => {
  for (const autoSteer of [true, false]) {
    const players = [driver('a', 1)], race = createRace(players); race.countdown = 0;
    players[0].input.accelerate = false;
    const { distance, lane } = race.karts[0];
    advance(race, players, 2, autoSteer);
    assert.equal(race.karts[0].speed, 0);
    assert.equal(race.karts[0].distance, distance);
    assert.equal(race.karts[0].lane, lane);
    if (!autoSteer) assert.equal(race.karts[0].heading, 0);
  }
});
test('invalid steering is neutralized instead of poisoning the simulation', () => {
  const players = [driver('a', Number.NaN)], race = createRace(players); race.countdown = 0;
  advance(race, players, 1);
  assert.ok(Number.isFinite(race.karts[0].lane));
});
test('boost pads give a timed boost only inside their lane', () => {
  const players = [driver('a')], race = createRace(players); race.countdown = 0;
  race.karts[0].distance = BOOST_FRACTIONS[0] * TRACK_LENGTH; race.karts[0].lane = BOOST_LANES[0];
  stepRace(race, players, 1 / 60);
  assert.ok(race.karts[0].boost > 1.7);
  assert.ok(race.karts[0].padCooldown > 0);
});
test('kart collision separates both racers without changing lap count', () => {
  const players = [driver('a'), driver('b')], race = createRace(players); race.countdown = 0;
  race.karts[0].lane = -0.2; race.karts[1].lane = 0.2;
  race.karts[0].speed = race.karts[1].speed = 20;
  stepRace(race, players, 1 / 60);
  assert.ok(Math.abs(race.karts[0].lane - race.karts[1].lane) >= 1.75);
  assert.ok(race.karts.every((kart) => kart.speed < 20));
  assert.ok(race.karts.every((kart) => currentLap(kart, 3) === 1));
});
test('crossing the grid line is not an extra lap; a whole circuit is', () => {
  const race = createRace([driver('a')]);
  race.karts[0].distance = 1;
  assert.equal(currentLap(race.karts[0], 3), 1);
  race.karts[0].distance = TRACK_LENGTH + 1;
  assert.equal(currentLap(race.karts[0], 3), 2);
});
test('finish order is permanent and unfinished racers receive DNF after the grace period', () => {
  const players = [driver('a'), driver('b')], race = createRace(players, 1); race.countdown = 0;
  race.karts[0].distance = TRACK_LENGTH - 0.1; race.karts[0].speed = 40;
  players[1].input.accelerate = false;
  stepRace(race, players, 1 / 60);
  assert.ok(race.karts[0].finishTime !== null);
  assert.equal(race.complete, false);
  advance(race, players, 25.1);
  assert.equal(race.complete, true);
  const results = raceResults(race, players);
  assert.equal(results[0].id, 'a'); assert.equal(results[0].finished, true);
  assert.equal(results[1].finished, false); assert.equal(results[1].time, null);
});
test('a completed race is immutable until a new race is created', () => {
  const players = [driver('a')], race = createRace(players, 1); race.countdown = 0;
  race.karts[0].distance = TRACK_LENGTH - 0.1; race.karts[0].speed = 40;
  stepRace(race, players, 1 / 60);
  assert.equal(race.complete, true);
  const result = JSON.stringify(race);
  advance(race, players, 2);
  assert.equal(JSON.stringify(race), result);
});
