import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const directory = dirname(fileURLToPath(import.meta.url));
const ZERO = { steer: 0, accelerate: false, brake: false };
const player = input => ({ id: 'driver', name: 'Driver', color: '#ffd264', input: { ...ZERO, ...input } });

/** Actual GameView, audio hook and physics, with deterministic RAF/hook doubles.
 * Renderer and audio output are recording doubles, not hardware emulation.
 */
async function fixture(t, initialProps = {}) {
  const prior = {
    window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement,
    requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const eventTarget = () => {
    const listeners = new Map();
    return {
      addEventListener(name, listener) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(listener);
      },
      removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
      dispatch(name, event = {}) { for (const listener of listeners.get(name) ?? []) listener(event); },
    };
  };
  globalThis.window = { ...eventTarget(), localStorage: { getItem: () => null, setItem() {} } };
  globalThis.document = { ...eventTarget(), hidden: false };
  globalThis.HTMLElement = class { isContentEditable = false; tagName = 'DIV'; closest() { return null; } };
  const canvas = eventTarget();
  const frames = new Map();
  let nextFrameId = 1;
  globalThis.requestAnimationFrame = callback => { const id = nextFrameId++; frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);

  const state = [], dependencies = [], cleanups = [];
  let slot = 0, dirty = false, pending = [];
  const changed = (index, next) => !dependencies[index] || !next || next.some((value, item) => !Object.is(value, dependencies[index][item]));
  const hooks = {
    useRef(current) { const index = slot++; if (!(index in state)) state[index] = { current }; return state[index]; },
    useState(initial) {
      const index = slot++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], value => {
        const next = typeof value === 'function' ? value(state[index]) : value;
        if (!Object.is(next, state[index])) { state[index] = next; dirty = true; }
      }];
    },
    useMemo(factory, next) {
      const index = slot++;
      if (changed(index, next)) { dependencies[index] = next; state[index] = factory(); }
      return state[index];
    },
    useCallback(callback, next) { return hooks.useMemo(() => callback, next); },
    useEffect(effect, next) {
      const index = slot++;
      if (changed(index, next)) {
        dependencies[index] = next;
        pending.push(() => { cleanups[index]?.(); cleanups[index] = effect(); });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const renderers = [], mixes = [], finishes = [];
  const context = { ...eventTarget(), state: 'running' };
  class RecordingRenderer {
    calls = [];
    disposed = false;
    constructor(_canvas, _entrants, race) { this.race = race; renderers.push(this); }
    render(race, elapsed) { this.calls.push({ race, elapsed }); }
    dispose() { this.disposed = true; }
  }
  class RecordingAudio {
    paused = false;
    muted = false;
    disposed = false;
    updates = [];
    pauses = [];
    constructor() { mixes.push(this); }
    setPaused(value) { this.paused = value; this.pauses.push(value); }
    setMuted(value) { this.muted = value; }
    update(race) { this.updates.push(race); }
    dispose() { this.disposed = true; }
  }
  const cache = new Map();
  const load = file => {
    file = resolve(file);
    if (cache.has(file)) return cache.get(file);
    const compiledModule = { exports: {} };
    cache.set(file, compiledModule.exports);
    const override = file.endsWith('/GameView.tsx') && process.env.BEERIO_GAMEVIEW_SOURCE;
    const source = ts.transpileModule(readFileSync(override || file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function('require', 'module', 'exports', source)(name => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
      if (name === './renderer') return { RaceRenderer: RecordingRenderer };
      if (name === './audio') return {
        RaceAudio: RecordingAudio, getRaceAudioContext: () => context,
        unlockRaceAudio: () => Promise.resolve(context.state === 'running'),
      };
      assert.ok(name.startsWith('.'), `Unexpected dependency ${name}`);
      const extension = name === './useRaceAudio' ? '.tsx' : '.ts';
      return load(resolve(dirname(file), name + extension));
    }, compiledModule, compiledModule.exports);
    cache.set(file, compiledModule.exports);
    return compiledModule.exports;
  };
  const { GameView } = load(resolve(directory, 'GameView.tsx'));
  let props = { players: [player()], localKeyboard: true, onFinish: results => finishes.push(results), ...initialProps };
  let tree;
  const commitRefs = node => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(commitRefs);
    if (node.type === 'canvas') node.props.ref.current = canvas;
    commitRefs(node.props?.children);
  };
  const render = async () => {
    for (let count = 0; count < 30; count++) {
      dirty = false; slot = 0;
      tree = GameView(props);
      commitRefs(tree);
      const effects = pending; pending = [];
      for (const effect of effects) effect();
      // Both the mount microtask and async audio activation must settle.
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      if (!dirty) return tree;
    }
    throw new Error('GameView did not settle');
  };
  const setProps = async patch => { props = { ...props, ...patch }; return render(); };
  const frame = async time => {
    assert.equal(frames.size, 1, 'Exactly one authoritative animation loop must remain scheduled');
    const [id, callback] = frames.entries().next().value;
    frames.delete(id); callback(time);
    return render();
  };
  const unmount = () => { for (const cleanup of cleanups) cleanup?.(); cleanups.length = 0; };
  t.after(() => { unmount(); Object.assign(globalThis, prior); });
  await render();
  return {
    frame, setProps, renderers, mixes, finishes, unmount,
    race: () => renderers[0]?.race,
    key: (code, type = 'keydown', repeat = false) => window.dispatch(type, { code, target: new HTMLElement(), repeat, preventDefault() {} }),
    visibility: hidden => { document.hidden = hidden; document.dispatch('visibilitychange'); },
  };
}

test('an initially paused GameView retains its scene and countdown and pauses audio', async t => {
  const f = await fixture(t, { paused: true, players: [player({ accelerate: true, action: 1 })] });
  await f.frame(100);
  const race = f.race(), before = structuredClone(race);
  const rendered = f.renderers[0].calls.length;
  assert.equal(f.mixes[0].paused, true);
  for (const now of [1000, 60000, 600000]) await f.frame(now);
  assert.deepEqual(race, before);
  assert.equal(f.renderers[0].calls.length, rendered, 'Paused scene must not animate away from its retained frame');
  assert.equal(f.mixes[0].updates.length, 0);
  assert.equal(f.finishes.length, 0);
  await f.setProps({ paused: false });
  assert.equal(f.mixes[0].paused, false);
  await f.frame(1200000);
  assert.deepEqual(race, before, 'First resumed frame discards elapsed wall time');
  await f.frame(1200017);
  assert.ok(race.countdown < before.countdown);
  assert.ok(before.countdown - race.countdown <= 1 / 60 + 1e-10);
  assert.equal(f.renderers.length, 1, 'Pause must not recreate the race or renderer');
});

test('pause freezes race, dance, hazards and item inventory despite held driving inputs', async t => {
  const f = await fixture(t, { players: [player({ accelerate: true, steer: 1 })] });
  await f.frame(100);
  const race = f.race(), kart = race.karts[0];
  race.countdown = 0; race.elapsed = 42;
  Object.assign(kart, { distance: 55, speed: 28, boost: 1.5 });
  Object.assign(kart.power, { dance: 2, shield: 3, slow: 1, item: 'guard' });
  race.powers.hazards.push({ id: 1, ownerId: 'other', distance: 100, lane: 0, life: 6 });
  race.powers.boxes[0].cooldown = 3;
  f.key('KeyW');
  await f.setProps({ paused: true });
  const before = structuredClone(race), audioUpdates = f.mixes[0].updates.length;
  for (const now of [117, 10000, 900000]) await f.frame(now);
  assert.deepEqual(race, before);
  assert.equal(f.mixes[0].paused, true);
  assert.equal(f.mixes[0].updates.length, audioUpdates);
  f.key('KeyW', 'keyup');
  await f.setProps({ paused: false, players: [player()] });
  await f.frame(1800000);
  assert.deepEqual(race, before);
  await f.frame(1800017);
  assert.ok(race.elapsed > 42 && race.elapsed < 42.02);
  assert.ok(kart.power.dance < 2 && kart.power.dance > 1.98);
  assert.equal(kart.power.used, 0);
  assert.equal(kart.power.item, 'guard');
  assert.equal(kart.distance, before.karts[0].distance);
  f.unmount();
  assert.equal(f.mixes[0].disposed, true);
  assert.equal(f.renderers[0].disposed, true);
});

test('pause and resume without any intervening RAF cannot advance elapsed wall time', async t => {
  const f = await fixture(t);
  await f.frame(100);
  const race = f.race(); race.countdown = 0; race.elapsed = 10;
  await f.frame(117);
  const before = structuredClone(race);
  await f.setProps({ paused: true });
  // Browsers can suspend RAF entirely in background tabs.
  await f.setProps({ paused: false });
  await f.frame(900000);
  assert.deepEqual(race, before, 'No hidden/offline time may enter physics on resume');
  await f.frame(900017);
  assert.ok(race.elapsed - before.elapsed <= 1 / 60 + 1e-10);
});

test('paused keyboard presses cannot queue acceleration or an item for resume', async t => {
  const f = await fixture(t);
  await f.frame(100);
  const race = f.race(), kart = race.karts[0]; race.countdown = 0;
  kart.power.item = 'guard';
  f.key('KeyW');
  await f.setProps({ paused: true });
  f.key('KeyE');
  await f.frame(1000);
  assert.equal(kart.power.used, 0);
  await f.setProps({ paused: false });
  await f.frame(10000); await f.frame(10017);
  assert.equal(kart.speed, 0, 'Keys held before the pause must be released safely');
  assert.equal(kart.power.item, 'guard', 'Item presses during pause must not replay');
  assert.equal(kart.power.used, 0);
  f.key('KeyW', 'keyup'); f.key('KeyE', 'keyup');
  f.key('KeyW'); f.key('KeyE');
  await f.frame(10034);
  assert.ok(kart.speed > 0);
  assert.equal(kart.power.used, 1, 'Fresh post-resume input remains responsive');
});

test('a pause transition without RAF still clears held keys and an unprocessed item press', async t => {
  const f = await fixture(t);
  await f.frame(100);
  const race = f.race(), kart = race.karts[0]; race.countdown = 0;
  kart.power.item = 'guard';
  f.key('KeyW'); f.key('KeyE');
  await f.setProps({ paused: true });
  await f.setProps({ paused: false });
  await f.frame(10000); await f.frame(10017);
  assert.equal(kart.speed, 0);
  assert.equal(kart.power.used, 0);
  assert.equal(kart.power.item, 'guard');
  f.key('KeyW', 'keyup'); f.key('KeyE', 'keyup');
  f.key('KeyW'); f.key('KeyE');
  await f.frame(10034);
  assert.ok(kart.speed > 0);
  assert.equal(kart.power.used, 1);
});

test('paused controller actions are baselined for every racer without consuming inventory', async t => {
  const first = player(), second = { ...player(), id: 'second' };
  const f = await fixture(t, { localKeyboard: false, players: [first, second] });
  await f.frame(100);
  const race = f.race(); race.countdown = 0;
  race.karts[0].power.item = 'guard'; race.karts[1].power.item = 'fizz';
  const positions = race.karts.map(kart => kart.distance);
  await f.setProps({ paused: true, players: [first, second].map(racer => ({ ...racer, input: { ...ZERO, accelerate: true, steer: 1, action: 7 } })) });
  await f.frame(1000); await f.frame(10000);
  assert.deepEqual(race.karts.map(kart => kart.power.used), [0, 0]);
  assert.deepEqual(race.karts.map(kart => kart.distance), positions);
  assert.deepEqual(race.karts.map(kart => kart.power.item), ['guard', 'fizz']);
  await f.setProps({ paused: false, players: [first, second] });
  await f.frame(20000); await f.frame(20017);
  assert.deepEqual(race.karts.map(kart => kart.power.used), [0, 0]);
  await f.setProps({ players: [first, second].map(racer => ({ ...racer, input: { ...ZERO, action: 8 } })) });
  await f.frame(20034);
  assert.deepEqual(race.karts.map(kart => kart.power.used), [1, 1]);
});

test('tab visibility cannot unpause audio while the race connection is paused', async t => {
  const f = await fixture(t);
  await f.frame(100);
  assert.equal(f.mixes[0].paused, false);
  await f.setProps({ paused: true });
  f.visibility(true); f.visibility(false);
  assert.equal(f.mixes[0].paused, true);
  await f.frame(10000);
  assert.equal(f.mixes[0].paused, true);
  await f.setProps({ paused: false });
  assert.equal(f.mixes[0].paused, false);
  assert.equal(f.mixes.length, 1, 'Pause/resume must reuse the existing sound graph');
});

test('held keyboard repeats remain blocked but a fresh post-resume press works', async t => {
  const f = await fixture(t);
  await f.frame(100);
  const race = f.race(), kart = race.karts[0]; race.countdown = 0;
  kart.power.item = 'guard';
  f.key('KeyW');
  await f.setProps({ paused: true });
  f.key('KeyE');
  await f.setProps({ paused: false });
  f.key('KeyW', 'keydown', true); f.key('KeyE', 'keydown', true);
  await f.frame(10000); await f.frame(10017);
  assert.equal(kart.speed, 0);
  assert.equal(kart.power.used, 0);
  // repeat:false represents a fresh physical press even if keyup was lost.
  f.key('KeyW'); f.key('KeyE');
  await f.frame(10034);
  assert.ok(kart.speed > 0);
  assert.equal(kart.power.used, 1);
});

test('fresh controller item input after resume is not swallowed before the first RAF', async t => {
  const first = player(), second = { ...player(), id: 'second' };
  const f = await fixture(t, { localKeyboard: false, players: [first, second] });
  await f.frame(100);
  const race = f.race(); race.countdown = 0;
  race.karts.forEach(kart => { kart.power.item = 'guard'; });
  await f.setProps({ paused: true });
  await f.frame(1000);
  await f.setProps({ paused: false });
  await f.setProps({ players: [first, second].map(racer => ({ ...racer, input: { ...ZERO, action: 1 } })) });
  await f.frame(10000); await f.frame(10017);
  assert.deepEqual(race.karts.map(kart => kart.power.used), [1, 1]);
});
