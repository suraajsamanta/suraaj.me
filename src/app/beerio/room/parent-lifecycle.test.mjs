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
  const prior = { window: globalThis.window, localStorage: globalThis.localStorage };
  const state = [], dependencies = [], cleanups = [];
  let hook = 0, pending = [], dirty = false;
  const messages = [];
  const room = {
    code: host ? 'ABC234' : null, role: host ? 'host' : null, status: host ? 'connected' : 'idle',
    playerId: null, locked: false, hostConnected: host, error: null,
    players: host ? [
      { id: 'a', name: 'First', color: '#ffffff', connected: true, input: { ...ZERO } },
      { id: 'b', name: 'Second', color: '#ff0000', connected: true, input: { ...ZERO } },
    ] : [],
  };
  Object.assign(room, {
    setLocked: locked => { if (room.status === 'connected') messages.push({ type: 'lock', locked }); },
    publishState: payload => { if (room.status === 'connected') messages.push({ type: 'state', payload }); },
    leaveRoom: () => { room.code = null; room.role = null; messages.push({ type: 'leave' }); },
    createRoom() {}, joinRoom() {}, setInput() {}, useItem() {},
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
      await new Promise(resolve => queueMicrotask(resolve));
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
    return game(await render());
  };
  return { room, messages, render, button, game, nodes, start };
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
