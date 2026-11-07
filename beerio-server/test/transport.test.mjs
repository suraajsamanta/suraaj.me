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
