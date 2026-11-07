import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomService } from '../core.mjs';

function fixture(recovery = false) {
  const service = new RoomService();
  const peer = () => { const p = { messages: [], send(m) { this.messages.push(structuredClone(m)); }, close() {} }; service.connect(p); return p; };
  const host = peer(); service.receive(host, { type: 'create', recoveryVersion: recovery ? 1 : undefined });
  const welcome = host.messages.find(m => m.type === 'welcome');
  const checkpoint = () => host.messages.filter(m => m.type === 'checkpoint').at(-1).checkpoint;
  const join = (name = 'Racer') => { const p = peer(); service.receive(p, { type: 'join', code: welcome.room.code, name }); return p; };
  const ack = () => service.receive(host, { type: 'checkpoint_ack', revision: checkpoint().revision });
  const view = () => service.roomView(service.rooms.get(welcome.room.code));
  return { service, peer, host, welcome, checkpoint, join, ack, view };
}
const ready = (f, p, value = true) => f.service.receive(p, { type: 'ready', ready: value });
const lock = (f, value = true) => f.service.receive(f.host, { type: 'lock', locked: value });

test('only authenticated controllers set their own readiness; changed appearance clears it', () => {
  const f = fixture(); const a = f.join('A'); const b = f.join('B');
  assert.ok(f.view().players.every(p => !p.ready));
  f.service.receive(f.host, { type: 'ready', ready: true, playerId: a.playerId }); assert.equal(f.host.messages.at(-1).code, 'player_only');
  ready(f, a); assert.equal(f.view().players[0].ready, true); assert.equal(f.view().players[1].ready, false);
  f.service.receive(a, { type: 'ready', ready: 'true' }); assert.equal(a.messages.at(-1).code, 'invalid_ready');
  f.service.receive(a, { type: 'appearance', appearance: { character: 'frog', vehicle: 'buggy', color: '#112233' } });
  assert.equal(f.view().players[0].ready, false);
  ready(f, a); f.service.receive(a, { type: 'appearance', appearance: { character: 'frog', vehicle: 'buggy', color: '#112233' } });
  assert.equal(f.view().players[0].ready, true, 'identical appearance does not undo ready');
  ready(f, b); lock(f); assert.equal(f.view().locked, true);
  ready(f, a, false); assert.equal(a.messages.at(-1).code, 'room_locked'); assert.equal(f.view().players[0].ready, true);
  lock(f, false); assert.ok(f.view().players.every(p => !p.ready), 'new race requires fresh ready');
});

test('lock freezes only ready connected entrants and rejects zero or unready entrants', () => {
  const f = fixture(); lock(f); assert.equal(f.host.messages.at(-1).code, 'not_ready');
  const a = f.join('A'); const b = f.join('B'); ready(f, a); lock(f);
  assert.equal(f.host.messages.at(-1).code, 'not_ready'); assert.equal(f.view().locked, false);
  const bToken = b.messages.find(m => m.type === 'welcome').token;
  f.service.disconnect(b); lock(f); assert.equal(f.view().locked, true);
  assert.equal(f.view().players.find(p => p.id === a.playerId).inRace, true);
  const back = f.peer(); f.service.receive(back, { type: 'resume', code: f.welcome.room.code, token: bToken });
  assert.equal(f.view().players.find(p => p.id === b.playerId).inRace, false, 'late reconnect cannot join frozen roster');
  f.service.receive(back, { type: 'input', input: { steer: 1, accelerate: true, brake: false, action: 1 } });
  assert.deepEqual(f.host.messages.at(-1).input, { steer: 0, accelerate: false, brake: false }, 'excluded driver cannot send active input');
});

test('reconnecting in lobby clears readiness and blocks a stale start', () => {
  const f = fixture(); const a = f.join(); const token = a.messages[0].token; ready(f, a); f.service.disconnect(a);
  const back = f.peer(); f.service.receive(back, { type: 'resume', code: f.welcome.room.code, token });
  assert.equal(f.view().players[0].ready, false); lock(f); assert.equal(f.host.messages.at(-1).code, 'not_ready');
  ready(f, back); lock(f); assert.equal(f.view().locked, true);
});

test('pending checkpoint join cannot ready or slip into a locked roster', () => {
  const f = fixture(true); const a = f.join('A'); f.ack(); ready(f, a);
  const b = f.join('B'); ready(f, b); assert.equal(b.messages.at(-1).code, 'player_only');
  lock(f); assert.equal(f.view().locked, true); assert.equal(f.view().players.find(p => p.id === b.playerId).inRace, false);
  f.service.receive(b, { type: 'input', input: { steer: 1, accelerate: true, brake: false, action: 1 } });
  assert.deepEqual(f.host.messages.at(-1).input, { steer: 0, accelerate: false, brake: false }, 'pending join cannot send active input');
  f.ack(); assert.equal(f.view().players.find(p => p.id === b.playerId).inRace, false);
});

test('unlocked recovery and legacy locked checkpoints are safe', () => {
  const f = fixture(true); const a = f.join(); f.ack(); ready(f, a); const unlocked = f.checkpoint();
  const n = fixture(true); const host = n.peer(); n.service.receive(host, { type: 'resume', token: f.welcome.token, roomId: f.welcome.roomId, checkpoint: unlocked, recoveryVersion: 1 });
  assert.equal(host.messages.find(m => m.type === 'welcome').room.players[0].ready, false);
  lock(f); const legacy = f.checkpoint(); legacy.players.forEach(p => delete p.ready);
  const x = fixture(true); const h = x.peer(); x.service.receive(h, { type: 'resume', token: f.welcome.token, roomId: f.welcome.roomId, checkpoint: legacy, recoveryVersion: 1 });
  const room = h.messages.find(m => m.type === 'welcome').room;
  assert.equal(room.locked, true); assert.equal(room.recovering, true); assert.equal(room.players[0].inRace, true);
});

test('host reconnect in a lobby requires a fresh ready-up without changing race recovery', () => {
  const f = fixture(); const a = f.join(); ready(f, a);
  f.service.disconnect(f.host);
  assert.equal(f.view().players[0].ready, false);
  const host = f.peer(); f.service.receive(host, { type: 'resume', code: f.welcome.room.code, token: f.welcome.token });
  assert.equal(host.messages.find(m => m.type === 'welcome').room.players[0].ready, false);
  f.service.receive(host, { type: 'lock', locked: true });
  assert.equal(host.messages.at(-1).code, 'not_ready');
});
