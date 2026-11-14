import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const src = readFileSync(new URL('./prompts.ts', import.meta.url), 'utf8');
const { SIMULATOR_PROMPTS: bank } = await import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(src, {compilerOptions:{module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));

test('bank has 500 distinct reusable scenes with short setups and direct questions', () => {
 assert.equal(bank.length,500);
 assert.equal(new Set(bank.map(p=>p.id)).size,500);
 assert.equal(new Set(bank.map(p=>p.text)).size,500);
 assert.equal(new Set(bank.map(p=>p.category)).size,20);
 const setups=new Set();
 for(const {text} of bank){
  const [setup,cue,...tail]=text.split('\n\n');
  assert.ok(setup.length>10 && cue?.includes('{name}') && cue?.endsWith('?') && !tail.length,text);
  assert.ok(text.split(/\s+/).length<=30,text);
  setups.add(setup);
 }
 assert.ok(setups.size>=495);
});
