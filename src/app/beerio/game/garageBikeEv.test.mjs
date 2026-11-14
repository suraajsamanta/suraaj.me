import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const compiled=ts.transpileModule(readFileSync(new URL('./garageBikeEv.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const loaded={exports:{}};new Function('exports','module',compiled)(loaded.exports,loaded);
const {buildBikeEv}=loaded.exports;
function capture(id,color=[.82,.06,.11]) {
 const calls=[],g=Object.fromEntries(['triangle','quad','box','beam','ellipsoid'].map(name=>[name,(...args)=>calls.push([name,...args])]));
 return {ok:buildBikeEv(g,color,id),calls};
}
for(const id of ['ducati','bmw-bike','cybertruck','tesla-roadster'])test(id+' is deterministic, finite and bounded',()=>{
 const a=capture(id),b=capture(id);assert.equal(a.ok,true);assert.deepEqual(a,b);assert.ok(a.calls.length>300&&a.calls.length<1500);
 for(const call of a.calls)for(const arg of call.slice(1))if(Array.isArray(arg))for(const v of arg){assert.ok(Number.isFinite(v));assert.ok(Math.abs(v)<3);}
 assert.notDeepEqual(a.calls,capture(id,[.1,.5,.8]).calls,'paint remains customizable');
});
test('unowned IDs do not emit geometry',()=>assert.deepEqual(capture('kart'),{ok:false,calls:[]}));
test('bike designs are not the same mesh in different paint',()=>assert.notDeepEqual(capture('ducati').calls,capture('bmw-bike').calls));
test('electric designs have no tailpipe ellipsoids',()=>{
 for(const id of ['cybertruck','tesla-roadster'])assert.ok(capture(id).calls.filter(c=>c[0]==='ellipsoid').every(c=>c[1][2]>0));
});
