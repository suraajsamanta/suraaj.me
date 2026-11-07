import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomService, ZERO_INPUT } from '../core.mjs';

function setup() {
  const service = new RoomService({ now: () => 1000 });
  const peer = () => {
    const p = { messages: [], send(m) { this.messages.push(structuredClone(m)); }, close() {} };
    service.connect(p);
    return p;
  };
  return { service, peer };
}

function lastCheckpoint(host) {
  return structuredClone(host.messages.filter(m => m.type === 'checkpoint').at(-1).checkpoint);
}

test('ten controllers join, input remains distinct, the eleventh is rejected, and all ten recover after relay restart', () => {
  const first = setup(), host = first.peer();
  first.service.receive(host, { type: 'create', maxPlayers: 10, recoveryVersion: 1 });
  const hostWelcome = host.messages.find(m => m.type === 'welcome');
  assert.equal(hostWelcome.room.maxPlayers, 10);
  const controllers = Array.from({ length: 10 }, (_, i) => {
    const p = first.peer();
    first.service.receive(p, { type: 'join', code: hostWelcome.room.code, name: `Racer ${i + 1}` });
    first.service.receive(host, { type: 'checkpoint_ack', revision: lastCheckpoint(host).revision });
    assert.ok(p.messages.find(m => m.type === 'welcome'), `controller ${i + 1} received welcome`);
    return p;
  });
  const room = first.service.rooms.get(hostWelcome.room.code);
  const roster = first.service.roomView(room).players;
  assert.equal(roster.length, 10);
  assert.equal(new Set(roster.map(p => p.id)).size, 10);
  assert.equal(new Set(roster.map(p => p.color)).size, 10);
  assert.ok(roster.every(p => /^#[0-9a-f]{6}$/i.test(p.color)));
  const overflow = first.peer();
  first.service.receive(overflow, { type: 'join', code: hostWelcome.room.code, name: 'Eleven' });
  assert.equal(overflow.messages.at(-1).code, 'room_full');
  for (const controller of controllers) first.service.receive(controller, { type: 'ready', ready: true });
  first.service.receive(host, { type: 'lock', locked: true });
  for (const [i, p] of controllers.entries()) {
    first.service.receive(p, { type: 'input', input: { steer: i / 10, accelerate: true, brake: false, drift: i % 2 === 0 } });
    assert.equal(host.messages.at(-1).playerId, p.playerId);
    assert.equal(host.messages.at(-1).input.steer, i / 10);
    assert.equal(host.messages.at(-1).input.drift, i % 2 === 0);
  }
  const checkpoint = lastCheckpoint(host);
  assert.equal(checkpoint.players.length, 10);
  assert.equal(checkpoint.participants.length, 10);
  const second = setup(), restoredHost = second.peer();
  second.service.receive(restoredHost, { type: 'resume', roomId: hostWelcome.roomId, code: hostWelcome.room.code,
    token: hostWelcome.token, recoveryVersion: 1, checkpoint });
  const restored = restoredHost.messages.find(m => m.type === 'welcome');
  assert.equal(restored.room.players.length, 10);
  assert.equal(restored.room.recovering, true);
  const resumed = controllers.map((old, i) => {
    const welcome = old.messages.find(m => m.type === 'welcome'), p = second.peer();
    second.service.receive(p, { type: 'resume', roomId: welcome.roomId, token: welcome.token });
    const rejoined = p.messages.find(m => m.type === 'welcome');
    assert.equal(rejoined.playerId, welcome.playerId);
    assert.deepEqual(rejoined.room.players.find(q => q.id === p.playerId).input, ZERO_INPUT);
    assert.equal(rejoined.room.recovering, i < 9);
    return p;
  });
  for (const [i, p] of resumed.entries()) {
    second.service.receive(p, { type: 'input', input: { steer: -i / 10, accelerate: true, brake: false } });
    assert.equal(restoredHost.messages.at(-1).playerId, p.playerId);
  }
});

test('room creation and recovery cannot exceed ten racers', () => {
  const f = setup(), badHost = f.peer();
  f.service.receive(badHost, { type: 'create', maxPlayers: 11 });
  assert.equal(badHost.messages.at(-1).code, 'invalid_capacity');
  const host = f.peer();
  f.service.receive(host, { type: 'create', recoveryVersion: 1 });
  const welcome = host.messages.find(m => m.type === 'welcome');
  assert.equal(welcome.room.maxPlayers, 10);
  const checkpoint = lastCheckpoint(host);
  checkpoint.maxPlayers = 11;
  const next = setup(), attacker = next.peer();
  next.service.receive(attacker, { type: 'resume', roomId: welcome.roomId, token: welcome.token, checkpoint, recoveryVersion: 1 });
  assert.equal(attacker.messages.at(-1).code, 'invalid_recovery');
});

test('full names, including astral characters, are retained through restart; names over the limit are rejected', () => {
  const f = setup(), host = f.peer();
  f.service.receive(host, { type: 'create', recoveryVersion: 1 });
  const welcome = host.messages.find(m => m.type === 'welcome');
  const name = 'Alexandria Racer ' + '🏎️'.repeat(20);
  assert.ok(name.length > 18 && Array.from(name).length <= 64);
  const driver = f.peer();
  f.service.receive(driver, { type: 'join', code: welcome.room.code, name });
  f.service.receive(host, { type: 'checkpoint_ack', revision: lastCheckpoint(host).revision });
  assert.equal(driver.messages.find(m => m.type === 'welcome').room.players[0].name, name);
  const next = setup(), restoredHost = next.peer();
  next.service.receive(restoredHost, { type: 'resume', roomId: welcome.roomId, token: welcome.token,
    recoveryVersion: 1, checkpoint: lastCheckpoint(host) });
  assert.equal(restoredHost.messages.find(m => m.type === 'welcome').room.players[0].name, name);
  const overflow = f.peer();
  f.service.receive(overflow, { type: 'join', code: welcome.room.code, name: '🏎'.repeat(65) });
  assert.equal(overflow.messages.at(-1).code, 'invalid_name');
  assert.equal(f.service.roomView(f.service.rooms.get(welcome.room.code)).players.length, 1);
});
