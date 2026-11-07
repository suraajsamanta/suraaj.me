import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomService } from '../core.mjs';

function setup() {
  const service = new RoomService();
  const peer = () => { const p = { messages: [], send(m) { this.messages.push(structuredClone(m)); }, close() {} }; service.connect(p); return p; };
  const host = peer(); service.receive(host, { type: 'create' });
  const code = host.messages[0].room.code;
  const join = (appearance) => { const p = peer(); service.receive(p, { type: 'join', code, name: 'Racer', ...(appearance === undefined ? {} : { appearance }) }); return p; };
  return { service, peer, host, code, join };
}
const first = { character: 'robot', vehicle: 'motorcycle', color: '#AABBCC' };
const second = { character: 'frog', vehicle: 'buggy', color: '#123456' };

test('customization broadcasts to host and other phones and survives reconnect', () => {
  const f = setup(); const p = f.join(first); const token = p.messages[0].token; const id = p.playerId; const other = f.join();
  const hostView = f.host.messages.at(-1).room.players.find(x => x.id === id);
  assert.deepEqual([hostView.character, hostView.vehicle, hostView.color], ['robot', 'motorcycle', '#aabbcc']);
  f.service.receive(p, { type: 'appearance', appearance: second });
  assert.deepEqual(Object.fromEntries(['character','vehicle','color'].map(k => [k, other.messages.at(-1).room.players.find(x => x.id === id)[k]])), second);
  f.service.disconnect(p); const resumed = f.peer(); f.service.receive(resumed, { type: 'resume', code: f.code, token });
  assert.deepEqual(Object.fromEntries(['character','vehicle','color'].map(k => [k, resumed.messages[0].room.players.find(x => x.id === id)[k]])), second);
});

test('reject invalid selections and deny edits during a race or by a host', () => {
  const f = setup(); const bad = f.join({ ...first, vehicle: 'bogus' }); assert.equal(bad.messages.at(-1).code, 'invalid_appearance');
  const p = f.join(first); f.service.receive(p, { type: 'appearance', appearance: { ...second, color: 'red' } }); assert.equal(p.messages.at(-1).code, 'invalid_appearance');
  f.service.receive(f.host, { type: 'appearance', appearance: second }); assert.equal(f.host.messages.at(-1).code, 'player_only');
  f.service.receive(f.host, { type: 'lock', locked: true }); f.service.receive(p, { type: 'appearance', appearance: second }); assert.equal(p.messages.at(-1).code, 'room_locked');
  const view = f.service.roomView(f.service.rooms.get(f.code)).players[0]; assert.equal(view.character, 'robot'); assert.equal(view.vehicle, 'motorcycle');
  f.service.receive(f.host, { type: 'lock', locked: false }); f.service.receive(p, { type: 'appearance', appearance: second }); assert.equal(f.host.messages.at(-1).room.players[0].character, 'frog');
});

test('older clients without a selection receive compatible defaults', () => {
  const f = setup(); const p = f.join(); const view = p.messages[0].room.players[0]; assert.equal(view.character, 'fox'); assert.equal(view.vehicle, 'kart'); assert.match(view.color, /^#[a-f\d]{6}$/i);
});
