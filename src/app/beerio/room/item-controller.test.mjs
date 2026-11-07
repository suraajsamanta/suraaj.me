import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { RoomService } from '../../../../beerio-server/core.mjs';

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

function pointer(pointerId, { isPrimary = false, pointerType = 'touch', button = 0, detail = 1 } = {}) {
  return {
    pointerId, isPrimary, pointerType, button, detail, clientX: 244,
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
  const hostMessages = [];
  const service = new RoomService();
  const host = { send: message => hostMessages.push(structuredClone(message)), close() {} };
  service.connect(host);
  service.receive(host, { type: 'create', maxPlayers: 6 });
  const code = hostMessages.find(message => message.type === 'welcome').room.code;
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.document = {
    hidden: false, addEventListener: (name, callback) => handlers.set(`document:${name}`, callback), removeEventListener() {},
  };
  globalThis.window = {
    location: { protocol: 'https:', hostname: 'beerio.example' },
    setInterval: () => 1, clearInterval() {},
    addEventListener: (name, callback) => handlers.set(name, callback), removeEventListener() {},
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
  service.receive(host, { type: 'lock', locked: true });
  const id = client.getSnapshot().playerId;
  assert.ok(id);
  const player = { id, name: 'Controller test', color: '#ffffff', input: { steer: 0, accelerate: false, brake: false } };
  const race = createRace([player]);
  race.countdown = 0;
  race.karts[0].distance = 20;
  let action = { lastControllerAction: 0, localAction: 0 };
  let taps = 0;
  const buttons = controllerButtons({
    send: client.setInput,
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
  return { buttons, handlers, step, player, kart: race.karts[0], taps: () => taps };
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
  assert.deepEqual(input, { steer: 1, accelerate: true, brake: false, action: 1 });
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
