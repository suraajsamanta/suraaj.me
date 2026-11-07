import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
import ts from 'typescript';

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const appearance = { exports: {} };
new Function('require', 'module', 'exports', compile('../appearance.ts'))(() => {}, appearance, appearance.exports);
const grid = { exports: {} };
new Function('require', 'module', 'exports', compile('../lobby/StartingGrid.tsx'))(name => {
  if (name === 'react/jsx-runtime') return jsx;
  if (name === '../appearance') return appearance.exports;
  if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
  throw new Error(`Unexpected dependency: ${name}`);
}, grid, grid.exports);

test('ten grid cards show real character, vehicle, color, complete names and state', () => {
  const name = 'A'.repeat(64);
  const players = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: i ? `Driver ${i}` : name, color: '#123456', character: 'frog', vehicle: 'motorcycle', connected: i !== 2, ready: i === 0, input: {} }));
  const html = renderToStaticMarkup(React.createElement(grid.exports.default, { players, maxPlayers: 10 }));
  assert.equal((html.match(/<article/g) || []).length, 10);
  assert.match(html, new RegExp(name));
  assert.match(html, /Hops the Frog/); assert.match(html, /Motorcycle/);
  assert.match(html, /🐸/); assert.match(html, /🏍️/); assert.match(html, /--driver-color:#123456/);
  assert.match(html, /VEHICLE COLOR #123456/);
  assert.match(html, />READY</); assert.match(html, />NOT READY</); assert.match(html, />DISCONNECTED</);
});

test('empty slots and responsive, wrapping layout are represented', () => {
  const html = renderToStaticMarkup(React.createElement(grid.exports.default, { players: [], maxPlayers: 10 }));
  assert.equal((html.match(/OPEN SLOT/g) || []).length, 10);
  const css = readFileSync(new URL('../lobby/starting-grid.module.css', import.meta.url), 'utf8');
  assert.match(css, /repeat\(5, minmax\(0, 1fr\)\)/); assert.match(css, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});
