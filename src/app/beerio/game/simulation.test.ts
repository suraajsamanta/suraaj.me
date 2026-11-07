import assert from 'node:assert/strict';
import test from 'node:test';
import { createRace, currentLap, MAX_SPEED, raceResults, stepRace, type GamePlayer } from './simulation';
import { BARRIER_OFFSET, BOOST_FRACTIONS, BOOST_LANES, circularDistance, TRACK_LENGTH, trackPose } from './track';

const driver = (id: string, steer = 0): GamePlayer => ({ id, name: `Racer ${id}`, color: '#ffbd59', input: { steer, accelerate: true, brake: false } });
const advance = (race: ReturnType<typeof createRace>, players: GamePlayer[], seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) stepRace(race, players, 1 / 60);
};

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
test('steering moves right, guard rails bound the kart and slow impacts', () => {
  const players = [driver('a', 1)], race = createRace(players); race.countdown = 0;
  const initial = race.karts[0].lane;
  advance(race, players, 1);
  assert.ok(race.karts[0].lane > initial);
  race.karts[0].lane = BARRIER_OFFSET + 1; race.karts[0].speed = 30; race.karts[0].bump = 0;
  stepRace(race, players, 1 / 60);
  assert.ok(race.karts[0].lane <= BARRIER_OFFSET - 1.15);
  assert.ok(race.karts[0].speed < 25);
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
