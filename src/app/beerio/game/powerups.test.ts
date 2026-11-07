import assert from 'node:assert/strict';
import test from 'node:test';
import { absorbPowerHit, collectPowerups, createPowerState, createPowerWorld, DANCE_SECONDS, FLASK_SECONDS, FLASK_PULSE_SECONDS, PRISM_SECONDS, SPLATTER_SECONDS, JET_SECONDS, CROWN_WARNING_SECONDS, powerDrivingState, POWER_UPS, stepPowers, type PowerUp } from './powerups';
import { createRace, stepRace, type GamePlayer } from './simulation';
import { ACTIVE_SHORTCUT, selectTrack, SHORTCUT_LENGTH, TRACKS, TRACK_LENGTH, wrap } from './track';
import { mergeControllerAction } from './actionMerge';

const player = (id: string, action?: number): GamePlayer => ({ id, name: id, color: '#ffffff', input: { steer: 0, accelerate: false, brake: false, ...(action ? { action } : {}) } });
function ready(ids = ['a', 'b']) {
  const players = ids.map(id => player(id));
  const race = createRace(players);
  race.countdown = 0;
  race.karts.forEach((kart, index) => { kart.distance = 40 + index * 15; kart.lane = 0; kart.speed = 30; });
  return { race, players };
}

test('all ten original items have clear controls and active-track item boxes', () => {
  assert.deepEqual(Object.keys(POWER_UPS), ['fizz', 'guard', 'slick', 'bolt', 'dance', 'flask', 'prism', 'splat', 'jet', 'crown']);
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

function tickPowers(race: ReturnType<typeof createRace>, players: GamePlayer[], seconds: number) {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) stepPowers(race, players, 1 / 60);
}
function press(race: ReturnType<typeof createRace>, players: GamePlayer[], index: number, item?: PowerUp) {
  if (item) race.karts[index].power.item = item;
  players[index].input.action = (players[index].input.action ?? 0) + 1;
  stepPowers(race, players, 1 / 60);
}

test('Fizz Flask permits fresh pulses in one fixed window, never heartbeat spam or unlimited refills', () => {
  const { race, players } = ready(['a']);
  const kart = race.karts[0];
  press(race, players, 0, 'flask');
  assert.equal(kart.power.item, 'flask');
  assert.equal(kart.power.flask, FLASK_SECONDS);
  assert.equal(kart.power.used, 1);
  assert.equal(kart.boost, FLASK_PULSE_SECONDS);
  kart.boost = 0;
  tickPowers(race, players, 0.5);
  assert.equal(kart.boost, 0, 'same action is not a repeated pulse');
  const remaining = kart.power.flask;
  press(race, players, 0);
  assert.ok(kart.boost > 0);
  assert.ok(kart.power.flask < remaining, 'a fresh pulse never extends the window');
  assert.equal(kart.power.used, 1, 'reusing one flask is still one item');
  kart.boost = 0;
  press(race, players, 0);
  assert.equal(kart.boost, 0, 'very fast taps obey the pulse cooldown');
  tickPowers(race, players, 7);
  assert.equal(kart.power.flask, 0);
  assert.equal(kart.power.item, null);
  kart.power.item = 'guard';
  for (const action of [players[0].input.action, 0, 1, -1, Number.MAX_SAFE_INTEGER + 1]) {
    players[0].input.action = action;
    stepPowers(race, players, 1 / 60);
  }
  assert.equal(kart.power.item, 'guard', 'stale flask traffic cannot use the next pickup');
});

test('Prism Party clears effects, boosts with manual control, protects repeatedly, and expires', () => {
  const { race, players } = ready(['a']);
  const kart = race.karts[0];
  kart.power.slow = 2; kart.power.splatter = 2;
  press(race, players, 0, 'prism');
  assert.equal(kart.power.prism, PRISM_SECONDS);
  assert.equal(kart.power.slow, 0);
  assert.equal(kart.power.splatter, 0);
  assert.deepEqual(powerDrivingState(kart), { autoDrive: false, maximumSpeed: 58, acceleration: 23, collisionImmune: true });
  for (let i = 0; i < 3; i++) assert.equal(absorbPowerHit(kart), true);
  assert.equal(kart.power.prism, PRISM_SECONDS);
  tickPowers(race, players, PRISM_SECONDS + 0.1);
  assert.equal(kart.power.prism, 0);
  assert.equal(absorbPowerHit(kart), false);
  assert.equal(powerDrivingState(kart).collisionImmune, false);
});

test('Berry Blot affects rivals only, respects protection, never alters their controls, and fades', () => {
  const { race, players } = ready(['owner', 'plain', 'guarded', 'prism', 'finished', 'offline']);
  const [owner, plain, guarded, prism, finished, offline] = race.karts;
  guarded.power.shield = 5; prism.power.prism = 5; finished.finishTime = 10; players[5].connected = false;
  const beforeInput = JSON.stringify(players.map(player => player.input));
  const beforeSpeed = plain.speed;
  press(race, players, 0, 'splat');
  assert.equal(owner.power.splatter, 0);
  assert.equal(plain.power.splatter, SPLATTER_SECONDS);
  assert.equal(plain.speed, beforeSpeed);
  assert.equal(plain.power.slow, 0);
  assert.equal(guarded.power.splatter, 0);
  assert.equal(guarded.power.shield, 0);
  assert.equal(prism.power.splatter, 0);
  assert.equal(finished.power.splatter, 0);
  assert.equal(offline.power.splatter, 0);
  assert.equal(JSON.stringify(players.slice(1).map(player => player.input)), JSON.stringify(JSON.parse(beforeInput).slice(1)));
  tickPowers(race, players, SPLATTER_SECONDS + 0.1);
  assert.equal(plain.power.splatter, 0);
});

test('simultaneous defensive transformations beat splashes independent of roster order', () => {
  const outcomes = [false, true].map(reverse => {
    const { race, players } = ready(['splash', 'guard', 'prism']);
    for (const kart of race.karts) kart.power.item = kart.id === 'splash' ? 'splat' : kart.id === 'guard' ? 'guard' : 'prism';
    players.forEach(player => { player.input.action = 1; });
    if (reverse) { race.karts.reverse(); players.reverse(); }
    stepPowers(race, players, 1 / 60);
    return race.karts.map(kart => ({ id: kart.id, power: kart.power })).sort((a, b) => a.id.localeCompare(b.id));
  });
  assert.deepEqual(outcomes[0], outcomes[1]);
  assert.ok(outcomes[0].every(kart => kart.power.splatter === 0));
});

test('rear-pack Jet Keg uses absolute multi-lap rank, is bounded, and requires a fresh deliberate press', () => {
  const { race, players } = ready(['leader', 'rear']);
  const [leader, rear] = race.karts;
  leader.distance = TRACK_LENGTH + 4; rear.distance = TRACK_LENGTH - 5;
  rear.power.item = 'jet';
  stepPowers(race, players, 1 / 60);
  assert.equal(rear.power.jet, 0);
  press(race, players, 1);
  assert.equal(rear.power.jet, JET_SECONDS);
  assert.equal(powerDrivingState(rear).autoDrive, true);
  assert.equal(rear.distance, TRACK_LENGTH - 5, 'activation cannot teleport');
  assert.equal(absorbPowerHit(rear), true);
  tickPowers(race, players, JET_SECONDS + 0.1);
  assert.equal(rear.power.jet, 0);
  assert.equal(powerDrivingState(rear).autoDrive, false);
  assert.ok(rear.speed <= 43);
  assert.equal(rear.power.used, 1);
  // A leader holding a rear-only pickup gets a useful regular boost, not autopilot.
  press(race, players, 0, 'jet');
  assert.equal(leader.power.jet, 0);
  assert.ok(leader.boost > 2);
});

test('Jet Keg cancels on brake, disconnect, finish, dance, near-finish, and taking the lead', () => {
  for (const mode of ['brake', 'disconnected', 'missing', 'finished', 'dance', 'near-finish', 'leading']) {
    const { race, players } = ready(['leader', 'rear']);
    const [leader, rear] = race.karts;
    leader.distance = 500; rear.distance = 100;
    press(race, players, 1, 'jet');
    rear.speed = 64;
    if (mode === 'brake') players[1].input.brake = true;
    if (mode === 'disconnected') players[1].connected = false;
    if (mode === 'missing') players.pop();
    if (mode === 'finished') rear.finishTime = 20;
    if (mode === 'dance') rear.power.dance = 2;
    if (mode === 'near-finish') rear.distance = TRACK_LENGTH * race.laps - 20;
    if (mode === 'leading') rear.distance = 501;
    stepPowers(race, players, 1 / 60);
    assert.equal(rear.power.jet, 0, mode);
    assert.ok(rear.speed <= 43, mode);
  }
  const { race, players } = ready(['leader', 'rear']);
  players[1].input.brake = true;
  press(race, players, 1, 'jet');
  assert.equal(race.karts[1].power.jet, 0, 'held brake cannot enter autodrive');
});

test('disconnected item traffic is consumed safely without activation or replay on reconnect', () => {
  const { race, players } = ready(['a']);
  const kart = race.karts[0];
  players[0].connected = false; kart.power.item = 'prism'; players[0].input.action = 5;
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.used, 0);
  assert.equal(kart.power.lastAction, 5);
  players[0].connected = true;
  stepPowers(race, players, 1 / 60);
  assert.equal(kart.power.used, 0);
  press(race, players, 0);
  assert.equal(kart.power.used, 1);
});

test('Crown Comet locks the absolute-progress leader, warns, spares bystanders and resolves one hit', () => {
  const { race, players } = ready(['owner', 'bystander', 'leader']);
  const [owner, bystander, leader] = race.karts;
  owner.distance = TRACK_LENGTH - 15; bystander.distance = TRACK_LENGTH - 8; leader.distance = TRACK_LENGTH * 2 - 1;
  press(race, players, 0, 'crown');
  const comet = race.powers.projectiles[0];
  assert.equal(comet.targetId, leader.id, 'wrapped screen position never determines the leader');
  assert.equal(comet.kind, 'crown');
  assert.ok((comet.warning ?? 0) >= CROWN_WARNING_SECONDS - 0.02);
  assert.ok(leader.power.leaderWarning > 1);
  tickPowers(race, players, 1);
  assert.equal(leader.power.slow, 0, 'warning allows time to react');
  assert.equal(bystander.power.slow, 0);
  tickPowers(race, players, 0.7);
  assert.ok(leader.power.slow > 0);
  assert.equal(leader.power.hitLabel, 'Crown Comet hit!');
  assert.equal(bystander.power.slow, 0);
  assert.equal(owner.power.slow, 0);
  assert.equal(race.powers.projectiles.length, 0);
});

test('Crown Comet respects guards, excludes finished/disconnected targets, and does not retarget a bystander', () => {
  for (const protection of ['guard', 'prism', 'jet']) {
    const { race, players } = ready(['owner', 'leader']);
    const target = race.karts[1];
    press(race, players, 0, 'crown');
    if (protection === 'guard') target.power.shield = 5;
    else if (protection === 'prism') target.power.prism = 5;
    else { target.power.jet = 5; race.karts[0].distance = target.distance + 100; }
    tickPowers(race, players, 2.2);
    assert.equal(target.power.slow, 0, protection);
    assert.equal(target.speed, 30, protection);
  }
  for (const end of ['finish', 'disconnect', 'leave']) {
    const { race, players } = ready(['owner', 'other', 'leader']);
    const target = race.karts[2];
    press(race, players, 0, 'crown');
    if (end === 'finish') target.finishTime = 10;
    if (end === 'disconnect') players[2].connected = false;
    if (end === 'leave') players.pop();
    stepPowers(race, players, 1 / 60);
    assert.equal(race.powers.projectiles.length, 0, end);
    assert.equal(race.karts[1].power.slow, 0, end);
  }
});

test('six- and ten-racer item selection and effects are deterministic under reordered rosters', () => {
  for (const count of [6, 10]) {
    const ids = Array.from({ length: count }, (_, i) => `racer-${i}`);
    const first = ready(ids), second = ready(ids);
    for (const { race, players } of [first, second]) {
      race.powers.boxes = [];
      race.karts.forEach((kart, i) => {
        kart.distance = TRACK_LENGTH * (2 - i % 3) + 100 + i * 6;
        kart.lane = i % 2 ? -3 : 3;
        kart.power.item = (['prism', 'splat', 'guard', 'bolt', 'crown', 'flask', 'slick', 'jet', 'dance', 'fizz'] as PowerUp[])[i];
        players[i].input.action = 1;
      });
    }
    second.race.karts.reverse(); second.players.reverse();
    tickPowers(first.race, first.players, 2);
    tickPowers(second.race, second.players, 2);
    const stable = (race: typeof first.race) => ({ ...race, karts: [...race.karts].sort((a, b) => a.id.localeCompare(b.id)) });
    assert.deepEqual(stable(first.race), stable(second.race), `${count} racers`);
    assert.ok(first.race.karts.every(kart => Number.isFinite(kart.speed) && kart.speed <= 64));
  }
});

test('deterministic pickup pools expose every original item and reserve Jet Keg for the rear half', () => {
  for (const count of [2, 6, 10]) {
    const { race } = ready(Array.from({ length: count }, (_, i) => `racer-${i}`));
    const leader = race.karts[0], rear = race.karts[count - 1];
    const frontSeen = new Set<PowerUp>(), rearSeen = new Set<PowerUp>();
    race.powers.boxes = [{ id: 0, distance: 50, lane: 0, cooldown: 0 }];
    const box = race.powers.boxes[0];
    const collectFor = (kart: typeof leader, seen: Set<PowerUp>, isLeader: boolean) => {
      for (let i = 0; i < 200; i++) {
        race.karts.forEach((other, index) => { other.distance = isLeader ? -100 - index * 20 : TRACK_LENGTH + 100 + index * 20; other.lane = 6; });
        kart.distance = 50; kart.lane = 0; kart.power.item = null; box.cooldown = 0;
        collectPowerups(race, new Map([[kart.id, 50]]));
        if (kart.power.item) seen.add(kart.power.item);
      }
    };
    collectFor(leader, frontSeen, true); collectFor(rear, rearSeen, false);
    assert.ok(!frontSeen.has('jet') && !frontSeen.has('crown'));
    assert.deepEqual([...rearSeen].sort(), Object.keys(POWER_UPS).sort(), `${count}-racer rear pool includes all items`);
  }
});

test('all new power timers freeze during countdown/completion and reject invalid time steps', () => {
  const { race, players } = ready(['a', 'b']);
  Object.assign(race.karts[0].power, { flask: 4, flaskCooldown: 0.2, prism: 2, jet: 3, splatter: 1, leaderWarning: 1 });
  players[0].input.action = 20;
  for (const state of [{ countdown: 1, complete: false }, { countdown: 0, complete: true }]) {
    Object.assign(race, state);
    const before = JSON.stringify(race);
    stepPowers(race, players, 0.1);
    assert.equal(JSON.stringify(race), before);
  }
  Object.assign(race, { countdown: 0, complete: false });
  for (const dt of [0, -1, NaN, Infinity]) {
    const before = JSON.stringify(race);
    stepPowers(race, players, dt);
    assert.equal(JSON.stringify(race), before);
  }
});

test('disconnected coasting racers cannot consume pickups or skew the active catch-up pool', () => {
  const { race } = ready(['active', 'offline']);
  const [active, offline] = race.karts;
  const box = race.powers.boxes[0];
  offline.distance = box.distance; offline.lane = box.lane;
  active.distance = box.distance - 50; active.lane = box.lane;
  collectPowerups(race, new Map(), new Set([active.id]));
  assert.equal(offline.power.item, null);
  assert.equal(box.cooldown, 0, 'offline kart leaves the shared box available');
  const seen = new Set<PowerUp>();
  for (let i = 0; i < 100; i++) {
    offline.distance = TRACK_LENGTH * 2 + 100;
    active.distance = box.distance; active.lane = box.lane; active.power.item = null; box.cooldown = 0;
    collectPowerups(race, new Map(), new Set([active.id]));
    if (active.power.item) seen.add(active.power.item);
  }
  assert.ok(!seen.has('jet') && !seen.has('crown'), 'a disconnected leader cannot make solo active racer eligible for catch-up attacks');
});

test('Jet Keg can earn first naturally, but never guarantees places or teleports a distant racer', () => {
  for (const autoSteer of [true, false]) {
    const { race, players } = ready(['leader', 'rear']);
    const [leader, rear] = race.karts;
    leader.distance = 240; leader.lane = -5; leader.speed = 20;
    rear.distance = 200; rear.lane = 5; rear.speed = 30;
    players[1].input.action = 1; rear.power.item = 'jet';
    const start = rear.distance;
    for (let frame = 0; frame < 180; frame++) {
      const before = rear.distance;
      stepRace(race, players, 1 / 60, autoSteer);
      assert.ok(rear.distance - before <= 64 / 60 + 1e-6, 'each frame travels at the bounded physical speed');
    }
    assert.ok(rear.distance > leader.distance, 'a favorable nearby gap can be overcome');
    assert.ok(rear.distance - start < 64 * 3 + 1);
    assert.equal(rear.power.jet, 0, 'taking first returns control');
    assert.equal(rear.finishTime, null);
  }
  const { race, players } = ready(['leader', 'rear']);
  const [leader, rear] = race.karts;
  leader.distance = 500; leader.lane = -5; leader.speed = 43; players[0].input.accelerate = true;
  rear.distance = 40; rear.lane = 5; rear.speed = 30; players[1].input.action = 1; rear.power.item = 'jet';
  for (let frame = 0; frame < 330; frame++) stepRace(race, players, 1 / 60);
  assert.equal(rear.power.jet, 0);
  assert.ok(rear.distance < leader.distance, 'a distant leader remains ahead when the finite rescue ends');
  assert.ok(rear.speed <= 60);
  assert.equal(rear.finishTime, null);
});

test('Crown Comet remains finite on every circuit and never promises an out-of-range leader hit', () => {
  try {
    for (const track of TRACKS) {
      selectTrack(track.id);
      const { race, players } = ready(['owner', 'leader']);
      const [owner, leader] = race.karts;
      owner.distance = 5; owner.lane = 0;
      leader.distance = TRACK_LENGTH * 2 + TRACK_LENGTH * 0.75; leader.lane = 6;
      press(race, players, 0, 'crown');
      assert.equal(race.powers.projectiles[0].targetId, leader.id);
      // A very fast target can stay out of range. The world must still clean up
      // the finite projectile, and no alternative/lapped racer is punished.
      for (let frame = 0; frame < 900; frame++) {
        const projectile = race.powers.projectiles[0];
        if (projectile) leader.distance = projectile.distance + TRACK_LENGTH / 2 + TRACK_LENGTH * 3;
        stepPowers(race, players, 1 / 60);
      }
      assert.equal(race.powers.projectiles.length, 0, track.id);
      assert.equal(leader.power.slow, 0, track.id);
      assert.equal(leader.power.leaderWarning, 0, track.id);
      assert.equal(owner.power.slow, 0, track.id);
    }
  } finally { selectTrack('sunset'); }
});

test('main-road boxes cannot be collected on a branch or by an exit-frame sweep through its bypassed segment', () => {
  const { race } = ready(['branch']);
  const kart = race.karts[0];
  const start = ACTIVE_SHORTCUT.start * TRACK_LENGTH, exit = ACTIVE_SHORTCUT.end * TRACK_LENGTH;
  const midpoint = (start + exit) / 2;
  race.powers.boxes = [{ id: 0, distance: midpoint, lane: 0, cooldown: 0 }];
  kart.onShortcut = true; kart.distance = midpoint; kart.lane = 0;
  collectPowerups(race, new Map([[kart.id, midpoint - 2]]));
  assert.equal(kart.power.item, null);
  assert.equal(race.powers.boxes[0].cooldown, 0);
  kart.onShortcut = false; kart.distance = exit + 1;
  collectPowerups(race, new Map([[kart.id, start + 1]]), new Set([kart.id]), new Map([[kart.id, true]]));
  assert.equal(kart.power.item, null, 'the branch-to-main sweep cannot vacuum boxes from the parallel main road');
  race.powers.boxes[0].distance = exit + 2;
  collectPowerups(race, new Map([[kart.id, exit + 1]]), new Set([kart.id]), new Map([[kart.id, false]]));
  assert.ok(kart.power.item, 'normal main-road collection resumes on the next frame');
});

test('slicks retain the spawn route independently of owner route and hit only one physical-road rival', () => {
  const { race, players } = ready(['owner', 'branch', 'main']);
  const [owner, branch, main] = race.karts;
  const scale = TRACK_LENGTH * (ACTIVE_SHORTCUT.end - ACTIVE_SHORTCUT.start) / SHORTCUT_LENGTH;
  owner.distance = TRACK_LENGTH * (ACTIVE_SHORTCUT.start + ACTIVE_SHORTCUT.end) / 2;
  owner.onShortcut = true;
  branch.onShortcut = true; branch.distance = owner.distance + 30;
  main.onShortcut = false; main.distance = owner.distance + 30;
  press(race, players, 0, 'slick');
  const hazard = race.powers.hazards[0];
  assert.equal(hazard.onShortcut, true);
  assert.ok(Math.abs(hazard.distance - wrap(owner.distance - 4 * scale)) < 1e-8, 'drop distance uses four physical branch metres');
  owner.onShortcut = false; main.distance = hazard.distance; main.lane = hazard.lane;
  stepPowers(race, players, 1 / 60);
  assert.equal(main.power.slow, 0);
  assert.equal(race.powers.hazards.length, 1, 'a main-road racer cannot consume a branch slick');
  branch.distance = hazard.distance; branch.lane = hazard.lane;
  stepPowers(race, players, 1 / 60);
  assert.ok(branch.power.slow > 0);
  assert.equal(main.power.slow, 0);
  assert.equal(owner.power.slow, 0);
  assert.equal(race.powers.hazards.length, 0);
});

test('Bubble Bolt never homes toward or ghost-hits a racer on the parallel road', () => {
  const { race, players } = ready(['owner', 'branch']);
  const [owner, branch] = race.karts;
  const midpoint = TRACK_LENGTH * (ACTIVE_SHORTCUT.start + ACTIVE_SHORTCUT.end) / 2;
  owner.distance = midpoint - 15; owner.lane = 0; owner.onShortcut = false;
  branch.distance = midpoint; branch.lane = 5; branch.onShortcut = true;
  press(race, players, 0, 'bolt');
  owner.onShortcut = true; // Owner route changes cannot silently move a projectile.
  tickPowers(race, players, 0.5);
  const bolt = race.powers.projectiles[0];
  assert.ok(bolt);
  assert.equal(bolt.onShortcut, false);
  assert.equal(bolt.lane, 0, 'homing ignores the separate branch even at similar progress');
  assert.equal(branch.power.slow, 0);
  branch.onShortcut = false; branch.distance = bolt.distance + 1; branch.lane = 0;
  stepPowers(race, players, 1 / 60);
  assert.ok(branch.power.slow > 0, 'the same projectile can hit after routes physically match');
  assert.equal(race.powers.projectiles.length, 0);
});

test('branch projectiles travel physical metres and split collision sweeps when merging onto the main road', () => {
  const { race, players } = ready(['owner', 'main']);
  const [owner, main] = race.karts;
  const exit = ACTIVE_SHORTCUT.end * TRACK_LENGTH;
  const scale = TRACK_LENGTH * (ACTIVE_SHORTCUT.end - ACTIVE_SHORTCUT.start) / SHORTCUT_LENGTH;
  owner.onShortcut = true; owner.distance = exit - 30 * scale;
  main.onShortcut = false; main.distance = exit + 1; main.lane = 0;
  race.powers.projectiles.push({ id: 50, ownerId: owner.id, kind: 'bolt', distance: exit - scale, lane: 0, life: 4, onShortcut: true });
  stepPowers(race, players, 1 / 60);
  assert.ok(main.power.slow > 0, 'a branch bolt can hit only the main-road part of its actual merged sweep');
  assert.equal(race.powers.projectiles.length, 0);
  main.power.hitCooldown = 0; main.power.slow = 0; main.distance = exit + 100;
  race.powers.projectiles.push({ id: 51, ownerId: owner.id, kind: 'bolt', distance: exit - 20 * scale, lane: 0, life: 4, onShortcut: true });
  const before = race.powers.projectiles[0].distance;
  stepPowers(race, players, 1 / 60);
  assert.ok(Math.abs((race.powers.projectiles[0].distance - before) / scale - 72 / 60) < 1e-8);
  race.powers.projectiles[0].distance = exit - scale;
  stepPowers(race, players, 1 / 60);
  assert.equal(race.powers.projectiles[0].onShortcut, false, 'renderer route changes at the actual junction');
  assert.ok(Math.abs(race.powers.projectiles[0].distance - exit - 0.2) < 1e-8);
});

test('Crown Comet keeps its lap-aware leader lock across routes but cannot ghost-hit through the bypass', () => {
  const { race, players } = ready(['owner', 'bystander', 'leader']);
  const [owner, bystander, leader] = race.karts;
  const midpoint = TRACK_LENGTH * (ACTIVE_SHORTCUT.start + ACTIVE_SHORTCUT.end) / 2;
  owner.distance = midpoint - 18; owner.onShortcut = false;
  bystander.distance = midpoint - 4; bystander.onShortcut = false;
  leader.distance = TRACK_LENGTH + midpoint; leader.onShortcut = true;
  press(race, players, 0, 'crown');
  assert.equal(race.powers.projectiles[0].targetId, leader.id);
  tickPowers(race, players, 1.8);
  assert.equal(leader.power.slow, 0, 'a main-road comet passes the branch without a phantom impact');
  assert.equal(bystander.power.slow, 0);
  const comet = race.powers.projectiles[0];
  assert.ok(comet);
  const exit = ACTIVE_SHORTCUT.end * TRACK_LENGTH;
  leader.distance = TRACK_LENGTH + exit + 1; leader.onShortcut = false;
  comet.distance = exit; comet.lane = leader.lane;
  stepPowers(race, players, 1 / 60);
  assert.ok(leader.power.slow > 0, 'the locked target becomes hittable on the actual common route');
  assert.equal(bystander.power.slow, 0);
  assert.equal(race.powers.projectiles.length, 0);
});

test('remote Berry Blot still reaches branch rivals while local shield and boost items work there', () => {
  const { race, players } = ready(['owner', 'branch']);
  const [owner, branch] = race.karts;
  branch.onShortcut = true;
  press(race, players, 0, 'splat');
  assert.equal(branch.power.splatter, SPLATTER_SECONDS, 'the intentional remote view effect is not a physical road collision');
  press(race, players, 1, 'prism');
  assert.equal(branch.power.splatter, 0);
  assert.ok(powerDrivingState(branch).collisionImmune);
  assert.equal(branch.onShortcut, true);
  assert.equal(owner.power.splatter, 0);
});

test('ten-racer mixed-route attacks remain deterministic without cross-road duplicate hits', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `route-${i}`);
  const first = ready(ids), second = ready(ids);
  const midpoint = TRACK_LENGTH * (ACTIVE_SHORTCUT.start + ACTIVE_SHORTCUT.end) / 2;
  for (const { race, players } of [first, second]) {
    race.powers.boxes = [];
    race.karts.forEach((kart, i) => {
      kart.distance = TRACK_LENGTH * (i % 3) + midpoint + i * 0.2;
      kart.onShortcut = i % 2 === 0;
      kart.lane = 0;
      kart.power.item = (['bolt', 'slick', 'crown', 'prism', 'splat', 'guard', 'flask', 'bolt', 'slick', 'dance'] as PowerUp[])[i];
      players[i].input.action = 1;
    });
  }
  second.race.karts.reverse(); second.players.reverse();
  tickPowers(first.race, first.players, 1.7);
  tickPowers(second.race, second.players, 1.7);
  const sorted = (race: typeof first.race) => ({ ...race, karts: [...race.karts].sort((a, b) => a.id.localeCompare(b.id)) });
  assert.deepEqual(sorted(first.race), sorted(second.race));
  assert.ok(first.race.karts.every(kart => kart.power.used === 1));
  assert.equal(new Set(first.race.powers.projectiles.map(projectile => projectile.id)).size, first.race.powers.projectiles.length);
});

test('all three branches use physical slick radii and choose the nearest same-road target regardless of roster order', () => {
  try {
    for (const track of TRACKS) {
      selectTrack(track.id);
      const scale = TRACK_LENGTH * (ACTIVE_SHORTCUT.end - ACTIVE_SHORTCUT.start) / SHORTCUT_LENGTH;
      const midpoint = TRACK_LENGTH * (ACTIVE_SHORTCUT.start + ACTIVE_SHORTCUT.end) / 2;
      for (const reverse of [false, true]) {
        const { race, players } = ready(['owner', 'nearest', 'farther', 'main']);
        const [owner, nearest, farther, main] = race.karts;
        owner.distance = midpoint - 40 * scale; owner.onShortcut = true;
        nearest.distance = midpoint + 1.2 * scale; nearest.onShortcut = true;
        farther.distance = midpoint - 2.4 * scale; farther.onShortcut = true;
        main.distance = midpoint; main.onShortcut = false;
        race.powers.hazards.push({ id: 100, ownerId: owner.id, distance: midpoint, lane: 0, life: 2, onShortcut: true });
        if (reverse) race.karts.reverse();
        stepPowers(race, players, 1 / 60);
        assert.ok(nearest.power.slow > 0, `${track.id}: physically nearest branch target is hit`);
        assert.equal(farther.power.slow, 0, `${track.id}: only one target consumes the slick`);
        assert.equal(main.power.slow, 0, `${track.id}: parallel main road is excluded`);
        assert.equal(race.powers.hazards.length, 0);
        // Isolate the outer collision boundary so a virtual-progress radius
        // cannot silently shrink this item's physical reach on a shorter road.
        farther.power.hitCooldown = 0;
        race.powers.hazards.push({ id: 101, ownerId: owner.id, distance: midpoint, lane: 0, life: 2, onShortcut: true });
        nearest.distance = midpoint + 20 * scale;
        stepPowers(race, players, 1 / 60);
        assert.ok(farther.power.slow > 0, `${track.id}: 2.4 physical metres is within the slick`);
        assert.equal(race.powers.hazards.length, 0);
      }
    }
  } finally { selectTrack('sunset'); }
});

test('all three branches sweep bolts and comets over physical metres without skipping their targets', () => {
  try {
    for (const track of TRACKS) {
      selectTrack(track.id);
      const scale = TRACK_LENGTH * (ACTIVE_SHORTCUT.end - ACTIVE_SHORTCUT.start) / SHORTCUT_LENGTH;
      const midpoint = TRACK_LENGTH * (ACTIVE_SHORTCUT.start + ACTIVE_SHORTCUT.end) / 2;
      for (const kind of ['bolt', 'crown'] as const) {
        const { race, players } = ready(['owner', 'target', 'main']);
        const [owner, target, main] = race.karts;
        owner.distance = midpoint - 30 * scale; owner.onShortcut = true;
        target.distance = midpoint + (kind === 'bolt' ? 6.5 : 9.5) * scale; target.onShortcut = true;
        main.distance = target.distance; main.onShortcut = false;
        race.powers.projectiles.push({ id: 200, ownerId: owner.id, distance: midpoint, lane: 0, life: 2, kind, targetId: target.id, warning: 0, onShortcut: true });
        stepPowers(race, players, 0.1);
        assert.ok(target.power.slow > 0, `${track.id}: ${kind} reaches the crossed physical target`);
        assert.equal(main.power.slow, 0, `${track.id}: ${kind} cannot hit the parallel route`);
        assert.equal(race.powers.projectiles.length, 0, `${track.id}: ${kind} is consumed once`);
      }
    }
  } finally { selectTrack('sunset'); }
});

test('branch item spawns and merges remain bounded at entrance and exit seams on all nine laps of every course', () => {
  try {
    for (const track of TRACKS) {
      selectTrack(track.id);
      const start = ACTIVE_SHORTCUT.start * TRACK_LENGTH, exit = ACTIVE_SHORTCUT.end * TRACK_LENGTH;
      const scale = (exit - start) / SHORTCUT_LENGTH;
      for (let lap = 0; lap < 9; lap++) {
        const { race, players } = ready(['owner', 'rival']);
        race.laps = 9; race.powers.boxes = [];
        const [owner, rival] = race.karts;
        owner.onShortcut = true; owner.distance = lap * TRACK_LENGTH + start + 0.05 * scale;
        rival.onShortcut = false; rival.distance = owner.distance + 100; rival.lane = 6;
        const before = owner.distance;
        press(race, players, 0, 'bolt');
        const bolt = race.powers.projectiles[0];
        assert.ok(bolt, `${track.id} lap ${lap + 1}: bolt exists`);
        assert.equal(bolt.onShortcut, true);
        assert.ok(Math.abs((bolt.distance - start) / scale - 4.25) < 1e-8, `${track.id} lap ${lap + 1}: entrance travel stays physical`);
        assert.equal(owner.distance, before, 'item activation never alters lap progress');
        press(race, players, 0, 'slick');
        assert.ok(Math.abs(race.powers.hazards[0].distance - start) < 1e-8, 'a branch drop behind the entrance clamps to the branch instead of jumping laps');
        race.powers.projectiles = [];
        owner.distance = lap * TRACK_LENGTH + exit - 2 * scale;
        press(race, players, 0, 'bolt');
        const merged = race.powers.projectiles[0];
        assert.ok(merged);
        assert.equal(merged.onShortcut, false);
        assert.ok(Math.abs(merged.distance - exit - 2.2) < 1e-8, `${track.id} lap ${lap + 1}: exit uses remaining physical travel without a lap jump`);
      }
    }
  } finally { selectTrack('sunset'); }
});
