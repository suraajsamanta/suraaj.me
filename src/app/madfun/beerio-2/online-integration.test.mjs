import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { createRelay } from '../../../../beerio-server/server.mjs';

const require = createRequire(new URL('../../../../beerio-server/server.mjs', import.meta.url));
const NodeWebSocket = require('ws');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const neutral = Object.freeze({ steer: 0, throttle: false, brake: false, drift: false, reset: false });
const throttle = { ...neutral, throttle: true };

async function until(check, label, timeout = 7000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('Timed out: ' + label);
    await sleep(16);
  }
}

// Load the exact browser client with the same test convention as the other
// Madfun suites. Dynamic Rapier import must resolve from the file, not data:.
async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  let js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  for (const [from, to] of Object.entries(imports)) {
    js = js.replaceAll(`'${from}'`, JSON.stringify(to)).replaceAll(`"${from}"`, JSON.stringify(to));
  }
  return 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
}

const courseUrl = await moduleUrl('./course.ts');
const driveUrl = await moduleUrl('./drive.ts', {
  './course': courseUrl,
  '@dimforge/rapier3d-compat': import.meta.resolve('@dimforge/rapier3d-compat'),
});
const partyUrl = await moduleUrl('../shared/party-client.ts');
const { Beerio2Session } = await import(await moduleUrl('./online.ts', {
  './course': courseUrl, './drive': driveUrl, '../shared/party-client': partyUrl,
}));
const { PartyClient } = await import(partyUrl);

async function fixture(t) {
  const relay = createRelay({ logger: { error() {} } });
  relay.server.listen(0, '127.0.0.1');
  await once(relay.server, 'listening');
  const { port } = relay.server.address();
  const url = `ws://127.0.0.1:${port}/party`;
  const previousWs = globalThis.WebSocket;
  const previousEnv = process.env.NEXT_PUBLIC_PARTY_RELAY_URL;
  process.env.NEXT_PUBLIC_PARTY_RELAY_URL = url;
  const sockets = [];
  class LocalSocket extends NodeWebSocket {
    constructor(endpoint, ...rest) {
      assert.equal(endpoint, url, 'All network activity must target this isolated relay.');
      super(endpoint, ...rest);
      sockets.push(this);
    }
  }
  globalThis.WebSocket = LocalSocket;
  const clients = [];
  function track(client) { clients.push(client); return client; }
  t.after(async () => {
    for (const client of clients) client.dispose();
    await relay.close();
    globalThis.WebSocket = previousWs;
    if (typeof previousEnv === 'undefined') delete process.env.NEXT_PUBLIC_PARTY_RELAY_URL;
    else process.env.NEXT_PUBLIC_PARTY_RELAY_URL = previousEnv;
  });
  return {
    relay, url, make: (options) => track(new Beerio2Session(options)), raw: () => track(new PartyClient(url)),
    latestSocket: () => sockets.at(-1),
  };
}

const phase = client => client.getFrame()?.phase;
const car = client => client.getFrame()?.cars[client.getSnapshot().playerId];

test('Beerio 2 phones drive in two isolated rooms and resume the same seat', { timeout: 18000 }, async t => {
  const f = await fixture(t);
  const a = f.make(), b = f.make();
  a.create('Host A'); b.create('Host B');
  const codes = await until(() => {
    const codes = [a.getSnapshot().code, b.getSnapshot().code];
    return codes.every(Boolean) && codes;
  }, 'both hosts have codes');
  assert.notEqual(...codes);
  const a1 = f.make(), a2 = f.make(), b1 = f.make(), b2 = f.make();
  a1.join(codes[0], 'Aster');
  a2.join(codes[0], 'Ash');
  b1.join(codes[1], 'Birch');
  b2.join(codes[1], 'Brook');
  await until(() => [a1, a2, b1, b2].every(phone => phone.getSnapshot().status === 'connected' && phase(phone) === 'lobby') &&
    [a,b].every(host => host.getSnapshot().players.length === 3), 'four phones join correct lobbies');
  assert.equal(f.relay.rooms.rooms.size, 0, 'No Beerio v1 room has been created.');

  a1.start();
  await sleep(145);
  assert.equal(phase(a), 'lobby', 'Only host can start a race.');
  a.start();
  await until(() => phase(a1) === 'countdown', 'authoritative countdown broadcast');
  assert.equal(phase(b1), 'lobby', 'Starting room A must not start B.');
  b.start();
  await until(() => phase(b1) === 'countdown', 'separate room B countdown broadcast');
  for (const phone of [a1, a2, b1, b2]) {
    assert.equal(car(phone)?.speed, 0, 'Countdown freezes the cars.');
  }
  await until(() => [a1, a2, b1, b2].every(phone => phase(phone) === 'race'), 'both races begin');
  for (const phone of [a1, a2, b1, b2]) assert.equal(car(phone)?.lap, 1);

  const startA = { ...car(a1) };
  const startB = { ...car(b1) };
  a1.setInput(throttle);
  await until(() => car(a1)?.speed > 3, 'room A gas reaches host physics');
  assert.ok(Math.hypot(car(a1).x - startA.x, car(a1).z - startA.z) > 0.2);
  assert.equal(car(a2).speed, 0);
  assert.equal(car(b1).x, startB.x);
  assert.equal(car(b1).z, startB.z);
  assert.equal(car(b1).speed, 0, 'Room A gas cannot drive a car in room B.');
  assert.ok(!Object.hasOwn(b1.getFrame().cars, a1.getSnapshot().playerId));

  b1.setInput({ ...throttle, steer: 0.32 });
  await until(() => car(b1)?.speed > 3, 'room B drives through its own input stream');
  a1.setInput(neutral);
  b1.setInput(neutral);

  const id = b2.getSnapshot().playerId;
  const raceId = b2.getFrame().raceId;
  f.latestSocket().terminate();
  await until(() => b2.getSnapshot().status === 'reconnecting', 'dropped phone enters reconnect');
  await until(() => b2.getSnapshot().status === 'connected' && phase(b2) === 'race', 'phone rejoins ongoing race');
  assert.equal(b2.getSnapshot().playerId, id);
  assert.equal(b2.getFrame().raceId, raceId);
  assert.ok(car(b2), 'Resumed seat still has its own car.');
  assert.equal(phase(a2), 'race');

  a.leave();
  await until(() => ['closed', 'error'].includes(a1.getSnapshot().status), 'room A racers see host closure');
  assert.equal(phase(b2), 'race', 'Closing room A must not close room B.');
  assert.equal(f.relay.parties.rooms.size, 1);
});

test('Beerio 2 does not leave a ghost seat in a different party game', { timeout: 14000 }, async t => {
  const f = await fixture(t);
  const foreign = f.raw();
  foreign.create('simulator');
  const code = await until(() => foreign.getSnapshot().code, 'foreign test room exists');
  foreign.publish({ protocol: 'test.foreign-game.v1', phase: 'lobby' });
  const wrong = f.make();
  wrong.join(code, 'Wrong room');
  await until(() => wrong.getSnapshot().status === 'error', 'wrong-game room label is rejected');
  assert.match(wrong.getSnapshot().error ?? '', /different|another|beerio|right|valid|room/i);
  await until(() => foreign.getSnapshot().players.length === 0, 'wrong-game seat released');
  assert.equal(f.relay.rooms.rooms.size, 0);
  assert.equal(f.relay.parties.rooms.size, 1);
});

test('Only the host can start, pause and rematch; results reach all racers', { timeout: 17000 }, async t => {
  const f = await fixture(t);
  const finishAfter = 20;
  const createWorld = async () => ({
    spawn: (grid = 0) => ({ steps: 0, state: {
      x: grid, y: 0, z: 0, yaw: 0, facing: 0, pitch: 0, steer: 0, speed: 0,
      lap: 1, seconds: 0, best: null, boost: false, finished: false, finishTime: null, progress: 0,
    }}),
    step(driver, input, dt, totalLaps) {
      assert.equal(totalLaps, 3);
      if (!input.throttle) return;
      const s = driver.state;
      driver.steps++;
      s.z += 0.5;
      s.seconds += dt;
      if (driver.steps >= finishAfter) { s.lap = 3; s.finished = true; s.finishTime = s.seconds; }
    },
    dispose(){},
  });
  const host = f.make({ createWorld }), guest = f.make(), rematchGuest = f.make();
  host.create('Timekeeper');
  const code = await until(() => host.getSnapshot().code && !host.getSnapshot().loading && host.getSnapshot().code, 'host prepared');
  host.start();
  await sleep(125);
  assert.equal(phase(host), 'lobby', 'Host needs a second connected racer.');
  guest.join(code, 'First Guest');
  await until(() => phase(guest) === 'lobby' && host.getSnapshot().players.length === 2, 'guest admitted');
  host.start();
  await until(() => phase(guest) === 'countdown', 'guest sees countdown');
  await until(() => phase(guest) === 'race', 'guest sees green light');
  const raceId = guest.getFrame().raceId;
  host.setPaused(true);
  await until(() => phase(guest) === 'paused', 'guest sees pause');
  const frozen = car(guest).z;
  guest.setInput(throttle);
  await sleep(175);
  assert.equal(car(guest).z, frozen, 'input is ignored while paused');
  host.setPaused(false);
  await until(() => phase(guest) === 'race', 'guest sees resume');

  const fire = setInterval(() => { host.setInput(throttle); guest.setInput(throttle); }, 40);
  try {
    host.setInput(throttle); guest.setInput(throttle);
    await until(() => phase(guest) === 'results', 'final results are broadcast');
  } finally {
    clearInterval(fire);
  }
  const results = guest.getFrame().results;
  assert.equal(results.length, 2);
  assert.ok(results.every(r => r.time > 0));
  assert.ok(guest.getFrame().cars[guest.getSnapshot().playerId].finished);

  guest.rematch();
  await sleep(125);
  assert.equal(phase(host), 'results', 'Guest must not reset results.');
  host.rematch();
  await until(() => phase(guest) === 'lobby' && guest.getFrame().raceId > raceId, 'host launches a clean rematch lobby');
  assert.equal(guest.getFrame().cars[guest.getSnapshot().playerId].finished, false);
  rematchGuest.join(code, 'Late Guest');
  await until(() => phase(rematchGuest) === 'lobby' && host.getSnapshot().players.length === 3, 'rematch accepts late guest');
});

test('real driving and Rapier can complete three laps using legal controls only', { timeout: 7000 }, async () => {
  const { createDrivingWorld } = await import(driveUrl);
  const { course, locate } = await import(courseUrl);
  const world = await createDrivingWorld();
  try {
    const driver = world.spawn(1);
    const dt = 1 / 60;
    let crossedHill = false;
    for (let i = 0; i < 60 * 115 && !driver.state.finished; i++) {
      const s = driver.state;
      const p = locate(s.x, s.z);
      const ahead = Math.min(4, 1 + s.speed * 0.095);
      const i0 = Math.floor(p.progress + ahead);
      const a = course[i0 % course.length], b = course[(i0 + 1) % course.length];
      const t = p.progress + ahead - i0;
      const targetX = a.x + (b.x - a.x) * t, targetZ = a.z + (b.z - a.z) * t;
      const go = Math.atan2(targetX - s.x, targetZ - s.z);
      const error = Math.atan2(Math.sin(go - s.yaw), Math.cos(go - s.yaw));
      const steer = Math.max(-1, Math.min(1, 1.8 * error));
      world.step(driver, { ...neutral, throttle: s.speed < 23, steer, brake: s.speed > 13 && Math.abs(error) > 0.8 }, dt, 3);
      crossedHill ||= s.y > 12;
    }
    assert.ok(crossedHill);
    const { finished, lap, finishTime, best, progress } = driver.state;
    assert.equal(finished, true, 'Simulated legal driving finishes all laps.');
    assert.equal(lap, 3);
    assert.equal(progress, course.length * 3);
    assert.ok(finishTime > 40 && finishTime < 115);
    assert.ok(best > 0 && best < finishTime);
  } finally { world.dispose(); }
});

test('Private lobby admits exactly ten racers including the host', { timeout: 14000 }, async t => {
  const f = await fixture(t);
  const host = f.make();
  host.create('Grid Lead');
  const code = await until(() => host.getSnapshot().code, 'full grid host');
  const guests = Array.from({ length: 9 }, (_, i) => {
    const phone = f.make();
    phone.join(code, `Racer ${i + 2}`);
    return phone;
  });
  await until(() => host.getSnapshot().players.length === 10 &&
    guests.every(p => p.getFrame()?.players.length === 10), 'all nine guest seats visible everywhere');
  assert.equal(new Set(host.getSnapshot().players.map(p => p.id)).size, 10);
  assert.equal(Object.keys(host.getFrame().cars).length, 10);
  const over = f.make();
  over.join(code, 'Eleventh Driver');
  await until(() => over.getSnapshot().status === 'error', 'eleventh racer rejected');
  assert.match(over.getSnapshot().error ?? '', /full|started|capacity/i);
  assert.equal(host.getSnapshot().players.length, 10);
  assert.ok(host.getSnapshot().players.every(p => p.connected));
  const room = f.relay.parties.rooms.get(code);
  await until(() => room.players.size === 9, 'full-lobby rejection also releases the relay seat');
});
