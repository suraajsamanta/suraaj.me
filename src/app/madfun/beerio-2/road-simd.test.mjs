import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const output=mkdtempSync(fileURLToPath(new URL('../../../../.beerio2-simd-',import.meta.url)));
after(()=>rmSync(output,{recursive:true,force:true}));
for(const name of ['course','drive','road-simd','road-simd-bytes']) {
 const source=readFileSync(new URL(`./${name}.ts`,import.meta.url),'utf8');
 const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}});
 writeFileSync(join(output,`${name}.mjs`),result.outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
}
const {TRACKS}=await import(pathToFileURL(join(output,'course.mjs')));
const {indexRoad}=await import(pathToFileURL(join(output,'drive.mjs')));
const {createSimdRoadQuery}=await import(pathToFileURL(join(output,'road-simd.mjs')));
test('SIMD128 matches indexed scalar across both tracks, seams, and off-road recovery',async()=>{
 for(const track of TRACKS) {
  const scalar=indexRoad(track.points), simd=await createSimdRoadQuery(track.points); assert.ok(simd);
  let seed=5142;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const queries=[...track.points.map(p=>[p.x,p.z]),...Array.from({length:10000},()=>[(random()-.5)*450,(random()-.5)*450])];
  for(const [x,z] of queries) {
   const a=scalar(x,z),b=simd(x,z);
   assert.equal(b.segment,a.segment,`segment at ${x},${z}`);
   for(const key of ['x','y','z','distance','progress']) assert.ok(Math.abs(a[key]-b[key])<1e-10,`${key}: ${a[key]} vs ${b[key]}`);
  }
 }
});
test('invalid degenerate geometry falls back without throwing',async()=>{
 assert.equal(await createSimdRoadQuery([]),null);
 assert.equal(await createSimdRoadQuery([{x:0,y:0,z:0}]),null);
});
test('report warmed on-road end-to-end query benchmark (not a flaky speed assertion)',async t=>{
 for(const track of TRACKS) {
  const scalar=indexRoad(track.points),simd=await createSimdRoadQuery(track.points); assert.ok(simd);
  const queries=Array.from({length:4096},(_,i)=> {const p=track.points[i%track.points.length]; return [p.x+Math.sin(i)*4,p.z+Math.cos(i)*4];});
  let sink=0;
  const run=fn=>{const start=performance.now();for(let j=0;j<32;j++)for(const [x,z] of queries)sink+=fn(x,z).distance;return performance.now()-start;};
  run(scalar);run(simd);
  const a=[],b=[];for(let i=0;i<7;i++){a.push(run(scalar));b.push(run(simd));}a.sort((a,b)=>a-b);b.sort((a,b)=>a-b);
  t.diagnostic(`${track.id}: 131072 queries scalar=${a[3].toFixed(2)}ms SIMD=${b[3].toFixed(2)}ms speedup=${(a[3]/b[3]).toFixed(2)}x checksum=${sink}`);
 }
});
test('missing WASM and CSP compile rejection select scalar fallback',async()=>{
 const original=globalThis.WebAssembly;
 try {
  const missing=await import(pathToFileURL(join(output,'road-simd.mjs')).href+'?missing');
  globalThis.WebAssembly=undefined;
  assert.equal(await missing.createSimdRoadQuery(TRACKS[0].points),null);
  globalThis.WebAssembly=original;
  const denied=await import(pathToFileURL(join(output,'road-simd.mjs')).href+'?denied');
  globalThis.WebAssembly={validate:()=>true,compile:async()=>{throw new Error('CSP blocked');}};
  assert.equal(await denied.createSimdRoadQuery(TRACKS[0].points),null);
 } finally {globalThis.WebAssembly=original;}
});
