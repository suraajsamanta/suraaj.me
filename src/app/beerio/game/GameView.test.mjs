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
    frame, setProps, renderers, mixes, finishes, unmount, tree: () => tree, track: () => load(resolve(directory, 'track.ts')), blur: () => window.dispatch('blur'),
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

test('resume clears every racer’s pre-pause drift without consuming fresh item input', async t => {
  const players = Array.from({ length: 10 }, (_, i) => ({ ...player(), id: `driver-${i}`, input: { ...ZERO, drift: true } }));
  const f = await fixture(t, { localKeyboard: false, players });
  await f.frame(100);
  const race = f.race(); race.countdown = 0;
  for (const kart of race.karts) {
    kart.speed = 25; kart.drifting = true; kart.driftCharge = 2.5; kart.power.item = 'guard';
  }
  // Pause and resume without an intervening RAF, then deliver fresh actions
  // before the first resumed frame, as can happen after a brief disconnect.
  await f.setProps({ paused: true });
  await f.setProps({ paused: false });
  await f.setProps({ players: players.map(racer => ({ ...racer, input: { ...ZERO, drift: true, accelerate: true, steer: 1, action: 1 } })) });
  await f.frame(10000);
  for (const kart of race.karts) { assert.equal(kart.driftCharge, 0, kart.id); assert.equal(kart.drifting, false, kart.id); }
  await f.frame(10017);
  for (const kart of race.karts) {
    assert.equal(kart.drifting, true, kart.id);
    assert.ok(kart.driftCharge >= 0 && kart.driftCharge < 0.1, kart.id);
    assert.equal(kart.boost, 0, `stale drift must not reward ${kart.id}`);
    assert.equal(kart.power.used, 1, `fresh item press must work for ${kart.id}`);
    assert.equal(kart.power.item, null, kart.id);
  }
});

test('inventory callback publishes a detached initial snapshot for every racer', async t => {
  const inventories = [];
  const players = Array.from({ length: 6 }, (_, index) => ({ ...player(), id: `driver-${index}` }));
  const f = await fixture(t, { players, onInventoryChange: inventory => inventories.push(inventory) });
  await f.frame(100);
  assert.deepEqual(inventories, [players.map(racer => ({ id: racer.id, item: null }))]);
  inventories[0][0].item = 'dance';
  assert.equal(f.race().karts[0].power.item, null, 'Consumers cannot mutate authoritative inventory');
  f.race().karts[1].power.item = 'guard';
  await f.frame(600);
  assert.deepEqual(inventories[1], players.map((racer, index) => ({ id: racer.id, item: index === 1 ? 'guard' : null })));
});

test('inventory changes are coalesced to at most 2 Hz and consumed items publish empty', async t => {
  const inventories = [];
  const f = await fixture(t, { onInventoryChange: inventory => inventories.push(inventory) });
  await f.frame(100);
  const kart = f.race().karts[0];
  kart.power.item = 'guard';
  await f.frame(200);
  kart.power.item = 'fizz';
  await f.frame(599);
  assert.equal(inventories.length, 1, 'Do not flood room state with frame-rate updates');
  await f.frame(600);
  assert.deepEqual(inventories[1], [{ id: 'driver', item: 'fizz' }], 'Publish the latest state, not a queued stale pickup');
  kart.power.item = null;
  await f.frame(1099);
  assert.equal(inventories.length, 2);
  await f.frame(1100);
  assert.deepEqual(inventories[2], [{ id: 'driver', item: null }]);
});

test('unchanged inventory has a 2s reconnect heartbeat rather than a frame-rate broadcast', async t => {
  const inventories = [];
  const f = await fixture(t, { onInventoryChange: inventory => inventories.push(inventory) });
  await f.frame(100);
  for (const now of [600, 1100, 1600, 2099]) await f.frame(now);
  assert.equal(inventories.length, 1);
  await f.frame(2100);
  assert.equal(inventories.length, 2);
  assert.deepEqual(inventories[1], inventories[0]);
});

test('inventory callback replacement and controller updates do not restart the race', async t => {
  const oldCalls = [], newCalls = [];
  const f = await fixture(t, { onInventoryChange: inventory => oldCalls.push(inventory) });
  await f.frame(100);
  const race = f.race(); race.countdown = 0; race.elapsed = 17;
  await f.setProps({ onInventoryChange: inventory => newCalls.push(inventory), players: [player({ accelerate: true })] });
  race.karts[0].power.item = 'guard';
  await f.frame(600);
  assert.equal(f.renderers.length, 1);
  assert.equal(f.race(), race);
  assert.ok(race.elapsed >= 17);
  assert.equal(oldCalls.length, 1);
  assert.deepEqual(newCalls, [[{ id: 'driver', item: 'guard' }]]);
});

test('inventory waits during a host pause and refreshes after reconnect', async t => {
  const inventories = [];
  const f = await fixture(t, { paused: true, onInventoryChange: inventory => inventories.push(inventory) });
  await f.frame(100);
  assert.equal(inventories.length, 0);
  await f.setProps({ paused: false });
  await f.frame(600);
  assert.equal(inventories.length, 1);
  f.race().karts[0].power.item = 'guard';
  await f.setProps({ paused: true });
  await f.frame(5000);
  assert.equal(inventories.length, 1);
  await f.setProps({ paused: false });
  await f.frame(10000);
  assert.deepEqual(inventories[1], [{ id: 'driver', item: 'guard' }]);
});

test('finish callback takes precedence over a due inventory change and blocks all later inventory', async t => {
  const events = [];
  const f = await fixture(t, {
    players: [player(), { ...player(), id: 'second' }],
    onInventoryChange: inventory => events.push({ type: 'inventory', inventory }),
    onFinish: results => events.push({ type: 'finish', results }),
  });
  await f.frame(100);
  const race = f.race();
  race.countdown = 0;
  race.elapsed = 25.99;
  race.firstFinish = 1;
  race.karts[0].finishTime = 1;
  race.karts[1].power.item = 'guard';
  assert.equal(race.complete, false);
  // Physics ends the grace period in this frame, while an inventory change is due.
  await f.frame(600);
  assert.equal(race.complete, true);
  assert.deepEqual(events.map(event => event.type), ['inventory', 'finish']);
  await f.frame(2600); await f.frame(10000);
  assert.deepEqual(events.map(event => event.type), ['inventory', 'finish']);
});


function findNodes(node, predicate) {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(child => findNodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...findNodes(node.props?.children, predicate)];
}
test('berry blot affects only the targeted viewport and expires with its timer', async t => {
  const players = [player(), { ...player(), id: 'other', name: 'Other' }];
  const f = await fixture(t, { players });
  await f.frame(100); const race = f.race(); race.countdown = 0;
  race.karts[1].power.splatter = 1;
  await f.frame(200);
  let sections = findNodes(f.tree(), node => node.type === 'section');
  assert.equal(findNodes(sections[0], node => node.props?.['aria-label'] === 'Berry blot on this view').length, 0);
  assert.equal(findNodes(sections[1], node => node.props?.['aria-label'] === 'Berry blot on this view').length, 1);
  race.karts[1].power.splatter = 0; await f.frame(300);
  sections = findNodes(f.tree(), node => node.type === 'section');
  assert.equal(findNodes(sections[1], node => node.props?.['aria-label'] === 'Berry blot on this view').length, 0);
});
test('keyboard Shift charges drift, releasing boosts, and blur cancels without boost', async t => {
  const f = await fixture(t); await f.frame(100); const race = f.race(), kart = race.karts[0];
  race.countdown = 0; kart.speed = 25;
  f.key('KeyW'); f.key('KeyD'); f.key('ShiftLeft');
  for (let now = 117; now <= 900; now += 17) await f.frame(now);
  assert.ok(kart.drifting && kart.driftCharge >= 0.6);
  f.key('ShiftLeft', 'keyup'); await f.frame(917);
  assert.ok(kart.boost > 0); assert.equal(kart.drifting, false);
  kart.boost = 0; f.key('ShiftLeft');
  for (let now = 934; now <= 1700; now += 17) await f.frame(now);
  assert.ok(kart.driftCharge >= 0.6);
  f.blur(); await f.frame(1717);
  assert.equal(kart.drifting, false); assert.equal(kart.boost, 0);
});

test('ten racers have distinct 4-by-3 HUD views and retain full names', async t => {
  const players = Array.from({ length: 10 }, (_, i) => ({
    ...player(), id: `driver-${i}`, name: `Driver ${i + 1} with a long name 🏎️`,
  }));
  const f = await fixture(t, { players, localKeyboard: false });
  const tree = f.tree();
  assert.equal(tree.props.style['--game-columns'], 4);
  assert.equal(tree.props.style['--game-rows'], 3);
  const findSections = node => {
    if (!node) return [];
    if (Array.isArray(node)) return node.flatMap(findSections);
    return [...(node.type === 'section' ? [node] : []), ...findSections(node.props?.children)];
  };
  const sections = findSections(tree);
  assert.equal(sections.length, 10);
  assert.deepEqual(sections.map(section => section.props['aria-label']), players.map(p => `${p.name}'s racing view`));
  const labels = sections.map(section => findNodes(section, node => node.type === 'strong' && node.props?.title)[0]);
  assert.deepEqual(labels.map(label => label.props['aria-label']), players.map(p => p.name));
  assert.deepEqual(labels.map(label => label.props.children), players.map(p => p.name));
  await f.frame(100);
  assert.equal(f.race().karts.length, 10);
  assert.equal(f.renderers[0].calls.at(-1).race.karts.length, 10);
});


test('small compact race views bound name height, while larger views can show full names', () => {
  const css = readFileSync(resolve(directory, 'game.module.css'), 'utf8');
  assert.match(css, /\.compact \.viewport\s*\{[^}]*container-type:\s*inline-size/);
  assert.match(css, /\.compact \.name strong\s*\{[^}]*-webkit-line-clamp:\s*2;[^}]*overflow:\s*hidden/);
  assert.match(css, /@container\s*\(min-width:\s*361px\)\s*\{\s*\.compact \.name strong\s*\{[^}]*-webkit-line-clamp:\s*unset;[^}]*overflow:\s*visible/);
  assert.match(css, /\.resultName\s*\{[^}]*white-space:\s*normal;[^}]*overflow:\s*visible/);
});


test('one shared shortcut map is shown for every player count', async t => {
  for (let count = 1; count <= 10; count++) await t.test(`${count} racers`, async t => {
    const players = Array.from({ length: count }, (_, i) => ({ ...player(), id: `map-${i}` }));
    const f = await fixture(t, { players, localKeyboard: false }); await f.frame(100);
    const maps = findNodes(f.tree(), node => node.type === 'svg' && node.props?.['aria-label'] === 'Live circuit map');
    assert.equal(maps.length, 1);
    assert.equal(findNodes(maps[0], node => node.type === 'circle').length, count);
    assert.equal(findNodes(maps[0], node => node.type === 'path' && node.props?.['aria-label'] === 'Shortcut').length, 1);
  });
});
test('shortcut map uses each course branch and places a branch kart on the physical route', async t => {
  for (const trackId of ['sunset', 'canyon', 'brewery']) await t.test(trackId, async t => {
    const f = await fixture(t, { players: [player()], trackId }); await f.frame(100);
    const track = f.track(), race = f.race(), kart = race.karts[0]; race.countdown = 0;
    kart.distance = (track.ACTIVE_SHORTCUT.start + track.ACTIVE_SHORTCUT.end) / 2 * track.TRACK_LENGTH;
    kart.onShortcut = true;
    await f.frame(200);
    const map = findNodes(f.tree(), node => node.type === 'svg' && node.props?.['aria-label'] === 'Live circuit map')[0];
    const branch = findNodes(map, node => node.type === 'path' && node.props?.['aria-label'] === 'Shortcut')[0];
    const expectedPath = track.sampleShortcut(track.ACTIVE_TRACK).filter((_, i) => i % 4 === 0).map((point, i) => `${i ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.z.toFixed(1)}`).join(' ');
    assert.equal(branch.props.d, expectedPath);
    const dot = findNodes(map, node => node.type === 'circle')[0], expected = track.shortcutPose(kart.distance, kart.lane).position;
    assert.ok(Math.abs(dot.props.cx - expected[0]) < 1e-8); assert.ok(Math.abs(dot.props.cy - expected[2]) < 1e-8);
    const main = track.trackPose(kart.distance, kart.lane).position;
    assert.ok(Math.hypot(dot.props.cx - main[0], dot.props.cy - main[2]) > 1);
  });
});
