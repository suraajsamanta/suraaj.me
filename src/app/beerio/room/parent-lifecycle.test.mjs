import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(process.env.BEERIO_PARENT_SOURCE || new URL('../Beerio.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const ZERO = { steer: 0, accelerate: false, brake: false };
const RESULTS = [
  { id: 'a', name: 'First', color: '#ffffff', place: 1, time: 100, finished: true, itemsUsed: 3 },
  { id: 'b', name: 'Second', color: '#ff0000', place: 2, time: null, finished: false, itemsUsed: 1 },
];

// Run the actual parent component and its callbacks with stateful hook doubles.
// The room stub models asynchronous lock acknowledgments and dropped sends while
// offline. Network delivery, input resets and simulation have separate tests.
async function fixture(t, host = true) {
  const prior = { window: globalThis.window, localStorage: globalThis.localStorage, queueMicrotask: globalThis.queueMicrotask };
  let holdMicrotasks = false; const heldMicrotasks = [];
  globalThis.queueMicrotask = fn => { if (holdMicrotasks) heldMicrotasks.push(fn); else prior.queueMicrotask(fn); };
  const state = [], dependencies = [], cleanups = [];
  let hook = 0, pending = [], dirty = false;
  const messages = [];
  const room = {
    code: host ? 'ABC234' : null, role: host ? 'host' : null, status: host ? 'connected' : 'idle',
    playerId: null, locked: false, hostConnected: host, error: null, canRetryConnection: false, recovering: false, recoveryWaitingFor: [],
    players: host ? [
      { id: 'a', name: 'First', color: '#ffffff', connected: true, input: { ...ZERO } },
      { id: 'b', name: 'Second', color: '#ff0000', connected: true, input: { ...ZERO } },
    ] : [],
  };
  Object.assign(room, {
    setLocked: locked => { if (room.status === 'connected') messages.push({ type: 'lock', locked }); },
    publishState: payload => { if (room.status === 'connected') messages.push({ type: 'state', payload }); },
    leaveRoom: () => { room.code = null; room.role = null; messages.push({ type: 'leave' }); },
    createRoom() {}, joinRoom() {}, setInput() {}, useItem() {}, retryConnection() { messages.push({ type: 'retry' }); }, resumeRace() { messages.push({ type: 'resume' }); },
  });
  const react = {
    useState(initial) {
      const slot = hook++;
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
      return [state[slot], value => {
        const next = typeof value === 'function' ? value(state[slot]) : value;
        if (!Object.is(next, state[slot])) { state[slot] = next; dirty = true; }
      }];
    },
    useRef(current) { const slot = hook++; if (!(slot in state)) state[slot] = { current }; return state[slot]; },
    useCallback: callback => callback,
    useEffect(effect, next) {
      const slot = hook++;
      if (!dependencies[slot] || next?.some((value, index) => !Object.is(value, dependencies[slot][index]))) {
        dependencies[slot] = next;
        pending.push(() => { cleanups[slot]?.(); cleanups[slot] = effect(); });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'qrcode') return { default: { toDataURL: () => Promise.resolve('data:image/test') } };
    if (name === 'next/link' || name === 'next/image') return { default: name };
    if (name === './appearance') return { CHARACTERS: [{ id: 'fox', name: 'Fox', icon: 'fox' }], VEHICLES: [{ id: 'kart', name: 'Kart', icon: 'kart' }], PALETTE: ['#ffce58'], DEFAULT_APPEARANCE: { character: 'fox', vehicle: 'kart', color: '#ffce58' }, validAppearance: () => false };
    if (name === './game/SteeringJoystick') return { default: 'SteeringJoystick' };
    if (name === './game/GameView') return { default: 'GameView' };
    if (name === './game/audio') return { unlockRaceAudio: () => Promise.resolve() };
    if (name === './game/track') return { TRACKS: ['sunset', 'canyon', 'brewery'].map(id => ({ id, name: id, description: id })) };
    if (name === './room/useBeerioRoom') return { useBeerioRoom: () => room };
    if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    throw new Error(`Unexpected parent dependency: ${name}`);
  }, compiledModule, compiledModule.exports);
  globalThis.window = { location: { search: '', href: 'https://beerio.example/beerio' }, addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  t.after(() => { for (const cleanup of cleanups) cleanup?.(); Object.assign(globalThis, prior); });
  const render = async () => {
    for (let count = 0; count < 20; count++) {
      dirty = false; hook = 0;
      const tree = compiledModule.exports.default();
      const effects = pending; pending = [];
      for (const effect of effects) effect();
      await Promise.resolve();
      if (!dirty) return tree;
    }
    throw new Error('Parent component did not settle');
  };
  const nodes = (tree, predicate) => {
    const result = [];
    const visit = node => {
      if (!node) return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (predicate(node)) result.push(node);
      visit(node.props?.children);
    };
    visit(tree);
    return result;
  };
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
    : Array.isArray(node) ? node.map(text).join('') : text(node?.props?.children ?? '');
  const button = (tree, label) => nodes(tree, node => node.type === 'button' && text(node) === label)[0]?.props;
  const game = tree => nodes(tree, node => node.type === 'GameView')[0]?.props;
  const start = async () => {
    const tree = await render();
    button(tree, 'START YOUR ENGINES ↗').onClick();
    await render();
    room.locked = true;
    return game(await render());
  };
  return { room, messages, render, button, game, nodes, start, hold: () => { holdMicrotasks = true; }, flush: () => { holdMicrotasks = false; for (const fn of heldMicrotasks.splice(0)) fn(); } };
}

test('parent preserves result counts and rematches only connected entrants after unlock acknowledgment', async t => {
  const f = await fixture(t);
  let tree = await f.render();
  f.nodes(tree, node => node.type?.name === 'TrackPicker')[0].props.onChange('brewery');
  let game = await f.start();
  const key = game.raceKey;
  assert.equal(game.trackId, 'brewery');
  assert.equal(game.players.length, 2);
  f.room.locked = true;
  game = f.game(await f.render());
  f.messages.length = 0;
  game.onFinish(RESULTS);
  game = f.game(await f.render());
  assert.ok(f.messages.some(message => message.type === 'lock' && message.locked === false));
  assert.deepEqual(f.messages.find(message => message.payload?.results).payload.results, RESULTS);
  assert.equal(game.rematchDisabled, true, 'Wait for the relay to acknowledge unlock');
  f.room.locked = false;
  f.room.players[1].connected = false;
  game = f.game(await f.render());
  assert.equal(game.rematchDisabled, false);
  game.onRematch();
  game = f.game(await f.render());
  assert.equal(game.raceKey, key, 'Wait for the lock acknowledgement');
  f.room.locked = true;
  game = f.game(await f.render());
  assert.equal(game.raceKey, key + 1);
  assert.equal(game.trackId, 'brewery');
  assert.deepEqual(game.players.map(player => player.id), ['a']);
  f.room.status = 'reconnecting';
  assert.equal(f.game(await f.render()).rematchDisabled, true);
  f.room.status = 'connected'; f.room.players[0].connected = false;
  assert.equal(f.game(await f.render()).rematchDisabled, true);
  game.onLobby();
  tree = await f.render();
  assert.equal(f.game(tree), undefined);
  assert.ok(f.button(tree, 'START YOUR ENGINES ↗').disabled);
});

test('parent reconciles a finish that occurred while the host was disconnected', async t => {
  const f = await fixture(t);
  await f.start();
  f.room.locked = true; f.room.status = 'reconnecting';
  let game = f.game(await f.render());
  f.messages.length = 0;
  game.onFinish(RESULTS);
  await f.render();
  assert.equal(f.messages.length, 0);
  f.room.status = 'connected';
  game = f.game(await f.render());
  assert.ok(f.messages.some(message => message.type === 'lock' && message.locked === false));
  assert.equal(game.rematchDisabled, true);
  f.room.locked = false;
  assert.equal(f.game(await f.render()).rematchDisabled, false);
});

test('parent reconciles lobby navigation and a missed race-start lock after reconnect', async t => {
  const f = await fixture(t);
  await f.start();
  f.room.status = 'reconnecting'; f.room.locked = false;
  await f.render(); f.messages.length = 0;
  f.room.status = 'connected';
  await f.render();
  assert.ok(f.messages.some(message => message.type === 'lock' && message.locked === true));
  f.room.locked = true; f.room.status = 'reconnecting';
  const game = f.game(await f.render());
  f.messages.length = 0;
  game.onLobby();
  await f.render();
  assert.equal(f.messages.length, 0);
  f.room.status = 'connected';
  const tree = await f.render();
  assert.equal(f.game(tree), undefined);
  assert.ok(f.messages.some(message => message.type === 'lock' && message.locked === false), 'Offline lobby must reopen the room on reconnect');
});

test('solo finish and rematch do not send multiplayer room commands', async t => {
  const f = await fixture(t, false);
  let tree = await f.render();
  f.button(tree, 'Try a solo practice lap →').onClick();
  let game = f.game(await f.render());
  const key = game.raceKey;
  game.onFinish(RESULTS.slice(0, 1));
  game = f.game(await f.render());
  assert.equal(game.rematchDisabled, false);
  assert.equal(game.lobbyLabel, 'Back to menu');
  game.onRematch();
  game = f.game(await f.render());
  assert.equal(game.raceKey, key + 1);
  assert.deepEqual(f.messages, []);
  game.onLobby();
  tree = await f.render();
  assert.equal(f.game(tree), undefined);
  assert.ok(f.button(tree, 'Try a solo practice lap →'));
});


test('host snapshots each racer appearance when starting split-screen', async t => {
  const f = await fixture(t);
  Object.assign(f.room.players[0], { character: 'robot', vehicle: 'motorcycle', color: '#123456' });
  Object.assign(f.room.players[1], { character: 'frog', vehicle: 'buggy', color: '#abcdef' });
  const game = await f.start();
  assert.deepEqual(game.players.map(({ character, vehicle, color }) => ({ character, vehicle, color })), [
    { character: 'robot', vehicle: 'motorcycle', color: '#123456' },
    { character: 'frog', vehicle: 'buggy', color: '#abcdef' },
  ]);
  Object.assign(f.room.players[0], { character: 'fox', vehicle: 'kart', color: '#eeeeee' });
  assert.equal(f.game(await f.render()).players[0].character, 'robot');
});


test('start uses authoritative locked roster after a last-moment appearance change', async t => {
  const f = await fixture(t);
  let tree = await f.render();
  f.button(tree, 'START YOUR ENGINES ↗').onClick();
  tree = await f.render();
  assert.equal(f.game(tree), undefined);
  assert.ok(f.button(tree, 'STARTING…').disabled);
  Object.assign(f.room.players[0], { character: 'robot', vehicle: 'motorcycle', color: '#123456' });
  f.room.locked = true;
  const game = f.game(await f.render());
  assert.equal(game.players[0].character, 'robot');
  assert.equal(game.players[0].vehicle, 'motorcycle');
  assert.equal(game.players[0].color, '#123456');
});

test('start aborts on disconnect and reopens an acknowledged lock on reconnect', async t => {
  const f = await fixture(t);
  f.button(await f.render(), 'START YOUR ENGINES ↗').onClick();
  await f.render();
  f.room.status = 'reconnecting'; f.room.locked = true;
  assert.equal(f.game(await f.render()), undefined);
  f.messages.length = 0; f.room.status = 'connected';
  assert.equal(f.game(await f.render()), undefined);
  assert.ok(f.messages.some(message => message.type === 'lock' && message.locked === false));
});


test('closing a pending start invalidates a queued lock acknowledgement', async t => {
  const f = await fixture(t);
  f.button(await f.render(), 'START YOUR ENGINES ↗').onClick();
  await f.render(); f.hold(); f.room.locked = true;
  let tree = await f.render();
  assert.equal(f.game(tree), undefined);
  f.button(tree, 'CLOSE ROOM').onClick();
  f.flush(); tree = await f.render();
  assert.equal(f.game(tree), undefined);
  assert.ok(f.button(tree, 'HOST A RACE ↗'));
});

test('multiple locked roster snapshots schedule only one start', async t => {
  const f = await fixture(t);
  f.button(await f.render(), 'START YOUR ENGINES ↗').onClick();
  await f.render(); f.hold(); f.room.locked = true;
  await f.render();
  f.room.players = f.room.players.map(player => ({ ...player }));
  await f.render();
  f.flush();
  const game = f.game(await f.render());
  assert.equal(game.raceKey, 1);
  assert.equal(f.messages.filter(message => message.payload?.phase === 'racing').length, 1);
});

test('disconnect cancels a queued lock acknowledgement before it starts', async t => {
  const f = await fixture(t);
  f.button(await f.render(), 'START YOUR ENGINES ↗').onClick();
  await f.render(); f.hold(); f.room.locked = true;
  await f.render(); f.room.status = 'reconnecting';
  await f.render(); f.flush();
  assert.equal(f.game(await f.render()), undefined);
});

test('a recovered public room code does not restart or remount the race', async t => {
  const f = await fixture(t);
  const before = await f.start();
  f.room.status = 'reconnecting';
  const paused = f.game(await f.render());
  assert.equal(paused.paused, true);
  f.room.code = 'QRS789'; f.room.status = 'connected';
  const after = f.game(await f.render());
  assert.equal(after.paused, false);
  assert.equal(after.raceKey, before.raceKey);
  assert.deepEqual(after.players.map(player => player.id), before.players.map(player => player.id));
});


test('paused host offers retry only for recoverable connection errors', async t => {
  const f = await fixture(t); await f.start();
  f.room.status = 'error'; f.room.error = 'Connection lost'; f.room.canRetryConnection = true;
  let tree = await f.render();
  assert.equal(f.game(tree).paused, true);
  f.button(tree, 'RETRY CONNECTION').onClick();
  assert.ok(f.messages.some(message => message.type === 'retry'));
  f.room.canRetryConnection = false;
  tree = await f.render();
  assert.equal(f.button(tree, 'RETRY CONNECTION'), undefined);
});


test('recovery waits for missing drivers and resumes without resetting the race', async t => {
  const f = await fixture(t); const before = await f.start();
  f.room.recovering = true; f.room.recoveryWaitingFor = ['b']; f.room.players[1].connected = false;
  let tree = await f.render();
  assert.equal(f.game(tree).paused, true);
  assert.ok(f.nodes(tree, node => node.props?.children === 'Second').length || JSON.stringify(tree).includes('Second'));
  f.button(tree, 'CONTINUE WITHOUT MISSING DRIVERS').onClick();
  assert.ok(f.messages.some(message => message.type === 'resume'));
  assert.equal(f.game(await f.render()).paused, true, 'Wait for relay acknowledgement');
  f.room.recovering = false; f.room.recoveryWaitingFor = [];
  tree = await f.render(); assert.equal(f.game(tree).paused, false); assert.equal(f.game(tree).raceKey, before.raceKey);
});

test('all drivers returning automatically clears recovery without restarting', async t => {
  const f = await fixture(t); const before = await f.start();
  f.room.recovering = true; f.room.recoveryWaitingFor = ['b'];
  assert.equal(f.game(await f.render()).paused, true);
  f.room.recovering = false; f.room.recoveryWaitingFor = [];
  const after = f.game(await f.render());
  assert.equal(after.paused, false); assert.equal(after.raceKey, before.raceKey);
  assert.equal(f.messages.filter(message => message.type === 'resume').length, 0);
});

test('phone controller remains hidden during recovery and returns after acknowledgement', async t => {
  const f = await fixture(t, false);
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, locked: true, recovering: true, players: [{ id: 'a', name: 'First', color: '#ffffff', connected: true, input: { ...ZERO } }] });
  let tree = await f.render();
  assert.equal(f.nodes(tree, node => node.type?.name === 'Controller').length, 0);
  f.room.recovering = false; tree = await f.render();
  assert.equal(f.nodes(tree, node => node.type?.name === 'Controller').length, 1);
});
