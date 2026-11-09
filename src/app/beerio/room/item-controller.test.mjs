import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { RoomService, SELECTION_COUNTDOWN_MS } from '../../../../beerio-server/core.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const modules = new Map();
function loadTypeScript(file) {
  file = resolve(file);
  if (modules.has(file)) return modules.get(file);
  const loadedModule = { exports: {} };
  modules.set(file, loadedModule.exports);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const localRequire = name => {
    assert.ok(name.startsWith('.'), `Unexpected dependency: ${name}`);
    return loadTypeScript(resolve(dirname(file), `${name}.ts`));
  };
  new Function('require', 'module', 'exports', source)(localRequire, loadedModule, loadedModule.exports);
  modules.set(file, loadedModule.exports);
  return loadedModule.exports;
}
const { BeerioRoomClient } = loadTypeScript(resolve(root, 'src/app/beerio/room/client.ts'));
const { createRace, stepRace } = loadTypeScript(resolve(root, 'src/app/beerio/game/simulation.ts'));
const { mergeControllerAction } = loadTypeScript(resolve(root, 'src/app/beerio/game/actionMerge.ts'));

// Execute the real JSX handlers with lightweight hooks. This deliberately models
// a browser that sends non-primary pointer events without a compatibility click.
// It does not claim to emulate React DOM, physical touch, or a browser's layout.
function controllerButtons(props, effects) {
  const file = process.env.BEERIO_CONTROLLER_SOURCE || resolve(root, 'src/app/beerio/Beerio.tsx');
  const fullSource = readFileSync(file, 'utf8');
  const start = fullSource.indexOf('type Input =');
  const end = fullSource.indexOf('export default function Beerio');
  assert.ok(start >= 0 && end > start, 'Controller source boundaries must remain identifiable');
  const source = ts.transpileModule(
    'const { useRef, useState, useCallback, useEffect } = require("react");\n' +
    'const styles = new Proxy({}, { get: (_, name) => name });\n' +
    'const SteeringJoystick = require("./SteeringJoystick").default;\n' +
    fullSource.slice(start, end) + '\nexport { Controller };',
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText;
  const react = {
    useCallback: callback => callback,
    useEffect: effect => effects.push(effect()),
    useRef: current => ({ current }),
    useState: initial => [initial, () => {}],
  };
  const jsx = (type, props) => ({ type, props });
  const joystickSource = ts.transpileModule(readFileSync(resolve(root, 'src/app/beerio/game/SteeringJoystick.tsx'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const joystickModule = { exports: {} };
  new Function('require', 'module', 'exports', joystickSource)(name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    throw new Error(`Unexpected joystick dependency: ${name}`);
  }, joystickModule, joystickModule.exports);
  const loadedModule = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === './SteeringJoystick') return joystickModule.exports;
    throw new Error(`Unexpected Controller dependency: ${name}`);
  }, loadedModule, loadedModule.exports);
  const buttons = new Map();
  const visit = node => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node.type === 'function') return visit(node.type(node.props));
    if (node.type === 'button' || node.props?.role === 'slider') buttons.set(node.props['aria-label'], node.props);
    visit(node.props?.children);
  };
  visit(loadedModule.exports.Controller(props));
  return buttons;
}

function pointer(pointerId, { isPrimary = false, pointerType = 'touch', button = 0, detail = 1, timeStamp = 1000 } = {}) {
  return {
    pointerId, isPrimary, pointerType, button, detail, timeStamp, clientX: 244,
    nativeEvent: { pointerId, isPrimary, pointerType, button, detail },
    preventDefault() { this.defaultPrevented = true; },
    currentTarget: { setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => true, getBoundingClientRect: () => ({ left: 10, width: 268 }) },
  };
}

async function fixture(t) {
  const prior = {
    WebSocket: globalThis.WebSocket, window: globalThis.window,
    document: globalThis.document, sessionStorage: globalThis.sessionStorage,
  };
  const effects = [];
  const handlers = new Map();
  const addHandler = (name, callback) => { const previous = handlers.get(name); handlers.set(name, () => { previous?.(); callback(); }); };
  const hostMessages = [];
  let now = Date.now();
  const service = new RoomService({ now: () => now });
  const host = { send: message => hostMessages.push(structuredClone(message)), close() {} };
  service.connect(host);
  service.receive(host, { type: 'create', maxPlayers: 6, characterSelectionVersion: 1 });
  const code = hostMessages.find(message => message.type === 'welcome').room.code;
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.document = {
    hidden: false, addEventListener: (name, callback) => addHandler(`document:${name}`, callback), removeEventListener() {},
  };
  globalThis.window = {
    location: { protocol: 'https:', hostname: 'beerio.example' },
    setInterval: () => 1, clearInterval() {},
    addEventListener: (name, callback) => addHandler(name, callback), removeEventListener() {},
  };
  // An in-memory wire exercises production serialization and relay validation.
  // Actual network sockets and reconnect timing are tested in item-pipeline.test.mjs.
  class WireSocket {
    static OPEN = 1;
    readyState = 0;
    bufferedAmount = 0;
    constructor() {
      this.peer = { send: message => this.onmessage?.({ data: JSON.stringify(message) }), close: () => this.close() };
      service.connect(this.peer);
      queueMicrotask(() => { this.readyState = 1; this.onopen?.(); });
    }
    send(raw) { service.receive(this.peer, JSON.parse(raw)); }
    close() {
      if (this.readyState === 3) return;
      this.readyState = 3;
      service.disconnect(this.peer);
      this.onclose?.();
    }
  }
  globalThis.WebSocket = WireSocket;
  const client = new BeerioRoomClient();
  t.after(() => {
    for (const cleanup of effects) cleanup?.();
    client.destroy();
    Object.assign(globalThis, prior);
  });
  client.joinRoom({ code, name: 'Controller test', relayUrl: 'wss://beerio.example' });
  await new Promise(resolve => setImmediate(resolve));
  const id = client.getSnapshot().playerId;
  assert.ok(id);
  assert.equal(client.getSnapshot().characterSelection, true);
  service.receive(host, { type: 'select_characters' });
  client.chooseCharacter({ confirm: true });
  assert.equal(client.getSnapshot().selectionPhase, 'countdown');
  assert.equal(client.getSnapshot().locked, false);
  now += SELECTION_COUNTDOWN_MS;
  service.sweep();
  assert.equal(client.getSnapshot().selectionPhase, 'racing');
  assert.equal(client.getSnapshot().locked, true);
  assert.equal(client.getSnapshot().players.find(player => player.id === id)?.inRace, true);
  const player = { id, name: 'Controller test', color: '#ffffff', input: { steer: 0, accelerate: false, brake: false } };
  const race = createRace([player]);
  race.countdown = 0;
  race.karts[0].distance = 20;
  let action = { lastControllerAction: 0, localAction: 0 };
  let taps = 0;
  let controllerInput = null;
  const buttons = controllerButtons({
    send: input => { controllerInput = input; client.setInput(input); },
    useItem: () => { taps++; return client.useItem(); },
  }, effects);
  const step = () => {
    const message = hostMessages.filter(message => message.type === 'input' && message.playerId === id).at(-1);
    if (message) {
      action = mergeControllerAction(action.lastControllerAction, action.localAction, message.input.action);
      player.input = { ...message.input, action: action.localAction };
    }
    stepRace(race, [player], 1 / 60);
    return message?.input;
  };
  return { buttons, handlers, step, player, kart: race.karts[0], taps: () => taps, input: () => controllerInput };
}

test('third-finger item press reaches the race while GO and steering stay held', async t => {
  const f = await fixture(t);
  const go = f.buttons.get('Accelerate'), right = f.buttons.get('Steering joystick'), item = f.buttons.get('Use item');
  go.onPointerDown(pointer(1, { isPrimary: true }));
  right.onPointerDown(pointer(2));
  f.kart.power.item = 'guard';
  item.onPointerDown?.(pointer(3));
  const input = f.step();
  assert.equal(f.taps(), 1, 'Non-primary pointerdown must work without a synthesized click');
  assert.deepEqual(input, { steer: 1, accelerate: true, brake: false, drift: false, action: 1 });
  assert.equal(f.kart.power.used, 1);
  assert.equal(f.kart.power.item, null);

  f.kart.power.item = 'fizz';
  item.onPointerUp?.(pointer(3));
  item.onClick?.(pointer(3));
  item.onClick?.(pointer(3, { detail: 0 }));
  f.step();
  assert.equal(f.taps(), 1, 'Pointer compatibility clicks, including detail zero, must not fire twice');
  assert.equal(f.kart.power.item, 'fizz');
  item.onPointerDown?.(pointer(4));
  f.step();
  assert.equal(f.kart.power.used, 2);
  assert.equal(f.player.input.accelerate, true);
  assert.equal(f.player.input.steer, 1);
  item.onPointerCancel?.(pointer(4));
  item.onLostPointerCapture?.(pointer(4));
  f.step();
  assert.equal(f.player.input.accelerate, true, 'Cancelling the item pointer must not release GO');
  assert.equal(f.player.input.steer, 1, 'Losing item capture must not release steering');

  right.onPointerUp(pointer(2));
  go.onPointerUp(pointer(1, { isPrimary: true }));
  f.step();
  assert.equal(f.player.input.accelerate, false);
  assert.equal(f.player.input.steer, 0);
  assert.equal(f.kart.power.used, 2);
});

test('item mouse, keyboard and assistive activation stay single-shot', async t => {
  const f = await fixture(t), item = f.buttons.get('Use item');
  f.kart.power.item = 'guard';
  item.onPointerDown?.(pointer(1, { pointerType: 'mouse', isPrimary: true, button: 2 }));
  item.onPointerDown?.(pointer(1, { pointerType: 'mouse', isPrimary: true, button: 1 }));
  assert.equal(f.taps(), 0, 'Right and middle clicks must not consume items');
  item.onPointerDown?.(pointer(1, { pointerType: 'mouse', isPrimary: true }));
  item.onClick?.(pointer(1, { pointerType: 'mouse', isPrimary: true }));
  f.step();
  assert.equal(f.taps(), 1);
  assert.equal(f.kart.power.used, 1);
  f.kart.power.item = 'slick';
  item.onClick?.({ detail: 0, nativeEvent: {} });
  f.step();
  assert.equal(f.taps(), 2, 'Keyboard and assistive click-only activation must stay usable');
  assert.equal(f.kart.power.used, 2);
});

test('double-tap GO fires once on the second press and keeps driving while held', async t => {
  const f = await fixture(t), go = f.buttons.get('Accelerate'), stick = f.buttons.get('Steering joystick');
  stick.onPointerDown(pointer(1));
  f.kart.power.item = 'guard';
  go.onPointerDown(pointer(2, { timeStamp: 1000 }));
  assert.equal(f.input().accelerate, true, 'the first press accelerates without a gesture delay');
  go.onPointerUp(pointer(2, { timeStamp: 1080 }));
  go.onLostPointerCapture(pointer(2, { timeStamp: 1080 }));
  assert.equal(f.input().accelerate, false);
  go.onPointerDown(pointer(3, { timeStamp: 1220 }));
  const input = f.step();
  assert.equal(f.taps(), 1);
  assert.equal(input.accelerate, true);
  assert.equal(input.steer, 1);
  assert.equal(f.kart.power.used, 1);
  assert.equal(f.kart.power.item, null);
  assert.equal(f.step().accelerate, true, 'holding the second press keeps accelerating');
  go.onClick?.(pointer(3, { timeStamp: 1220, detail: 2 }));
  go.onPointerUp(pointer(3, { timeStamp: 1280 }));
  f.kart.power.item = 'fizz';
  go.onPointerDown(pointer(4, { timeStamp: 1320 }));
  f.step();
  assert.equal(f.taps(), 1, 'a third tap is not a second overlapping double-tap');
  assert.equal(f.kart.power.item, 'fizz');
  go.onPointerUp(pointer(4, { timeStamp: 1360 }));
  go.onPointerDown(pointer(5, { timeStamp: 1450 }));
  f.step();
  assert.equal(f.taps(), 2, 'a deliberate new tap pair can use the next item');
  assert.equal(f.kart.power.item, null);
});

test('slow taps, long holds, non-primary buttons and simultaneous GO touches do not fire items', async t => {
  const f = await fixture(t), go = f.buttons.get('Accelerate');
  go.onPointerDown(pointer(1, { timeStamp: 1000 }));
  go.onPointerUp(pointer(1, { timeStamp: 1350 }));
  go.onPointerDown(pointer(2, { timeStamp: 1450 }));
  assert.equal(f.taps(), 0, 'a long hold is not the first tap');
  go.onPointerUp(pointer(2, { timeStamp: 1500 }));
  go.onPointerDown(pointer(3, { timeStamp: 1900 }));
  assert.equal(f.taps(), 0, 'taps outside the window do not fire');
  go.onPointerDown(pointer(4, { timeStamp: 1950 }));
  go.onPointerUp(pointer(4, { timeStamp: 1980 }));
  assert.equal(f.input().accelerate, true, 'another GO touch cannot release the owning finger');
  assert.equal(f.taps(), 0, 'two fingers at once are not a double-tap');
  go.onPointerCancel(pointer(3, { timeStamp: 2000 }));
  for (const button of [1, 2]) {
    go.onPointerDown(pointer(5, { pointerType: 'mouse', button, timeStamp: 2100 }));
    go.onPointerUp(pointer(5, { pointerType: 'mouse', button, timeStamp: 2150 }));
  }
  go.onPointerDown(pointer(6, { timeStamp: 2200 }));
  assert.equal(f.taps(), 0, 'middle and right clicks cannot arm the shortcut');
});

test('cancelled GO touches and lifecycle interruptions discard the pending double-tap', async t => {
  const f = await fixture(t), go = f.buttons.get('Accelerate');
  for (const event of ['onPointerCancel', 'onLostPointerCapture']) {
    go.onPointerDown(pointer(1, { timeStamp: 1000 }));
    go[event](pointer(1, { timeStamp: 1050 }));
    go.onPointerDown(pointer(2, { timeStamp: 1100 }));
    assert.equal(f.taps(), 0, `${event}: a cancelled touch cannot arm an item`);
    go.onPointerCancel(pointer(2, { timeStamp: 1150 }));
  }
  for (const event of ['blur', 'pagehide', 'orientationchange', 'document:visibilitychange']) {
    go.onPointerDown(pointer(1, { timeStamp: 2000 }));
    go.onPointerUp(pointer(1, { timeStamp: 2050 }));
    f.handlers.get(event)();
    go.onPointerDown(pointer(2, { timeStamp: 2100 }));
    assert.equal(f.taps(), 0, `${event}: stale tap memory must not fire an item`);
    go.onPointerCancel(pointer(2, { timeStamp: 2150 }));
  }
});

test('keyboard GO supports a deliberate double-tap without repeat or blur retriggers', async t => {
  const f = await fixture(t), go = f.buttons.get('Accelerate');
  const key = (timeStamp, repeat = false) => ({ key: ' ', timeStamp, repeat, preventDefault() {} });
  f.kart.power.item = 'guard';
  go.onKeyDown(key(1000)); go.onKeyDown(key(1040, true)); go.onKeyUp(key(1080));
  go.onKeyDown(key(1200));
  assert.equal(f.taps(), 1);
  assert.equal(f.step().accelerate, true);
  assert.equal(f.kart.power.used, 1);
  go.onKeyDown(key(1250, true)); go.onKeyUp(key(1280));
  assert.equal(f.taps(), 1);
  go.onKeyDown(key(2000)); go.onKeyUp(key(2050)); go.onBlur(); go.onKeyDown(key(2100));
  assert.equal(f.taps(), 1, 'leaving the GO button cancels its tap memory');
});


test('four independent touches drive, drift and use an item; cancellation disarms drift', async t => {
  const f = await fixture(t);
  const go = f.buttons.get('Accelerate'), stick = f.buttons.get('Steering joystick');
  const drift = f.buttons.get('Drift'), item = f.buttons.get('Use item');
  go.onPointerDown(pointer(1)); stick.onPointerDown(pointer(2)); drift.onPointerDown(pointer(3));
  f.kart.speed = 20;
  for (let i = 0; i < 80; i++) f.step();
  assert.ok(f.kart.driftCharge >= 0.6);
  f.kart.power.item = 'guard'; item.onPointerDown(pointer(4));
  let input = f.step();
  assert.equal(input.drift, true); assert.equal(input.accelerate, true); assert.equal(input.steer, 1);
  assert.equal(f.kart.power.used, 1);
  drift.onPointerCancel(pointer(3)); input = f.step();
  assert.equal(input.drift, undefined); assert.equal(input.accelerate, true); assert.equal(input.steer, 1);
  assert.equal(f.kart.driftCharge, 0); assert.equal(f.kart.boost, 0);
});

test('releasing a charged drift sends a boost while GO and steering stay held', async t => {
  const f = await fixture(t);
  const go = f.buttons.get('Accelerate'), stick = f.buttons.get('Steering joystick'), drift = f.buttons.get('Drift');
  go.onPointerDown(pointer(1)); stick.onPointerDown(pointer(2)); drift.onPointerDown(pointer(3));
  f.kart.speed = 20;
  for (let i = 0; i < 80; i++) f.step();
  assert.ok(f.kart.driftCharge >= 0.6);
  f.kart.boost = 0;
  drift.onPointerUp(pointer(3));
  const input = f.step();
  assert.equal(input.drift, false); assert.equal(input.accelerate, true); assert.equal(input.steer, 1);
  assert.ok(f.kart.boost > 0, 'explicit drift release awards a usable boost');
});

test('cancel remains disarmed when later control updates coalesce before a host frame', async t => {
  const f = await fixture(t);
  const go = f.buttons.get('Accelerate'), stick = f.buttons.get('Steering joystick'), drift = f.buttons.get('Drift');
  go.onPointerDown(pointer(1)); stick.onPointerDown(pointer(2)); drift.onPointerDown(pointer(3));
  f.kart.speed = 20;
  for (let i = 0; i < 80; i++) f.step();
  assert.ok(f.kart.driftCharge >= 0.6); f.kart.boost = 0;
  drift.onPointerCancel(pointer(3));
  // A steering update after cancellation but before host simulation must not
  // turn the cancellation into an intentional release.
  await new Promise(resolve => setTimeout(resolve, 40));
  stick.onPointerMove(pointer(2));
  const input = f.step();
  assert.equal(input.drift, undefined); assert.equal(f.kart.boost, 0); assert.equal(f.kart.driftCharge, 0);
  drift.onPointerDown(pointer(4));
  assert.equal(f.step().drift, true, 'a fresh press re-arms drift');
});


test('keyboard auto-repeat cannot rearm driving or drift after a safety reset', async t => {
  const f = await fixture(t);
  const go = f.buttons.get('Accelerate'), drift = f.buttons.get('Drift');
  const key = (repeat = false) => ({ key: ' ', repeat, preventDefault() {} });
  for (const event of ['blur', 'pagehide', 'orientationchange', 'document:visibilitychange']) {
    go.onKeyDown(key()); drift.onKeyDown(key());
    f.kart.drifting = true; f.kart.driftCharge = 1.5; f.kart.boost = 0;
    f.handlers.get(event)();
    await new Promise(resolve => setTimeout(resolve, 40));
    go.onKeyDown(key(true)); drift.onKeyDown(key(true));
    const input = f.step();
    assert.equal(input.accelerate, false, `${event}: held key repeat must not restart acceleration`);
    assert.equal(input.drift, undefined, `${event}: held key repeat must not rearm cancelled drift`);
    assert.equal(f.kart.driftCharge, 0); assert.equal(f.kart.boost, 0);
    go.onKeyUp(key()); drift.onKeyUp(key());
    go.onKeyDown(key()); drift.onKeyDown(key());
    assert.equal(f.step().drift, true, 'A deliberate fresh keydown re-arms the control');
  }
});
