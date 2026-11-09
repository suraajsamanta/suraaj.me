import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
import ts from 'typescript';
import { SELECTION_CHARACTERS } from '../../../../beerio-server/core.mjs';

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
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

test('all24 supplied portraits have unique Indian first names and match the relay navigation order', () => {
  const characters = appearance.exports.ANIMAL_CHARACTERS;
  assert.equal(characters.length, 24);
  assert.equal(new Set(characters.map(c => c.name)).size, 24);
  assert.deepEqual(appearance.exports.SELECTABLE_CHARACTERS.map(c => c.id), SELECTION_CHARACTERS);
  assert.equal(appearance.exports.SELECTABLE_CHARACTERS.length, 30);
  for (const character of appearance.exports.CHARACTERS) assert.match(character.name, /^[A-Z][a-z]+$/);
  assert.ok(readFileSync(new URL('../../../../public/beerio/characters.jpg', import.meta.url)).byteLength > 50000);
});

test('shared grid shows all30 choices, long usernames above cards, selected status and reconnect status', () => {
  const players = [{ id: 'a', name: 'A'.repeat(64), color: '#ffce58', character: 'gorilla', characterConfirmed: true, connected: true }, { id: 'b', name: 'Maya', color: '#4ce4f3', character: 'gorilla', characterConfirmed: false, connected: false }];
  const html = renderToStaticMarkup(React.createElement(selection.exports.CharacterGrid, { players }));
  assert.equal((html.match(/<article/g) || []).length, 30);
  assert.match(html, /30 characters in 6 columns and 5 rows/);
  assert.match(html, /Huang/); assert.match(html, /Zuckerberg/);
  assert.match(html, new RegExp(players[0].name)); assert.match(html, /RECONNECTING/); assert.match(html, /PICKED ✓/);
  assert.match(html, /Arjun/); assert.match(html, /Veer/); assert.doesNotMatch(html, /the (Monkey|Bird|Lion)/i);
  assert.match(html, /background-position:100% 100%/);
});

test('phone offers four directions and SELECT with no second ready-up; confirmed pick can be changed', () => {
  const player = { id: 'a', name: 'Arun', character: 'tiger', connected: true, characterConfirmed: false };
  const html = renderToStaticMarkup(React.createElement(selection.exports.CharacterController, { player, onChoose() {} }));
  for (const direction of ['up', 'down', 'left', 'right']) assert.match(html, new RegExp(`Choose character ${direction}`));
  assert.match(html, />SELECT</); assert.match(html, /Priya/); assert.doesNotMatch(html, /READY UP/);
  const selected = renderToStaticMarkup(React.createElement(selection.exports.CharacterController, { player: { ...player, characterConfirmed: true }, onChoose() {} }));
  assert.match(selected, /CHANGE CHARACTER/); assert.doesNotMatch(selected, /selectionJoystick/);
});


test('six original guest SVGs and accessible portraits reflect distinct requested outfits and accessories', () => {
  const guests = appearance.exports.PUBLIC_FIGURE_CHARACTERS;
  assert.deepEqual(guests.map(c => c.name), ['Bezos', 'Trump', 'Musk', 'Zuckerberg', 'Ye', 'Huang']);
  const signatures = new Set();
  for (const guest of guests) {
    const svg = readFileSync(new URL(`../../../../public${guest.portraitPath}`, import.meta.url), 'utf8');
    assert.match(svg, /<title id="title">/); assert.match(svg, /<desc id="desc">/);
    assert.match(svg, /viewBox="0 0 256 256"/); assert.doesNotMatch(svg, /<script|https?:\/\/[^w]|<foreignObject/);
    signatures.add(svg);
    const html = renderToStaticMarkup(React.createElement(selection.exports.CharacterPortrait, { id: guest.id }));
    assert.match(html, new RegExp(guest.name)); assert.ok(html.includes(guest.portraitPath));
    assert.ok(html.includes('role="img"')); assert.ok(html.includes(guest.portraitDescription));
    assert.equal(appearance.exports.validAppearance({ character: guest.id, vehicle: 'kart', color: '#123456' }), true);
  }
  assert.equal(signatures.size, 6);
});

test('legacy version1 rooms retain the original24-card layout and four rows', () => {
  const html = renderToStaticMarkup(React.createElement(selection.exports.CharacterGrid, { players: [], version: 1 }));
  assert.equal((html.match(/<article/g) || []).length, 24);
  assert.match(html, /24 characters in 6 columns and 4 rows/); assert.doesNotMatch(html, /Huang|Bezos/);
});
