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
async function moduleUrl(path, imports = {}, transform = source => source) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  let js = ts.transpileModule(transform(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  for (const [from, to] of Object.entries(imports)) {
    js = js.replaceAll(`'${from}'`, JSON.stringify(to)).replaceAll(`"${from}"`, JSON.stringify(to));
  }
  return 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
}

const courseUrl = await moduleUrl('./course.ts');
const roadBytesUrl = await moduleUrl('./road-simd-bytes.ts');
const roadSimdUrl = await moduleUrl('./road-simd.ts', { './road-simd-bytes': roadBytesUrl });
const driveUrl = await moduleUrl('./drive.ts', {
  './road-simd': roadSimdUrl,
  './course': courseUrl,
  '@dimforge/rapier3d-compat': import.meta.resolve('@dimforge/rapier3d-compat'),
});
const partyUrl = await moduleUrl('../shared/party-client.ts');
const appearanceUrl = await moduleUrl('../../beerio/appearance.ts');
const rideUrl = await moduleUrl('./ride-selection.ts', { '../../beerio/appearance': appearanceUrl });
const { Beerio2Session, validateFrame } = await import(await moduleUrl('./online.ts', {
  './course': courseUrl, './drive': driveUrl, '../shared/party-client': partyUrl, './ride-selection': rideUrl,
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
  const hostRide = { vehicle: 'ferrari', character: 'fox' };
  const guestRide = { vehicle: 'ducati', character: 'panda' };
  host.create('Timekeeper', 'seattle', hostRide);
  const code = await until(() => host.getSnapshot().code && !host.getSnapshot().loading && host.getSnapshot().code, 'host prepared');
  host.start();
  await sleep(125);
  assert.equal(phase(host), 'lobby', 'Host needs a second connected racer.');
  guest.join(code, 'First Guest', guestRide);
  await until(() => phase(guest) === 'lobby' && host.getSnapshot().players.length === 2, 'guest admitted');
  host.start();
  await until(() => phase(guest) === 'countdown', 'guest sees countdown');
  await until(() => phase(guest) === 'race', 'guest sees green light');
  assert.deepEqual(guest.getFrame().players.find(p => p.id === 'host').ride, hostRide);
  assert.deepEqual(guest.getFrame().players.find(p => p.id === guest.getSnapshot().playerId).ride, guestRide);
  const legacy = structuredClone(guest.getFrame());
  for (const p of legacy.players) delete p.ride;
  assert.ok(validateFrame(legacy), 'A build with no cosmetics still works');
  legacy.players[0].ride = { vehicle: 'unlisted', character: 'fox' };
  assert.equal(validateFrame(legacy), false);
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
  const tv = f.make();
  tv.watch(code, host.getSnapshot().watchInvite);
  await until(() => tv.getSnapshot().role === 'spectator' && tv.getFrame()?.players.length === 10, 'optional TV joins full ten-car grid without taking a driver seat');
  assert.equal(host.getSnapshot().spectatorConnected, true);
  assert.equal(host.getSnapshot().players.length, 10);
  assert.equal(tv.getFrame().cars[tv.getSnapshot().playerId], undefined);
  assert.equal(tv.getSnapshot().watchInvite, null);
  assert.ok(!Object.hasOwn(tv.getFrame(), 'watchInvite'), 'TV invitation is never included in race frames');
  const over = f.make();
  over.join(code, 'Eleventh Driver');
  await until(() => over.getSnapshot().status === 'error', 'eleventh racer rejected');
  assert.match(over.getSnapshot().error ?? '', /full|started|capacity/i);
  assert.equal(host.getSnapshot().players.length, 10);
  assert.ok(host.getSnapshot().players.every(p => p.connected));
  const room = f.relay.parties.rooms.get(code);
  await until(() => room.players.size === 9, 'full-lobby rejection also releases the relay seat');
  host.start();
  await until(() => guests.every(phone => phase(phone) === 'race'), 'ten-car race begins');
  const counts = new Map(guests.map(phone => [phone, { tick: 0, frames: 0 }]));
  const started = performance.now();
  while (performance.now() - started < 1250) {
    const input = { ...throttle, steer: Math.sin(performance.now() / 500) * .15 };
    host.setInput(input);
    for (const phone of guests) {
      phone.setInput(input);
      const count = counts.get(phone);
      if (phone.getFrame().tick !== count.tick) { count.tick = phone.getFrame().tick; count.frames++; }
    }
    await sleep(16);
  }
  for (const phone of guests) {
    assert.equal(phone.getSnapshot().status, 'connected', 'high-frequency steering does not trip relay rate limits');
    assert.ok(car(phone).speed > 1, 'every admitted racer has authoritative moving physics');
    assert.ok(counts.get(phone).frames >= 10, 'each phone keeps receiving snapshots under full grid load');
    assert.ok(phone.getNetworkStats().inputAckMs !== null, 'each phone receives consumed-input telemetry');
  }
  t.diagnostic(JSON.stringify({ localRelayTenPlayer: guests.map(phone => ({ frames: counts.get(phone).frames, ...phone.getNetworkStats() })) }));
});


// The baseline restores the former timer-only, phase-aligned 20Hz input sender.
// Both variants use identical host physics, packets, 15Hz snapshots and injected network delays.
const { Beerio2Session: BaselineSession } = await import(await moduleUrl('./online.ts', {
  './course': courseUrl, './drive': driveUrl, '../shared/party-client': partyUrl, './ride-selection': rideUrl,
}, source => source.replace('this.sendInput(this.inputAt);', '')
  .replace('(changed ? 25 : 50)', '50')
  .replace('this.lastInput = now;', 'this.lastInput = Number.isFinite(this.lastInput) ? this.lastInput + Math.floor((now - this.lastInput) / 50) * 50 : now;')));

async function syntheticRun(Session, guests = 9) {
  let now = 0, serial = 0, packets = 0, bytes = 0;
  const queue = [], peers = [], delivery = new Map();
  const schedule = (key, fn) => {
    // Deterministic jitter without reordering a WebSocket stream.
    const when = Math.max(now + 25 + ((serial++ * 17) % 25) - 12, (delivery.get(key) ?? 0) + .01);
    delivery.set(key, when); queue.push({ when, fn });
  };
  const roster = Array.from({ length: guests }, (_, i) => ({ id: `p${i}`, name: `Guest ${i}`, connected: true }));
  class Transport {
    constructor(id) { this.id = id; this.room = { status: 'idle', role: id === 'host' ? 'host' : 'player',
      code: 'ABCDEF', playerId: id, players: roster, hostConnected: true, error: null }; peers.push(this); }
    subscribe(fn) { this.roomListener = fn; return () => {}; }
    onAction(fn) { this.actionListener = fn; return () => {}; }
    onState(fn) { this.stateListener = fn; return () => {}; }
    getSnapshot() { return this.room; }
    create() { this.room.status = 'connected'; this.roomListener(); }
    join() { this.create(); }
    sendAction(payload) { packets++; schedule(this.id + '-input', () => peers[0].actionListener({ role: 'player', playerId: this.id, payload: structuredClone(payload) })); }
    publish(payload) {
      bytes += JSON.stringify(payload).length * guests;
      for (const peer of peers.slice(1)) schedule(peer.id + '-frame', () => peer.stateListener(structuredClone(payload)));
    }
    setLocked() {} leave() {} dispose() {} retry() {}
  }
  const createWorld = async () => ({
    spawn: grid => ({ state: { x: grid, y: 0, z: 0, yaw: 0, facing: 0, pitch: 0, steer: 0, speed: 10,
      lap: 1, seconds: 0, best: null, boost: false, finished: false, finishTime: null, progress: 0 } }),
    step(driver, input, dt) { driver.state.x += 10 * dt; driver.state.steer = input.steer; }, dispose() {},
  });
  const host = new Session({ client: new Transport('host'), now: () => now, autoTick: false, createWorld });
  host.create('Host', 'orbit');
  await Promise.resolve(); await Promise.resolve();
  const phones = roster.map(p => {
    const phone = new Session({ client: new Transport(p.id), now: () => now, autoTick: false });
    phone.join('ABCDEF', p.name); return phone;
  });
  let nextTick = 0, started = false, nextEvent = 5007, event = null, n = 0;
  const latencies = [], held = [], smooth = [], acks = [];
  const before = performance.now();
  for (now = 0; now < 17000; now++) {
    queue.sort((a,b) => a.when - b.when);
    while (queue.length && queue[0].when <= now) queue.shift().fn();
    if (now >= nextTick) {
      for (const phone of phones) phone.advance();
      host.advance(); nextTick += 1000 / 60;
      if (!started && now > 1500) { assert.equal(host.getSnapshot().players.length, guests + 1); host.start(); started = true; }
      if (now > 5500) {
        assert.equal(phones[0].getRenderFrame().cars.p0, phones[0].getFrame().cars.p0, 'remote buffering never delays the local car');
        assert.ok(host.getRenderFrame().cars.host.x >= host.getFrame().cars.host.x, 'host renders live authoritative physics, not its network copy');
        held.push(phones[0].getFrame().cars.host.x);
        smooth.push(phones[0].getRenderFrame().cars.host.x);
      }
    }
    if (now >= nextEvent) {
      const steer = ++n / 100;
      event = { at: now, steer };
      for (const phone of phones) phone.setInput({ ...throttle, steer });
      nextEvent += 187 + (n * 19) % 71;
    }
    if (event && phones[0].getFrame()?.cars.p0?.steer === event.steer) {
      latencies.push(now - event.at); event = null;
      const ack = phones[0].getNetworkStats().inputAckMs;
      if (ack !== null) acks.push(ack);
    }
  }
  assert.equal(phones[0].getSnapshot().trackId, 'orbit');
  assert.ok(acks.length > 30, 'consumed input acknowledgements arrive over the real session protocol');
  assert.ok(phones[0].getNetworkStats().frameJitterMs > 0);
  const elapsed = performance.now() - before;
  const deltas = values => values.slice(1).map((x,i) => x-values[i]);
  const deviation = values => { const mean = values.reduce((a,b) => a+b, 0)/values.length; return Math.sqrt(values.reduce((a,b) => a+(b-mean)**2, 0)/values.length); };
  const result = { meanMs: latencies.reduce((a,b) => a+b, 0)/latencies.length,
    p95Ms: [...latencies].sort((a,b) => a-b)[Math.floor(latencies.length*.95)], samples: latencies.length,
    rawMotionJitter: deviation(deltas(held)), bufferedMotionJitter: deviation(deltas(smooth)), packetsPerPlayerSecond: packets/guests/17,
    outboundKBPerSecond: bytes/1024/17, simulationMs: elapsed };
  for (const phone of phones) phone.dispose(); host.dispose();
  return result;
}

test('synthetic ten-player input-to-authoritative-frame latency beats timer-only baseline without raising snapshot rate', async t => {
  const baseline = await syntheticRun(BaselineSession);
  const improved = await syntheticRun(Beerio2Session);
  t.diagnostic(JSON.stringify({ conditions: '10 players, 25ms each-way +/-12ms jitter, 60Hz host, unchanged 15Hz snapshots', baseline, improved }));
  assert.ok(improved.meanMs < baseline.meanMs - 5, 'event-driven send measurably reduces input-to-visible-authority delay');
  assert.ok(improved.p95Ms <= baseline.p95Ms, 'tail latency does not regress');
  assert.ok(improved.bufferedMotionJitter < improved.rawMotionJitter * .6, 'remote buffer reduces frame-to-frame motion variance');
  assert.ok(improved.packetsPerPlayerSecond < 30, 'held controls retain low-rate heartbeat');
});


test('rapid changed inputs stay below relay limit; a reset tap survives coalescing; legacy frames remain valid', () => {
  let now = 0, onRoom, onState;
  const messages = [];
  const peer = {
    subscribe(fn) { onRoom = fn; return () => {}; }, onAction() { return () => {}; },
    onState(fn) { onState = fn; return () => {}; },
    getSnapshot: () => ({ status: 'connected', role: 'player', playerId: 'p0', code: 'ABCDEF', hostConnected: true, players: [], error: null }),
    join() { onRoom(); }, sendAction(payload) { messages.push({ at: now, payload }); }, leave() {}, dispose() {},
  };
  const phone = new Beerio2Session({ client: peer, now: () => now, autoTick: false });
  phone.join('ABCDEF', 'Driver');
  const frame = { protocol: 'madfun-beerio-2-v1', raceId: 1, tick: 1, phase: 'race', countdown: 0, elapsed: 0, totalLaps: 3,
    players: [{ id: 'host', name: 'Host', color: '#ffffff', connected: true, ready: true },
      { id: 'p0', name: 'Driver', color: '#ffffff', connected: true, ready: true }], cars: {}, results: [], rejected: [] };
  assert.equal(validateFrame(frame), true, 'Seattle-only old host frames remain compatible');
  assert.equal(validateFrame({ ...frame, trackId: 'unknown' }), false);
  assert.equal(validateFrame({ ...frame, acknowledgements: { p0: { stream: 'x', seq: NaN } } }), false);
  onState(frame);
  phone.setInput(throttle);
  now = 1; phone.setInput({ ...neutral, reset: true });
  now = 2; phone.setInput(neutral);
  now = 25; phone.advance();
  assert.equal(messages.at(-1).payload.input.reset, true, 'one-frame reset must reach host even inside send cap');
  for (now = 26; now < 2100; now++) {
    if (now % 100 === 0) onState({ ...frame, tick: now });
    phone.setInput({ ...throttle, steer: Math.sin(now) });
    if (now % 16 === 0) phone.advance();
  }
  for (let from = 0; from < 1100; from++) {
    assert.ok(messages.filter(m => m.at >= from && m.at < from + 1000).length <= 43,
      'changing every millisecond still leaves headroom under 50 total relay messages/sec');
  }
  assert.equal(phone.getSnapshot().trackId, 'seattle');
  phone.dispose();
});


test('invited TV can join a locked race, remains read-only and reconnects without a driving seat', { timeout: 14000 }, async t => {
  const f = await fixture(t);
  const host = f.make(), guest = f.make();
  host.create('Phone Host', 'orbit');
  const code = await until(() => host.getSnapshot().code && !host.getSnapshot().loading && host.getSnapshot().code, 'phone host prepared');
  const invite = host.getSnapshot().watchInvite;
  assert.match(invite, /^[A-Za-z0-9_-]{32}$/);
  guest.join(code, 'Racer');
  await until(() => host.getSnapshot().players.length === 2 && phase(guest) === 'lobby', 'driver admitted');
  assert.equal(guest.getSnapshot().watchInvite, null, 'ordinary driver cannot obtain TV invitation from state');
  host.start();
  await until(() => phase(guest) === 'race', 'race locked and started');

  const wrong = f.make();
  wrong.watch(code, 'a'.repeat(32));
  await until(() => wrong.getSnapshot().status === 'error', 'incorrect TV invitation is rejected');
  assert.equal(host.getSnapshot().spectatorConnected, false);
  const transport = f.raw();
  let tvActions = 0;
  const sendAction = transport.sendAction;
  transport.sendAction = payload => { tvActions++; return sendAction(payload); };
  const tv = f.make({ client: transport });
  tv.watch(code, invite);
  await until(() => phase(tv) === 'race', 'TV invitation works even after room is locked');
  const tvSocket = f.latestSocket(), id = tv.getSnapshot().playerId;
  assert.equal(tv.getSnapshot().role, 'spectator');
  assert.equal(tv.getSnapshot().trackId, 'orbit');
  assert.equal(host.getSnapshot().players.length, 2);
  assert.equal(f.relay.parties.rooms.get(code).players.size, 1);
  assert.equal(Object.keys(tv.getFrame().cars).length, 2);
  assert.equal(tv.getFrame().cars[id], undefined);

  const duplicate = f.make();
  duplicate.watch(code, invite);
  await until(() => duplicate.getSnapshot().status === 'error', 'only one TV invitation seat may be occupied');
  tv.setInput(throttle); tv.start(); tv.rematch(); tv.setPaused(true);
  assert.equal(tvActions, 0, 'TV emits neither input nor driver-admission hello packets');
  transport.sendAction({ protocol: 'madfun-beerio-2-v1', kind: 'hello', stream: 'forged' });
  transport.sendAction({ protocol: 'madfun-beerio-2-v1', kind: 'input', stream: 'forged', raceId: tv.getFrame().raceId,
    seq: 1, input: throttle, playerId: guest.getSnapshot().playerId });
  await sleep(180);
  assert.equal(phase(host), 'race', 'TV cannot start, pause or reset the host race');
  assert.equal(host.getSnapshot().players.length, 2, 'judge-role forged hello cannot join the driving roster');
  assert.ok(Object.values(tv.getFrame().cars).every(car => car.speed === 0), 'TV and forged judge inputs cannot drive any car');

  tvSocket.terminate();
  await until(() => tv.getSnapshot().status === 'reconnecting', 'TV handles temporary socket loss');
  await until(() => tv.getSnapshot().status === 'connected' && phase(tv) === 'race', 'TV resumes its read-only seat');
  assert.equal(tv.getSnapshot().playerId, id);
  assert.equal(host.getSnapshot().players.length, 2);
  host.leave();
  await until(() => ['closed', 'error'].includes(tv.getSnapshot().status), 'TV sees host close the room');
});
