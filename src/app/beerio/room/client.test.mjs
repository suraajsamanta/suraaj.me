import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Exercise the actual browser TypeScript without adding a test runner or shipping test dependencies.
const transpile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const asModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const types = asModule(transpile(await readFile(new URL('./types.ts', import.meta.url), 'utf8')));
const clientSource = transpile(await readFile(new URL('./client.ts', import.meta.url), 'utf8')).replace('"./types"', JSON.stringify(types));
const { BeerioRoomClient } = await import(asModule(clientSource));

const ZERO = { steer: 0, accelerate: false, brake: false };
const active = { steer: 0.8, accelerate: true, brake: false };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class FakeWebSocket {
  static OPEN = 1;
  static instances = [];
  readyState = 0;
  bufferedAmount = 0;
  sent = [];
  constructor(url) {
    this.url = url;
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => { if (this.readyState !== 3) { this.readyState = 1; this.onopen?.(); } });
  }
  send(payload) { this.sent.push(JSON.parse(payload)); }
  close() { this.readyState = 3; queueMicrotask(() => this.onclose?.()); }
  receive(message) { this.onmessage?.({ data: JSON.stringify(message) }); }
}

function fixture(t) {
  const saved = new Map();
  const old = { WebSocket: globalThis.WebSocket, window: globalThis.window, sessionStorage: globalThis.sessionStorage, nodeEnv: process.env.NODE_ENV, relay: process.env.NEXT_PUBLIC_BEERIO_RELAY_URL };
  globalThis.WebSocket = FakeWebSocket;
  globalThis.window = { location: { protocol: 'http:', hostname: 'localhost' } };
  globalThis.sessionStorage = {
    getItem(key) { return saved.get(key) ?? null; },
    setItem(key, value) { saved.set(key, value); },
    removeItem(key) { saved.delete(key); },
  };
  process.env.NODE_ENV = 'test';
  delete process.env.NEXT_PUBLIC_BEERIO_RELAY_URL;
  const client = new BeerioRoomClient();
  t.after(() => {
    client.destroy();
    globalThis.WebSocket = old.WebSocket;
    globalThis.window = old.window;
    globalThis.sessionStorage = old.sessionStorage;
    if (old.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old.nodeEnv;
    if (old.relay === undefined) delete process.env.NEXT_PUBLIC_BEERIO_RELAY_URL; else process.env.NEXT_PUBLIC_BEERIO_RELAY_URL = old.relay;
  });
  return { client, saved, socket: () => FakeWebSocket.instances.at(-1) };
}

function welcome(socket, role = 'player', roomOverrides = {}) {
  socket.receive({
    type: 'welcome', role, playerId: role === 'player' ? 'player1' : null, token: 'a'.repeat(48),
    room: { code: 'ABC234', maxPlayers: 6, locked: false, hostConnected: true,
      players: [{ id: 'player1', name: 'Phone', color: '#4ce4f3', connected: true, input: { ...ZERO } }], ...roomOverrides },
  });
}

test('client creates a room and handles host state permissions', async (t) => {
  const f = fixture(t);
  f.client.createRoom({ maxPlayers: 4 });
  await flush();
  assert.deepEqual(f.socket().sent[0], { type: 'create', maxPlayers: 4, recoveryVersion: 1, characterSelectionVersion: 2 });
  welcome(f.socket(), 'host');
  assert.equal(f.client.getSnapshot().status, 'connected');
  f.client.setLocked(true);
  f.client.publishState({ phase: 'racing' });
  assert.ok(f.socket().sent.some((m) => m.type === 'lock' && m.locked));
  assert.ok(f.socket().sent.some((m) => m.type === 'state'));
  f.client.setInput(active);
  assert.equal(f.socket().sent.filter((m) => m.type === 'input').length, 0);
});

test('controller normalizes input, releases immediately, heartbeats and suppresses background input', async (t) => {
  const f = fixture(t);
  f.client.joinRoom({ code: ' abc234 ', name: 'Phone' });
  await flush();
  assert.equal(f.socket().sent[0].code, 'ABC234');
  welcome(f.socket(), 'player', { locked: true });
  f.client.setInput({ steer: 4, accelerate: true, brake: false });
  assert.deepEqual(f.socket().sent.at(-1).input, { steer: 1, accelerate: true, brake: false });
  f.client.setInput(ZERO);
  assert.deepEqual(f.socket().sent.at(-1).input, ZERO);
  const neutralCount = f.socket().sent.length;
  for (let i = 0; i < 200; i++) f.client.setInput(ZERO);
  assert.equal(f.socket().sent.length, neutralCount);
  await wait(110);
  assert.ok(f.socket().sent.length > neutralCount);
  f.client.setInputSuppressed(true);
  f.client.setInput(active);
  await wait(110);
  assert.deepEqual(f.socket().sent.at(-1).input, ZERO);
  f.client.publishState({ bad: true });
  f.client.setLocked(true);
  assert.equal(f.socket().sent.filter((m) => ['state', 'lock'].includes(m.type)).length, 0);
});

test('host locally zeroes stale controls even when relay stays connected', async (t) => {
  const f = fixture(t);
  f.client.createRoom();
  await flush();
  welcome(f.socket(), 'host');
  f.socket().receive({ type: 'input', playerId: 'player1', input: active });
  assert.deepEqual(f.client.getSnapshot().players[0].input, active);
  await wait(750);
  assert.deepEqual(f.client.getSnapshot().players[0].input, ZERO);
});

test('disconnect resets host input and enters reconnecting; leave clears storage', async (t) => {
  const f = fixture(t);
  f.client.createRoom();
  await flush();
  welcome(f.socket(), 'host');
  f.socket().receive({ type: 'input', playerId: 'player1', input: active });
  f.socket().close();
  await flush();
  assert.equal(f.client.getSnapshot().status, 'reconnecting');
  assert.deepEqual(f.client.getSnapshot().players[0].input, ZERO);
  f.client.leaveRoom();
  assert.equal(f.client.getSnapshot().status, 'idle');
  assert.equal(f.saved.size, 0);
});

test('resume honors explicit room links, restores same-room identity and keeps tokens off room URLs', async (t) => {
  const f = fixture(t);
  f.client.joinRoom({ code: 'ABC234', name: 'Phone' });
  await flush();
  welcome(f.socket());
  f.client.destroy();
  const count = FakeWebSocket.instances.length;
  f.client.restoreSession('DEF567');
  assert.equal(FakeWebSocket.instances.length, count);
  f.client.restoreSession('ABC234');
  await flush();
  assert.equal(FakeWebSocket.instances.length, count + 1);
  assert.deepEqual(f.socket().sent[0], { type: 'resume', code: 'ABC234', token: 'a'.repeat(48), characterSelectionVersion: 2 });
  assert.ok(!f.socket().url.includes('a'.repeat(48)));
});

test('fatal session errors clear credentials and do not reconnect', async (t) => {
  const f = fixture(t);
  f.client.joinRoom({ code: 'ABC234', name: 'Phone' });
  await flush();
  welcome(f.socket());
  f.socket().receive({ type: 'error', code: 'session_replaced', message: 'Replaced elsewhere', fatal: true });
  await flush();
  assert.equal(f.client.getSnapshot().status, 'error');
  assert.equal(f.client.getSnapshot().error, 'Replaced elsewhere');
  assert.equal(f.saved.size, 0);
});

test('room closed clears state and session; state callbacks unsubscribe cleanly', async (t) => {
  const f = fixture(t);
  f.client.joinRoom({ code: 'ABC234', name: 'Phone' });
  await flush();
  welcome(f.socket());
  const states = [];
  const stop = f.client.onState((state) => states.push(state));
  f.socket().receive({ type: 'state', payload: { lap: 1 } });
  stop();
  f.socket().receive({ type: 'state', payload: { lap: 2 } });
  assert.deepEqual(states, [{ lap: 1 }]);
  f.socket().receive({ type: 'room_closed', reason: 'The host ended the room.' });
  assert.equal(f.client.getSnapshot().status, 'closed');
  assert.equal(f.saved.size, 0);
});

test('durable room lock drives waiting, race, resume, and return to lobby without state listeners', async (t) => {
  const f = fixture(t);
  const canDrive = () => {
    const room = f.client.getSnapshot();
    return room.status === 'connected' && room.hostConnected && room.locked;
  };
  const roomUpdate = (patch) => {
    const { code, players, maxPlayers, locked, hostConnected } = f.client.getSnapshot();
    f.socket().receive({ type: 'room', room: { code, players, maxPlayers, locked, hostConnected, ...patch } });
  };
  f.client.joinRoom({ code: 'ABC234', name: 'Phone' });
  await flush();
  welcome(f.socket());
  assert.equal(canDrive(), false, 'newly joined phones wait for the host');
  roomUpdate({ locked: true });
  assert.equal(canDrive(), true, 'starting the race enables controls without a state listener');
  f.client.destroy();
  f.client.restoreSession('ABC234');
  await flush();
  assert.equal(canDrive(), false, 'resuming phones are paused until welcome');
  welcome(f.socket(), 'player', { locked: true });
  assert.equal(canDrive(), true, 'locked welcome restores current race after reload');
  roomUpdate({ locked: false });
  assert.equal(canDrive(), false, 'host returning to lobby disables controls');
  roomUpdate({ locked: true });
  roomUpdate({ hostConnected: false });
  assert.equal(canDrive(), false, 'host loss immediately pauses controls');
  roomUpdate({ hostConnected: true, locked: false });
  assert.equal(canDrive(), false, 'reloaded host opens lobby rather than stale racing controls');
  f.socket().receive({ type: 'room_closed', reason: 'The host ended the room.' });
  assert.equal(canDrive(), false, 'closed rooms cannot accept driving input');
  assert.equal(f.client.getSnapshot().status, 'closed');
});

test('missing production relay and mixed-content URL fail explicitly rather than pretending online', (t) => {
  const f = fixture(t);
  process.env.NODE_ENV = 'production';
  f.client.createRoom();
  assert.equal(f.client.getSnapshot().status, 'error');
  assert.match(f.client.getSnapshot().error, /NEXT_PUBLIC_BEERIO_RELAY_URL/);
  globalThis.window.location.protocol = 'https:';
  f.client.createRoom({ relayUrl: 'ws://relay.example' });
  assert.match(f.client.getSnapshot().error, /secure wss/);
});

test('first connection tolerates a cold relay and retries early socket failures', async (t) => {
  const f = fixture(t);
  f.client.createRoom();
  await flush();
  f.socket().close();
  await flush();
  assert.equal(f.client.getSnapshot().status, 'connecting');
  assert.match(f.client.getSnapshot().error, /waking up/);
  assert.match(f.client.getSnapshot().error, /90 seconds/);
  f.client.leaveRoom();
  assert.equal(f.client.getSnapshot().status, 'idle');
});

test('initial handshake shows a cold-start hint and times out after 90 seconds', async (t) => {
  const f = fixture(t);
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  f.client.createRoom();
  await flush();
  t.mock.timers.tick(10_000);
  assert.equal(f.client.getSnapshot().status, 'connecting');
  assert.match(f.client.getSnapshot().error, /waking up/);
  t.mock.timers.tick(80_000);
  await flush();
  assert.equal(f.client.getSnapshot().status, 'error');
  assert.match(f.client.getSnapshot().error, /within 90 seconds/);
});

test('item presses are discrete, preserve held driving, and stop at safety boundaries', async (t) => {
  const f = fixture(t);
  f.client.joinRoom({ code: 'ABC234', name: 'Phone' });
  await flush();
  welcome(f.socket());
  assert.equal(f.client.useItem(), false, 'lobby taps cannot queue a future item');
  f.socket().receive({ type: 'room', room: { ...f.client.getSnapshot(), locked: true } });
  f.client.setInput(active);
  assert.equal(f.client.useItem(), true);
  assert.deepEqual(f.socket().sent.at(-1).input, { ...active, action: 1 });
  f.client.setInput(ZERO);
  assert.deepEqual(f.socket().sent.at(-1).input, { ...ZERO, action: 1 }, 'pedal release does not erase an action before the host frame');
  f.client.resetInput();
  assert.deepEqual(f.socket().sent.at(-1).input, ZERO, 'explicit safety reset drops pending actions');
  f.client.setInputSuppressed(true);
  assert.equal(f.client.useItem(), false);
  f.client.setInputSuppressed(false);
  f.client.useItem();
  assert.equal(f.socket().sent.at(-1).input.action, 2);
  f.client.destroy();
  assert.equal(f.client.useItem(), false);
  f.client.restoreSession('ABC234');
  await flush();
  welcome(f.socket(), 'player', { locked: true, players: [{ id: 'player1', name: 'Phone', color: '#4ce4f3', connected: true, input: { ...ZERO }, actionSequence: 19 }] });
  assert.ok(!f.socket().sent.some(message => message.type === 'input' && message.input.action), 'resume does not replay a pre-reconnect tap');
  f.client.useItem();
  assert.equal(f.socket().sent.at(-1).input.action, 20, 'next press starts beyond relay high-water mark');
});

test('host receives item sequences, stale action-only packets are neutralized, and older actions remain distinguishable', async (t) => {
  const f = fixture(t);
  f.client.createRoom();
  await flush();
  welcome(f.socket(), 'host');
  f.socket().receive({ type: 'input', playerId: 'player1', input: { ...ZERO, action: 3 } });
  assert.equal(f.client.getSnapshot().players[0].input.action, 3);
  await wait(750);
  assert.deepEqual(f.client.getSnapshot().players[0].input, ZERO);
  f.socket().receive({ type: 'input', playerId: 'player1', input: { ...ZERO, action: -10 } });
  assert.deepEqual(f.client.getSnapshot().players[0].input, ZERO, 'malformed sequences are discarded');
});

test('finish and rematch clear held controls and item events without replacing the controller', async (t) => {
  const f = fixture(t);
  f.client.joinRoom({ code: 'ABC234', name: 'Phone' });
  await flush();
  welcome(f.socket(), 'player', { locked: true });
  f.client.setInput(active);
  f.client.useItem();
  assert.deepEqual(f.socket().sent.at(-1).input, { ...active, action: 1 });
  const roomUpdate = locked => f.socket().receive({ type: 'room', room: { ...f.client.getSnapshot(), locked } });
  roomUpdate(false);
  f.client.setInput(active); // A controller cleanup or late pointer event races the transition.
  await wait(110);
  assert.deepEqual(f.socket().sent.at(-1).input, ZERO, 'results cannot send held driving');
  assert.equal(f.client.useItem(), false);
  roomUpdate(true);
  await wait(110);
  assert.deepEqual(f.socket().sent.at(-1).input, ZERO, 'fresh race does not reuse a previous hold');
  assert.equal(f.client.getSnapshot().playerId, 'player1');
  f.client.setInput(active);
  assert.equal(f.client.useItem(), true);
  assert.deepEqual(f.socket().sent.at(-1).input, { ...active, action: 2 });
});

const ROOM_ID = '1'.repeat(64);
function recoveryWelcome(socket, role = 'host', code = 'ABC234') {
  socket.receive({ type: 'welcome', role, playerId: role === 'player' ? 'player1' : null, token: 'a'.repeat(48), roomId: ROOM_ID,
    room: { code, maxPlayers: 6, locked: true, hostConnected: true,
      players: [{ id: 'player1', name: 'Phone', color: '#4ce4f3', connected: true, input: { ...ZERO } }] } });
}
function recoveryCheckpoint() {
  return { version: 1, revision: 3, ackRequired: true, roomId: ROOM_ID, maxPlayers: 6, locked: true,
    players: [{ id: 'player1', name: 'Phone', color: '#4ce4f3', character: 'frog', vehicle: 'kart', tokenHash: '2'.repeat(64), actionSequence: 0 }] };
}

test('host stores private checkpoint before acknowledging and retains item high-water floor in the same input packet', async t => {
  const f = fixture(t); f.client.createRoom(); await flush(); recoveryWelcome(f.socket());
  f.socket().receive({ type: 'checkpoint', checkpoint: recoveryCheckpoint() });
  const saved = () => JSON.parse([...f.saved.values()][0]);
  assert.equal(saved().checkpoint.roomId, ROOM_ID);
  assert.deepEqual(f.socket().sent.at(-1), { type: 'checkpoint_ack', revision: 3 });
  f.socket().receive({ type: 'input', playerId: 'player1', input: { ...active, action: 4 }, actionSequence: 4 });
  assert.equal(saved().checkpoint.players[0].actionSequence, 4);
  f.client.destroy(); f.client.restoreSession('ABC234'); await flush();
  const resume = f.socket().sent[0];
  assert.equal(resume.roomId, ROOM_ID); assert.equal(resume.checkpoint.players[0].actionSequence, 4);
  assert.ok(!f.socket().url.includes('a'.repeat(48)));
  recoveryWelcome(f.socket(), 'host', 'DEF567');
  assert.equal(f.client.getSnapshot().code, 'DEF567');
  assert.deepEqual(f.client.getSnapshot().players[0].input, ZERO);
  assert.equal(saved().checkpoint.roomId, ROOM_ID, 'welcome cannot erase the retained checkpoint');
});

test('relay shutdown and phones waiting for host preserve credentials, neutralize input and allow bounded retry', async t => {
  const f = fixture(t); f.client.joinRoom({ code: 'ABC234', name: 'Phone' }); await flush(); recoveryWelcome(f.socket(), 'player');
  f.client.setInput(active);
  f.socket().receive({ type: 'relay_restarting' }); await flush();
  assert.equal(f.client.getSnapshot().status, 'reconnecting'); assert.equal(f.saved.size, 1);
  f.client.retryConnection(); await flush();
  assert.equal(f.socket().sent[0].roomId, ROOM_ID);
  assert.equal(f.socket().sent[0].checkpoint, undefined, 'controller never sends a host checkpoint');
  f.socket().receive({ type: 'error', code: 'recovery_pending', message: 'Host has not returned', fatal: false }); await flush();
  assert.equal(f.client.getSnapshot().status, 'reconnecting'); assert.equal(f.saved.size, 1);
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  f.client.retryConnection(); await flush();
  for (let i = 0; i < 13; i++) {
    f.socket().receive({ type: 'error', code: 'recovery_pending', message: 'Waiting', fatal: false });
    await flush(); t.mock.timers.tick(9000); await flush();
  }
  assert.equal(f.client.getSnapshot().status, 'error'); assert.equal(f.client.getSnapshot().canRetryConnection, true);
  assert.equal(f.saved.size, 1);
  f.client.retryConnection(); await flush(); recoveryWelcome(f.socket(), 'player', 'DEF567');
  assert.equal(f.client.getSnapshot().status, 'connected'); assert.equal(f.client.getSnapshot().canRetryConnection, false);
  assert.deepEqual(f.client.getSnapshot().players[0].input, ZERO);
  f.client.leaveRoom(); assert.equal(f.saved.size, 0);
});

test('wrong immutable room identity is rejected without replacing saved identity; explicit invalid session disables retry', async t => {
  const f = fixture(t); f.client.createRoom(); await flush(); recoveryWelcome(f.socket());
  f.socket().receive({ type: 'checkpoint', checkpoint: recoveryCheckpoint() });
  f.socket().receive({ type: 'welcome', role: 'host', token: 'b'.repeat(48), roomId: '3'.repeat(64), room: { code: 'ABC234', players: [] } });
  assert.equal(f.client.getSnapshot().status, 'error'); assert.equal(f.client.getSnapshot().canRetryConnection, true);
  assert.equal(JSON.parse([...f.saved.values()][0]).roomId, ROOM_ID);
  f.client.retryConnection(); await flush();
  f.socket().receive({ type: 'error', code: 'invalid_session', fatal: true, message: 'Expired' });
  assert.equal(f.saved.size, 0); assert.equal(f.client.getSnapshot().canRetryConnection, false);
});

test('storage-disabled hosts keep recovery in memory, while controllers reject private checkpoint traffic', async t => {
  const f = fixture(t);
  globalThis.sessionStorage.setItem = () => { throw new Error('Storage disabled'); };
  f.client.createRoom(); await flush(); recoveryWelcome(f.socket());
  f.socket().receive({ type: 'checkpoint', checkpoint: recoveryCheckpoint() });
  assert.deepEqual(f.socket().sent.at(-1), { type: 'checkpoint_ack', revision: 3 });
  f.socket().close(); await flush(); f.client.retryConnection(); await flush();
  assert.equal(f.socket().sent[0].checkpoint.roomId, ROOM_ID);
  f.client.leaveRoom(); f.client.joinRoom({ code: 'ABC234', name: 'Phone' }); await flush(); recoveryWelcome(f.socket(), 'player');
  f.socket().receive({ type: 'checkpoint', checkpoint: recoveryCheckpoint() });
  assert.equal(f.socket().sent.some(m => m.type === 'checkpoint_ack'), false);
});

test('recovered controller updates its public deep link without leaking recovery credentials', async t => {
  const f = fixture(t); let replaced;
  globalThis.window.location.href = 'https://game.example/beerio?room=ABC234';
  globalThis.window.history = { state: null, replaceState(state, title, url) { replaced = url.href; } };
  f.client.joinRoom({ code: 'ABC234', name: 'Phone' }); await flush(); recoveryWelcome(f.socket(), 'player');
  f.socket().close(); await flush(); f.client.retryConnection(); await flush(); recoveryWelcome(f.socket(), 'player', 'DEF567');
  assert.equal(replaced, 'https://game.example/beerio?room=DEF567');
  assert.ok(!replaced.includes('a'.repeat(48)));
});

test('recovery gate blocks held controls and item taps until all racers return or host explicitly resumes', async t => {
  const f = fixture(t); f.client.joinRoom({ code: 'ABC234', name: 'Phone' }); await flush();
  welcome(f.socket(), 'player', { locked: true, recovering: true, recoveryWaitingFor: ['missing'] });
  f.client.setInput(active); assert.equal(f.client.useItem(), false);
  await wait(110); assert.deepEqual(f.socket().sent.at(-1).input, ZERO);
  f.socket().receive({ type: 'room', room: { ...f.client.getSnapshot(), recovering: false, recoveryWaitingFor: [] } });
  await wait(110); assert.deepEqual(f.socket().sent.at(-1).input, ZERO, 'recovery completion does not replay the paused hold');
  f.client.setInput(active); assert.equal(f.client.useItem(), true);
  f.client.leaveRoom(); f.client.createRoom(); await flush();
  welcome(f.socket(), 'host', { locked: true, recovering: true, recoveryWaitingFor: ['missing'] });
  f.client.resumeRace(); assert.deepEqual(f.socket().sent.at(-1), { type: 'resume_race' });
});

test('join sends the full name, including supplementary Unicode characters', async (t) => {
  const f = fixture(t);
  const name = 'A very long racer name 🚀 with family and friends';
  f.client.joinRoom({ code: 'ABC234', name });
  await flush();
  assert.equal(f.socket().sent[0].name, name);
});

test('replacing an older host room leaves it and requests a new ten-player room on the same relay', async t => {
  const f = fixture(t);
  f.client.createRoom({ maxPlayers: 6, relayUrl: 'ws://relay.example' }); await flush();
  const oldSocket = f.socket(); welcome(oldSocket, 'host');
  f.client.createRoom({ maxPlayers: 10, relayUrl: f.client.getSnapshot().relayUrl }); await flush();
  assert.ok(oldSocket.sent.some(message => message.type === 'leave'));
  assert.equal(oldSocket.readyState, 3);
  const newSocket = f.socket(); assert.notEqual(newSocket, oldSocket);
  assert.equal(newSocket.url, oldSocket.url);
  assert.deepEqual(newSocket.sent[0], { type: 'create', maxPlayers: 10, recoveryVersion: 1, characterSelectionVersion: 2 });
  welcome(newSocket, 'host', { code: 'DEF345', maxPlayers: 10, players: [] });
  assert.equal(f.client.getSnapshot().code, 'DEF345');
  assert.equal(f.client.getSnapshot().maxPlayers, 10);
});


test('selection deadline uses the relay clock rather than a skewed phone clock', async (t) => {
  const f = fixture(t); f.client.joinRoom({ code: 'ABC234', name: 'Phone' }); await flush();
  const before = Date.now();
  welcome(f.socket(), 'player', { characterSelection: true, selectionPhase: 'countdown', serverTime: 1000, countdownEndsAt: 6000 });
  assert.ok(f.client.getSnapshot().countdownEndsAt >= before + 5000);
  assert.ok(f.client.getSnapshot().countdownEndsAt <= Date.now() + 5000);
  f.client.chooseCharacter({ confirm: false });
  assert.deepEqual(f.socket().sent.at(-1), { type: 'character', confirm: false });
});

test('new hosts negotiate selection support and cannot silently use an older relay', async (t) => {
  const f = fixture(t); f.client.createRoom(); await flush(); welcome(f.socket(), 'host');
  f.client.beginCharacterSelection(); assert.match(f.client.getSnapshot().error, /older relay/);
  f.socket().receive({ type: 'room', room: { ...f.client.getSnapshot(), characterSelection: true, selectionPhase: 'gathering' } });
  f.client.beginCharacterSelection(); assert.deepEqual(f.socket().sent.at(-1), { type: 'select_characters' });
});
