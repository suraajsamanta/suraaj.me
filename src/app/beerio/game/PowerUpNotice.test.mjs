import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const directory = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  file = resolve(directory, file);
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    return name.startsWith('.') ? load(name + '.ts') : require(name);
  }, mod, mod.exports);
  cache.set(file, mod.exports);
  return mod.exports;
}
const { PowerUpNotice } = load('PowerUpNotice.tsx');
const { POWER_UPS } = load('powerups.ts');
const css = readFileSync(resolve(directory, 'power-up-notice.module.css'), 'utf8');
const render = props => renderToStaticMarkup(React.createElement(PowerUpNotice, { item: 'fizz', kind: 'pickup', keyboard: true, playerName: 'Driver One', ...props }));

test('all twelve power-ups render different effect vignettes with meaningful text', () => {
  const scenes = new Set();
  for (const [item, power] of Object.entries(POWER_UPS)) {
    const html = render({ item, kind: 'activate' });
    assert.ok(html.includes(power.name), `${item} retains its readable item name`);
    assert.match(html, /role="status" aria-atomic="true"/);
    assert.match(html, /Driver One/);
    assert.match(html, /<span class="effect">[^<]{12,}/);
    assert.doesNotMatch(html, /Let’s go|undefined|NaN/);
    assert.doesNotMatch(html, /Press E to use|Double-tap GO to use/, 'An activated effect does not pretend it is still waiting to be used');
    const scene = html.match(/<svg.*?<\/svg>/)?.[0];
    assert.ok(scene, `${item} has a scene`);
    assert.match(scene, /aria-hidden="true" focusable="false"/);
    assert.doesNotMatch(scene, /\bid=|<filter|<image/, 'Vignettes need no cross-viewport IDs, expensive filters, or image requests');
    assert.ok((scene.match(/<(?:g|path|circle|ellipse)\b/g) || []).length < 28, 'Geometry stays bounded for ten simultaneous notices');
    scenes.add(scene);
  }
  assert.equal(scenes.size, 12, 'Dance and twerk, as well as all other effects, have distinct depictions');
});

test('pickup instructions match keyboard and phone controls; full slot does not illustrate activation', () => {
  assert.match(render({ keyboard: true }), /POWER-UP COLLECTED.*Press E to use/);
  assert.match(render({ keyboard: false }), /POWER-UP COLLECTED.*Double-tap GO to use/);
  for (const item of Object.keys(POWER_UPS)) {
    const full = render({ item, kind: 'full', keyboard: false });
    assert.match(full, /ITEM ALREADY HELD/);
    assert.match(full, /Use your held item first/);
    assert.match(full, /Double-tap GO to use/);
    assert.doesNotMatch(full, /<svg/, 'A full item slot uses a static badge, not a false power activation');
  }
});

test('copy describes duration, targeting, protection and brake cancellation accurately', () => {
  for (const [item, words] of Object.entries({ flask: /7 seconds/, prism: /6 seconds.*protection/, jet: /autopilot.*Brake to cancel/, crown: /leader/, dance: /racer ahead/, twerk: /racer behind/, lightning: /unprotected rivals/ })) {
    assert.match(render({ item }), words);
  }
});

test('animation is finite, pauseable and reduced-motion safe, including entry effects', () => {
  assert.match(render({ paused: true }), /data-paused="true"/);
  assert.doesNotMatch(render({ paused: false }), /data-paused/);
  assert.match(css, /\.notice\[data-paused\][\s\S]*?animation-play-state:\s*paused/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.notice, \.notice::after, \.notice \*\s*\{\s*animation:\s*none/);
  assert.doesNotMatch(css, /\binfinite\b|\bfilter\s*:|\bwill-change\s*:/);
  const frames = [...css.matchAll(/@keyframes\s+\w+\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)];
  assert.ok(frames.length >= 20);
  for (const [, content] of frames) {
    const declarations = [...content.matchAll(/([\w-]+):\s*[^;{}]+/g)].map(([, prop]) => prop);
    assert.ok(declarations.every(prop => ['transform', 'opacity'].includes(prop)), 'Only compositor-friendly properties animate');
  }
});

test('popup fits its own camera and has compact split-screen breakpoints', () => {
  assert.match(css, /width:\s*min\(88%, 410px\)/);
  assert.match(css, /box-sizing:\s*border-box/);
  assert.match(css, /pointer-events:\s*none/);
  for (const size of ['max-width: 360px', 'max-height: 240px', 'max-width: 180px']) assert.ok(css.includes(`@container (${size})`));
  const source = readFileSync(resolve(directory, 'PowerUpNotice.tsx'), 'utf8');
  assert.doesNotMatch(source, /requestAnimationFrame|setInterval|setTimeout|useEffect/);
});
