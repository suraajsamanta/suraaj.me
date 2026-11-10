import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
import ts from 'typescript';
import { createRelay } from '../../../../beerio-server/server.mjs';
import { SELECTION_CHARACTERS, ZERO_INPUT } from '../../../../beerio-server/core.mjs';

const require = createRequire(new URL('../../../../beerio-server/server.mjs', import.meta.url));
const WebSocket = require('ws');
const ORIGIN = 'https://beerio.example';
const STORAGE_KEY = 'beerio-room-session-v1';
const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const types = { exports: {} };
new Function('module', 'exports', compile('./types.ts'))(types, types.exports);
const clientSource = compile('./client.ts');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const appearance = { exports: {} };
new Function('module', 'exports', compile('../appearance.ts'))(appearance, appearance.exports);
function loadView(file) {
  const view = { exports: {} };
  new Function('require', 'module', 'exports', compile(file))(name => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return jsx;
    if (name === '../appearance') return appearance.exports;
    if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    throw new Error(`Unexpected view dependency: ${name}`);
  }, view, view.exports);
  return view.exports;
}
const { default: StartingGrid } = loadView('../lobby/StartingGrid.tsx');
const { CharacterController, CharacterGrid, CharacterPortrait } = loadView('../lobby/CharacterSelection.tsx');

async function until(check, label) {
  const deadline = Date.now() + 4000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await sleep(5);
  }
}

/** Each device has its own browser storage and real WebSocket connection. */
function device() {
  const saved = new Map(), messages = [], clients = [];
  const storage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: key => saved.delete(key),
  };
  class BrowserSocket extends WebSocket {
    constructor(url) {
      super(url, { origin: ORIGIN });
      this.on('message', data => messages.push(JSON.parse(data.toString())));
    }
  }
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'sessionStorage', 'WebSocket', clientSource)(name => {
    if (name === './types') return types.exports;
    throw new Error(`Unexpected client dependency: ${name}`);
  }, loaded, loaded.exports, { location: { protocol: 'http:', hostname: '127.0.0.1' } }, storage, BrowserSocket);
  const fresh = () => { const client = new loaded.exports.BeerioRoomClient(); clients.push(client); return client; };
  const d = { saved, messages, clients, client: fresh(), fresh };
  d.reload = () => { d.client.destroy(); d.client = fresh(); d.client.restoreSession(); };
  return d;
}

async function fixture(t, count = 10) {
  const relay = createRelay({ allowedOrigins: [ORIGIN], logger: { error() {} } });
  // Keep sockets, client behavior, checkpoint acknowledgments and relay sweeps
  // real; advance only the relay's clock to test exact countdown boundaries.
  let now = Date.now();
  relay.rooms.now = () => now;
  relay.server.listen(0, '127.0.0.1');
  await once(relay.server, 'listening');
  const relayUrl = `ws://127.0.0.1:${relay.server.address().port}/room`;
  const host = device(), phones = Array.from({ length: count }, device);
  t.after(async () => {
    for (const d of [host, ...phones]) for (const client of d.clients) client.destroy();
    await relay.close();
  });
  host.client.createRoom({ relayUrl });
  await until(() => host.client.getSnapshot().status === 'connected', 'host connected');
  const code = host.client.getSnapshot().code;
  for (const [index, phone] of phones.entries()) phone.client.joinRoom({
    relayUrl, code, name: `Phone ${index + 1}`,
    // A previous solo/multiplayer choice must not preselect a new room's racer.
    appearance: { character: 'huang', vehicle: 'motorcycle', color: '#123456' },
  });
  await until(() => phones.every(phone => phone.client.getSnapshot().status === 'connected' && phone.client.getSnapshot().players.length === count) &&
    host.client.getSnapshot().players.length === count, 'checkpoint-confirmed phone joins');
  const ids = phones.map(phone => phone.client.getSnapshot().playerId);
  const player = (index, source = host) => source.client.getSnapshot().players.find(p => p.id === ids[index]);
  const allSnapshots = () => [host, ...phones].map(d => d.client.getSnapshot());
  return { relay, host, phones, ids, player, allSnapshots,
    tick(ms) { now += ms; relay.rooms.sweep(); },
    room: () => relay.rooms.rooms.get(host.client.getSnapshot().code),
  };
}

test('ten phones remain unselected until confirmation, keep independent picks through reload and race, then reset for a rematch', async t => {
  const f = await fixture(t);
  const { host, phones, ids, player } = f;
  assert.equal(new Set(ids).size, 10);
  assert.equal(host.client.getSnapshot().characterSelectionVersion, 3);
  for (const snapshot of f.allSnapshots()) {
    assert.equal(snapshot.selectionPhase, 'gathering');
    assert.ok(snapshot.players.every(p => p.character == null && p.characterCursor == null && !p.characterConfirmed));
    assert.ok(snapshot.players.every(p => p.vehicle === 'motorcycle' && p.color === '#123456'));
  }
  // Color/ride edits in the lobby must not restore a stale saved character.
  phones[0].client.setAppearance({ character: 'musk', vehicle: 'buggy', color: '#abcdef' });
  await until(() => player(0).color === '#abcdef', 'lobby appearance update');
  assert.equal(player(0).character, null);

  // Selection is available immediately while the QR remains open. Confirmation
  // alone must not start a race before the host has finished inviting people.
  phones[9].client.chooseCharacter({ confirm: true });
  await until(() => phones[9].client.getSnapshot().error !== null, 'empty confirmation rejected');
  assert.equal(player(9).characterConfirmed, false);
  assert.equal(host.client.getSnapshot().countdownEndsAt, null);

  // First movement explicitly opens the first card. Each phone then browses to
  // a different animal/guest without committing a character to its race slot.
  const expected = ['gorilla', 'tiger', 'monkey', 'hippo', 'bezos', 'trump', 'musk', 'zuckerberg', 'ye', 'huang'];
  for (const phone of phones) phone.client.chooseCharacter({ direction: 'right' });
  await until(() => ids.every((_, index) => player(index).characterCursor === 'gorilla'), 'initial cursor');
  for (const [index, phone] of phones.entries()) {
    const target = SELECTION_CHARACTERS.indexOf(expected[index]);
    if (target >= 24) phone.client.chooseCharacter({ direction: 'up' });
    for (let column = 0; column < target % 6; column++) phone.client.chooseCharacter({ direction: 'right' });
  }
  await until(() => ids.every((_, index) => player(index).characterCursor === expected[index]), 'independent browsing');
  assert.ok(host.client.getSnapshot().players.every(p => p.character == null && !p.characterConfirmed));
  for (const phone of phones.slice(0, 9)) phone.client.chooseCharacter({ confirm: true });
  await until(() => host.client.getSnapshot().players.filter(p => p.characterConfirmed).length === 9, 'first nine selections');
  assert.equal(host.client.getSnapshot().selectionPhase, 'gathering');
  assert.equal(player(9).character, null);
  for (let index = 0; index < 9; index++) assert.equal(player(index).character, expected[index]);

  const savedIdentity = JSON.parse(phones[0].saved.get(STORAGE_KEY));
  phones[0].reload();
  await until(() => phones[0].client.getSnapshot().status === 'connected' && player(0).connected, 'phone reload');
  assert.equal(phones[0].client.getSnapshot().playerId, ids[0]);
  assert.equal(player(0).character, expected[0]);
  assert.equal(player(0).characterConfirmed, true);
  assert.equal(JSON.parse(phones[0].saved.get(STORAGE_KEY)).token, savedIdentity.token);

  phones[9].client.chooseCharacter({ confirm: true });
  await until(() => host.client.getSnapshot().players.every(p => p.characterConfirmed), 'all ten choices made while joining');
  assert.equal(host.client.getSnapshot().selectionPhase, 'gathering');
  assert.equal(host.client.getSnapshot().countdownEndsAt, null, 'Only the host can start the countdown');
  host.client.beginCharacterSelection();
  await until(() => f.allSnapshots().every(snapshot => snapshot.selectionPhase === 'countdown'), 'all ten selections');
  const firstDeadline = f.room().countdownEndsAt;
  assert.equal(firstDeadline - f.relay.rooms.now(), 8000, 'New rooms allow eight full seconds before the race');
  f.tick(2000);
  phones[3].client.chooseCharacter({ confirm: false });
  await until(() => host.client.getSnapshot().selectionPhase === 'selecting', 'change cancels countdown');
  assert.equal(player(3).character, null);
  assert.equal(player(3).characterCursor, expected[3]);
  assert.ok(ids.every((_, index) => index === 3 || player(index).character === expected[index]));
  phones[3].client.chooseCharacter({ direction: 'right' });
  await until(() => player(3).characterCursor === 'flamingo', 'revised cursor');
  phones[3].client.chooseCharacter({ confirm: true }); expected[3] = 'flamingo';
  await until(() => host.client.getSnapshot().selectionPhase === 'countdown', 'revised pick restarts countdown');
  assert.equal(f.room().countdownEndsAt, firstDeadline + 2000);

  // A temporarily missing phone keeps its identity and pick but pauses the
  // countdown. Returning must provide another complete eight seconds.
  f.tick(1000);
  phones[9].client.destroy();
  await until(() => !player(9).connected && host.client.getSnapshot().selectionPhase === 'selecting', 'disconnect pauses countdown');
  assert.equal(player(9).character, expected[9]);
  phones[9].client = phones[9].fresh(); phones[9].client.restoreSession();
  await until(() => phones[9].client.getSnapshot().status === 'connected' && host.client.getSnapshot().selectionPhase === 'countdown', 'same controller resumes');
  assert.equal(f.room().countdownEndsAt, firstDeadline + 3000);
  f.tick(7999);
  assert.equal(f.room().locked, false, 'The race cannot start one millisecond early');
  f.tick(1);
  await until(() => f.allSnapshots().every(snapshot => snapshot.locked && snapshot.selectionPhase === 'racing'), 'exact race boundary');
  for (const snapshot of f.allSnapshots()) {
    assert.deepEqual(ids.map(id => snapshot.players.find(p => p.id === id).character), expected);
    assert.ok(snapshot.players.every(p => p.inRace && p.characterConfirmed));
    for (const p of snapshot.players) assert.deepEqual(p.input, ZERO_INPUT);
  }
  assert.equal(host.messages.filter(message => message.type === 'room' && message.room.locked).length, 1);
  const checkpoint = JSON.parse(host.saved.get(STORAGE_KEY)).checkpoint;
  assert.equal(checkpoint.characterSelectionVersion, 3);
  assert.deepEqual(ids.map(id => checkpoint.players.find(p => p.id === id).character), expected);

  host.client.setLocked(false);
  await until(() => f.allSnapshots().every(snapshot => snapshot.selectionPhase === 'gathering'), 'return to lobby');
  for (const snapshot of f.allSnapshots()) assert.ok(snapshot.players.every(p => p.character == null && p.characterCursor == null && !p.characterConfirmed && !p.inRace));
  host.client.beginCharacterSelection();
  await until(() => f.allSnapshots().every(snapshot => snapshot.selectionPhase === 'selecting'), 'rematch selection');
  assert.ok(host.client.getSnapshot().players.every(p => p.character == null && p.characterCursor == null));
});

test('a late phone cancels an armed countdown, preserves other picks and gets eight seconds after selecting', async t => {
  const f = await fixture(t, 2);
  for (const phone of f.phones) phone.client.chooseCharacter({ direction: 'right' });
  await until(() => f.host.client.getSnapshot().players.every(p => p.characterCursor === 'gorilla'), 'early cursors');
  for (const phone of f.phones) phone.client.chooseCharacter({ confirm: true });
  await until(() => f.host.client.getSnapshot().players.every(p => p.characterConfirmed), 'early confirmations');
  assert.equal(f.host.client.getSnapshot().countdownEndsAt, null, 'Early arrivals cannot auto-start');
  f.host.client.beginCharacterSelection();
  await until(() => f.host.client.getSnapshot().selectionPhase === 'countdown', 'host arms race');
  f.tick(5000);

  const late = device(); f.phones.push(late);
  late.client.joinRoom({ relayUrl: f.host.client.getSnapshot().relayUrl, code: f.host.client.getSnapshot().code, name: 'Late Phone' });
  await until(() => late.client.getSnapshot().status === 'connected' && f.host.client.getSnapshot().players.length === 3, 'late phone joins');
  assert.equal(f.host.client.getSnapshot().selectionPhase, 'selecting');
  assert.equal(f.host.client.getSnapshot().countdownEndsAt, null);
  for (const id of f.ids) assert.equal(f.host.client.getSnapshot().players.find(p => p.id === id).character, 'gorilla');
  const lateId = late.client.getSnapshot().playerId;
  assert.equal(f.host.client.getSnapshot().players.find(p => p.id === lateId).character, null);
  late.client.chooseCharacter({ direction: 'right' });
  await until(() => f.host.client.getSnapshot().players.find(p => p.id === lateId).characterCursor === 'gorilla', 'late phone browses');
  late.client.chooseCharacter({ confirm: true });
  await until(() => f.host.client.getSnapshot().selectionPhase === 'countdown', 'late pick restarts countdown');
  assert.equal(f.room().countdownEndsAt - f.relay.rooms.now(), 8000);
  f.tick(7999); assert.equal(f.room().locked, false);
  f.tick(1);
  await until(() => f.allSnapshots().every(snapshot => snapshot.locked), 'all three race together');
  assert.ok(f.host.client.getSnapshot().players.every(p => p.character === 'gorilla' && p.inRace));
});

test('unselected host and phone views never invent a fallback character; SELECT requires a browsed card', () => {
  const player = { id: 'phone', name: 'Unselected Driver', color: '#123456', vehicle: 'kart', character: null, characterCursor: null, characterConfirmed: false, connected: true, ready: false, inRace: false, input: ZERO_INPUT };
  const host = renderToStaticMarkup(React.createElement(StartingGrid, { players: [player], maxPlayers: 10 }));
  assert.match(host, /Unselected Driver/);
  assert.doesNotMatch(host, /Max|🦍|characters\.jpg|models\//, 'The waiting room must not display an automatic racer');
  const portrait = renderToStaticMarkup(React.createElement(CharacterPortrait, { id: null }));
  assert.doesNotMatch(portrait, /Max|🦍|background-position|background-image/, 'Missing characters need a neutral placeholder');
  const phone = renderToStaticMarkup(React.createElement(CharacterController, { player, onChoose() {} }));
  assert.doesNotMatch(phone, /Max|🦍|background-position|background-image/);
  const select = phone.match(/<button\b[^>]*>SELECT<\/button>/)?.[0];
  assert.ok(select, 'The phone exposes the SELECT action');
  assert.match(select, /\bdisabled=/, 'A blank cursor cannot be confirmed');

  const browsing = { ...player, characterCursor: 'musk' };
  const browsed = renderToStaticMarkup(React.createElement(CharacterController, { player: browsing, onChoose() {} }));
  assert.match(browsed, /Musk/);
  assert.doesNotMatch(browsed.match(/<button\b[^>]*>SELECT<\/button>/)?.[0] ?? '', /\bdisabled=/);
  const grid = renderToStaticMarkup(React.createElement(CharacterGrid, { players: [browsing], version: 3 }));
  const muskCard = grid.match(/<article\b[^>]*aria-label="Musk"[^>]*>[\s\S]*?<\/article>/)?.[0];
  assert.ok(muskCard, 'All guests remain available in the v3 grid');
  assert.match(muskCard, /Unselected Driver/, 'The cursor appears above the browsed card without prematurely assigning a character');
  const confirmed = renderToStaticMarkup(React.createElement(CharacterController, { player: { ...browsing, character: 'musk', characterConfirmed: true }, onChoose() {} }));
  assert.match(confirmed, /Musk/); assert.match(confirmed, /CHANGE CHARACTER/);
});

test('v3 recovery accepts genuine null lobby slots but rejects invented confirmations, cursors and locked racers', { timeout: 6000 }, async t => {
  const f = await fixture(t, 3);
  f.phones[0].client.chooseCharacter({ direction: 'right' });
  await until(() => f.player(0).characterCursor === 'gorilla', 'validator fixture cursor');
  f.phones[0].client.chooseCharacter({ confirm: true });
  await until(() => f.player(0).characterConfirmed, 'validator fixture confirmed choice');
  const session = JSON.parse(f.host.saved.get(STORAGE_KEY));
  const checkpoint = session.checkpoint;
  assert.equal(checkpoint.players.filter(p => p.character === null).length, 2);

  const replacement = createRelay({ allowedOrigins: [ORIGIN], logger: { error() {} } });
  replacement.server.listen(0, '127.0.0.1');
  await once(replacement.server, 'listening');
  const sockets = [];
  t.after(async () => { for (const socket of sockets) socket.terminate(); await replacement.close(); });
  const restore = async candidate => {
    const socket = new WebSocket(`ws://127.0.0.1:${replacement.server.address().port}/room`, { origin: ORIGIN });
    sockets.push(socket); await once(socket, 'open');
    const received = once(socket, 'message');
    socket.send(JSON.stringify({ type: 'resume', characterSelectionVersion: 3, recoveryVersion: 1,
      code: session.code, roomId: session.roomId, token: session.token, checkpoint: candidate }));
    const [data] = await received;
    return JSON.parse(data.toString());
  };
  for (const mutate of [
    c => { c.players[1].characterConfirmed = true; },
    c => { c.locked = true; c.selectionPhase = 'racing'; c.participants = c.players.map(p => p.id); },
    c => { c.players[1].characterCursor = 'invented-character'; },
    c => { c.players[0].character = 'alien'; },
  ]) {
    const candidate = structuredClone(checkpoint); mutate(candidate);
    const response = await restore(candidate);
    assert.equal(response.type, 'error'); assert.equal(response.code, 'invalid_recovery');
    assert.equal(replacement.rooms.rooms.size, 0, 'Rejected checkpoints must not reserve a partial room');
  }
  const restored = await restore(checkpoint);
  assert.equal(restored.type, 'welcome');
  assert.equal(restored.room.characterSelectionVersion, 3);
  assert.equal(restored.room.selectionPhase, 'gathering');
  assert.equal(restored.room.countdownEndsAt, null);
  assert.deepEqual(restored.room.players.map(p => p.character), ['gorilla', null, null]);
});
