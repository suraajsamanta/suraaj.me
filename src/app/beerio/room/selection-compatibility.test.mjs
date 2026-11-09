import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { RoomService } from '../../../../beerio-server/core.mjs';

const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const types = moduleUrl(transpile(await readFile(new URL('./types.ts', import.meta.url), 'utf8')));
const { BeerioRoomClient } = await import(moduleUrl(transpile(await readFile(new URL('./client.ts', import.meta.url), 'utf8')).replace('"./types"', JSON.stringify(types))));
const STORAGE_KEY = 'beerio-room-session-v1';
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(t) {
  const saved = new Map(), clients = [];
  const old = { WebSocket: globalThis.WebSocket, window: globalThis.window, sessionStorage: globalThis.sessionStorage };
  const f = { service: new RoomService(), legacy: true, saved, clients };
  class BrowserSocket {
    static OPEN = 1;
    readyState = 0;
    bufferedAmount = 0;
    constructor() {
      this.service = f.service;
      this.peer = { send: message => queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(message) })), close: () => this.close() };
      this.service.connect(this.peer);
      queueMicrotask(() => { if (this.readyState === 0) { this.readyState = 1; this.onopen?.(); } });
    }
    send(payload) {
      const message = JSON.parse(payload);
      // Reproduce the v1 cached-page handshake. Its existing error handler clears
      // credentials only for fatal errors, exactly as the current handler does.
      if (f.legacy) delete message.characterSelectionVersion;
      this.service.receive(this.peer, message);
    }
    close() {
      if (this.readyState === 3) return;
      this.readyState = 3;
      this.service.disconnect(this.peer);
      queueMicrotask(() => this.onclose?.());
    }
  }
  globalThis.WebSocket = BrowserSocket;
  globalThis.window = { location: { protocol: 'http:', hostname: 'localhost' } };
  globalThis.sessionStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  f.client = () => { const client = new BeerioRoomClient(); clients.push(client); return client; };
  f.peer = () => {
    const peer = { messages: [], send(message) { this.messages.push(structuredClone(message)); }, close() {} };
    f.service.connect(peer); return peer;
  };
  f.create = () => {
    const host = f.peer(); f.service.receive(host, { type: 'create', characterSelectionVersion: 2, recoveryVersion: 1 });
    const welcome = host.messages.find(message => message.type === 'welcome');
    const room = f.service.roomsByIdentity.get(welcome.roomId);
    const phone = f.peer();
    f.service.receive(phone, { type: 'join', code: room.code, characterSelectionVersion: 2, name: 'Huang driver', appearance: { character: 'huang', vehicle: 'kart', color: '#123456' } });
    f.service.receive(host, { type: 'checkpoint_ack', revision: room.checkpointRevision });
    const phoneWelcome = phone.messages.find(message => message.type === 'welcome');
    const checkpoint = host.messages.filter(message => message.type === 'checkpoint').at(-1).checkpoint;
    return { host, phone, welcome, phoneWelcome, checkpoint, room };
  };
  t.after(() => {
    for (const client of clients) client.destroy();
    globalThis.WebSocket = old.WebSocket; globalThis.window = old.window; globalThis.sessionStorage = old.sessionStorage;
  });
  return f;
}

for (const role of ['host', 'player']) test(`obsolete ${role} resume preserves stored identity until refresh and cannot evict the live session`, async t => {
  const f = fixture(t), room = f.create();
  const identity = role === 'host' ? room.welcome : room.phoneWelcome;
  const session = { code: room.room.code, roomId: room.welcome.roomId, token: identity.token, role, relayUrl: 'ws://localhost:8787/', ...(role === 'host' ? { checkpoint: room.checkpoint } : {}) };
  f.saved.set(STORAGE_KEY, JSON.stringify(session));
  const stale = f.client(); stale.restoreSession(); await flush();
  assert.match(stale.getSnapshot().error, /Refresh Beerio/);
  assert.equal(stale.getSnapshot().status, 'reconnecting');
  assert.deepEqual(JSON.parse(f.saved.get(STORAGE_KEY)), session, 'Refresh instructions must not delete a valid session');
  assert.equal(room.room.host, room.host);
  assert.equal(room.room.players.get(room.phoneWelcome.playerId).peer, room.phone);
  assert.equal(f.service.rooms.size, 1);
  stale.destroy(); f.legacy = false;
  const refreshed = f.client(); refreshed.restoreSession(); await flush();
  assert.equal(refreshed.getSnapshot().status, 'connected');
  assert.equal(refreshed.getSnapshot().role, role);
  assert.equal(refreshed.getSnapshot().characterSelectionVersion, 2);
  assert.equal(refreshed.getSnapshot().players[0].character, 'huang');
  if (role === 'player') assert.equal(refreshed.getSnapshot().playerId, room.phoneWelcome.playerId);
  assert.equal(JSON.parse(f.saved.get(STORAGE_KEY)).token, identity.token);
  assert.equal(f.service.rooms.size, 1);
});

test('obsolete host recovery retains its checkpoint without reserving a room, then refresh restores the original roster', async t => {
  const f = fixture(t), room = f.create();
  const session = { code: room.room.code, roomId: room.welcome.roomId, token: room.welcome.token, role: 'host', relayUrl: 'ws://localhost:8787/', checkpoint: room.checkpoint };
  f.saved.set(STORAGE_KEY, JSON.stringify(session));
  f.service = new RoomService();
  const stale = f.client(); stale.restoreSession(); await flush();
  assert.match(stale.getSnapshot().error, /Refresh Beerio/);
  assert.deepEqual(JSON.parse(f.saved.get(STORAGE_KEY)), session);
  assert.equal(f.service.rooms.size, 0); assert.equal(f.service.roomsByIdentity.size, 0);
  stale.destroy(); f.legacy = false;
  const refreshed = f.client(); refreshed.restoreSession(); await flush();
  assert.equal(refreshed.getSnapshot().status, 'connected');
  assert.equal(refreshed.getSnapshot().characterSelectionVersion, 2);
  assert.equal(refreshed.getSnapshot().players[0].id, room.phoneWelcome.playerId);
  assert.equal(refreshed.getSnapshot().players[0].character, 'huang');
  assert.equal(f.service.rooms.size, 1); assert.equal(f.service.roomsByIdentity.size, 1);
  assert.equal(JSON.parse(f.saved.get(STORAGE_KEY)).token, session.token);
});
