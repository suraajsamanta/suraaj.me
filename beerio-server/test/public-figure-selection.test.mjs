import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomService, SELECTION_CHARACTERS, LEGACY_SELECTION_CHARACTERS, ZERO_INPUT } from '../core.mjs';

const FIGURES = ['bezos', 'trump', 'musk', 'zuckerberg', 'ye', 'huang'];

function fixture(startTime = 1000) {
  let now = startTime;
  const service = new RoomService({ now: () => now });
  const peer = () => {
    const p = { messages: [], send(message) { this.messages.push(structuredClone(message)); }, close() {} };
    service.connect(p); return p;
  };
  const send = (p, message) => service.receive(p, message);
  const tick = duration => { now += duration; service.sweep(); };
  return { service, peer, send, tick, get now() { return now; } };
}

test('all thirty character cells have correct four-way navigation across a six-by-five grid', () => {
  assert.equal(SELECTION_CHARACTERS.length, 30);
  assert.equal(new Set(SELECTION_CHARACTERS).size, 30);
  assert.deepEqual(SELECTION_CHARACTERS.slice(24), FIGURES);
  for (let index = 0; index < 30; index++) for (const direction of ['left', 'right', 'up', 'down']) {
    const f = fixture(), host = f.peer();
    f.send(host, { type: 'create', characterSelectionVersion: 2 });
    const code = host.messages.find(message => message.type === 'welcome').room.code;
    const phone = f.peer();
    f.send(phone, { type: 'join', characterSelectionVersion: 2, code, name: 'Navigation QA', appearance: { character: SELECTION_CHARACTERS[index], vehicle: 'kart', color: '#123456' } });
    f.send(host, { type: 'select_characters' });
    f.send(phone, { type: 'character', direction });
    const row = Math.floor(index / 6), column = index % 6;
    const target = direction === 'left' ? row * 6 + (column + 5) % 6
      : direction === 'right' ? row * 6 + (column + 1) % 6
        : direction === 'up' ? ((row + 4) % 5) * 6 + column : ((row + 1) % 5) * 6 + column;
    const room = host.messages.filter(message => message.type === 'room').at(-1).room;
    assert.equal(room.players[0].character, SELECTION_CHARACTERS[target], `${SELECTION_CHARACTERS[index]} ${direction}`);
    assert.equal(phone.messages.at(-1).room.players[0].character, SELECTION_CHARACTERS[target], 'Host and controller share one selection');
    assert.equal(room.locked, false);
  }
});

test('all six new identities survive selection interruption, checkpoint restoration and locked race recovery', () => {
  const f = fixture(), host = f.peer();
  f.send(host, { type: 'create', characterSelectionVersion: 2, recoveryVersion: 1 });
  const hostWelcome = host.messages.find(message => message.type === 'welcome');
  const checkpoint = () => host.messages.filter(message => message.type === 'checkpoint').at(-1).checkpoint;
  const phones = FIGURES.map((character, index) => {
    const phone = f.peer();
    f.send(phone, { type: 'join', characterSelectionVersion: 2, code: hostWelcome.room.code, name: `Driver ${index + 1}`, appearance: { character, vehicle: 'motorcycle', color: '#123456' } });
    f.send(host, { type: 'checkpoint_ack', revision: checkpoint().revision });
    return { peer: phone, welcome: phone.messages.find(message => message.type === 'welcome') };
  });
  f.send(host, { type: 'select_characters' });
  for (const phone of phones) f.send(phone.peer, { type: 'character', confirm: true });
  const before = f.service.rooms.get(hostWelcome.room.code);
  assert.equal(before.selectionPhase, 'countdown'); f.tick(4000);
  for (const phone of phones) f.service.disconnect(phone.peer);
  assert.equal(before.countdownEndsAt, null);

  const recovered = fixture(20000), restoredHost = recovered.peer();
  recovered.send(restoredHost, { type: 'resume', characterSelectionVersion: 2, roomId: hostWelcome.roomId, token: hostWelcome.token, checkpoint: checkpoint(), recoveryVersion: 1 });
  const room = recovered.service.roomsByIdentity.get(hostWelcome.roomId);
  assert.equal(room.selectionPhase, 'selecting'); assert.equal(room.countdownEndsAt, null);
  const restoredPhones = phones.map((phone, index) => {
    const peer = recovered.peer();
    recovered.send(peer, { type: 'resume', characterSelectionVersion: 2, roomId: hostWelcome.roomId, token: phone.welcome.token });
    assert.equal(peer.playerId, phone.welcome.playerId);
    if (index < phones.length - 1) assert.equal(room.countdownEndsAt, null, 'Every original controller must return');
    return peer;
  });
  assert.equal(room.countdownEndsAt, 25000, 'Restart gives all returning controllers a fresh five seconds');
  assert.deepEqual([...room.players.values()].map(player => player.character), FIGURES);
  for (const peer of restoredPhones) {
    const view = peer.messages.filter(message => message.type === 'room').at(-1).room;
    assert.deepEqual(view.players.map(player => player.character), FIGURES);
    assert.ok(view.players.every(player => player.characterConfirmed));
  }
  recovered.tick(4999); assert.equal(room.locked, false); recovered.tick(1); assert.equal(room.locked, true);
  assert.deepEqual([...room.participants], phones.map(phone => phone.welcome.playerId));
  const raceCheckpoint = restoredHost.messages.filter(message => message.type === 'checkpoint').at(-1).checkpoint;
  const afterCrash = fixture(40000), raceHost = afterCrash.peer();
  afterCrash.send(raceHost, { type: 'resume', characterSelectionVersion: 2, roomId: hostWelcome.roomId, token: hostWelcome.token, checkpoint: raceCheckpoint, recoveryVersion: 1 });
  const race = afterCrash.service.roomsByIdentity.get(hostWelcome.roomId);
  assert.equal(race.locked, true); assert.equal(race.recovering, true);
  for (const phone of phones) afterCrash.send(afterCrash.peer(), { type: 'resume', characterSelectionVersion: 2, roomId: hostWelcome.roomId, token: phone.welcome.token });
  assert.equal(race.recovering, false); assert.equal(race.selectionPhase, 'racing');
  assert.deepEqual([...race.players.values()].map(player => player.character), FIGURES);
  for (const player of race.players.values()) assert.deepEqual(player.input, ZERO_INPUT);
});

test('older twenty-four-character rooms keep their original row topology and accept older controllers', () => {
  const f = fixture(), host = f.peer();
  f.send(host, { type: 'create', characterSelectionVersion: 1 });
  const welcome = host.messages.find(message => message.type === 'welcome');
  const phone = f.peer(); f.send(phone, { type: 'join', code: welcome.room.code, name: 'Older phone' });
  assert.ok(phone.messages.some(message => message.type === 'welcome'));
  f.send(host, { type: 'select_characters' }); f.send(phone, { type: 'character', direction: 'up' });
  let room = host.messages.filter(message => message.type === 'room').at(-1).room;
  assert.equal(room.characterSelectionVersion, 1);
  assert.equal(room.players[0].character, LEGACY_SELECTION_CHARACTERS[18]);
  f.send(phone, { type: 'character', direction: 'down' });
  room = host.messages.filter(message => message.type === 'room').at(-1).room;
  assert.equal(room.players[0].character, 'gorilla');
  f.send(phone, { type: 'character', confirm: true }); f.tick(5000);
  assert.equal(f.service.rooms.get(welcome.room.code).locked, true);
});

test('obsolete joins and resumptions cannot replace live thirty-character sessions or allocate recovery rooms', () => {
  const f = fixture(), host = f.peer();
  f.send(host, { type: 'create', characterSelectionVersion: 2, recoveryVersion: 1 });
  const welcome = host.messages.find(message => message.type === 'welcome');
  const room = f.service.rooms.get(welcome.room.code);
  const outdated = f.peer(); f.send(outdated, { type: 'join', code: room.code, name: 'Old phone' });
  assert.equal(outdated.messages.at(-1).code, 'update_required'); assert.equal(room.players.size, 0);
  const phone = f.peer(); f.send(phone, { type: 'join', characterSelectionVersion: 2, code: room.code, name: 'New phone', appearance: { character: 'huang', vehicle: 'kart', color: '#123456' } });
  f.send(host, { type: 'checkpoint_ack', revision: room.checkpointRevision });
  const phoneWelcome = phone.messages.find(message => message.type === 'welcome');
  const oldPhone = f.peer(); f.send(oldPhone, { type: 'resume', roomId: welcome.roomId, token: phoneWelcome.token });
  assert.equal(oldPhone.messages.at(-1).code, 'update_required');
  assert.equal(room.players.get(phoneWelcome.playerId).peer, phone, 'An incompatible resume cannot evict the compatible controller');
  const oldHost = f.peer(); f.send(oldHost, { type: 'resume', roomId: welcome.roomId, token: welcome.token });
  assert.equal(oldHost.messages.at(-1).code, 'update_required'); assert.equal(room.host, host);
  const checkpoint = host.messages.filter(message => message.type === 'checkpoint').at(-1).checkpoint;
  const fresh = fixture(), recoveryHost = fresh.peer();
  fresh.send(recoveryHost, { type: 'resume', roomId: welcome.roomId, token: welcome.token, checkpoint, recoveryVersion: 1 });
  assert.equal(recoveryHost.messages.at(-1).code, 'update_required');
  assert.equal(fresh.service.rooms.size, 0, 'Denied recovery must not reserve a public room');
  assert.equal(fresh.service.roomsByIdentity.size, 0, 'Denied recovery must not reserve the immutable identity');
});
