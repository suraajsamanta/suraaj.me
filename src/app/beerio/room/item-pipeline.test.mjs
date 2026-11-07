import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRelay } from '../../../../beerio-server/server.mjs';

// Use the production clients, actual local WebSockets, relay and simulation together.
// Browser multitouch delivery is covered separately by the controller UI tests.
const require = createRequire(import.meta.url);
const WebSocket = createRequire(new URL('../../../../beerio-server/package.json', import.meta.url))('ws');
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = mkdtempSync(join(tmpdir(), 'beerio-item-pipeline-'));
after(() => rmSync(output, { recursive: true, force: true }));
const compiled = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'),
  'src/app/beerio/room/client.ts', 'src/app/beerio/game/simulation.ts', 'src/app/beerio/game/actionMerge.ts',
  '--rootDir', 'src/app/beerio', '--outDir', output, '--module', 'commonjs', '--target', 'es2020',
  '--skipLibCheck', '--esModuleInterop',
], { cwd: root, encoding: 'utf8' });
assert.equal(compiled.status, 0, compiled.stderr || compiled.stdout);
const clientPath = join(output, 'room/client.js');
// Browser storage belongs to a tab, not to the whole test process. Give each
// actual compiled client lexical browser globals so asynchronous checkpoints,
// socket callbacks and reconnect timers keep using their originating tab.
const loadClient = new Function('require', 'module', 'exports', 'sessionStorage', 'window', 'WebSocket', readFileSync(clientPath, 'utf8'));
const clientRequire = createRequire(clientPath);
const { createRace, stepRace } = require(join(output, 'game/simulation.js'));
const { mergeControllerAction } = require(join(output, 'game/actionMerge.js'));
const ZERO = { steer: 0, accelerate: false, brake: false };
const DRIVE = { steer: 0.8, accelerate: true, brake: false };
const ORIGIN = 'https://beerio.example';
const STORAGE_KEY = 'beerio-room-session-v1';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(predicate, description) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, `Timed out: ${description}`);
    await wait(10);
  }
}

async function fixture(t, count = 1) {
  const sockets = [];
  class BrowserSocket extends WebSocket {
    dropInputs = false;
    constructor(url) { super(url, { origin: ORIGIN }); sockets.push(this); }
    send(data) {
      if (this.dropInputs && JSON.parse(data).type === 'input') return;
      super.send(data);
    }
  }
  const relay = createRelay({ allowedOrigins: [ORIGIN] });
  const clients = [];
  const storageByClient = new WeakMap();
  t.after(async () => {
    for (const client of clients) client.destroy();
    await relay.close();
  });
  relay.server.listen(0, '127.0.0.1');
  await once(relay.server, 'listening');
  const url = `ws://127.0.0.1:${relay.server.address().port}`;
  const newClient = (saved = new Map()) => {
    const sessionStorage = {
      getItem: key => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: key => saved.delete(key),
    };
    const clientModule = { exports: {} };
    loadClient(clientRequire, clientModule, clientModule.exports, sessionStorage,
      { location: { protocol: 'http:', hostname: 'localhost' } }, BrowserSocket);
    const client = new clientModule.exports.BeerioRoomClient();
    clients.push(client);
    storageByClient.set(client, saved);
    return client;
  };
  const storageFor = client => storageByClient.get(client);
  const savedSession = client => JSON.parse(storageFor(client).get(STORAGE_KEY) ?? 'null');
  const host = newClient();
  host.createRoom({ relayUrl: url });
  await until(() => host.getSnapshot().status === 'connected', 'host welcome');
  const phones = [];
  for (let index = 0; index < count; index++) {
    const phone = newClient();
    phone.joinRoom({ code: host.getSnapshot().code, name: `Phone ${index + 1}`, relayUrl: url });
    await until(() => phone.getSnapshot().status === 'connected', 'phone welcome');
    phones.push(phone);
  }
  host.setLocked(true);
  await until(() => phones.every(phone => phone.getSnapshot().locked), 'race started on every phone');
  const race = createRace(host.getSnapshot().players);
  race.countdown = 0;
  let actions = { lastControllerAction: 0, localAction: 0 };
  const input = index => host.getSnapshot().players[index].input;
  const step = () => {
    const players = host.getSnapshot().players.map((player, index) => {
      if (index !== 0) return player;
      actions = mergeControllerAction(actions.lastControllerAction, actions.localAction, player.input.action);
      return { ...player, input: { ...player.input, action: actions.localAction } };
    });
    stepRace(race, players, 1 / 60);
  };
  const pickup = (index = 0, row = 0, item = 'fizz') => {
    const kart = race.karts[index], box = race.powers.boxes[row * 3 + index];
    const collected = kart.power.collected;
    box.cooldown = 0;
    kart.lane = box.lane; kart.lateral = 0; kart.distance = box.distance - 2.1; kart.speed = 18;
    step();
    assert.ok(kart.power.item, 'driving through a real item box fills inventory');
    assert.equal(kart.power.collected, collected + 1, 'the box really awarded a fresh item');
    // Real relay IDs randomize the awarded item. Generic transport cases need a
    // consistent effect; Dance Break's intentional stop is tested separately.
    kart.power.item = item;
  };
  return { host, phones, race, input, step, pickup, sockets, storageFor, savedSession, newClient };
}

test('held accelerator and steering carry ITEM through both clients, relay, host merge and simulation', async t => {
  const f = await fixture(t, 2);
  f.phones.forEach(phone => phone.setInput(DRIVE));
  await until(() => f.input(0).accelerate && f.input(1).accelerate, 'held driving reaches host');
  f.pickup(0); f.pickup(1);
  for (let index = 0; index < 2; index++) {
    assert.equal(f.phones[index].useItem(), true);
    await until(() => f.input(index).action === 1, 'new item sequence reaches host');
    assert.deepEqual(f.input(index), { ...DRIVE, action: 1 });
    f.step();
    assert.equal(f.race.karts[index].power.used, 1);
    assert.equal(f.race.karts[index].power.item, null);
    assert.ok(f.race.karts[index].speed > 0, 'item use does not stop driving');
  }
  f.pickup(0, 1); f.pickup(1, 1);
  await wait(240); // More than two real phone input heartbeats.
  for (let frame = 0; frame < 30; frame++) f.step();
  assert.ok(f.race.karts.every(kart => kart.power.used === 1 && kart.power.item), 'heartbeats do not fire newly collected items');
  f.phones[0].useItem();
  f.phones[0].setInput(ZERO); // Both packets can arrive before the next host frame.
  await until(() => f.input(0).action === 2 && !f.input(0).accelerate, 'release retains item event');
  f.step();
  assert.equal(f.race.karts[0].power.used, 2, 'release does not erase the pending press');
});

test('host checkpoint writes and controller departures preserve each browser tab\'s own session', async t => {
  const f = await fixture(t, 2);
  const [first, second] = f.phones;
  const firstSession = f.savedSession(first), secondSession = f.savedSession(second);
  assert.equal(f.savedSession(f.host).role, 'host');
  assert.equal(f.savedSession(f.host).checkpoint.players.length, 2, 'real host checkpoint writes are retained');
  assert.equal(firstSession.role, 'player');
  assert.equal(secondSession.role, 'player');
  assert.notEqual(firstSession.token, secondSession.token);
  assert.equal(firstSession.checkpoint, undefined, 'private host checkpoints do not enter controller storage');
  assert.equal(secondSession.checkpoint, undefined);
  first.useItem();
  await until(() => f.savedSession(f.host).checkpoint.players.find(player => player.id === first.getSnapshot().playerId)?.actionSequence === 1,
    'asynchronous action receipt updates host checkpoint storage');
  assert.deepEqual(f.savedSession(first), firstSession, 'host action checkpoints cannot overwrite a phone session');
  assert.deepEqual(f.savedSession(second), secondSession);
  second.leaveRoom();
  await until(() => f.savedSession(f.host).checkpoint.players.length === 1, 'departure updates host checkpoint');
  assert.equal(f.storageFor(second).size, 0, 'leaving clears only that controller tab');
  assert.equal(f.savedSession(f.host).role, 'host');
  assert.deepEqual(f.savedSession(first), firstSession, 'another phone leaving does not clear this controller');
});

test('empty presses, stale traffic and explicit safety resets cannot fire a later pickup', async t => {
  const f = await fixture(t);
  const [phone] = f.phones;
  phone.setInput(DRIVE);
  phone.useItem();
  await until(() => f.input(0).action === 1, 'empty press reaches host');
  f.step();
  f.pickup();
  f.step();
  assert.equal(f.race.karts[0].power.used, 0, 'empty press is consumed before pickup');
  const socket = f.sockets.at(-1);
  socket.dropInputs = true;
  await until(() => !f.input(0).accelerate && f.input(0).action === undefined, 'relay neutralizes stale input');
  socket.dropInputs = false;
  socket.send(JSON.stringify({ type: 'input', input: { ...DRIVE, action: 1 } }));
  await until(() => f.input(0).accelerate, 'delayed heartbeat is received');
  assert.equal(f.input(0).action, undefined, 'stale action stays below relay floor');
  f.step();
  assert.equal(f.race.karts[0].power.used, 0);
  phone.useItem();
  await until(() => f.input(0).action === 2, 'next genuine press still works');
  f.step();
  assert.equal(f.race.karts[0].power.used, 1);
  f.pickup(0, 1);
  phone.resetInput();
  await until(() => !f.input(0).accelerate && f.input(0).action === undefined, 'safety reset reaches host');
  socket.send(JSON.stringify({ type: 'input', input: { ...ZERO, action: 2 } }));
  await wait(30);
  f.step();
  assert.equal(f.race.karts[0].power.used, 1, 'reset does not replay an old press');
});

test('Dance Break arrives once through the relay, blocks driving and pickups, then permits fresh item use', async t => {
  const f = await fixture(t);
  const [phone] = f.phones;
  const kart = f.race.karts[0];
  phone.setInput(DRIVE);
  await until(() => f.input(0).accelerate, 'held driving reaches host');
  f.pickup(0, 0, 'dance');
  phone.useItem();
  await until(() => f.input(0).action === 1, 'dance item press reaches host');
  f.step();
  assert.equal(kart.power.used, 1);
  assert.equal(kart.power.item, null);
  assert.ok(kart.power.dance > 3, 'dance timer starts from the network item action');
  assert.equal(kart.speed, 0, 'dance intentionally stops the kart despite held GO');
  assert.deepEqual(f.input(0), { ...DRIVE, action: 1 }, 'input stays held while dance temporarily blocks physics');
  const box = f.race.powers.boxes[3];
  kart.distance = box.distance; kart.lane = box.lane;
  f.step();
  assert.equal(kart.power.item, null, 'dancing racers intentionally cannot collect another box');
  assert.equal(kart.power.collected, 1);
  kart.distance = 40; kart.lane = 0; // Finish the animation away from a pickup.
  for (let frame = 0; kart.power.dance > 0 && frame < 240; frame++) f.step();
  assert.equal(kart.power.dance, 0, 'the real simulation expires the dance');
  f.step();
  assert.ok(kart.speed > 0, 'the still-held accelerator works after the dance');
  f.pickup(0, 1, 'guard');
  await wait(120);
  f.step();
  assert.equal(kart.power.item, 'guard');
  assert.equal(kart.power.used, 1, 'old action heartbeats do not use a post-dance pickup');
  phone.useItem();
  await until(() => f.input(0).action === 2, 'fresh post-dance press reaches host');
  f.step();
  assert.equal(kart.power.used, 2);
  assert.ok(kart.power.shield > 0);
});

test('automatic reconnect and a reloaded phone retain item sequence without replay', async t => {
  const f = await fixture(t);
  const [phone] = f.phones;
  const id = phone.getSnapshot().playerId;
  phone.setInput(DRIVE);
  f.pickup();
  phone.useItem();
  await until(() => f.input(0).action === 1, 'initial action arrives');
  f.step();
  f.pickup(0, 1);
  f.sockets.at(-1).terminate();
  await until(() => phone.getSnapshot().status === 'reconnecting', 'controller detects network loss');
  assert.equal(phone.useItem(), false, 'disconnected taps are ignored');
  await until(() => phone.getSnapshot().status === 'connected', 'automatic reconnect');
  assert.equal(phone.getSnapshot().playerId, id);
  assert.equal(phone.getSnapshot().players[0].actionSequence, 1);
  assert.deepEqual(f.input(0), ZERO);
  f.step();
  assert.equal(f.race.karts[0].power.used, 1);
  phone.setInput(DRIVE);
  phone.useItem();
  await until(() => f.input(0).action === 2, 'first post-reconnect press arrives');
  f.step();
  assert.equal(f.race.karts[0].power.used, 2);
  f.pickup(0, 2);
  const savedSession = f.storageFor(phone);
  phone.destroy();
  await until(() => !f.host.getSnapshot().players[0].connected, 'old page disconnects');
  const reloaded = f.newClient(savedSession); // Reload reuses only this tab's storage.
  reloaded.restoreSession(f.host.getSnapshot().code);
  await until(() => reloaded.getSnapshot().status === 'connected', 'reloaded phone restores session');
  assert.equal(reloaded.getSnapshot().role, 'player');
  assert.equal(reloaded.getSnapshot().playerId, id, 'reload resumes the same phone, never the host');
  f.step();
  assert.equal(f.race.karts[0].power.used, 2, 'new client does not replay its predecessor');
  reloaded.setInput(DRIVE);
  reloaded.useItem();
  await until(() => f.input(0).action === 3, 'reload continues the sequence from relay high-water mark');
  f.step();
  assert.equal(f.race.karts[0].power.used, 3);
});

test('finishing while holding GO, steer and ITEM leaves the same controller neutral for a rematch', async t => {
  const f = await fixture(t);
  const [phone] = f.phones;
  const id = phone.getSnapshot().playerId;
  phone.setInput(DRIVE);
  f.pickup();
  phone.useItem();
  await until(() => f.input(0).action === 1, 'item press arrives while driving');
  f.step();
  phone.useItem();
  await until(() => f.input(0).action === 2, 'last press arrives before finish');
  f.host.setLocked(false);
  await until(() => !phone.getSnapshot().locked && !f.host.getSnapshot().locked, 'results boundary reaches controller');
  assert.deepEqual(f.input(0), ZERO);
  assert.equal(phone.useItem(), false);
  phone.setInput(DRIVE); // Late held-control callbacks cannot move a results-screen kart.
  await wait(120);
  assert.deepEqual(f.input(0), ZERO);
  f.host.setLocked(true);
  await until(() => phone.getSnapshot().locked && f.host.getSnapshot().locked, 'rematch boundary reaches controller');
  await wait(120);
  assert.deepEqual(f.input(0), ZERO, 'rematch heartbeat remains neutral until a fresh gesture');
  assert.equal(phone.getSnapshot().playerId, id);
  const rematch = createRace(f.host.getSnapshot().players);
  rematch.countdown = 0;
  const kart = rematch.karts[0], box = rematch.powers.boxes[0];
  kart.lane = box.lane; kart.distance = box.distance - 2.1; kart.speed = 18;
  stepRace(rematch, f.host.getSnapshot().players, 1 / 60);
  assert.ok(kart.power.item);
  stepRace(rematch, f.host.getSnapshot().players, 1 / 60);
  assert.equal(kart.power.used, 0, 'previous-race presses do not fire a new pickup');
  phone.setInput(DRIVE);
  phone.useItem();
  await until(() => f.input(0).action === 3, 'fresh rematch item press arrives');
  assert.deepEqual(f.input(0), { ...DRIVE, action: 3 });
  stepRace(rematch, f.host.getSnapshot().players, 1 / 60);
  assert.equal(kart.power.used, 1, 'new press works without rejoining');
});
