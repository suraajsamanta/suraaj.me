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
  let stateListener = () => {}; let confirmResult = true;
  const room = {
    code: host ? 'ABC234' : null, role: host ? 'host' : null, status: host ? 'connected' : 'idle',
    playerId: null, maxPlayers: 10, locked: false, characterSelection: true, selectionPhase: 'gathering', countdownEndsAt: null, hostConnected: host, error: null, canRetryConnection: false, recovering: false, recoveryWaitingFor: [],
    players: host ? [
      { id: 'a', name: 'First', color: '#ffffff', connected: true, ready: true, inRace: false, input: { ...ZERO } },
      { id: 'b', name: 'Second', color: '#ff0000', connected: true, ready: true, inRace: false, input: { ...ZERO } },
    ] : [],
  };
  Object.assign(room, {
    beginCharacterSelection: () => { if (room.status === 'connected') { room.error = null; messages.push({ type: 'select_characters' }); } },
    chooseCharacter: choice => messages.push({ type: 'character', ...choice }), skipOfflineDrivers: () => messages.push({ type: 'skip_offline' }),
    setLocked: locked => { if (room.status === 'connected') { if (locked) room.error = null; messages.push({ type: 'lock', locked }); } },
    publishState: payload => { if (room.status === 'connected') messages.push({ type: 'state', payload }); },
    leaveRoom: () => { room.code = null; room.role = null; messages.push({ type: 'leave' }); },
    onState(listener) { stateListener = listener; return () => { stateListener = () => {}; }; }, createRoom(options) { messages.push({ type: 'create', options }); }, joinRoom(options) { messages.push({ type: 'join', options }); }, joinRandomRoom(options) { messages.push({ type: 'join_random', options }); }, setAppearance(appearance) { messages.push({ type: 'appearance', appearance }); }, setInput() {}, useItem() {}, retryConnection() { messages.push({ type: 'retry' }); }, resumeRace() { messages.push({ type: 'resume' }); }, setReady(ready) { messages.push({ type: 'ready', ready }); },
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
    if (name === './lobby/CharacterSelection') return { CharacterGrid: 'CharacterGrid', CharacterController: 'CharacterController' };
    if (name === './lobby/StartingGrid') return { default: 'StartingGrid' };
    if (name === './game/GameView') return { default: 'GameView' };
    if (name === './game/powerups') return { POWER_UPS: { fizz: { name: 'Fizz Boost' }, dance: { name: 'Dance Break' }, diddy: { name: 'Diddy Mode' } } };
    if (name === './game/audio') return { unlockRaceAudio: () => Promise.resolve() };
    if (name === './game/track') return { TRACKS: ['sunset', 'canyon', 'brewery'].map(id => ({ id, name: id, description: id })) };
    if (name === './room/useBeerioRoom') return { useBeerioRoom: () => room };
    if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    throw new Error(`Unexpected parent dependency: ${name}`);
  }, compiledModule, compiledModule.exports);
  globalThis.window = { location: { search: '', href: 'https://beerio.example/beerio' }, addEventListener() {}, removeEventListener() {}, confirm: () => confirmResult };
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
  const lock = () => { room.locked = true; room.selectionPhase = 'racing'; room.countdownEndsAt = null; room.players.forEach(player => { player.inRace = player.connected; }); };
  const unlock = () => { room.locked = false; room.selectionPhase = 'gathering'; room.countdownEndsAt = null; room.players.forEach(player => { player.inRace = false; player.ready = false; player.characterConfirmed = false; }); };
  const start = async () => {
    const tree = await render();
    button(tree, 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').onClick();
    await render();
    room.selectionPhase = 'countdown'; room.countdownEndsAt = Date.now() + 5000; await render();
    lock();
    return game(await render());
  };
  return { room, messages, render, button, game, nodes, start, lock, unlock, emit: value => stateListener(value), setConfirm: value => { confirmResult = value; }, hold: () => { holdMicrotasks = true; }, flush: () => { holdMicrotasks = false; for (const fn of heldMicrotasks.splice(0)) fn(); } };
}

test('parent preserves results and returns rematches to fresh character selection without ready-up', async t => {
  const f = await fixture(t);
  let tree = await f.render();
  f.nodes(tree, node => node.type?.name === 'TrackPicker')[0].props.onChange('brewery');
  let game = await f.start(); const key = game.raceKey;
  assert.equal(game.trackId, 'brewery'); assert.equal(game.initialCountdown, 0); assert.equal(game.players.length, 2);
  f.messages.length = 0; game.onFinish(RESULTS); game = f.game(await f.render());
  assert.ok(f.messages.some(message => message.type === 'lock' && message.locked === false));
  assert.deepEqual(f.messages.find(message => message.payload?.results).payload.results, RESULTS);
  assert.equal(game.onRematch, undefined, 'Rematch must return through shared character selection');
  assert.equal(game.lobbyLabel, 'Rematch lobby'); assert.equal(game.rematchDisabled, true);
  f.unlock(); f.room.players[1].connected = false;
  game = f.game(await f.render()); game.onLobby(); tree = await f.render();
  assert.equal(f.game(tree), undefined);
  assert.equal(f.button(tree, 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').disabled, false, 'A separate ready-up is not required');
  assert.ok(f.room.players.every(player => !player.characterConfirmed));
  game = await f.start(); assert.equal(game.raceKey, key + 1); assert.equal(game.trackId, 'brewery');
  assert.deepEqual(game.players.map(player => player.id), ['a']);
  f.room.status = 'reconnecting'; assert.equal(f.game(await f.render()).rematchDisabled, true);
  f.room.status = 'connected'; f.room.players[0].connected = false; assert.equal(f.game(await f.render()).rematchDisabled, true);
  game.onLobby(); f.unlock(); tree = await f.render(); assert.equal(f.game(tree), undefined);
  assert.ok(f.button(tree, 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').disabled);
});


test('parent reconciles a finish that occurred while the host was disconnected', async t => {
  const f = await fixture(t);
  await f.start();
  f.lock(); f.room.status = 'reconnecting';
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

test('parent reconciles lobby navigation sent while disconnected', async t => {
  const f = await fixture(t); await f.start();
  f.room.status = 'reconnecting'; const game = f.game(await f.render()); f.messages.length = 0;
  game.onLobby(); await f.render(); assert.equal(f.messages.length, 0);
  f.room.status = 'connected'; const tree = await f.render(); assert.equal(f.game(tree), undefined);
  assert.ok(f.messages.some(message => message.type === 'lock' && message.locked === false), 'Offline lobby must reopen the room on reconnect');
});


test('solo finish and rematch do not send multiplayer room commands', async t => {
  const f = await fixture(t, false);
  let tree = await f.render();
  f.button(tree, 'Set up a solo practice race →').onClick();
  tree = await f.render();
  f.button(tree, 'START SOLO PRACTICE ↗').onClick();
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
  assert.ok(f.button(tree, 'Set up a solo practice race →'));
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
  f.button(tree, 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').onClick();
  tree = await f.render();
  assert.equal(f.game(tree), undefined);
  assert.ok(f.button(tree, 'OPENING…').disabled);
  Object.assign(f.room.players[0], { character: 'robot', vehicle: 'motorcycle', color: '#123456' });
  f.lock();
  const game = f.game(await f.render());
  assert.equal(game.players[0].character, 'robot');
  assert.equal(game.players[0].vehicle, 'motorcycle');
  assert.equal(game.players[0].color, '#123456');
});

test('a valid relay race acknowledgment waits through disconnect and starts once on reconnect', async t => {
  const f = await fixture(t);
  f.button(await f.render(), 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').onClick(); await f.render();
  f.room.selectionPhase = 'countdown'; await f.render();
  f.room.status = 'reconnecting'; f.lock(); assert.equal(f.game(await f.render()), undefined);
  f.messages.length = 0; f.room.status = 'connected'; const game = f.game(await f.render());
  assert.equal(game.players.length, 2); assert.equal(game.initialCountdown, 0);
  assert.equal(f.game(await f.render()).raceKey, game.raceKey);
  assert.equal(f.messages.some(message => message.type === 'lock' && message.locked === false), false, 'Do not undo the acknowledged automatic start');
});


test('closing a pending start invalidates a queued lock acknowledgement', async t => {
  const f = await fixture(t);
  f.button(await f.render(), 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').onClick();
  await f.render(); f.hold(); f.lock();
  let tree = await f.render();
  assert.equal(f.game(tree), undefined);
  f.button(tree, 'CLOSE ROOM').onClick();
  f.flush(); tree = await f.render();
  assert.equal(f.game(tree), undefined);
  assert.ok(f.button(tree, 'HOST A RACE ↗'));
});

test('multiple locked roster snapshots schedule only one start', async t => {
  const f = await fixture(t);
  f.button(await f.render(), 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').onClick();
  await f.render(); f.hold(); f.lock();
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
  f.button(await f.render(), 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').onClick();
  await f.render(); f.hold(); f.lock();
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
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, locked: true, recovering: true, players: [{ id: 'a', name: 'First', color: '#ffffff', connected: true, ready: true, inRace: true, input: { ...ZERO } }] });
  let tree = await f.render();
  assert.equal(f.nodes(tree, node => node.type?.name === 'Controller').length, 0);
  f.room.recovering = false; tree = await f.render();
  assert.equal(f.nodes(tree, node => node.type?.name === 'Controller').length, 1);
});


test('garage is absent on host landing and host lobby, and solo setup opens separately', async t => {
  const f = await fixture(t, false);
  let tree = await f.render();
  const garages = () => f.nodes(tree, node => node.type?.name === 'AppearancePicker');
  assert.equal(garages().length, 0);
  f.button(tree, 'HOST A RACE ↗').onClick(); tree = await f.render();
  assert.equal(garages().length, 0);
  f.room.code = 'ABC234'; f.room.role = 'host'; f.room.status = 'connected'; f.room.hostConnected = true;
  tree = await f.render(); assert.equal(garages().length, 0);
  f.button(tree, 'CLOSE ROOM').onClick(); tree = await f.render();
  f.button(tree, 'Set up a solo practice race →').onClick(); tree = await f.render();
  assert.equal(garages().length, 1);
});

test('phone joins with name and color then uses the relay character choice after reconnect', async t => {
  const f = await fixture(t, false); let tree = await f.render();
  f.button(tree, 'JOIN WITH A CODE').onClick(); tree = await f.render();
  const picker = f.nodes(tree, node => node.type?.name === 'AppearancePicker')[0];
  assert.equal(picker.props.colorOnly, true, 'Only color is requested before joining');
  picker.props.onChange({ color: '#123456' }); tree = await f.render();
  const inputs = f.nodes(tree, node => node.type === 'input');
  inputs.find(node => node.props.placeholder === 'ABC123').props.onChange({ target: { value: 'ABC234' } });
  inputs.find(node => node.props.placeholder === 'Your name').props.onChange({ target: { value: 'Sam' } });
  tree = await f.render(); f.nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(f.messages.find(message => message.type === 'join').options.appearance.color, '#123456');
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, locked: false, players: [{ id: 'a', name: 'Sam', character: 'gorilla', vehicle: 'kart', color: '#123456', connected: true, characterConfirmed: false, inRace: false, input: { ...ZERO } }] });
  tree = await f.render(); assert.equal(f.nodes(tree, node => node.type?.name === 'AppearancePicker').length, 0);
  assert.equal(f.nodes(tree, node => node.type === 'CharacterController').length, 0, 'Wait for host selection phase');
  f.room.selectionPhase = 'selecting'; tree = await f.render();
  let choice = f.nodes(tree, node => node.type === 'CharacterController')[0].props;
  choice.onChoose({ direction: 'right' }); assert.deepEqual(f.messages.at(-1), { type: 'character', direction: 'right' });
  Object.assign(f.room.players[0], { character: 'tiger', characterConfirmed: true });
  f.room.status = 'reconnecting'; tree = await f.render(); assert.equal(f.nodes(tree, node => node.type === 'CharacterController').length, 0);
  f.room.status = 'connected'; tree = await f.render(); choice = f.nodes(tree, node => node.type === 'CharacterController')[0].props;
  assert.equal(choice.player.character, 'tiger'); assert.equal(choice.player.characterConfirmed, true);
  f.lock(); tree = await f.render(); assert.equal(f.nodes(tree, node => node.type === 'CharacterController').length, 0);
  assert.equal(f.nodes(tree, node => node.type?.name === 'Controller').length, 1);
});


test('phone shows only its own valid item and clears stale inventory at boundaries', async t => {
  const f = await fixture(t, false);
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, locked: true, players: [{ id: 'a', name: 'Sam', color: '#ffffff', connected: true, ready: true, inRace: true, input: { ...ZERO } }] });
  let tree = await f.render();
  const controller = () => f.nodes(tree, node => node.type?.name === 'Controller')[0]?.props;
  assert.equal(controller().item, undefined);
  f.emit({ type: 'inventory', inventory: [{ id: 'b', item: 'dance' }, { id: 'a', item: 'fizz' }] });
  tree = await f.render(); assert.equal(controller().item, 'fizz');
  f.emit({ type: 'inventory', inventory: [{ id: 'a', item: 'diddy', feedback: 'Diddy Mode collected!' }] });
  tree = await f.render(); assert.equal(controller().item, 'diddy'); assert.equal(controller().itemFeedback, 'Diddy Mode collected!');
  f.emit({ type: 'inventory', inventory: [{ id: 'a', item: null, feedback: 'Diddy Mode activated!' }] });
  tree = await f.render(); assert.equal(controller().item, null); assert.equal(controller().itemFeedback, 'Diddy Mode activated!');
  f.emit({ type: 'inventory', inventory: [{ id: 'a', item: null }] });
  tree = await f.render(); assert.equal(controller().item, null);
  f.emit({ type: 'inventory', inventory: [{ id: 'a', item: 'not-a-real-item' }] });
  tree = await f.render(); assert.equal(controller().item, undefined);
  f.emit({ type: 'inventory', inventory: [{ id: 'a', item: 'dance' }] }); await f.render();
  f.room.status = 'reconnecting'; await f.render(); f.room.status = 'connected';
  tree = await f.render(); assert.equal(controller().item, undefined);
  f.emit({ type: 'inventory', inventory: [{ id: 'a', item: 'dance' }] });
  tree = await f.render(); assert.equal(controller().item, 'dance');
  f.room.locked = false; await f.render(); f.lock();
  tree = await f.render(); assert.equal(controller().item, undefined);
});

test('phone reports only its own valid no-target feedback and clears it at inventory and race boundaries', async t => {
  const f = await fixture(t, false);
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, locked: true, players: [{ id: 'a', name: 'Sam', color: '#ffffff', connected: true, ready: true, inRace: true, input: { ...ZERO } }] });
  let tree = await f.render();
  const controller = () => f.nodes(tree, node => node.type?.name === 'Controller')[0]?.props;
  const feedback = async (label = 'No racer ahead', item = 'dance') => {
    f.emit({ type: 'inventory', inventory: [{ id: 'b', item: 'dance', feedback: 'No racer behind' }, { id: 'a', item, feedback: label }] });
    tree = await f.render();
  };
  for (const label of ['No racer ahead', 'No racer behind', 'No rivals to strike', 'No rivals to oil', 'Wait until back on track']) {
    await feedback(label);
    assert.equal(controller().item, 'dance', 'An unavailable target does not consume the held item');
    assert.equal(controller().itemFeedback, label);
  }
  await feedback('arbitrary relay text'); assert.equal(controller().itemFeedback, '');
  await feedback('No racer ahead', 'unknown'); assert.equal(controller().itemFeedback, '');
  await feedback('No racer ahead', null); assert.equal(controller().itemFeedback, '');
  await feedback();
  f.emit({ type: 'inventory', inventory: [{ id: 'a', item: 'dance' }] }); tree = await f.render();
  assert.equal(controller().itemFeedback, '', 'Older inventory packets and ended feedback remain compatible');
  for (const phase of ['racing', 'results', 'lobby']) {
    await feedback(); f.emit({ phase }); tree = await f.render();
    assert.equal(controller().itemFeedback, '');
  }
  for (const patch of [{ status: 'reconnecting' }, { hostConnected: false }, { recovering: true }]) {
    await feedback(); Object.assign(f.room, patch); tree = await f.render();
    assert.equal(controller(), undefined);
    f.emit({ type: 'inventory', inventory: [{ id: 'a', item: 'dance', feedback: 'No racer ahead' }] });
    Object.assign(f.room, { status: 'connected', hostConnected: true, recovering: false }); tree = await f.render();
    assert.equal(controller().itemFeedback, '', 'No stale no-target notice survives reconnection or recovery');
  }
  await feedback(); f.unlock(); tree = await f.render(); assert.equal(controller(), undefined);
  f.lock(); tree = await f.render(); assert.equal(controller().itemFeedback, '');
});

test('results wait for host and fresh character selection takes priority over old results', async t => {
  const f = await fixture(t, false);
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, players: [{ id: 'a', name: 'Sam', color: '#ffffff', connected: true, characterConfirmed: true, inRace: false, input: { ...ZERO } }] });
  await f.render(); f.unlock(); f.emit({ phase: 'results', results: RESULTS }); let tree = await f.render();
  assert.ok(JSON.stringify(tree).includes('Race finished!'));
  assert.equal(f.nodes(tree, node => node.type?.name === 'AppearancePicker').length, 0);
  assert.equal(f.button(tree, 'READY UP ↗'), undefined);
  f.room.selectionPhase = 'selecting'; tree = await f.render();
  assert.equal(f.nodes(tree, node => node.type === 'CharacterController').length, 1);
  f.emit({ phase: 'lobby' }); tree = await f.render(); assert.equal(f.nodes(tree, node => node.type === 'CharacterController').length, 1);
});


test('result retry survives host send throttling and is cancelled by a later lobby', async t => {
  const f = await fixture(t); let last = 0;
  f.room.publishState = payload => { if (Date.now() - last < 50) return; last = Date.now(); f.messages.push({ type: 'state', payload }); };
  let game = await f.start(); f.messages.length = 0; last = 0;
  game.onInventoryChange([{ id: 'a', item: 'fizz' }]); game.onFinish(RESULTS);
  assert.equal(f.messages.some(message => message.payload?.phase === 'results'), false);
  await new Promise(resolve => setTimeout(resolve, 190));
  assert.ok(f.messages.some(message => message.payload?.phase === 'results'));
  game = f.game(await f.render()); f.messages.length = 0; game.onLobby(); await f.render();
  await new Promise(resolve => setTimeout(resolve, 190));
  assert.equal(f.messages.some(message => message.payload?.phase === 'results'), false);
});

test('leaving an active race requires confirmation but lobby exit does not', async t => {
  const f = await fixture(t); let game = await f.start(); f.messages.length = 0; f.setConfirm(false);
  game.onLobby(); assert.ok(f.game(await f.render())); assert.equal(f.messages.length, 0);
  f.setConfirm(true); game.onLobby(); assert.equal(f.game(await f.render()), undefined);
  f.setConfirm(false); f.button(await f.render(), 'CLOSE ROOM').onClick();
  assert.ok(f.messages.some(message => message.type === 'leave'));
});

test('a pending result retry cannot leak into an acknowledged rematch', async t => {
  const f = await fixture(t); let game = await f.start(); f.messages.length = 0;
  game.onFinish(RESULTS); await f.render(); f.room.locked = false;
  game = f.game(await f.render()); f.messages.length = 0; game.onLobby(); f.unlock(); await f.render();
  f.room.players.forEach(player => { player.ready = true; });
  game = await f.start(); const rematchKey = game.raceKey;
  await new Promise(resolve => setTimeout(resolve, 190));
  assert.equal(f.messages.some(message => message.payload?.phase === 'results'), false);
  assert.equal(f.game(await f.render()).raceKey, rematchKey);
});

test('phone requires confirmation before leaving an active race', async t => {
  const f = await fixture(t, false);
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, locked: true, players: [{ id: 'a', name: 'Sam', color: '#ffffff', connected: true, ready: true, inRace: true, input: { ...ZERO } }] });
  let tree = await f.render(); f.messages.length = 0; f.setConfirm(false);
  f.button(tree, 'LEAVE').onClick(); tree = await f.render();
  assert.equal(f.messages.some(message => message.type === 'leave'), false);
  assert.equal(f.nodes(tree, node => node.type?.name === 'Controller').length, 1);
  f.setConfirm(true); f.button(tree, 'LEAVE').onClick();
  assert.ok(f.messages.some(message => message.type === 'leave'));
});

test('phone character controller renders only relay-confirmed choice state', async t => {
  const f = await fixture(t, false);
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, selectionPhase: 'selecting', players: [{ id: 'a', name: 'Sam', character: 'gorilla', vehicle: 'kart', color: '#123456', connected: true, characterConfirmed: false, inRace: false, input: { ...ZERO } }] });
  let tree = await f.render(); const choice = () => f.nodes(tree, node => node.type === 'CharacterController')[0].props;
  choice().onChoose({ direction: 'right' }); choice().onChoose({ direction: 'down' }); tree = await f.render();
  assert.equal(choice().player.character, 'gorilla', 'Do not invent an optimistic selection');
  f.room.players[0] = { ...f.room.players[0], character: 'zebra' }; tree = await f.render(); assert.equal(choice().player.character, 'zebra');
  choice().onChoose({ confirm: true }); tree = await f.render(); assert.equal(choice().player.characterConfirmed, false);
  f.room.players[0] = { ...f.room.players[0], characterConfirmed: true }; tree = await f.render(); assert.equal(choice().player.characterConfirmed, true);
});


test('phone reconnect drops stale selection and displays authoritative restored state', async t => {
  const f = await fixture(t, false);
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, selectionPhase: 'selecting', players: [{ id: 'a', name: 'Sam', character: 'bird', vehicle: 'motorcycle', color: '#123456', connected: true, characterConfirmed: false, inRace: false, input: { ...ZERO } }] });
  let tree = await f.render(); f.nodes(tree, node => node.type === 'CharacterController')[0].props.onChoose({ direction: 'right' });
  f.room.status = 'reconnecting'; await f.render(); f.room.status = 'connected'; f.room.players[0].character = 'horse';
  tree = await f.render(); assert.equal(f.nodes(tree, node => node.type === 'CharacterController')[0].props.player.character, 'horse');
});


test('ten-player host opens character selection without any ready-up and waits for relay lock', async t => {
  const f = await fixture(t);
  f.room.players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `Driver ${i}`, color: '#ffffff', connected: true, ready: false, characterConfirmed: false, inRace: false, input: { ...ZERO } }));
  let tree = await f.render(); const grid = f.nodes(tree, node => node.type === 'StartingGrid')[0];
  assert.equal(grid.props.maxPlayers, 10); assert.equal(grid.props.players.length, 10);
  assert.equal(f.button(tree, 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').disabled, false);
  f.messages.length = 0; f.button(tree, 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').onClick(); await f.render();
  assert.ok(f.messages.some(message => message.type === 'select_characters'));
  assert.equal(f.messages.some(message => message.type === 'lock' && message.locked), false);
  f.room.selectionPhase = 'selecting'; tree = await f.render(); assert.equal(f.nodes(tree, node => node.type === 'CharacterGrid')[0].props.players.length, 10);
  f.room.selectionPhase = 'countdown'; f.room.countdownEndsAt = Date.now() + 5000;
  assert.equal(f.game(await f.render()), undefined, 'No simulation before the relay countdown ends');
  f.lock(); const game = f.game(await f.render()); assert.equal(game.players.length, 10); assert.equal(game.initialCountdown, 0);
});


test('a rejected selection open exits pending state immediately and allows a clean retry', async t => {
  const f = await fixture(t); f.button(await f.render(), 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').onClick();
  assert.ok(f.button(await f.render(), 'OPENING…'));
  f.room.error = 'Wait for a connected driver before choosing characters.'; let tree = await f.render();
  assert.equal(f.button(tree, 'OPENING…'), undefined); assert.equal(f.game(tree), undefined);
  assert.ok(JSON.stringify(tree).includes(f.room.error));
  f.button(tree, 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').onClick(); tree = await f.render();
  assert.equal(f.room.error, null); assert.ok(f.button(tree, 'OPENING…'));
  f.lock(); assert.equal(f.game(await f.render()).players.length, 2);
});


test('acknowledged frozen participants include a driver who disconnects before React renders', async t => {
  const f = await fixture(t);
  f.room.players.push({ id: 'late', name: 'Late', color: '#ffffff', connected: false, ready: false, inRace: false, input: { ...ZERO } });
  f.button(await f.render(), 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').onClick(); await f.render();
  f.lock();
  f.room.players[1].connected = false;
  f.room.players[1].input = { steer: 1, accelerate: true, brake: false, action: 7 };
  f.room.players[2].connected = true;
  let game = f.game(await f.render());
  assert.deepEqual(game.players.map(player => player.id), ['a', 'b']);
  assert.equal(game.players[1].connected, false);
  assert.deepEqual(game.players[1].input, ZERO);
  f.room.players[1].connected = true;
  game = f.game(await f.render());
  assert.deepEqual(game.players.map(player => player.id), ['a', 'b'], 'Late reconnect cannot add a viewport to the race');
});

test('phone character selection follows durable phases and excludes nonparticipants from controls', async t => {
  const f = await fixture(t, false);
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, players: [{ id: 'a', name: 'Sam', character: 'gorilla', color: '#123456', connected: true, characterConfirmed: false, inRace: false, input: { ...ZERO } }] });
  let tree = await f.render(); assert.equal(f.nodes(tree, node => node.type === 'h1')[0].props.children, 'You’re in!');
  assert.equal(f.button(tree, 'READY UP ↗'), undefined);
  f.room.selectionPhase = 'selecting'; tree = await f.render(); assert.equal(f.nodes(tree, node => node.type === 'CharacterController').length, 1);
  f.room.players[0].characterConfirmed = true; f.room.selectionPhase = 'countdown'; f.room.countdownEndsAt = Date.now() + 5000;
  tree = await f.render(); assert.equal(f.nodes(tree, node => node.type === 'CharacterController')[0].props.endsAt, f.room.countdownEndsAt);
  f.room.locked = true; f.room.selectionPhase = 'racing'; tree = await f.render();
  assert.equal(f.nodes(tree, node => node.type === 'h1')[0].props.children, 'Race in progress.');
  assert.equal(f.nodes(tree, node => node.type?.name === 'Controller').length, 0);
  f.unlock(); await f.render(); f.lock(); tree = await f.render(); assert.equal(f.nodes(tree, node => node.type?.name === 'Controller').length, 1);
});


test('character selection yields to connection interruptions and restores only relay state', async t => {
  const f = await fixture(t, false);
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, selectionPhase: 'selecting', players: [{ id: 'a', name: 'Sam', color: '#ffffff', connected: true, characterConfirmed: true, inRace: false, input: { ...ZERO } }] });
  let tree = await f.render(); assert.equal(f.nodes(tree, node => node.type === 'CharacterController').length, 1);
  for (const [patch, title] of [[{ status: 'reconnecting' }, 'Reconnecting…'], [{ hostConnected: false }, 'Host reconnecting…'], [{ recovering: true }, 'Waiting for drivers…'], [{ status: 'error', canRetryConnection: true }, 'Connection paused.'], [{ status: 'error', canRetryConnection: false }, 'Room unavailable.'], [{ status: 'closed' }, 'Room closed.']]) {
    Object.assign(f.room, patch); tree = await f.render(); assert.equal(f.nodes(tree, node => node.type === 'h1')[0].props.children, title);
    assert.equal(f.nodes(tree, node => node.type === 'CharacterController').length, 0);
    assert.equal(f.nodes(tree, node => node.type?.name === 'Controller').length, 0);
    Object.assign(f.room, { status: 'connected', hostConnected: true, recovering: false, canRetryConnection: false }); tree = await f.render(); assert.equal(f.nodes(tree, node => node.type === 'CharacterController')[0].props.player.characterConfirmed, true);
  }
  f.messages.length = 0; f.setConfirm(false); f.button(tree, 'LEAVE').onClick(); assert.ok(f.messages.some(message => message.type === 'leave'), 'Leaving selection does not require active-race confirmation');
});


test('ten-entrant finish preserves complete score and item counts through host results and lobby', async t => {
  const f = await fixture(t);
  f.room.players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `Long racer ${i} ${'x'.repeat(40)}`, color: '#ffffff', connected: true, ready: true, inRace: false, input: { ...ZERO } }));
  let game = await f.start();
  const results = f.room.players.map((player, i) => ({ id: player.id, name: player.name, color: player.color, place: i + 1, time: i < 8 ? 100 + i : null, finished: i < 8, itemsUsed: i * 3 }));
  game.onFinish(results); game = f.game(await f.render());
  assert.deepEqual(f.messages.find(message => message.payload?.results).payload.results, results);
  assert.deepEqual(game.players.map(player => player.id), results.map(result => result.id), 'All ten original racers remain mounted for the results board');
  assert.equal(game.onRematch, undefined);
  assert.equal(game.lobbyLabel, 'Rematch lobby');
  f.unlock(); game.onLobby();
  const tree = await f.render();
  assert.equal(f.nodes(tree, node => node.type === 'StartingGrid')[0].props.players.length, 10);
  assert.equal(f.button(tree, 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').disabled, false);
});


test('older room capacity is explained and an empty room can be replaced explicitly', async t => {
  const f = await fixture(t);
  let tree = await f.render();
  assert.equal(f.button(tree, 'CREATE 10-PLAYER ROOM ↗'), undefined);
  Object.assign(f.room, { maxPlayers: 6, players: [], relayUrl: 'wss://relay.example/' });
  tree = await f.render();
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node?.props?.children ?? '');
  const warning = f.nodes(tree, node => node.props?.role === 'status' && text(node).includes('older room'))[0];
  assert.match(text(warning), /only 6 players/);
  assert.match(text(warning), /closes the current room/);
  assert.match(text(warning), /rejoin with the new code/);
  assert.equal(f.messages.some(message => message.type === 'create' || message.type === 'leave'), false);
  f.button(tree, 'CREATE 10-PLAYER ROOM ↗').onClick();
  assert.deepEqual(f.messages.at(-1), { type: 'create', options: { maxPlayers: 10, relayUrl: 'wss://relay.example/' } });
});

test('occupied older room asks before replacement and does nothing on cancel', async t => {
  const f = await fixture(t); Object.assign(f.room, { maxPlayers: 6, relayUrl: 'wss://relay.example/' });
  f.setConfirm(false); f.button(await f.render(), 'CREATE 10-PLAYER ROOM ↗').onClick();
  assert.equal(f.messages.some(message => message.type === 'create' || message.type === 'leave'), false);
  f.setConfirm(true); f.button(await f.render(), 'CREATE 10-PLAYER ROOM ↗').onClick();
  assert.deepEqual(f.messages.at(-1), { type: 'create', options: { maxPlayers: 10, relayUrl: 'wss://relay.example/' } });
  f.room.status = 'reconnecting'; assert.equal(f.button(await f.render(), 'CREATE 10-PLAYER ROOM ↗').disabled, true);
});

test('interrupted selection opening becomes retryable after reconnect', async t => {
  const f = await fixture(t); f.button(await f.render(), 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').onClick(); await f.render();
  f.room.status = 'reconnecting'; await f.render(); f.room.status = 'connected'; const tree = await f.render();
  assert.equal(f.game(tree), undefined); assert.equal(f.button(tree, 'OPENING…'), undefined);
  assert.equal(f.button(tree, 'EVERYONE’S IN · CHOOSE CHARACTERS ↗').disabled, false);
});

test('host reload during selection or racing reopens gathering rather than inventing a lost simulation', async t => {
  for (const phase of ['selecting', 'countdown', 'racing']) {
    const f = await fixture(t); f.room.selectionPhase = phase; f.room.locked = phase === 'racing';
    if (f.room.locked) f.room.players.forEach(player => { player.inRace = true; });
    const tree = await f.render(); assert.equal(f.game(tree), undefined);
    assert.ok(f.messages.some(message => message.type === 'lock' && message.locked === false));
    f.unlock(); const restored = await f.render(); assert.equal(f.game(restored), undefined);
    assert.equal(f.nodes(restored, node => node.type === 'CharacterGrid').length, 0);
    assert.ok(f.button(restored, 'EVERYONE’S IN · CHOOSE CHARACTERS ↗'));
  }
});

test('phone reports named item collection and activation even after the item is consumed', async t => {
  const f = await fixture(t, false);
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, locked: true, players: [{ id: 'a', name: 'Sam', color: '#ffffff', connected: true, inRace: true, input: { ...ZERO } }] });
  let tree = await f.render(); const controller = () => f.nodes(tree, node => node.type?.name === 'Controller')[0].props;
  for (const [item, label] of [['fizz', 'Fizz Boost collected!'], [null, 'Fizz Boost activated!'], ['dance', 'Dance Break collected!'], [null, 'Dance Break activated!']]) {
    f.emit({ type: 'inventory', inventory: [{ id: 'b', item: 'dance', feedback: 'untrusted other driver' }, { id: 'a', item, feedback: label }] });
    tree = await f.render(); assert.equal(controller().item, item); assert.equal(controller().itemFeedback, label);
  }
  f.emit({ type: 'inventory', inventory: [{ id: 'a', item: null, feedback: 'Unknown item activated!' }] }); tree = await f.render(); assert.equal(controller().itemFeedback, '');
});

test('v3 host keeps QR and character grid together while gathering and only enables start after every confirmed pick', async t => {
  const f = await fixture(t);
  f.room.characterSelectionVersion = 3;
  f.room.players.forEach(player => { player.character = null; player.characterCursor = null; player.characterConfirmed = false; });
  let tree = await f.render();
  const grid = () => f.nodes(tree, node => node.type === 'CharacterGrid');
  const qr = () => f.nodes(tree, node => node.props?.alt === 'QR code to join this room');
  assert.equal(grid().length, 1); assert.equal(qr().length, 1);
  assert.equal(grid()[0].props.version, 3);
  assert.equal(f.nodes(tree, node => node.type === 'StartingGrid').length, 0, 'No separate joining lobby');
  assert.equal(f.button(tree, 'EVERYONE’S IN · CHOOSE CHARACTERS ↗'), undefined);
  assert.equal(f.button(tree, 'START RACE ↗').disabled, true);
  assert.equal(f.messages.some(message => message.type === 'select_characters'), false);
  f.room.players[0].characterCursor = 'fox';
  tree = await f.render(); assert.equal(f.button(tree, 'START RACE ↗').disabled, true, 'Browsing alone is not a confirmed choice');
  f.room.players.forEach(player => { player.character = 'fox'; player.characterCursor = 'fox'; player.characterConfirmed = true; });
  tree = await f.render(); assert.equal(f.button(tree, 'START RACE ↗').disabled, false);
  f.button(tree, 'START RACE ↗').onClick(); tree = await f.render();
  assert.equal(f.game(tree), undefined);
  assert.equal(f.messages.filter(message => message.type === 'select_characters').length, 1);
  f.room.selectionPhase = 'countdown'; f.room.countdownEndsAt = Date.now() + 8000;
  tree = await f.render();
  assert.equal(grid().length, 1); assert.equal(qr().length, 1, 'Joining remains discoverable throughout countdown');
  assert.equal(f.button(tree, 'RACE STARTING…').disabled, true);
  f.lock();
  const game = f.game(await f.render());
  assert.equal(game.initialCountdown, 0, 'The host does not insert a second countdown');
  assert.deepEqual(game.players.map(player => player.character), ['fox', 'fox']);
});

test('v3 phone opens its own blank character controller immediately on joining and hides it while reconnecting', async t => {
  const f = await fixture(t, false);
  const self = { id: 'a', name: 'Fresh driver', color: '#123456', character: null, characterCursor: null, connected: true, characterConfirmed: false, inRace: false, input: { ...ZERO } };
  Object.assign(f.room, { code: 'ABC234', role: 'player', playerId: 'a', status: 'connected', hostConnected: true, characterSelectionVersion: 3, selectionPhase: 'gathering', players: [self] });
  let tree = await f.render();
  let controller = f.nodes(tree, node => node.type === 'CharacterController')[0];
  assert.ok(controller, 'No extra waiting screen between joining and choosing');
  assert.equal(controller.props.player.character, null);
  assert.equal(controller.props.player.characterCursor, null);
  controller.props.onChoose({ direction: 'right' });
  assert.deepEqual(f.messages.at(-1), { type: 'character', direction: 'right' });
  f.room.status = 'reconnecting'; tree = await f.render();
  assert.equal(f.nodes(tree, node => node.type === 'CharacterController').length, 0);
  self.characterCursor = 'fox'; self.character = 'fox'; self.characterConfirmed = true;
  f.room.status = 'connected'; tree = await f.render();
  controller = f.nodes(tree, node => node.type === 'CharacterController')[0];
  assert.equal(controller.props.player.character, 'fox');
  assert.equal(controller.props.player.characterConfirmed, true);
});

test('random joining is offered separately and host discovery requires opt-in', async t => {
  const f = await fixture(t, false);
  let tree = await f.render();
  f.button(tree, 'HOST A RACE ↗').onClick(); tree = await f.render();
  const toggle = f.nodes(tree, n => n.type === 'button' && n.props.role === 'switch')[0];
  assert.equal(toggle.props['aria-checked'], false);
  toggle.props.onClick(); tree = await f.render();
  f.button(tree, 'CREATE ROOM ↗').onClick();
  assert.equal(f.messages.at(-1).options.publicMatchmaking, true);
  f.button(tree, '← BACK').onClick(); tree = await f.render();
  f.button(tree, 'JOIN A RANDOM ROOM').onClick(); tree = await f.render();
  assert.equal(f.nodes(tree, n => n.type === 'input' && n.props.placeholder === 'ABC123').length, 0);
  const name = f.nodes(tree, n => n.type === 'input' && n.props.placeholder === 'Your name')[0];
  name.props.onChange({ target: { value: 'Speedy' } }); tree = await f.render();
  assert.equal(f.button(tree, 'FIND A ROOM ↗').disabled, false);
  f.nodes(tree, n => n.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(f.messages.at(-1).type, 'join_random'); assert.equal(f.messages.at(-1).options.name, 'Speedy');
});
