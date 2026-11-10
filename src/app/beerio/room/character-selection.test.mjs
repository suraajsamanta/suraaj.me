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

test('all 24 animals have unique English first names and match the relay navigation order', () => {
  const characters = appearance.exports.ANIMAL_CHARACTERS;
  assert.equal(characters.length, 24);
  assert.equal(new Set(characters.map(c => c.name)).size, 24);
  assert.deepEqual(characters.map(c => c.name), ['Max', 'Luna', 'Charlie', 'Molly', 'Penny', 'Jack', 'Daisy', 'Leo', 'Milo', 'Bella', 'Rocky', 'Sam', 'Ruby', 'Oliver', 'Teddy', 'Cody', 'Hazel', 'Finn', 'Rosie', 'Oscar', 'Buddy', 'Ben', 'Gigi', 'Riley']);
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
  assert.match(html, /Max/); assert.match(html, /Riley/); assert.doesNotMatch(html, /the (Monkey|Bird|Lion)/i);
  assert.match(html, /\/beerio\/models\/horse\.png/);
});

test('phone offers four directions and SELECT with no second ready-up; confirmed pick can be changed', () => {
  const player = { id: 'a', name: 'Arun', character: 'tiger', connected: true, characterConfirmed: false };
  const html = renderToStaticMarkup(React.createElement(selection.exports.CharacterController, { player, onChoose() {} }));
  for (const direction of ['up', 'down', 'left', 'right']) assert.match(html, new RegExp(`Choose character ${direction}`));
  assert.match(html, />SELECT</); assert.match(html, /Luna/); assert.doesNotMatch(html, /READY UP/);
  const selected = renderToStaticMarkup(React.createElement(selection.exports.CharacterController, { player: { ...player, characterConfirmed: true }, onChoose() {} }));
  assert.match(selected, /CHANGE CHARACTER/); assert.doesNotMatch(selected, /selectionJoystick/);
});


test('all animal and guest previews are distinct generated model renders with accessible names', () => {
  const characters = appearance.exports.CHARACTERS;
  assert.deepEqual(appearance.exports.PUBLIC_FIGURE_CHARACTERS.map(c => c.name), ['Bezos', 'Trump', 'Musk', 'Zuckerberg', 'Ye', 'Huang']);
  const signatures = new Set();
  for (const character of characters) {
    const path = `/beerio/models/${character.id}.png`;
    const png = readFileSync(new URL(`../../../../public${path}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(png.readUInt32BE(16) >= 128 && png.readUInt32BE(20) >= 128, `${character.id} needs a readable preview`);
    signatures.add(png.toString('base64'));
    const html = renderToStaticMarkup(React.createElement(selection.exports.CharacterPortrait, { id: character.id }));
    assert.match(html, new RegExp(character.name)); assert.ok(html.includes(path));
    assert.ok(html.includes('role="img"')); assert.ok(html.includes(`aria-label="${character.name}"`));
    assert.equal(appearance.exports.validAppearance({ character: character.id, vehicle: 'kart', color: '#123456' }), true);
  }
  assert.equal(signatures.size, characters.length);
});

test('legacy version1 rooms retain the original24-card layout and four rows', () => {
  const html = renderToStaticMarkup(React.createElement(selection.exports.CharacterGrid, { players: [], version: 1 }));
  assert.equal((html.match(/<article/g) || []).length, 24);
  assert.match(html, /24 characters in 6 columns and 4 rows/); assert.doesNotMatch(html, /Huang|Bezos/);
});
