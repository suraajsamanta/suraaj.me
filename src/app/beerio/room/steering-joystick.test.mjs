import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Exercise the actual JSX pointer and keyboard handlers without pretending this
// is a substitute for a physical multi-touch browser test.
function mount(t) {
  const old = { window: globalThis.window, document: globalThis.document };
  const handlers = new Map(), values = [], cleanups = [];
  const target = {
    captures: [], getBoundingClientRect: () => ({ left: 10, width: 268 }),
    setPointerCapture(id) { this.captures.push(id); },
  };
  globalThis.window = {
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener() {},
  };
  globalThis.document = {
    addEventListener: (name, fn) => handlers.set(`document:${name}`, fn),
    removeEventListener() {},
  };
  const react = {
    useRef: current => ({ current }), useState: initial => [initial, () => {}],
    useEffect: effect => cleanups.push(effect()),
  };
  const source = ts.transpileModule(readFileSync(new URL('../game/SteeringJoystick.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  new Function('require', 'module', 'exports', source)(name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    throw new Error(`Unexpected dependency: ${name}`);
  }, mod, mod.exports);
  const node = mod.exports.default({ onSteer: value => values.push(value) });
  const event = (pointerId, clientX, extra = {}) => ({ pointerId, clientX, button: 0, currentTarget: target, preventDefault() {}, ...extra });
  t.after(() => { cleanups.forEach(cleanup => cleanup?.()); Object.assign(globalThis, old); });
  return { p: node.props, target, values, event, handlers, cleanup: () => cleanups.find(fn => typeof fn === "function")() };
}

test('analog stick clamps, has a dead zone, tracks only its owning touch, and springs back', t => {
  const f = mount(t);
  f.p.onPointerDown(f.event(2, 144, { isPrimary: false }));
  assert.equal(f.values.at(-1), 0, 'center is neutral');
  assert.deepEqual(f.target.captures, [2]);
  f.p.onPointerMove(f.event(2, 151));
  assert.equal(f.values.at(-1), 0, 'tiny motion stays neutral');
  f.p.onPointerMove(f.event(2, 198));
  assert.ok(f.values.at(-1) > 0.4 && f.values.at(-1) < 0.6, 'half travel gives analog steering');
  f.p.onPointerDown(f.event(3, 244));
  f.p.onPointerMove(f.event(3, 44));
  assert.ok(f.values.at(-1) > 0, 'another touch cannot take or move the stick');
  f.p.onPointerMove(f.event(2, 1000));
  assert.equal(f.values.at(-1), 1);
  f.p.onPointerMove(f.event(2, -1000));
  assert.equal(f.values.at(-1), -1);
  f.p.onPointerUp(f.event(3, 244));
  assert.equal(f.values.at(-1), -1, 'another finger lifting does not release');
  f.p.onPointerUp(f.event(2, 44));
  assert.equal(f.values.at(-1), 0);
  f.p.onPointerMove(f.event(2, 244));
  assert.equal(f.values.at(-1), 0, 'late events cannot reactivate');
});

test('cancel, lost capture, window lifecycle, and unmount all neutralize', t => {
  const f = mount(t);
  for (const stop of [
    () => f.p.onPointerCancel(f.event(1, 244)),
    () => f.p.onLostPointerCapture(f.event(1, 244)),
    () => f.handlers.get('blur')(),
    () => f.handlers.get('pagehide')(),
    () => f.handlers.get('orientationchange')(),
    () => f.handlers.get('document:visibilitychange')(),
    () => f.cleanup(),
  ]) {
    f.p.onPointerDown(f.event(1, 244));
    assert.equal(f.values.at(-1), 1);
    stop();
    assert.equal(f.values.at(-1), 0);
    f.p.onPointerMove(f.event(1, 244));
    assert.equal(f.values.at(-1), 0);
  }
});

test('keyboard arrows spring to center and blur releases them', t => {
  const f = mount(t), key = key => ({ key, preventDefault() {} });
  f.p.onKeyDown(key('ArrowLeft')); assert.equal(f.values.at(-1), -1);
  f.p.onKeyDown(key('ArrowRight')); assert.equal(f.values.at(-1), 0);
  f.p.onKeyUp(key('ArrowLeft')); assert.equal(f.values.at(-1), 1);
  f.p.onBlur(); assert.equal(f.values.at(-1), 0);
  assert.equal(f.p.role, 'slider');
  assert.equal(f.p['aria-label'], 'Steering joystick');
});
