import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomService, ZERO_INPUT, HOST_GRACE_MS, PLAYER_GRACE_MS, INPUT_TIMEOUT_MS } from '../core.mjs';

function fixture() {
  let time = 1_000;
  const service = new RoomService({ now: () => time });
  const peer = () => {
    const messages = [];
    const peer = { messages, closed: false, send: (m) => messages.push(structuredClone(m)), close() { this.closed = true; } };
    service.connect(peer);
    return peer;
  };
  const host = peer();
  service.receive(host, { type: 'create', maxPlayers: 6 });
  const welcome = host.messages.find((m) => m.type === 'welcome');
  const code = welcome.room.code;
  const join = (name = 'Racer') => {
    const player = peer();
    service.receive(player, { type: 'join', code, name });
    return player;
  };
  return { service, peer, host, code, welcome, join, tick(ms) { time += ms; service.sweep(); } };
}

test('six unique racer slots; no host slot and no tokens in public roster', () => {
  const f = fixture();
  const players = Array.from({ length: 6 }, (_, i) => f.join(`Racer ${i}`));
  const room = f.service.roomView(f.service.rooms.get(f.code));
  assert.equal(room.players.length, 6);
  assert.equal(new Set(room.players.map((p) => p.color)).size, 6);
  assert.ok(room.players.every((p) => !('token' in p) && !('peer' in p)));
  assert.equal(f.join().messages.at(-1).code, 'room_full');
  assert.equal(players[0].messages[0].role, 'player');
});

test('only host can publish and lock, and lock rejects new joins', () => {
  const f = fixture();
  const player = f.join();
  f.service.receive(player, { type: 'state', payload: { winner: player.playerId } });
  assert.equal(player.messages.at(-1).code, 'host_only');
  f.service.receive(player, { type: 'lock', locked: true });
  assert.equal(f.service.rooms.get(f.code).locked, false);
  f.service.receive(f.host, { type: 'lock', locked: true });
  assert.equal(f.join().messages.at(-1).code, 'room_locked');
  f.service.receive(f.host, { type: 'state', payload: { phase: 'racing' } });
  assert.deepEqual(player.messages.at(-1), { type: 'state', payload: { phase: 'racing' } });
});

test('valid input forwards to host only; stale and disconnected controls reset', () => {
  const f = fixture();
  const player = f.join();
  const other = f.join();
  f.service.receive(f.host, { type: 'lock', locked: true });
  const count = other.messages.length;
  f.service.receive(player, { type: 'input', input: { steer: 0.5, accelerate: true, brake: false } });
  assert.deepEqual(f.host.messages.at(-1).input, { steer: 0.5, accelerate: true, brake: false });
  assert.equal(other.messages.length, count);
  f.tick(INPUT_TIMEOUT_MS + 1);
  assert.deepEqual(f.host.messages.at(-1).input, ZERO_INPUT);
  f.service.receive(player, { type: 'input', input: { steer: -1, accelerate: true, brake: false } });
  f.service.disconnect(player);
  const entry = f.service.roomView(f.service.rooms.get(f.code)).players[0];
  assert.equal(entry.connected, false);
  assert.deepEqual(entry.input, ZERO_INPUT);
});

test('malformed inputs are refused, never clamped into authority', () => {
  const f = fixture();
  const player = f.join();
  for (const input of [null, {}, { steer: NaN, accelerate: true, brake: false }, { steer: 2, accelerate: true, brake: false }, { steer: 0, accelerate: 'true', brake: false }]) {
    f.service.receive(player, { type: 'input', input });
    assert.equal(player.messages.at(-1).code, 'invalid_input');
  }
  assert.deepEqual(f.service.roomView(f.service.rooms.get(f.code)).players[0].input, ZERO_INPUT);
});

test('player can resume same slot with secret while locked; room code is not a credential', () => {
  const f = fixture();
  const player = f.join('Fast Pal');
  const token = player.messages[0].token;
  const id = player.playerId;
  f.service.disconnect(player);
  f.service.receive(f.host, { type: 'lock', locked: true });
  const bad = f.peer();
  f.service.receive(bad, { type: 'resume', code: f.code, token: f.code });
  assert.equal(bad.messages.at(-1).code, 'invalid_session');
  const resumed = f.peer();
  f.service.receive(resumed, { type: 'resume', code: f.code, token });
  assert.equal(resumed.playerId, id);
  assert.equal(resumed.messages[0].room.players.length, 1);
  assert.equal(resumed.messages[0].room.players[0].name, 'Fast Pal');
  assert.deepEqual(resumed.messages[0].room.players[0].input, ZERO_INPUT);
});

test('host disconnect clears input, resume retains room, and departure eventually closes it', () => {
  const f = fixture();
  const player = f.join();
  f.service.receive(f.host, { type: 'lock', locked: true });
  f.service.receive(player, { type: 'input', input: { steer: 1, accelerate: true, brake: false } });
  f.service.disconnect(f.host);
  assert.equal(player.messages.at(-1).room.hostConnected, false);
  assert.deepEqual(player.messages.at(-1).room.players[0].input, ZERO_INPUT);
  f.tick(1000);
  const replacement = f.peer();
  f.service.receive(replacement, { type: 'resume', code: f.code, token: f.welcome.token });
  assert.equal(replacement.role, 'host');
  assert.equal(player.messages.at(-1).room.hostConnected, true);
  f.service.disconnect(replacement);
  f.tick(HOST_GRACE_MS + 1);
  assert.equal(f.service.rooms.size, 0);
  assert.equal(player.messages.at(-1).type, 'room_closed');
  assert.equal(player.closed, true);
});

test('explicit host leave closes immediately; disconnected player seats expire', () => {
  const f = fixture();
  const player = f.join();
  f.service.disconnect(player);
  f.tick(PLAYER_GRACE_MS + 1);
  assert.equal(f.service.roomView(f.service.rooms.get(f.code)).players.length, 0);
  f.service.receive(f.host, { type: 'leave' });
  assert.equal(f.service.rooms.size, 0);
});

test('duplicate resume replaces old socket without disconnecting new socket', () => {
  const f = fixture();
  const player = f.join();
  const replacement = f.peer();
  f.service.receive(replacement, { type: 'resume', code: f.code, token: player.messages[0].token });
  assert.equal(player.closed, true);
  assert.equal(player.messages.at(-1).code, 'session_replaced');
  f.service.disconnect(player);
  assert.equal(f.service.rooms.get(f.code).players.get(replacement.playerId).peer, replacement);
});

test('capacity bounds, input flooding, oversized state and unauthenticated socket timeout', () => {
  const f = fixture();
  const badHost = f.peer();
  f.service.receive(badHost, { type: 'create', maxPlayers: 7 });
  assert.equal(badHost.messages.at(-1).code, 'invalid_capacity');
  const player = f.join();
  for (let i = 0; i < 90; i++) f.service.receive(player, { type: 'input', input: { ...ZERO_INPUT } });
  assert.equal(player.closed, true);
  assert.ok(player.messages.some((m) => m.code === 'rate_limit'));
  f.service.receive(f.host, { type: 'state', payload: 'x'.repeat(33_000) });
  assert.equal(f.host.messages.at(-1).code, 'state_too_large');
  const empty = f.peer();
  f.tick(15_001);
  assert.equal(empty.closed, true);
});

test('names are bounded and remove controls; lower-case codes normalize', () => {
  const f = fixture();
  const player = f.peer();
  f.service.receive(player, { type: 'join', code: f.code.toLowerCase(), name: '\u0000Hello\n' + 'x'.repeat(30) });
  const name = player.messages[0].room.players[0].name;
  assert.equal(name.length, 18);
  assert.ok(!name.includes('\n'));
});

test('item sequences survive heartbeats but cannot replay across resets, stale controls or reconnects', () => {
  const f = fixture();
  const player = f.join();
  const token = player.messages[0].token;
  f.service.receive(f.host, { type: 'lock', locked: true });
  const input = action => ({ steer: 0, accelerate: false, brake: false, action });
  f.service.receive(player, { type: 'input', input: input(5) });
  assert.equal(f.host.messages.at(-1).input.action, 5);
  f.service.receive(player, { type: 'input', input: input(5) });
  assert.equal(f.host.messages.at(-1).input.action, 5, 'heartbeat retains latest press until a host frame');
  f.service.receive(player, { type: 'input', input: input(3) });
  assert.equal(f.host.messages.at(-1).input.action, 5, 'out-of-order packet cannot lower the high-water mark');
  f.service.receive(player, { type: 'input', input: { ...ZERO_INPUT } });
  f.service.receive(player, { type: 'input', input: input(5) });
  assert.deepEqual(f.host.messages.at(-1).input, ZERO_INPUT, 'reset suppresses even a delayed duplicate');
  f.service.receive(player, { type: 'input', input: input(6) });
  assert.equal(f.host.messages.at(-1).input.action, 6);
  f.tick(INPUT_TIMEOUT_MS + 1);
  assert.deepEqual(f.host.messages.at(-1).input, ZERO_INPUT);
  f.service.receive(player, { type: 'input', input: input(6) });
  assert.deepEqual(f.host.messages.at(-1).input, ZERO_INPUT, 'stale actions cannot replay');
  f.service.disconnect(player);
  const resumed = f.peer();
  f.service.receive(resumed, { type: 'resume', code: f.code, token });
  assert.deepEqual(resumed.messages[0].room.players[0].input, ZERO_INPUT);
  assert.equal(resumed.messages[0].room.players[0].actionSequence, 6);
  f.service.receive(resumed, { type: 'input', input: input(7) });
  assert.equal(f.host.messages.at(-1).input.action, 7, 'first legitimate post-resume press works');
});

test('invalid item sequences are rejected while legacy driving-only input stays compatible', () => {
  const f = fixture();
  const player = f.join();
  for (const action of [NaN, -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
    f.service.receive(player, { type: 'input', input: { ...ZERO_INPUT, action } });
    assert.equal(player.messages.at(-1).code, 'invalid_input');
  }
  f.service.receive(player, { type: 'input', input: { ...ZERO_INPUT } });
  assert.deepEqual(f.host.messages.at(-1).input, ZERO_INPUT);
});

test('finish and rematch boundaries clear held input and reject lobby action replay', () => {
  const f = fixture();
  const player = f.join();
  const held = action => ({ steer: 0.7, accelerate: true, brake: false, action });
  const send = action => f.service.receive(player, { type: 'input', input: held(action) });
  send(1);
  assert.deepEqual(f.host.messages.at(-1).input, ZERO_INPUT, 'lobby input is neutral');
  f.service.receive(f.host, { type: 'lock', locked: true });
  assert.deepEqual(f.service.roomView(f.service.rooms.get(f.code)).players[0].input, ZERO_INPUT);
  send(2);
  assert.deepEqual(f.host.messages.at(-1).input, held(2));
  f.service.receive(f.host, { type: 'lock', locked: true });
  assert.deepEqual(f.service.roomView(f.service.rooms.get(f.code)).players[0].input, held(2), 'duplicate lock does not cancel live input');
  f.service.receive(f.host, { type: 'lock', locked: false });
  assert.deepEqual(f.service.roomView(f.service.rooms.get(f.code)).players[0].input, ZERO_INPUT, 'finish releases held controls');
  send(3);
  assert.deepEqual(f.host.messages.at(-1).input, ZERO_INPUT, 'results-screen packets cannot queue controls');
  f.service.receive(f.host, { type: 'lock', locked: true });
  assert.deepEqual(f.service.roomView(f.service.rooms.get(f.code)).players[0].input, ZERO_INPUT, 'rematch starts neutral');
  send(3);
  assert.equal(f.host.messages.at(-1).input.action, undefined, 'results-screen item is below the action floor');
  send(4);
  assert.deepEqual(f.host.messages.at(-1).input, held(4), 'a new race accepts fresh controls and item presses');
  assert.equal(f.service.roomView(f.service.rooms.get(f.code)).players.length, 1, 'same controller slot survives');
});
