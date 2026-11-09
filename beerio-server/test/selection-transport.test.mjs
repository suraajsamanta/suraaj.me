import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import WebSocket from 'ws';
import { createRelay } from '../server.mjs';

const ORIGIN = 'https://beerio.example';
const ZERO = { steer: 0, accelerate: false, brake: false };

async function client(url) {
  const ws = new WebSocket(url, { origin: ORIGIN });
  const messages = [], waiters = new Set();
  ws.on('message', data => {
    const message = JSON.parse(data.toString());
    messages.push(message);
    for (const waiter of waiters) if (waiter.predicate(message)) {
      waiters.delete(waiter); clearTimeout(waiter.timer); waiter.resolve(message);
    }
  });
  await once(ws, 'open');
  return {
    ws, messages,
    send: message => ws.send(JSON.stringify(message)),
    wait(predicate, timeout = 2500) {
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, timer: setTimeout(() => {
          waiters.delete(waiter); reject(new Error('Timed out waiting for character-selection transport'));
        }, timeout) };
        waiters.add(waiter);
      });
    },
  };
}

test('real WebSocket character selection cancels for disconnect and late join, then starts once after a full five seconds', async t => {
  const relay = createRelay({ allowedOrigins: [ORIGIN], logger: { error() {} } });
  relay.server.listen(0, '127.0.0.1'); await once(relay.server, 'listening');
  t.after(() => relay.close());
  const url = `ws://127.0.0.1:${relay.server.address().port}/room`;
  const host = await client(url);
  let response = host.wait(message => message.type === 'welcome');
  host.send({ type: 'create', characterSelectionVersion: 2 });
  const { room: { code } } = await response;
  const join = async name => {
    const phone = await client(url), welcome = phone.wait(message => message.type === 'welcome');
    phone.send({ type: 'join', characterSelectionVersion: 2, code, name, appearance: { character: 'bezos', vehicle: 'kart', color: '#123456' } });
    return { phone, welcome: await welcome };
  };
  const a = await join('QA A'), b = await join('QA B');
  response = a.phone.wait(message => message.type === 'room' && message.room.selectionPhase === 'selecting');
  host.send({ type: 'select_characters' }); await response;
  response = host.wait(message => message.type === 'room' && message.room.players.find(player => player.id === a.welcome.playerId)?.character === 'trump');
  a.phone.send({ type: 'character', direction: 'right' }); await response;
  a.phone.send({ type: 'character', confirm: true });
  response = host.wait(message => message.type === 'room' && message.room.selectionPhase === 'countdown');
  b.phone.send({ type: 'character', confirm: true });
  const firstCountdown = (await response).room.countdownEndsAt;
  assert.ok(firstCountdown - Date.now() > 4500);

  response = host.wait(message => message.type === 'input' && message.playerId === a.welcome.playerId);
  a.phone.send({ type: 'input', input: { steer: 1, accelerate: true, brake: false, action: 8 } });
  assert.deepEqual((await response).input, ZERO, 'Countdown cannot queue driving or item actions');
  response = host.wait(message => message.type === 'room' && message.room.selectionPhase === 'selecting');
  b.phone.ws.close(); const interrupted = (await response).room;
  assert.equal(interrupted.countdownEndsAt, null); assert.equal(interrupted.locked, false);
  const returned = await client(url);
  response = host.wait(message => message.type === 'room' && message.room.selectionPhase === 'countdown');
  returned.send({ type: 'resume', characterSelectionVersion: 2, code, token: b.welcome.token }); await response;

  response = host.wait(message => message.type === 'room' && message.room.selectionPhase === 'selecting' && message.room.players.length === 3);
  const c = await join('QA C'); await response;
  response = host.wait(message => message.type === 'room' && message.room.selectionPhase === 'countdown');
  const confirmedAt = Date.now(); c.phone.send({ type: 'character', confirm: true });
  const finalCountdown = (await response).room.countdownEndsAt;
  assert.ok(finalCountdown >= confirmedAt + 5000);
  assert.equal(host.messages.some(message => message.type === 'room' && message.room.locked), false);
  response = host.wait(message => message.type === 'room' && message.room.locked, 6500);
  const racing = (await response).room;
  assert.ok(Date.now() >= finalCountdown, 'Never start before the complete countdown');
  assert.equal(racing.selectionPhase, 'racing'); assert.equal(racing.countdownEndsAt, null);
  assert.deepEqual(racing.players.filter(player => player.inRace).map(player => player.id), [a.welcome.playerId, b.welcome.playerId, c.welcome.playerId]);
  assert.ok(racing.players.every(player => player.characterConfirmed));
  assert.deepEqual(racing.players.map(player => player.character), ['trump', 'bezos', 'bezos']);
  assert.equal(racing.characterSelectionVersion, 2);
  assert.ok(racing.players.every(player => !player.input.action && !player.input.accelerate));
  assert.equal(host.messages.filter(message => message.type === 'room' && message.room.locked).length, 1);

  response = host.wait(message => message.type === 'input' && message.playerId === a.welcome.playerId && message.input.action === 9);
  a.phone.send({ type: 'input', input: { steer: -.5, accelerate: true, brake: false, action: 9 } });
  assert.equal((await response).input.accelerate, true);
  response = host.wait(message => message.type === 'room' && !message.room.locked);
  host.send({ type: 'lock', locked: false }); const rematch = (await response).room;
  assert.equal(rematch.selectionPhase, 'gathering');
  assert.ok(rematch.players.every(player => !player.characterConfirmed && !player.inRace));
  assert.ok(rematch.players.every(player => !player.input.action && !player.input.accelerate));
});
