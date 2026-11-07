import assert from 'node:assert/strict';
import test from 'node:test';
import { absorbPowerHit, collectPowerups, createPowerState, createPowerWorld, DANCE_SECONDS, POWER_UPS, stepPowers, type PowerUp } from './powerups';
import { createRace, stepRace, type GamePlayer } from './simulation';
import { TRACK_LENGTH } from './track';
import { mergeControllerAction } from './actionMerge';

const player = (id: string, action?: number): GamePlayer => ({ id, name: id, color: '#ffffff', input: { steer: 0, accelerate: false, brake: false, ...(action ? { action } : {}) } });
function ready(ids = ['a', 'b']) {
  const players = ids.map(id => player(id));
  const race = createRace(players);
  race.countdown = 0;
  race.karts.forEach((kart, index) => { kart.distance = 40 + index * 15; kart.lane = 0; kart.speed = 30; });
  return { race, players };
}

test('all five original items have clear controls and active-track item boxes', () => {
  assert.deepEqual(Object.keys(POWER_UPS), ['fizz', 'guard', 'slick', 'bolt', 'dance']);
  const world = createPowerWorld();
  assert.equal(world.boxes.length, 12);
  assert.ok(world.boxes.every(box => box.distance > 0 && box.distance < TRACK_LENGTH));
  assert.deepEqual(createPowerState(19).lastAction, 19);
  assert.equal(createPowerState(Number.NaN).lastAction, 0);
});

test('swept collection fills one inventory and shared boxes respawn without replacing an item', () => {
  const { race, players } = ready(['a']);
  const kart = race.karts[0], box = race.powers.boxes[0];
  kart.lane = box.lane; kart.distance = box.distance + 4;
  collectPowerups(race, new Map([[kart.id, box.distance - 4]]));
  assert.ok(kart.power.item);
  assert.equal(kart.power.collected, 1);
  assert.equal(box.cooldown, 4.5);
  const held = kart.power.item;
  stepPowers(race, players, 0.1);
  assert.ok(box.cooldown < 4.5);
  box.cooldown = 0;
  collectPowerups(race, new Map([[kart.id, box.distance - 4]]));
  assert.equal(kart.power.item, held);
  assert.equal(kart.power.collected, 1);
});

test('shared pickup tie is stable across roster order and collection wraps across a lap', () => {
  const first = ready(['a', 'b']), reversed = ready(['b', 'a']);
  for (const { race } of [first, reversed]) {
    race.powers.boxes = [{ id: 0, distance: 0.2, lane: 0, cooldown: 0 }];
    for (const kart of race.karts) { kart.distance = TRACK_LENGTH + 0.3; kart.lane = 0; }
    collectPowerups(race, new Map(race.karts.map(kart => [kart.id, TRACK_LENGTH - 2])));
    assert.ok(race.karts.find(kart => kart.id === 'a')!.power.item);
    assert.equal(race.karts.find(kart => kart.id === 'b')!.power.item, null);
  }
});

test('only a new action press fires, and empty/old/invalid presses never auto-fire a later item', () => {
  const { race, players } = ready(['a']);
  const kart = race.karts[0];
  kart.power.item = 'fizz';
  players[0].input.accelerate = true;
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.used, 0, 'driving never uses an item');
  players[0].input.action = 3;
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.item, null);
  assert.equal(kart.power.used, 1);
  assert.ok(kart.boost >= 2.5);
  kart.power.item = 'guard';
  for (const action of [3, 2, 0, -1, Number.NaN, Infinity]) {
    players[0].input.action = action;
    stepPowers(race, players, 1 / 60);
  }
  assert.equal(kart.power.item, 'guard');
  players[0].input.action = 4;
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.shield, 8);
  players[0].input.action = 5;
  stepPowers(race, players, 1 / 60);
  kart.power.item = 'slick';
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.item, 'slick');
});

test('fresh races baseline existing controller actions instead of replaying them', () => {
  const players = [player('a', 40)], race = createRace(players);
  race.countdown = 0;
  race.karts[0].power.item = 'fizz';
  stepRace(race, players, 1 / 60);
  assert.equal(race.karts[0].power.used, 0);
  assert.equal(race.karts[0].power.item, 'fizz');
  players[0].input.action = 41;
  stepRace(race, players, 1 / 60);
  assert.equal(race.karts[0].power.used, 1);
});

test('Fizz Boost clears slowdown; Foam Guard absorbs one hit then expires normally', () => {
  const { race, players } = ready(['a']);
  const kart = race.karts[0];
  kart.power.item = 'fizz'; kart.power.slow = 2; players[0].input.action = 1;
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.slow, 0);
  assert.ok(kart.speed > 30);
  kart.power.item = 'guard'; players[0].input.action = 2;
  stepPowers(race, players, 1 / 60);
  assert.ok(absorbPowerHit(kart));
  assert.equal(kart.power.shield, 0);
  assert.equal(absorbPowerHit(kart), false);
  kart.power.item = 'guard'; players[0].input.action = 3;
  stepPowers(race, players, 1 / 60);
  for (let i = 0; i < 81; i++) stepPowers(race, players, 0.1);
  assert.equal(kart.power.shield, 0);
});

test('Citrus Slick drops behind, spares its owner, slows one rival and disappears', () => {
  const { race, players } = ready();
  const [owner, rival] = race.karts;
  owner.power.item = 'slick'; players[0].input.action = 1;
  stepPowers(race, players, 1 / 60);
  const hazard = race.powers.hazards[0];
  assert.ok(hazard);
  assert.equal(hazard.distance, owner.distance - 4);
  owner.distance = hazard.distance;
  stepPowers(race, players, 1 / 60);
  assert.equal(owner.power.slow, 0);
  assert.equal(race.powers.hazards.length, 1);
  rival.distance = hazard.distance; rival.lane = hazard.lane;
  stepPowers(race, players, 1 / 60);
  assert.ok(rival.speed < 20);
  assert.ok(rival.power.slow > 1);
  assert.equal(race.powers.hazards.length, 0);
  assert.equal(owner.power.slow, 0);
});

test('shield blocks a slick with no speed penalty; temporary hit immunity prevents stacked penalties', () => {
  const { race, players } = ready();
  const [owner, rival] = race.karts;
  rival.power.shield = 5;
  const hazard = { id: 1, ownerId: owner.id, distance: rival.distance, lane: rival.lane, life: 5 };
  race.powers.hazards.push(hazard);
  stepPowers(race, players, 1 / 60);
  assert.equal(rival.speed, 30);
  assert.equal(rival.power.shield, 0);
  race.powers.hazards.push({ ...hazard, life: 5 });
  stepPowers(race, players, 1 / 60);
  assert.equal(rival.speed, 30);
});

test('Bubble Bolt homes slowly, hits ahead across the line, and can be dodged', () => {
  const { race, players } = ready();
  const [owner, rival] = race.karts;
  owner.distance = TRACK_LENGTH - 7; rival.distance = TRACK_LENGTH - 0.5;
  owner.power.item = 'bolt'; players[0].input.action = 1;
  for (let i = 0; i < 5; i++) stepPowers(race, players, 1 / 60);
  assert.ok(rival.power.slow > 0);
  assert.equal(owner.power.slow, 0);
  assert.equal(race.powers.projectiles.length, 0);
  rival.power.slow = 0; rival.power.hitCooldown = 0; rival.distance = 53; rival.lane = 6;
  owner.distance = 40; owner.lane = -6; owner.power.item = 'bolt'; players[0].input.action = 2;
  for (let i = 0; i < 20; i++) stepPowers(race, players, 1 / 60);
  assert.equal(rival.power.slow, 0, 'large lateral evasive move dodges slow homing');
});

test('expired hazards and bolts are removed; finished racers cannot use or collect items', () => {
  const { race, players } = ready();
  const [owner, rival] = race.karts;
  for (const item of ['slick', 'bolt'] as PowerUp[]) {
    owner.power.item = item; players[0].input.action = (players[0].input.action ?? 0) + 1;
    stepPowers(race, players, 1 / 60);
  }
  rival.lane = 100;
  for (let i = 0; i < 100; i++) stepPowers(race, players, 0.1);
  assert.equal(race.powers.hazards.length, 0);
  assert.equal(race.powers.projectiles.length, 0);
  owner.finishTime = 20; owner.power.item = 'fizz'; players[0].input.action = 100;
  stepPowers(race, players, 1 / 60);
  assert.equal(owner.power.item, 'fizz');
  const box = race.powers.boxes[0]; owner.power.item = null; owner.distance = box.distance; owner.lane = box.lane;
  collectPowerups(race, new Map([[owner.id, owner.distance]]));
  assert.equal(owner.power.item, null);
});

test('countdown and completed state never mutate powerups', () => {
  const { race, players } = ready(['a']);
  race.karts[0].power.item = 'guard'; players[0].input.action = 1;
  for (const state of [{ countdown: 1, complete: false }, { countdown: 0, complete: true }]) {
    Object.assign(race, state);
    const before = JSON.stringify(race);
    stepPowers(race, players, 1 / 60);
    collectPowerups(race, new Map());
    assert.equal(JSON.stringify(race), before);
  }
});


test('controller action stays at its high-water mark after neutral or stale packets', () => {
  const players = [player('controller')], race = createRace(players); race.countdown = 0;
  const kart = race.karts[0];
  let state = { lastControllerAction: 0, localAction: 0 };
  const send = (action: number) => {
    state = mergeControllerAction(state.lastControllerAction, state.localAction, action);
    players[0].input.action = state.localAction;
    stepRace(race, players, 1 / 60);
  };
  kart.power.item = 'guard'; send(1);
  assert.equal(kart.power.used, 1);
  kart.power.item = 'fizz'; send(0); send(1);
  assert.equal(kart.power.used, 1, 'old action must not consume a later item');
  assert.equal(kart.power.item, 'fizz');
  send(2);
  assert.equal(kart.power.used, 2, 'a new action still fires');
});


test('dance activates only from a fresh use, counts once, and expires without replaying', () => {
  const { race, players } = ready(['a']);
  const kart = race.karts[0];
  kart.power.item = 'dance';
  players[0].input.accelerate = true;
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.dance, 0);
  players[0].input.action = 1;
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.used, 1);
  assert.equal(kart.power.item, null);
  assert.equal(kart.power.dance, DANCE_SECONDS);
  assert.equal(kart.speed, 0);
  assert.equal(kart.boost, 0);
  kart.power.item = 'fizz';
  players[0].input.action = 2;
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.item, 'fizz', 'presses during dance cannot fire');
  for (let i = 0; i < 40; i++) stepPowers(race, players, 0.1);
  assert.equal(kart.power.dance, 0);
  assert.equal(kart.power.used, 1);
  assert.equal(kart.power.item, 'fizz', 'old press does not auto-fire after dance');
  players[0].input.action = 3;
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.used, 2);
});

test('dance can be collected from deterministic item boxes and cannot start disconnected or after finishing', () => {
  const { race, players } = ready(['a']);
  const kart = race.karts[0];
  const seen = new Set<PowerUp>();
  for (let i = 0; i < 30; i++) {
    const box = race.powers.boxes[i % race.powers.boxes.length];
    box.cooldown = 0; kart.power.item = null; kart.lane = box.lane; kart.distance = box.distance;
    collectPowerups(race, new Map([[kart.id, kart.distance]]));
    if (kart.power.item) seen.add(kart.power.item);
  }
  assert.ok(seen.has('dance'));
  kart.power.item = 'dance';
  stepPowers(race, [], 1 / 60);
  assert.equal(kart.power.used, 0);
  kart.finishTime = 10; players[0].input.action = 1;
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.dance, 0);
  assert.equal(kart.power.used, 0);
});
