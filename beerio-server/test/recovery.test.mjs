import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomService, ZERO_INPUT } from '../core.mjs';

function fixture() {
  let now = 1000;
  const service = new RoomService({ now: () => now });
  const peer = () => {
    const p = { messages: [], closed: false, send(m) { this.messages.push(structuredClone(m)); }, close() { this.closed = true; } };
    service.connect(p); return p;
  };
  const host = peer(); service.receive(host, { type: 'create', recoveryVersion: 1 });
  const hostWelcome = host.messages.find(m => m.type === 'welcome');
  const checkpoint = () => structuredClone(host.messages.filter(m => m.type === 'checkpoint').at(-1).checkpoint);
  const ack = () => service.receive(host, { type: 'checkpoint_ack', revision: checkpoint().revision });
  const join = (name = 'Racer') => {
    const p = peer(); service.receive(p, { type: 'join', code: hostWelcome.room.code, name, appearance: { character: 'frog', vehicle: 'motorcycle', color: '#123456' } });
    return p;
  };
  return { service, peer, host, hostWelcome, checkpoint, ack, join, tick(ms) { now += ms; service.sweep(); } };
}
function restore(f, checkpoint = f.checkpoint()) {
  const next = fixture(); // Also leave a distinct legitimate room in the new process.
  const host = next.peer();
  next.service.receive(host, { type: 'resume', roomId: f.hostWelcome.roomId, code: f.hostWelcome.room.code,
    token: f.hostWelcome.token, recoveryVersion: 1, checkpoint });
  return { ...next, restoredHost: host, restoredWelcome: host.messages.find(m => m.type === 'welcome') };
}

test('new controller welcome waits for host checkpoint acknowledgment; private checkpoint never reaches phones', () => {
  const f = fixture(); const p = f.join();
  assert.equal(p.messages.some(m => m.type === 'welcome'), false);
  const c = f.checkpoint();
  assert.equal(c.ackRequired, true);
  assert.equal(c.players.length, 1);
  assert.match(c.players[0].tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(p.messages).includes('tokenHash'), false);
  assert.equal(p.messages.some(m => m.type === 'checkpoint'), false);
  f.service.receive(p, { type: 'checkpoint_ack', revision: c.revision });
  assert.equal(p.messages.at(-1).code, 'invalid_checkpoint_ack');
  assert.equal(p.messages.some(m => m.type === 'welcome'), false);
  f.ack();
  assert.ok(p.messages.find(m => m.type === 'welcome'));
});

test('restart restores authenticated host and six exact racer identities, appearance and lock with neutral controls', () => {
  const f = fixture(); const racers = Array.from({ length: 6 }, (_, i) => { const p = f.join(`Racer ${i}`); f.ack(); return p; });
  f.service.receive(f.host, { type: 'lock', locked: true });
  f.service.receive(racers[0], { type: 'input', input: { steer: 1, accelerate: true, brake: false, action: 7 } });
  const checkpoint = f.checkpoint();
  checkpoint.players[0].actionSequence = 7; // Browser retains the action floor from the input packet.
  const n = restore(f, checkpoint);
  assert.equal(n.restoredWelcome.roomId, f.hostWelcome.roomId);
  assert.equal(n.restoredWelcome.room.locked, true);
  assert.equal(n.restoredWelcome.room.players.length, 6);
  const resumed = [];
  for (const old of racers) {
    const original = old.messages.find(m => m.type === 'welcome');
    const p = n.peer();
    n.service.receive(p, { type: 'resume', code: f.hostWelcome.room.code, roomId: original.roomId, token: original.token });
    resumed.push(p);
    const welcome = p.messages.find(m => m.type === 'welcome');
    assert.equal(welcome.playerId, original.playerId);
    assert.equal(welcome.room.code, n.restoredWelcome.room.code);
    const self = welcome.room.players.find(p => p.id === welcome.playerId);
    assert.equal(self.character, 'frog'); assert.equal(self.vehicle, 'motorcycle'); assert.equal(self.color, '#123456');
    assert.deepEqual(self.input, ZERO_INPUT);
    assert.equal(JSON.stringify(p.messages).includes('tokenHash'), false);

  }
  assert.equal(n.service.roomView(n.service.roomsByIdentity.get(f.hostWelcome.roomId)).recovering, false);
  n.service.receive(resumed[0], { type: 'input', input: { ...ZERO_INPUT, action: 7 } });
  assert.equal(n.restoredHost.messages.at(-1).input.action, undefined);
  n.service.receive(resumed[0], { type: 'input', input: { ...ZERO_INPUT, action: 8 } });
  assert.equal(n.restoredHost.messages.at(-1).input.action, 8);
});

test('phones arriving before host get retryable status, and wrong token cannot restore another room', () => {
  const f = fixture(); const p = f.join(); f.ack();
  const identity = p.messages.find(m => m.type === 'welcome');
  const n = fixture(); const early = n.peer();
  n.service.receive(early, { type: 'resume', roomId: identity.roomId, code: f.hostWelcome.room.code, token: identity.token });
  assert.equal(early.messages.at(-1).code, 'recovery_pending'); assert.equal(early.messages.at(-1).fatal, false);
  for (const token of [identity.token, n.hostWelcome.token, 'a'.repeat(48)]) {
    const attacker = n.peer();
    n.service.receive(attacker, { type: 'resume', roomId: identity.roomId, code: f.hostWelcome.room.code, token, checkpoint: f.checkpoint() });
    assert.equal(attacker.messages.at(-1).code, 'invalid_session');
    assert.equal(n.service.roomsByIdentity.has(identity.roomId), false);
  }
});

test('public-code collision cannot hijack established identity, and duplicate host restore creates one room', () => {
  const f = fixture(); const n = restore(f); const size = n.service.rooms.size;
  const second = n.peer();
  n.service.receive(second, { type: 'resume', roomId: f.hostWelcome.roomId, code: n.hostWelcome.room.code,
    token: f.hostWelcome.token, recoveryVersion: 1, checkpoint: f.checkpoint() });
  assert.equal(second.messages.find(m => m.type === 'welcome').roomId, f.hostWelcome.roomId);
  assert.equal(n.service.rooms.size, size);
  assert.equal(n.restoredHost.closed, true);
  const attacker = n.peer();
  n.service.receive(attacker, { type: 'resume', roomId: f.hostWelcome.roomId, code: n.restoredWelcome.room.code, token: n.hostWelcome.token });
  assert.equal(attacker.messages.at(-1).code, 'invalid_session');
});

test('invalid checkpoints cannot inflate capacity, inject controls, corrupt identity, duplicate seats or forge appearance', () => {
  const f = fixture(); f.join(); f.ack();
  const variants = [
    c => { c.maxPlayers = 7; }, c => { c.roomId = 'f'.repeat(64); },
    c => { c.players[0].tokenHash = f.hostWelcome.token; },
    c => { c.players.push(c.players[0]); }, c => { c.players[0].name = '\nBad'; },
    c => { c.players[0].character = 'invalid'; }, c => { c.players[0].vehicle = 'truck'; },
    c => { c.players[0].color = '<script>'; }, c => { c.players[0].actionSequence = -1; },
    c => { c.players[0].actionSequence = Number.MAX_SAFE_INTEGER + 1; },
  ];
  for (const mutate of variants) {
    const c = f.checkpoint(); mutate(c); const n = restore(f, c);
    assert.equal(n.restoredHost.messages.at(-1).code, 'invalid_recovery');
    assert.equal(n.service.roomsByIdentity.has(f.hostWelcome.roomId), false);
  }
  const c = f.checkpoint(); c.players[0].input = { steer: 1, accelerate: true, brake: false, action: 9 };
  const n = restore(f, c); assert.deepEqual(n.restoredWelcome.room.players[0].input, ZERO_INPUT);
});

test('unacknowledged join is bounded, legacy clients stay compatible, and explicit leave drops both indices', () => {
  const f = fixture(); const p = f.join(); f.tick(10001);
  assert.equal(p.closed, true); assert.equal(p.messages.at(-1).code, 'host_unavailable');
  assert.equal(f.checkpoint().players.length, 0);
  f.service.receive(f.host, { type: 'leave' });
  assert.equal(f.service.rooms.size, 0); assert.equal(f.service.roomsByIdentity.size, 0);
  const h = f.peer(); f.service.receive(h, { type: 'create' });
  const code = h.messages.find(m => m.type === 'welcome').room.code;
  const legacy = f.peer(); f.service.receive(legacy, { type: 'join', code, name: 'Legacy' });
  assert.ok(legacy.messages.find(m => m.type === 'welcome'));
});

test('recovery waits only for confirmed race participants and suppresses controls until everyone returns', () => {
  const f = fixture(); const active = f.join('Active'); f.ack(); const away = f.join('Away'); f.ack();
  f.service.disconnect(away);
  f.service.receive(f.host, { type: 'lock', locked: true });
  assert.deepEqual(f.checkpoint().participants, [active.playerId]);
  const n = restore(f); const room = n.service.roomsByIdentity.get(f.hostWelcome.roomId);
  assert.equal(n.restoredWelcome.room.recovering, true);
  assert.deepEqual(n.restoredWelcome.room.recoveryWaitingFor, [active.playerId]);
  const id = active.messages.find(m => m.type === 'welcome'); const p = n.peer();
  n.service.receive(p, { type: 'resume', roomId: id.roomId, token: id.token });
  assert.equal(n.service.roomView(room).recovering, false, 'unused lobby reservation does not block recovery');
  assert.equal(n.service.roomView(room).players.find(p => p.id === away.playerId).connected, false);
});

test('host can explicitly resume without missing racers; phones cannot bypass the recovery wait', () => {
  const f = fixture(); const a = f.join('A'); f.ack(); f.join('B'); f.ack();
  f.service.receive(f.host, { type: 'lock', locked: true });
  const n = restore(f); const id = a.messages.find(m => m.type === 'welcome'); const p = n.peer();
  n.service.receive(p, { type: 'resume', roomId: id.roomId, token: id.token });
  const room = n.service.roomsByIdentity.get(f.hostWelcome.roomId);
  assert.equal(room.recovering, true);
  n.service.receive(p, { type: 'input', input: { steer: 1, accelerate: true, brake: false, action: 4 } });
  assert.deepEqual(n.restoredHost.messages.at(-1).input, ZERO_INPUT);
  n.service.receive(p, { type: 'resume_race' }); assert.equal(p.messages.at(-1).code, 'host_only');
  assert.equal(room.recovering, true);
  n.service.receive(n.restoredHost, { type: 'resume_race' });
  assert.equal(room.recovering, false);
  assert.deepEqual(n.service.roomView(room).players[0].input, ZERO_INPUT);
  n.service.receive(p, { type: 'input', input: { ...ZERO_INPUT, action: 4 } });
  assert.equal(n.restoredHost.messages.at(-1).input.action, undefined, 'paused item cannot replay');
  n.service.receive(p, { type: 'input', input: { ...ZERO_INPUT, action: 5 } });
  assert.equal(n.restoredHost.messages.at(-1).input.action, 5);
});

test('explicit departures and ordinary expiry remove participant IDs; recovery wait never silently expires a racer', () => {
  const f = fixture(); const a = f.join('A'); f.ack(); const b = f.join('B'); f.ack();
  f.service.receive(f.host, { type: 'lock', locked: true });
  f.service.receive(a, { type: 'leave' });
  assert.deepEqual(f.checkpoint().participants, [b.playerId]);
  const n = restore(f); const room = n.service.roomsByIdentity.get(f.hostWelcome.roomId);
  n.tick(90001);
  assert.equal(room.recovering, true);
  assert.equal(room.players.size, 1, 'missing name/slot stays visible until host makes a choice');
  n.service.receive(n.restoredHost, { type: 'resume_race' }); n.tick(1);
  assert.equal(room.players.size, 1, 'explicit continue gives missing racer a fresh grace period');
  n.tick(90001);
  assert.equal(room.players.size, 0); assert.equal(room.participants.size, 0);
  f.service.disconnect(b); f.tick(90001);
  assert.deepEqual(f.checkpoint().participants, []);
  assert.equal(restore(f).restoredWelcome.room.recovering, false);
});

test('returning to lobby or explicitly closing a recovered room clears recovery state safely', () => {
  const f = fixture(); const p = f.join(); f.ack();
  f.service.receive(f.host, { type: 'lock', locked: true });
  const n = restore(f); const room = n.service.roomsByIdentity.get(f.hostWelcome.roomId);
  assert.equal(room.recovering, true);
  n.service.receive(n.restoredHost, { type: 'lock', locked: false });
  assert.equal(room.recovering, false); assert.equal(room.locked, false); assert.equal(room.participants.size, 0);
  assert.deepEqual(n.service.roomView(room).recoveryWaitingFor, []);
  const phone = n.peer(); const identity = p.messages.find(m => m.type === 'welcome');
  n.service.receive(phone, { type: 'resume', roomId: identity.roomId, token: identity.token });
  assert.deepEqual(n.service.roomView(room).players[0].input, ZERO_INPUT);
  n.service.receive(n.restoredHost, { type: 'leave' });
  assert.equal(phone.messages.at(-1).type, 'room_closed');
  assert.equal(n.service.roomsByIdentity.has(identity.roomId), false);
});
