import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import postcss from 'postcss';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
import ts from 'typescript';

// Structural layout contracts, not a substitute for browser geometry checks.
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const css = postcss.parse(read('../lobby/character-selection.module.css'));
const shell = postcss.parse(read('../beerio.module.css'));
const game = postcss.parse(read('../game/game.module.css'));
function declarations(root, selector) {
  const result = {};
  root.walkRules(rule => {
    if (rule.parent.type !== 'root' || !rule.selectors.includes(selector)) return;
    rule.walkDecls(decl => { result[decl.prop] = decl.value; });
  });
  return result;
}
const compile = file => ts.transpileModule(read(file), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const appearance = { exports: {} };
new Function('require', 'module', 'exports', compile('../appearance.ts'))(() => {}, appearance, appearance.exports);
const selection = { exports: {} };
new Function('require', 'module', 'exports', compile('../lobby/CharacterSelection.tsx'))(name => {
  if (name === 'react') return React;
  if (name === 'react/jsx-runtime') return jsx;
  if (name === '../appearance') return appearance.exports;
  if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
  throw new Error(`Unexpected dependency: ${name}`);
}, selection, selection.exports);

test('the host has a finite viewport and a shrinkable board with all five rows', () => {
  const host = declarations(css, '.hostScreen');
  assert.equal(host.height, '100dvh');
  assert.equal(host['min-height'], '0');
  assert.equal(host.overflow, 'hidden');
  assert.equal(declarations(css, '.hostWorkspace')['min-height'], '0');
  assert.equal(declarations(css, '.hostScreen .selection')['min-height'], '0');
  assert.equal(declarations(css, '.hostScreen .characterGrid')['grid-template-rows'], 'repeat(var(--character-rows, 5), minmax(0, 1fr))');
  assert.match(declarations(css, '.hostScreen .portrait').width, /100cqh/);
  assert.doesNotMatch(read('../lobby/character-selection.module.css'), /characters\.jpg|600% 400%/);
  assert.equal(declarations(css, '.modelPortrait')['background-size'], 'contain');
});

test('all 30 characters remain present for zero and ten drivers without a default selection', () => {
  for (const count of [0, 10]) {
    const players = Array.from({ length: count }, (_, i) => ({
      id: `driver-${i}`, name: `Driver ${i + 1}`, color: '#aaffcc', connected: true,
      character: null, characterCursor: null, characterConfirmed: false,
    }));
    const html = renderToStaticMarkup(React.createElement(selection.exports.CharacterGrid, { players, version: 3 }));
    assert.equal((html.match(/role="listitem"/g) || []).length, 30);
    assert.match(html, /--character-rows:5/);
    assert.match(html, /Huang/);
    assert.doesNotMatch(html, /highlighted/);
    assert.equal((html.match(/\/beerio\/models\//g) || []).length, 30);
  }
});

test('phone selection and setup are constrained by the dynamic viewport', () => {
  assert.equal(declarations(shell, '.shell').height, '100dvh');
  assert.equal(declarations(shell, '.phoneShell').overflow, 'hidden');
  assert.equal(declarations(css, '.phoneSelection')['min-height'], '0');
  assert.match(declarations(css, '.selectionJoystick').width, /dvh/);
  assert.match(declarations(css, '.selectButton').width, /dvh/);
  assert.match(read('../lobby/character-selection.module.css'), /@media \(max-height: 500px\) and \(orientation: landscape\)/);
});

test('race navigation occupies its own row instead of covering the first driver', () => {
  assert.equal(declarations(shell, '.race').display, 'flex');
  assert.equal(declarations(shell, '.race')['flex-direction'], 'column');
  assert.equal(declarations(shell, '.raceTop').position, 'relative');
  assert.equal(declarations(shell, '.raceTop').inset, 'auto');
  assert.equal(declarations(shell, '.raceTop').order, '0');
  assert.equal(declarations(shell, '.race > :first-child').order, '1');
  assert.equal(declarations(shell, '.race > :first-child')['min-height'], '0');
  assert.equal(declarations(game, '.game')['min-height'], '0');
  assert.equal(declarations(game, '.canvas')['min-height'], '0');
});


test('long driver names cannot expand the board rows and keep full accessible titles', () => {
  assert.equal(declarations(css, '.hostScreen .roster > span')['white-space'], 'nowrap');
  assert.equal(declarations(css, '.hostScreen .roster > span')['text-overflow'], 'ellipsis');
  assert.equal(declarations(css, '.hostScreen .nameFlags')['flex-wrap'], 'nowrap');
  const name = 'A'.repeat(64);
  const players = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name, color: '#aaffcc', connected: true, character: null, characterCursor: 'gorilla', characterConfirmed: false }));
  const html = renderToStaticMarkup(React.createElement(selection.exports.CharacterGrid, { players, version: 3 }));
  assert.equal((html.match(new RegExp(`title="${name}"`, 'g')) || []).length, 20);
});
