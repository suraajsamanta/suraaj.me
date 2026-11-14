import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const {outputText}=ts.transpileModule(await readFile(new URL('./engine.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
const {parseDeck,makeQueue,newRun,move,publicRun}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
const deck=parseDeck(JSON.stringify({title:'Private deck',categories:[{name:'Round One',clues:[{prompt:'Question',answer:'Yes',aliases:['Yep'],choices:['Yes','No']},{prompt:'Manual',manual:true,choices:['Alpha','Beta']}]},{name:'Round Two',clues:[{prompt:'Typed',answer:'OK'}]}],final:{category:'Final round',prompt:'Final question',answer:'Fine'}}));
const queue=makeQueue(deck,()=>0);
const seats=[{id:'a',name:'A',connected:true},{id:'b',name:'B',connected:true}];
const act=(g,type,actor='host',value)=>move(g,queue,actor,{type,value,version:g.version},100);
test('private deck runs in order, including manual grading and wager-free finale',()=>{
 let g=newRun(seats,0);assert.deepEqual(queue.map(c=>c.round),['Round One','Round One','Round Two','Final round']);assert.deepEqual(queue[0].choices,['No','Yes']);
 for(let i=0;i<queue.length;i++){
  if(g.phase==='round'){assert.equal(publicRun(g,queue,deck.title).prompt,undefined);g=act(g,'open');}
  assert.equal(g.phase,'answer');assert.equal(g.index,i);
  g=act(g,'answer','a',queue[i].answer??'Alpha');
  g=act(g,'answer','b',queue[i].choices?.[0]??'Wrong');
  assert.equal(publicRun(g,queue,deck.title).answers,undefined);
  assert.equal(act(g,'reveal','b'),g);g=act(g,'close');
  assert.equal(publicRun(g,queue,deck.title).answer,undefined);
  if(queue[i].manual)g=act(g,'mark','host','a');
  g=act(g,'reveal');assert.equal(publicRun(g,queue,deck.title).answer,queue[i].answer);assert.equal(act(g,'reveal'),g);
  g=act(g,'next');
 }
 assert.equal(g.phase,'results');assert.equal(g.scores.a,900);assert.equal(g.scores.b,0);
});
test('rejects duplicate, off-menu, late and stale answers',()=>{
 let g=act(newRun(seats,0),'open');g=act(g,'answer','a','Yes');assert.equal(act(g,'answer','a','No'),g);
 assert.equal(act(g,'answer','b','Not an option'),g);
 assert.equal(move(g,queue,'b',{type:'answer',value:'Yes',version:g.version},60000),g);
 assert.equal(move(g,queue,'b',{type:'answer',value:'Yes',version:g.version-1},100),g);
});
