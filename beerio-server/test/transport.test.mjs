import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import WebSocket from 'ws';
import { createRelay } from '../server.mjs';

const ORIGIN = 'https://beerio.example';

async function running(t) {
  const relay = createRelay({ allowedOrigins: [ORIGIN], logger: { error() {} } });
  relay.server.listen(0, '127.0.0.1');
  await once(relay.server, 'listening');
  t.after(() => relay.close());
  return { ...relay, url: `ws://127.0.0.1:${relay.server.address().port}` };
}

async function client(url) {
  const ws = new WebSocket(url, { origin: ORIGIN });
  const messages = [];
  const waiters = [];
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    messages.push(message);
    for (const waiter of [...waiters]) {
      if (waiter.predicate(message)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        clearTimeout(waiter.timer);
        waiter.resolve(message);
      }
    }
  });
  await once(ws, 'open');
  return {
    ws, messages,
    send: (message) => ws.send(JSON.stringify(message)),
    wait(predicate) {
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, timer: setTimeout(() => reject(new Error('Timed out waiting for a relay message')), 2000) };
        waiters.push(waiter);
      });
    },
  };
}

test('real WebSockets create room, join, relay input/state, reject player state, reconnect and leave', async (t) => {
  const relay = await running(t);
  const host = await client(relay.url);
  const hostWelcome = host.wait((m) => m.type === 'welcome');
  host.send({ type: 'create', maxPlayers: 4 });
  const { room: { code } } = await hostWelcome;
  const player = await client(relay.url);
  const joined = player.wait((m) => m.type === 'welcome');
  player.send({ type: 'join', code, name: 'Phone' });
  const welcome = await joined;
  const ready = player.wait(m => m.type === 'room' && m.room.players.every(driver => driver.ready));
  player.send({ type: 'ready', ready: true });
  await ready;
  const started = player.wait((m) => m.type === 'room' && m.room.locked);
  host.send({ type: 'lock', locked: true });
  await started;
  const input = host.wait((m) => m.type === 'input' && m.input.accelerate);
  player.send({ type: 'input', input: { steer: -0.4, accelerate: true, brake: false } });
  assert.equal((await input).playerId, welcome.playerId);
  const state = player.wait((m) => m.type === 'state');
  host.send({ type: 'state', payload: { phase: 'racing', lap: 2 } });
  assert.deepEqual((await state).payload, { phase: 'racing', lap: 2 });
  const forbidden = player.wait((m) => m.type === 'error');
  player.send({ type: 'state', payload: { winner: 'me' } });
  assert.equal((await forbidden).code, 'host_only');
  const stopped = host.wait((m) => m.type === 'input' && m.input.accelerate === false);
  player.ws.close();
  await stopped;
  const replacement = await client(relay.url);
  const resumed = replacement.wait((m) => m.type === 'welcome');
  replacement.send({ type: 'resume', code, token: welcome.token });
  assert.equal((await resumed).playerId, welcome.playerId);
  const ended = replacement.wait((m) => m.type === 'room_closed');
  host.send({ type: 'leave' });
  assert.match((await ended).reason, /host ended/);
});

test('origin and path restrictions reject unauthorised upgrades', async (t) => {
  const relay = await running(t);
  for (const [url, origin, expected] of [[relay.url, 'https://untrusted.example', '403'], [`${relay.url}/wrong`, ORIGIN, '404']]) {
    const ws = new WebSocket(url, { origin });
    const [error] = await once(ws, 'error');
    assert.ok(error.message.includes(expected));
  }
});

test('binary, oversized and invalid JSON messages close safely', async (t) => {
  const relay = await running(t);
  for (const [payload, expected] of [[Buffer.from('binary'), 1003], ['x'.repeat(42_000), 1009], ['{broken', 1007]]) {
    const peer = await client(relay.url);
    const closed = once(peer.ws, 'close');
    peer.ws.send(payload);
    const [code] = await closed;
    assert.equal(code, expected);
  }
});

test('health endpoint contains no room identities or credentials', async (t) => {
  const relay = await running(t);
  const response = await fetch(`${relay.url.replace('ws:', 'http:')}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'beerio-relay', rooms: 0 });
});

test('real WebSocket item presses retain sequence through release and resume without replay', async (t) => {
  const relay = await running(t);
  const host = await client(relay.url);
  const created = host.wait(message => message.type === 'welcome');
  host.send({ type: 'create', maxPlayers: 4 });
  const { room: { code } } = await created;
  const phone = await client(relay.url);
  const joined = phone.wait(message => message.type === 'welcome');
  phone.send({ type: 'join', code, name: 'Item Racer' });
  const identity = await joined;
  const ready = phone.wait(m => m.type === 'room' && m.room.players.every(driver => driver.ready));
  phone.send({ type: 'ready', ready: true });
  await ready;
  const started = phone.wait(message => message.type === 'room' && message.room.locked);
  host.send({ type: 'lock', locked: true });
  await started;
  const item = host.wait(message => message.type === 'input' && message.input.action === 1);
  phone.send({ type: 'input', input: { steer: 0.3, accelerate: true, brake: false, action: 1 } });
  assert.equal((await item).playerId, identity.playerId);
  const released = host.wait(message => message.type === 'input' && !message.input.accelerate && message.input.action === undefined);
  phone.send({ type: 'input', input: { steer: 0, accelerate: false, brake: false } });
  await released;
  phone.ws.close();
  const replacement = await client(relay.url);
  const resumed = replacement.wait(message => message.type === 'welcome');
  replacement.send({ type: 'resume', code, token: identity.token });
  const { room } = await resumed;
  assert.equal(room.players[0].actionSequence, 1);
  assert.equal(room.players[0].input.action, undefined);
  const next = host.wait(message => message.type === 'input' && message.input.action === 2);
  replacement.send({ type: 'input', input: { steer: 0, accelerate: false, brake: false, action: 2 } });
  await next;
  replacement.ws.close();
  host.ws.close();
});

test('real concurrent random joins fill two isolated races, with reconnect and private rooms excluded', async (t) => {
  const relay = await running(t);
  const hosts = await Promise.all([client(relay.url), client(relay.url), client(relay.url)]);
  const creates = hosts.map(h => h.wait(m => m.type === 'welcome'));
  hosts.forEach((h, i) => h.send({ type: 'create', maxPlayers: 4, publicMatchmaking: i < 2 }));
  const welcomes = await Promise.all(creates);
  const players = await Promise.all(Array.from({ length: 10 }, () => client(relay.url)));
  const replies = players.map(p => p.wait(m => m.type === 'welcome' || m.type === 'error'));
  players.forEach((p, i) => p.send({ type: 'join_random', name: `Concurrent ${i}` }));
  const joined = await Promise.all(replies);
  assert.equal(joined.filter(m => m.type === 'welcome').length, 8);
  assert.equal(joined.filter(m => m.code === 'no_random_room').length, 2);
  assert.ok(joined.filter(m => m.type === 'welcome').every(m => m.room.code !== welcomes[2].room.code));
  for (let i = 0; i < 2; i++) {
    const racers = players.map((player, j) => ({ player, welcome: joined[j] })).filter(x => x.welcome.room?.code === welcomes[i].room.code);
    assert.equal(racers.length, 4);
    const allReady = hosts[i].wait(m => m.type === 'room' && m.room.players.length === 4 && m.room.players.every(p => p.ready));
    racers.forEach(({ player }) => player.send({ type: 'ready', ready: true }));
    await allReady;
    const locked = hosts[i].wait(m => m.type === 'room' && m.room.locked);
    hosts[i].send({ type: 'lock', locked: true }); await locked;
  }
  const racerA = players.findIndex((_, i) => joined[i].room?.code === welcomes[0].room.code);
  const racerB = players.findIndex((_, i) => joined[i].room?.code === welcomes[1].room.code);
  const inputs = [0, 1].map(i => hosts[i].wait(m => m.type === 'input' && m.input.accelerate));
  players[racerA].send({ type: 'input', input: { steer: .5, accelerate: true, brake: false } });
  players[racerB].send({ type: 'input', input: { steer: -.5, accelerate: true, brake: false } });
  assert.equal((await inputs[0]).playerId, joined[racerA].playerId);
  assert.equal((await inputs[1]).playerId, joined[racerB].playerId);
  const states = [racerA, racerB].map(i => players[i].wait(m => m.type === 'state'));
  hosts[0].send({ type: 'state', payload: { race: 'A' } }); hosts[1].send({ type: 'state', payload: { race: 'B' } });
  assert.deepEqual((await states[0]).payload, { race: 'A' }); assert.deepEqual((await states[1]).payload, { race: 'B' });
  players[racerA].ws.close();
  await hosts[0].wait(m => m.type === 'room' && m.room.players.some(p => p.id === joined[racerA].playerId && !p.connected));
  const again = await client(relay.url); const resumed = again.wait(m => m.type === 'welcome');
  again.send({ type: 'resume', code: joined[racerA].room.code, token: joined[racerA].token, roomId: joined[racerA].roomId });
  assert.equal((await resumed).playerId, joined[racerA].playerId);
  assert.equal(relay.rooms.rooms.get(welcomes[1].room.code).players.get(joined[racerB].playerId).peer !== null, true);
});
