import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomService, SELECTION_COUNTDOWN_MS, LEGACY_SELECTION_CHARACTERS, SELECTION_CHARACTERS, ZERO_INPUT } from '../core.mjs';

function fixture({ recovery = false } = {}) {
  let now = 1000;
  let service = new RoomService({ now: () => now });
  const peer = () => { const p = { messages: [], send(m) { this.messages.push(structuredClone(m)); }, close() {} }; service.connect(p); return p; };
  const host = peer(); service.receive(host, { type: 'create', characterSelectionVersion: 1, recoveryVersion: recovery ? 1 : undefined });
  const welcome = host.messages.find(m => m.type === 'welcome');
  const room = service.rooms.get(welcome.room.code);
  const ack = () => service.receive(host, { type: 'checkpoint_ack', revision: room.checkpointRevision });
  const join = (name = 'Driver') => { const p = peer(); service.receive(p, { type: 'join', code: room.code, name }); if (recovery) ack(); return p; };
  const choose = (p, choice = { confirm: true }) => service.receive(p, { type: 'character', ...choice });
  const begin = () => service.receive(host, { type: 'select_characters' });
  const tick = ms => { now += ms; service.sweep(); };
  return { service, peer, host, room, welcome, ack, join, choose, begin, tick };
}

test('all24 characters use a four-way6x4 grid; last pick starts exactly5 seconds without ready-up', () => {
  const f = fixture(), a = f.join('Arun'), b = f.join('Maya'); f.begin();
  assert.equal(f.room.selectionPhase, 'selecting');
  assert.equal(f.room.players.get(a.playerId).character, 'gorilla');
  f.choose(a, { direction: 'left' }); assert.equal(f.room.players.get(a.playerId).character, 'rabbit');
  f.choose(a, { direction: 'up' }); assert.equal(f.room.players.get(a.playerId).character, 'horse');
  f.choose(a, { direction: 'right' }); assert.equal(f.room.players.get(a.playerId).character, 'pig');
  f.choose(a, { direction: 'down' }); assert.equal(f.room.players.get(a.playerId).character, 'gorilla');
  assert.equal(LEGACY_SELECTION_CHARACTERS.length, 24);
  assert.equal(SELECTION_CHARACTERS.length, 30);
  f.choose(a); assert.equal(f.room.countdownEndsAt, null);
  f.choose(b); assert.equal(f.room.countdownEndsAt, 1000 + SELECTION_COUNTDOWN_MS);
  f.service.receive(a, { type: 'input', input: { steer: 1, accelerate: true, brake: false, action: 9 } });
  assert.deepEqual(f.room.players.get(a.playerId).input, ZERO_INPUT);
  f.tick(4999); assert.equal(f.room.locked, false); f.tick(1); assert.equal(f.room.locked, true);
  assert.equal(f.room.selectionPhase, 'racing');
  assert.deepEqual([...f.room.participants], [a.playerId, b.playerId]);
  assert.equal(f.join('Late').messages.at(-1).code, 'room_locked');
});

test('change selection, late join, controller disconnect and host disconnect cancel/restart the entire countdown', () => {
  const f = fixture(), a = f.join(); f.begin(); f.choose(a); f.tick(3000);
  f.choose(a, { confirm: false }); assert.equal(f.room.countdownEndsAt, null);
  f.choose(a); assert.equal(f.room.countdownEndsAt, 9000);
  const late = f.join('Late'); assert.equal(f.room.selectionPhase, 'selecting'); f.choose(late);
  const token = a.messages.find(m => m.type === 'welcome').token;
  f.service.disconnect(a); assert.equal(f.room.countdownEndsAt, null);
  f.tick(5000); assert.equal(f.room.locked, false);
  const resumed = f.peer(); f.service.receive(resumed, { type: 'resume', code: f.room.code, token });
  assert.equal(resumed.playerId, a.playerId); assert.equal(f.room.countdownEndsAt, 14000);
  f.service.disconnect(f.host); assert.equal(f.room.countdownEndsAt, null);
  f.tick(1000); const host = f.peer(); f.service.receive(host, { type: 'resume', code: f.room.code, token: f.welcome.token });
  assert.equal(f.room.countdownEndsAt, 15000); f.tick(5000); assert.equal(f.room.locked, true);
});

test('selection permissions prevent host/player shortcuts, invalid directions and race edits; rematch clears picks', () => {
  const f = fixture(), a = f.join();
  f.service.receive(a, { type: 'select_characters' }); assert.equal(a.messages.at(-1).code, 'host_only');
  f.service.receive(f.host, { type: 'lock', locked: true }); assert.equal(f.room.locked, false);
  f.begin(); f.choose(a, { direction: '__proto__' }); assert.equal(a.messages.at(-1).code, 'invalid_character_choice');
  f.choose(a); f.service.receive(a, { type: 'ready', ready: true }); assert.equal(a.messages.at(-1).code, 'selection_required');
  f.service.receive(a, { type: 'appearance', appearance: { character: 'lion', vehicle: 'kart', color: '#ffffff' } }); assert.equal(a.messages.at(-1).code, 'room_locked');
  f.tick(5000); f.choose(a, { confirm: false }); assert.equal(a.messages.at(-1).code, 'selection_unavailable');
  f.service.receive(f.host, { type: 'lock', locked: false });
  assert.equal(f.room.selectionPhase, 'gathering'); assert.equal(f.room.players.get(a.playerId).characterConfirmed, false);
  assert.equal(f.room.participants.size, 0); f.begin(); assert.equal(f.room.selectionPhase, 'selecting');
});

test('pending checkpoint joins block countdown; disconnected seats require return or explicit host skip', () => {
  const f = fixture({ recovery: true }), a = f.join(); f.begin(); f.choose(a);
  const late = f.peer(); f.service.receive(late, { type: 'join', code: f.room.code, name: 'Late' });
  assert.equal(f.room.countdownEndsAt, null); f.choose(late); assert.equal(late.messages.at(-1).code, 'player_only');
  f.ack(); f.choose(late); assert.equal(f.room.selectionPhase, 'countdown');
  f.service.disconnect(late); assert.equal(f.room.countdownEndsAt, null);
  f.service.receive(a, { type: 'skip_offline' }); assert.equal(f.room.players.size, 2);
  f.service.receive(f.host, { type: 'skip_offline' }); assert.equal(f.room.players.size, 1); assert.equal(f.room.selectionPhase, 'countdown');
});

test('relay recovery preserves picks but never reuses a partially elapsed countdown', () => {
  const f = fixture({ recovery: true }), a = f.join(); f.begin(); f.choose(a); f.tick(4000);
  const checkpoint = f.host.messages.filter(m => m.type === 'checkpoint').at(-1).checkpoint;
  const token = a.messages.find(m => m.type === 'welcome').token;
  let now = 20000; const service = new RoomService({ now: () => now });
  const peer = () => { const p = { messages: [], send(m) { this.messages.push(structuredClone(m)); }, close() {} }; service.connect(p); return p; };
  const host = peer(); service.receive(host, { type: 'resume', code: f.room.code, roomId: f.room.roomId, token: f.welcome.token, checkpoint, recoveryVersion: 1 });
  const room = service.roomsByIdentity.get(f.room.roomId);
  assert.equal(room.selectionPhase, 'selecting'); assert.equal(room.countdownEndsAt, null); assert.equal(room.players.get(a.playerId).characterConfirmed, true);
  const phone = peer(); service.receive(phone, { type: 'resume', code: f.room.code, roomId: f.room.roomId, token });
  assert.equal(room.countdownEndsAt, 25000); now = 24999; service.sweep(); assert.equal(room.locked, false); now = 25000; service.sweep(); assert.equal(room.locked, true);
});
