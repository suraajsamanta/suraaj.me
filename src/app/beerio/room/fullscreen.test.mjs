import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../FullscreenButton.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function fixture(t, doc, userAgent = 'Desktop') {
  const prior = { document: Object.getOwnPropertyDescriptor(globalThis, 'document'), navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  const events = new Map(), cleanups = [], state = []; let index = 0;
  Object.assign(doc, { addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent } });
  t.after(() => { cleanups.forEach(fn => fn()); for (const key of ['document','navigator']) { if (prior[key]) Object.defineProperty(globalThis, key, prior[key]); else delete globalThis[key]; } });
  const compiled = { exports: {} };
  new Function('require','module','exports',code)(name => {
    if (name === 'react') return { useState: value => { const slot=index++; if (!(slot in state)) state[slot]=value; return [state[slot], next => { state[slot]=next; }]; }, useEffect: fn => { if (!cleanups.length) cleanups.push(fn()); } };
    if (name === 'react/jsx-runtime') return { jsx:(type,props)=>({type,props}), jsxs:(type,props)=>({type,props}) };
    return { default:{ smallButton:'smallButton' } };
  },compiled,compiled.exports);
  const render=()=>{index=0;return compiled.exports.default();};
  return { render, events, state };
}
test('fullscreen enters and exits from a tap and reflects browser escape', async t => {
  let requests=0,exits=0; const doc={documentElement:{ requestFullscreen:async()=>{requests++;doc.fullscreenElement=doc.documentElement;} },exitFullscreen:async()=>{exits++;doc.fullscreenElement=null;}};
  const f=fixture(t,doc); await f.render().props.children[0].props.onClick(); assert.equal(requests,1);
  f.events.get('fullscreenchange')(); assert.equal(f.render().props.children[0].props.children,'EXIT FULLSCREEN');
  await f.render().props.children[0].props.onClick(); assert.equal(exits,1);
  f.events.get('fullscreenchange')(); assert.equal(f.render().props.children[0].props['aria-pressed'],false);
});
test('iPhone unsupported fullscreen gives the home-screen route without claiming success', async t => {
  const f=fixture(t,{documentElement:{}},'iPhone'); await f.render().props.children[0].props.onClick();
  assert.match(f.state[1],/Add to Home Screen/); assert.equal(f.state[0],false);
});
test('fullscreen rejection remains retryable and reports the failure', async t => {
  const f=fixture(t,{documentElement:{requestFullscreen:async()=>{throw new Error('blocked');}}});
  await f.render().props.children[0].props.onClick(); assert.match(f.state[1],/could not open/); assert.equal(f.state[0],false);
});
