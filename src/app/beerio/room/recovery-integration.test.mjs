import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(new URL('../../../../beerio-server/server.mjs', import.meta.url));
const WebSocket = require('ws');
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const types = moduleUrl(transpile(await readFile(new URL('./types.ts', import.meta.url), 'utf8')));
const { BeerioRoomClient } = await import(moduleUrl(transpile(await readFile(new URL('./client.ts', import.meta.url), 'utf8')).replace('"./types"', JSON.stringify(types))));
const ORIGIN = 'https://beerio.example';
const ZERO = { steer: 0, accelerate: false, brake: false };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 6000) {
  const end = Date.now() + timeout;
  while (!check()) { if (Date.now() > end) throw new Error(`Timed out: ${label}`); await sleep(10); }
}
async function startRelay(port = 0) {
  const serverUrl = new URL('../../../../beerio-server/server.mjs', import.meta.url).href;
  const source = `import { createRelay } from ${JSON.stringify(serverUrl)};
    const relay = createRelay({ allowedOrigins: [${JSON.stringify(ORIGIN)}] });
    relay.server.listen(${port}, '127.0.0.1', () => console.log('READY ' + relay.server.address().port));
    process.on('SIGTERM', async () => { await relay.close(); process.exit(0); });`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; let errors = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { errors += data; });
  await until(() => /READY \d+/.test(output) || child.exitCode !== null, 'local relay startup');
  if (child.exitCode !== null) throw new Error(`Local relay failed: ${errors}`);
  const actualPort = Number(output.match(/READY (\d+)/)[1]);
  return { child, port: actualPort, url: `ws://127.0.0.1:${actualPort}/room`, async stop(signal) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit'); child.kill(signal); await exited;
  } };
}

test('ten actual browser clients survive abrupt and graceful relay process restarts without changing racer identity or replaying controls', async t => {
  const old = { WebSocket: globalThis.WebSocket, window: globalThis.window, sessionStorage: globalThis.sessionStorage };
  const received = [];
  const sockets = [];
  class BrowserSocket extends WebSocket {
    constructor(url) {
      super(url, { origin: ORIGIN });
      sockets.push(this);
      this.on('message', data => {
        const message = JSON.parse(data.toString());
        if (message.type === 'welcome') this.playerId = message.playerId;
        received.push(message);
      });
    }
  }
  globalThis.WebSocket = BrowserSocket;
  globalThis.window = { location: { protocol: 'http:', hostname: '127.0.0.1' } };
  // Separate clients intentionally retain in memory: prove a relay restart does
  // not depend on browser storage being available or introduce external storage.
  globalThis.sessionStorage = { getItem() { return null; }, setItem() { throw new Error('Storage unavailable'); }, removeItem() {} };
  const relays = []; const clients = [];
  t.after(async () => {
    for (const c of clients) c.destroy();
    for (const relay of relays) await relay.stop('SIGKILL');
    globalThis.WebSocket = old.WebSocket; globalThis.window = old.window; globalThis.sessionStorage = old.sessionStorage;
  });
  let relay = await startRelay(); relays.push(relay);
  const host = new BeerioRoomClient(); clients.push(host);
  host.createRoom({ relayUrl: relay.url });
  await until(() => host.getSnapshot().status === 'connected', 'host connection');
  const initialCode = host.getSnapshot().code;
  const phones = Array.from({ length: 10 }, (_, i) => {
    const c = new BeerioRoomClient(); clients.push(c);
    c.joinRoom({ relayUrl: relay.url, code: initialCode, name: `Racer ${i}`, appearance: { character: 'frog', vehicle: 'motorcycle', color: '#123456' } });
    return c;
  });
  await until(() => phones.every(c => c.getSnapshot().status === 'connected'), 'checkpoint-confirmed phone joins');
  const ids = phones.map(c => c.getSnapshot().playerId);
  phones.forEach(phone => phone.setReady(true));
  await until(() => host.getSnapshot().players.every(player => player.ready), 'all drivers ready');
  host.setLocked(true); await until(() => phones.every(c => c.getSnapshot().locked), 'race lock');
  phones[0].setInput({ steer: 1, accelerate: true, brake: false }); phones[0].useItem();
  await until(() => host.getSnapshot().players.find(p => p.id === ids[0]).input.action === 1, 'first item and checkpoint');

  await relay.stop('SIGKILL'); // No graceful notification: actual process and all Maps are gone.
  await until(() => host.getSnapshot().status === 'reconnecting', 'host pause after process crash');
  host.destroy(); // Delay only this test host so all ten phones arrive first.
  relay = await startRelay(relay.port); relays.push(relay);
  const pendingBefore = received.filter(m => m.code === 'recovery_pending').length;
  for (const phone of phones) phone.retryConnection();
  await until(() => received.filter(m => m.code === 'recovery_pending').length >= pendingBefore + 10, 'all phones retain credentials while host absent');
  assert.equal(host.getSnapshot().players.every(p => !p.input.accelerate && p.input.action === undefined), true);
  host.retryConnection();
  await until(() => host.getSnapshot().status === 'connected' && phones.every(c => c.getSnapshot().status === 'connected') && host.getSnapshot().players.every(p => p.connected), 'authenticated room recovery');
  const recoveredCode = host.getSnapshot().code;
  assert.notEqual(recoveredCode, initialCode);
  assert.deepEqual(phones.map(c => c.getSnapshot().playerId), ids);
  assert.equal(phones.every(c => c.getSnapshot().code === recoveredCode && c.getSnapshot().locked), true);
  assert.equal(host.getSnapshot().players.every(p => p.character === 'frog' && p.vehicle === 'motorcycle' && p.color === '#123456'), true);
  for (const p of host.getSnapshot().players) assert.deepEqual(p.input, ZERO);
  await until(() => phones.every(c => !c.getSnapshot().recovering), 'all phones receive recovery completion');
  assert.equal(phones[0].useItem(), true);
  await until(() => host.getSnapshot().players.find(p => p.id === ids[0]).input.action === 2, 'fresh post-recovery item');
  phones[0].resetInput();

  const restartingBefore = received.filter(m => m.type === 'relay_restarting').length;
  await relay.stop('SIGTERM');
  await until(() => received.filter(m => m.type === 'relay_restarting').length >= restartingBefore + 11, 'graceful restart does not send room_closed');
  const latePhone = phones[9];
  latePhone.destroy(); // Preserve its session, but keep this test controller offline.
  relay = await startRelay(relay.port); relays.push(relay);
  for (const c of clients.filter(c => c !== latePhone)) c.retryConnection();
  await until(() => clients.filter(c => c !== latePhone).every(c => c.getSnapshot().status === 'connected') && host.getSnapshot().players.filter(p => p.connected).length === 9, 'partial second recovery');
  assert.equal(host.getSnapshot().recovering, true);
  assert.deepEqual(host.getSnapshot().recoveryWaitingFor, [ids[9]]);
  assert.equal(phones.slice(0, 9).every(c => c.getSnapshot().recovering), true);
  phones[0].setInput({ steer: 1, accelerate: true, brake: false });
  assert.equal(phones[0].useItem(), false, 'client blocks new item presses while a participant is missing');
  await sleep(120);
  for (const p of host.getSnapshot().players) assert.deepEqual(p.input, ZERO);

  // Try bypassing browser guards on an authenticated controller socket: server
  // authority must enforce both the paused input gate and host-only continuation.
  const attacker = sockets.findLast(socket => socket.playerId === ids[0] && socket.readyState === WebSocket.OPEN);
  assert.ok(attacker);
  const deniedBefore = received.filter(m => m.code === 'host_only').length;
  attacker.send(JSON.stringify({ type: 'input', input: { steer: -1, accelerate: true, brake: false } }));
  attacker.send(JSON.stringify({ type: 'resume_race' }));
  await until(() => received.filter(m => m.code === 'host_only').length > deniedBefore, 'controller cannot resume missing racers');
  assert.equal(host.getSnapshot().recovering, true);
  for (const p of host.getSnapshot().players) assert.deepEqual(p.input, ZERO);

  host.resumeRace();
  await until(() => !host.getSnapshot().recovering && phones.slice(0, 9).every(c => !c.getSnapshot().recovering), 'host explicitly continues without missing phone');
  assert.deepEqual(host.getSnapshot().recoveryWaitingFor, []);
  assert.equal(host.getSnapshot().players.find(p => p.id === ids[9]).connected, false);
  await sleep(120);
  for (const p of host.getSnapshot().players) assert.deepEqual(p.input, ZERO, 'paused holds cannot restart after explicit continuation');
  latePhone.retryConnection();
  await until(() => clients.every(c => c.getSnapshot().status === 'connected') && host.getSnapshot().players.every(p => p.connected), 'late phone resumes same reserved racer');
  assert.equal(latePhone.getSnapshot().playerId, ids[9]);
  assert.equal(latePhone.getSnapshot().recovering, false);
  assert.deepEqual(phones.map(c => c.getSnapshot().playerId), ids);
  assert.notEqual(host.getSnapshot().code, recoveredCode);
  assert.equal(received.some(m => m.type === 'room_closed'), false);
  for (const p of host.getSnapshot().players) assert.deepEqual(p.input, ZERO);
  host.leaveRoom();
  await until(() => phones.every(c => c.getSnapshot().status === 'closed'), 'intentional host leave still ends the room');
  assert.equal(phones.every(c => !c.getSnapshot().canRetryConnection), true);
});
