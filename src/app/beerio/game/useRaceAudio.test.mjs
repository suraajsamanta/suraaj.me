import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('./useRaceAudio.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const eventTarget = () => {
  const listeners = new Map();
  return {
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    dispatch(name) { for (const callback of listeners.get(name) ?? []) callback(); },
    listenerCount() { return [...listeners.values()].reduce((count, set) => count + set.size, 0); },
  };
};
const audioContext = state => ({ ...eventTarget(), state, setState(state) { this.state = state; this.dispatch('statechange'); } });
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const nodes = node => !node ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
async function fixture(t, options = {}) {
  const prior = { window: globalThis.window, document: globalThis.document };
  let stored = options.muted ? 'true' : null;
  globalThis.window = { ...eventTarget(), localStorage: { getItem: () => stored, setItem(_key, value) { stored = value; } } };
  globalThis.document = { ...eventTarget(), hidden: false };
  let currentContext = options.context === undefined ? audioContext('running') : options.context;
  let unlock = options.unlock ?? (() => Promise.resolve(currentContext?.state === 'running'));
  const state = [], dependencies = [], cleanups = [], mixes = [];
  let slot = 0, dirty = false, pending = [], props = {}, result;
  const changed = (index, values) => !dependencies[index] || !values || values.some((value, item) => !Object.is(value, dependencies[index][item]));
  const hooks = {
    useRef(value) { const index = slot++; if (!(index in state)) state[index] = { current: value }; return state[index]; },
    useState(value) { const index = slot++; if (!(index in state)) state[index] = value; return [state[index], next => { if (state[index] !== next) { state[index] = next; dirty = true; } }]; },
    useCallback(callback, values) { const index = slot++; if (changed(index, values)) { dependencies[index] = values; state[index] = callback; } return state[index]; },
    useEffect(effect, values) { const index = slot++; if (changed(index, values)) { dependencies[index] = values; pending.push(() => { cleanups[index]?.(); cleanups[index] = effect(); }); } },
  };
  class RecordingAudio {
    muted = false; paused = false; disposed = false; retries = 0;
    constructor(context, options) { this.context = context; this.options = options; mixes.push(this); options.onMusicStatus('ready'); }
    setMuted(value) { this.muted = value; }
    setPaused(value) { this.paused = value; }
    dispose() { this.disposed = true; }
    retryMusic() { this.retries++; }
    update() {}
  }
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name.endsWith('.css')) return { default: {} };
    if (name === './audio') return { RaceAudio: RecordingAudio, getRaceAudioContext: () => currentContext, unlockRaceAudio: () => unlock() };
    throw new Error(`Unknown module ${name}`);
  }, compiledModule, compiledModule.exports);
  const render = async patch => {
    props = { ...props, ...patch };
    for (let iteration = 0; iteration < 20; iteration++) {
      slot = 0; dirty = false; result = compiledModule.exports.useRaceAudio(props);
      const work = pending; pending = []; work.forEach(effect => effect());
      for (let i = 0; i < 12; i++) await Promise.resolve();
      if (!dirty) return;
    }
    throw new Error('Hook did not settle');
  };
  const unmount = () => { cleanups.forEach(cleanup => cleanup?.()); cleanups.length = 0; };
  t.after(() => { unmount(); Object.assign(globalThis, prior); });
  await render();
  return {
    render, mixes, unmount, context: () => currentContext, setContext(value) { currentContext = value; }, setUnlock(value) { unlock = value; },
    label: () => nodes(result.soundControls).find(node => node.type === 'span')?.props.children,
    buttons: () => nodes(result.soundControls).filter(node => node.type === 'button'),
    async click() { nodes(result.soundControls).find(node => node.type === 'button').props.onClick(); await render(); },
    async gesture() { window.dispatch('pointerdown'); await render(); },
    async visibility(hidden) { document.hidden = hidden; document.dispatch('visibilitychange'); await render(); },
  };
}

test('a context finishing its delayed first unlock creates the missing graph exactly once', async t => {
  const context = audioContext('suspended'), f = await fixture(t, { context });
  assert.equal(f.mixes.length, 0);
  context.setState('running'); await f.render();
  assert.equal(f.mixes.length, 1); assert.equal(f.label(), 'SOUND ON');
  await f.gesture(); assert.equal(f.mixes.length, 1);
});

test('late-created and replaced contexts bind listeners and old graphs are disposed', async t => {
  const f = await fixture(t, { context: null }); assert.equal(f.label(), 'ENABLE SOUND');
  const first = audioContext('running'); f.setContext(first); await f.gesture();
  assert.equal(f.mixes.length, 1); assert.equal(first.listenerCount(), 1);
  first.setState('closed'); await f.render(); assert.equal(f.mixes[0].disposed, true);
  const second = audioContext('running'); f.setContext(second); await f.gesture();
  assert.equal(f.mixes.length, 2); assert.equal(first.listenerCount(), 0); assert.equal(second.listenerCount(), 1);
  f.unmount(); assert.equal(second.listenerCount(), 0); assert.equal(f.mixes[1].disposed, true);
});

test('interruption never falsely shows sound on, and gesture recovery reuses one graph', async t => {
  const f = await fixture(t); const context = f.context();
  context.setState('interrupted'); await f.render();
  assert.equal(f.label(), 'RESUME SOUND'); assert.equal(f.mixes[0].paused, true);
  await f.click(); assert.equal(f.label(), 'RESUME SOUND', 'Rejected resume is not overwritten with SOUND ON');
  f.setUnlock(async () => { context.setState('running'); return true; }); await f.click();
  assert.equal(f.label(), 'SOUND ON'); assert.equal(f.mixes.length, 1); assert.equal(f.mixes[0].paused, false);
});

test('visibility/pageshow preserve mute and room pause, and never force an unlock while muted', async t => {
  const f = await fixture(t); await f.render({ paused: true });
  await f.visibility(true); await f.visibility(false);
  assert.equal(f.mixes[0].paused, true);
  await f.render({ paused: false }); await f.click(); assert.equal(f.label(), 'SOUND OFF');
  let calls = 0; f.setUnlock(async () => { calls++; return false; }); f.context().setState('suspended');
  await f.visibility(true); await f.visibility(false); window.dispatch('pageshow'); await f.render(); await f.gesture();
  assert.equal(calls, 0); assert.equal(f.mixes[0].muted, true); assert.equal(f.label(), 'SOUND OFF');
});

test('fresh gestures retry resume but resolving after unmount cannot create a graph', async t => {
  const delayed = deferred(), f = await fixture(t, { context: audioContext('suspended') });
  let calls = 0; f.setUnlock(() => { calls++; return delayed.promise; });
  await f.gesture(); await f.gesture(); await f.click(); assert.equal(calls, 3);
  f.unmount(); f.context().setState('running'); delayed.resolve(true); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.mixes.length, 0);
});

test('music load failure is disclosed without disabling effects and retry is available', async t => {
  const f = await fixture(t);
  f.mixes[0].options.onMusicStatus('unavailable'); await f.render();
  assert.equal(f.label(), 'EFFECTS ON'); assert.equal(f.buttons().length, 2);
  f.buttons()[1].props.onClick(); assert.equal(f.mixes[0].retries, 1);
  f.mixes[0].options.onMusicStatus('ready'); await f.render();
  assert.equal(f.label(), 'SOUND ON'); assert.equal(f.buttons().length, 1);
});


test('pending automatic resume cannot swallow a real gesture or overwrite its successful status', async t => {
  const f = await fixture(t), context = f.context(), automatic = deferred();
  context.setState('suspended'); await f.render();
  let calls = 0;
  f.setUnlock(() => { calls++; return automatic.promise; });
  await f.visibility(true); await f.visibility(false);
  assert.equal(calls, 1); assert.equal(f.label(), 'RESUME SOUND');
  f.setUnlock(async () => { calls++; context.setState('running'); return true; });
  await f.gesture();
  assert.equal(calls, 2, 'A user gesture issues resume even while an automatic attempt is unresolved');
  assert.equal(f.label(), 'SOUND ON'); assert.equal(f.mixes.length, 1);
  automatic.resolve(false); await f.render();
  assert.equal(f.label(), 'SOUND ON', 'A stale unsuccessful attempt cannot undo recovery');
});

test('several pending gestures still create only one graph on the latest successful attempt', async t => {
  const context = audioContext('suspended'), f = await fixture(t, { context });
  const attempts = [];
  f.setUnlock(() => { const attempt = deferred(); attempts.push(attempt); return attempt.promise; });
  await f.gesture(); await f.gesture(); await f.click();
  context.setState('running'); attempts.at(-1).resolve(true); await f.render();
  assert.equal(f.mixes.length, 1); assert.equal(f.label(), 'SOUND ON');
  attempts[0].resolve(false); attempts[1].resolve(true); await f.render();
  assert.equal(f.mixes.length, 1); assert.equal(f.label(), 'SOUND ON');
});
