import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomService } from '../core.mjs';

function fixture() {
  const service = new RoomService();
  const peer = () => { const p = { messages: [], send(m) { this.messages.push(structuredClone(m)); }, close() {} }; service.connect(p); return p; };
  const create = (publicMatchmaking = false) => { const host = peer(); service.receive(host, { type: 'create', maxPlayers: 4, publicMatchmaking, characterSelectionVersion: 3, recoveryVersion: 1 }); return host; };
  const join = (host, name) => { const player = peer(); service.receive(player, { type: 'join', code: host.room, name, characterSelectionVersion: 3 }); return player; };
  const random = (name = 'Random') => { const player = peer(); service.receive(player, { type: 'join_random', name, characterSelectionVersion: 3 }); return player; };
  const ack = (host) => { const c = host.messages.findLast(m => m.type === 'checkpoint'); service.receive(host, { type: 'checkpoint_ack', revision: c.checkpoint.revision }); };
  return { service, peer, create, join, random, ack };
}

test('random matching only sees explicitly public, compatible, available gathering rooms', () => {
  const f = fixture();
  const privateHost = f.create();
  assert.equal(f.random().messages.at(-1).code, 'no_random_room');
  const pub = f.create(true);
  const joined = f.random();
  assert.equal(joined.room, pub.room);
  assert.equal(f.service.rooms.get(privateHost.room).players.size, 0);
  f.ack(pub);
  assert.equal(joined.messages.find(m => m.type === 'welcome').room.publicMatchmaking, true);
  // No room list or other room details are sent during discovery.
  assert.ok(joined.messages.every(m => !JSON.stringify(m).includes(privateHost.room)));
  f.service.rooms.get(pub.room).selectionPhase = 'selecting';
  assert.equal(f.random().messages.at(-1).code, 'no_random_room');
  f.service.rooms.get(pub.room).selectionPhase = 'gathering';
  f.service.rooms.get(pub.room).locked = true;
  assert.equal(f.random().messages.at(-1).code, 'no_random_room');
  f.service.rooms.get(pub.room).locked = false;
  f.service.disconnect(pub);
  assert.equal(f.random().messages.at(-1).code, 'no_random_room');
});

test('simultaneous requests reserve at most capacity including pending and disconnected seats', () => {
  const f = fixture(); const host = f.create(true);
  const players = Array.from({length: 8}, (_, i) => f.random(`Racer ${i}`));
  assert.equal(players.filter(p => p.room === host.room).length, 4);
  assert.equal(players.filter(p => p.messages.at(-1)?.code === 'no_random_room').length, 4);
  f.ack(host); f.service.disconnect(players[0]);
  assert.equal(f.random().messages.at(-1).code, 'no_random_room');
});

test('two rooms race and reconnect independently with no cross-room traffic', () => {
  const f = fixture(); const a = f.create(true), b = f.create(true);
  const pa = f.join(a, 'A'), pb = f.join(b, 'B'); f.ack(a); f.ack(b);
  const wa = pa.messages.find(m => m.type === 'welcome');
  const wb = pb.messages.find(m => m.type === 'welcome');
  // Exercise isolated racing state and input routing for both hosts.
  const ra = f.service.rooms.get(a.room), rb = f.service.rooms.get(b.room);
  for (const [room, player] of [[ra, pa], [rb, pb]]) { room.locked = true; room.selectionPhase = 'racing'; room.participants.add(player.playerId); }
  a.messages.length = b.messages.length = pa.messages.length = pb.messages.length = 0;
  f.service.receive(pa, { type: 'input', input: { steer: .5, accelerate: true, brake: false } });
  f.service.receive(pb, { type: 'input', input: { steer: -.5, accelerate: true, brake: false } });
  assert.equal(a.messages.find(m => m.type === 'input').playerId, pa.playerId);
  assert.equal(b.messages.find(m => m.type === 'input').playerId, pb.playerId);
  assert.ok(!a.messages.some(m => m.playerId === pb.playerId));
  assert.ok(!b.messages.some(m => m.playerId === pa.playerId));
  f.service.receive(a, { type: 'state', payload: { race: 'A' } });
  f.service.receive(b, { type: 'state', payload: { race: 'B' } });
  assert.deepEqual(pa.messages.filter(m => m.type === 'state').map(m => m.payload.race), ['A']);
  assert.deepEqual(pb.messages.filter(m => m.type === 'state').map(m => m.payload.race), ['B']);
  f.service.disconnect(pa); const again = f.peer();
  f.service.receive(again, { type: 'resume', token: wa.token, roomId: wa.roomId, code: wa.room.code, characterSelectionVersion: 3 });
  assert.equal(again.playerId, pa.playerId); assert.equal(again.room, a.room);
  assert.equal(f.service.rooms.get(b.room).players.get(pb.playerId).peer, pb);
  assert.notEqual(wa.roomId, wb.roomId);
});

test('public opt-in persists in authenticated host recovery while old checkpoints stay private', () => {
  const f = fixture(); const host = f.create(true);
  const welcome = host.messages.find(m => m.type === 'welcome');
  const checkpoint = host.messages.findLast(m => m.type === 'checkpoint').checkpoint;
  const restored = new RoomService(); const peer = { messages: [], send(m) { this.messages.push(m); }, close() {} }; restored.connect(peer);
  restored.receive(peer, { type: 'resume', token: welcome.token, roomId: welcome.roomId, code: welcome.room.code, checkpoint, recoveryVersion: 1, characterSelectionVersion: 3 });
  assert.equal(restored.rooms.get(peer.room).publicMatchmaking, true);
  const legacy = { ...checkpoint }; delete legacy.publicMatchmaking;
  const restoredLegacy = new RoomService(); const peer2 = { messages: [], send(m) { this.messages.push(m); }, close() {} }; restoredLegacy.connect(peer2);
  restoredLegacy.receive(peer2, { type: 'resume', token: welcome.token, roomId: welcome.roomId, code: welcome.room.code, checkpoint: legacy, recoveryVersion: 1, characterSelectionVersion: 3 });
  assert.equal(restoredLegacy.rooms.get(peer2.room).publicMatchmaking, false);
});
