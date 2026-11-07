import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import WebSocket from 'ws';
import { createRelay } from '../server.mjs';

const ORIGIN = 'https://beerio.example';
async function connect(url) {
  const ws = new WebSocket(url, { origin: ORIGIN });
  const waiters = [];
  ws.on('message', bytes => {
    const msg = JSON.parse(bytes.toString());
    for (const waiter of [...waiters]) if (waiter.match(msg)) {
      waiters.splice(waiters.indexOf(waiter), 1); clearTimeout(waiter.timer); waiter.resolve(msg);
    }
  });
  await once(ws, 'open');
  return {
    send: data => ws.send(JSON.stringify(data)),
    wait: match => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for relay message')), 3000);
      waiters.push({ match, resolve, timer });
    }),
  };
}

test('ten live WebSocket controllers join and send independent inputs; an eleventh is refused', async t => {
  const relay = createRelay({ allowedOrigins: [ORIGIN], logger: { error() {} } });
  relay.server.listen(0, '127.0.0.1');
  await once(relay.server, 'listening');
  t.after(() => relay.close());
  const url = `ws://127.0.0.1:${relay.server.address().port}`;
  const host = await connect(url), created = host.wait(m => m.type === 'welcome');
  host.send({ type: 'create', maxPlayers: 10 });
  const { room: { code } } = await created;
  const phones = [];
  for (let i = 0; i < 10; i++) {
    const phone = await connect(url), joined = phone.wait(m => m.type === 'welcome');
    phone.send({ type: 'join', code, name: `Phone ${i + 1}` });
    phones.push({ phone, id: (await joined).playerId });
  }
  const eleventh = await connect(url), full = eleventh.wait(m => m.type === 'error');
  eleventh.send({ type: 'join', code, name: 'Eleven' });
  assert.equal((await full).code, 'room_full');
  const ready = host.wait(m => m.type === 'room' && m.room.players.length === 10 && m.room.players.every(player => player.ready));
  for (const { phone } of phones) phone.send({ type: 'ready', ready: true });
  await ready;
  const started = phones[9].phone.wait(m => m.type === 'room' && m.room.locked);
  host.send({ type: 'lock', locked: true });
  assert.equal((await started).room.players.length, 10);
  const inputs = phones.map(({ id }) => host.wait(m => m.type === 'input' && m.playerId === id && m.input.accelerate));
  for (const [i, { phone }] of phones.entries()) phone.send({ type: 'input', input: { steer: i / 10, accelerate: true, brake: false } });
  const forwarded = await Promise.all(inputs);
  assert.deepEqual(forwarded.map(m => m.input.steer), phones.map((_, i) => i / 10));
});
