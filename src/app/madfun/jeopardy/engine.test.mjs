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
test('private deck withholds answers until host-paced recap, then displays final scores',()=>{
 let g=newRun(seats,0);assert.deepEqual(queue.map(c=>c.round),['Round One','Round One','Round Two','Final round']);assert.deepEqual(queue[0].choices,['No','Yes']);
 for(let i=0;i<queue.length;i++){
  if(g.phase==='round'){assert.equal(publicRun(g,queue,deck.title).prompt,undefined);g=act(g,'open');}
  assert.equal(g.phase,'answer');assert.equal(g.index,i);
  g=act(g,'answer','a',queue[i].answer??'Alpha');
  g=act(g,'answer','b',queue[i].choices?.[0]??'Wrong');
  const privateUntilResults=()=>{
   const state=publicRun(g,queue,deck.title);
   for(const field of ['answer','answers','marks','recap','revealCard','recapOpen'])assert.equal(Object.hasOwn(state,field),false,field);
   assert.deepEqual(state.scores,{});
  };
  privateUntilResults();
  assert.equal(act(g,'reveal','b'),g);g=act(g,'close');
  privateUntilResults();
  if(queue[i].manual)g=act(g,'mark','host','a');
  g=act(g,'reveal');privateUntilResults();assert.equal(act(g,'reveal'),g);
  g=act(g,'next');
 }
 assert.equal(g.phase,'recap');
 const answers=['Yes','Alpha','OK','Fine'];
 for(const [i,answer] of answers.entries()){
  const closed=publicRun(g,queue,deck.title);
  assert.equal(closed.recapOpen,false);
  assert.deepEqual(closed.revealCard,{index:i,round:queue[i].round,points:queue[i].points,prompt:queue[i].prompt});
  assert.deepEqual(closed.scores,{});
  assert.equal(act(g,'next_recap'),g);
  assert.equal(act(g,'reveal_recap','b'),g);
  assert.equal(move(g,queue,'host',{type:'reveal_recap',version:g.version-1},100),g);
  g=act(g,'reveal_recap');
  const open=publicRun(g,queue,deck.title);
  assert.deepEqual(open.revealCard,{...closed.revealCard,answer});
  assert.equal(Object.hasOwn(open,'recap'),false);
  assert.deepEqual(open.scores,{});
  assert.equal(act(g,'reveal_recap'),g);
  assert.equal(act(g,'next_recap','a'),g);
  g=act(g,'next_recap');
 }
 assert.equal(g.phase,'results');assert.equal(g.scores.a,900);assert.equal(g.scores.b,0);
 const state=publicRun(g,queue,deck.title);
 assert.deepEqual(state.scores,{a:900,b:0});
 assert.equal(state.revealCard,undefined);
 assert.equal(state.recap,undefined);
 assert.equal(g.recap[1].answers.b,'Beta');
 assert.equal(g.recap[1].marks.a,true);
});
test('maximum-size multibyte decks reveal each full answer within the relay byte cap',()=>{
 const full=makeQueue({title:'🌟'.repeat(35),categories:Array.from({length:6},()=>({name:'🚀'.repeat(18),clues:Array.from({length:5},()=>({prompt:'界'.repeat(400),answer:'国'.repeat(160)}))})),final:{category:'Final',prompt:'界'.repeat(400),answer:'国'.repeat(160)}});
 let g=newRun(seats,0);
 for(let i=0;i<full.length;i++){
  const next=type=>{g=move(g,full,'host',{type,version:g.version},100);};
  if(g.phase==='round')next('open');
  next('close');next('reveal');next('next');
 }
 for(let index=0;index<31;index++){
  const open=type=>{g=move(g,full,'host',{type,version:g.version},100);};
  assert.equal(publicRun(g,full,'🌟'.repeat(35)).revealCard.answer,undefined);
  open('reveal_recap');
  const state=publicRun(g,full,'🌟'.repeat(35));
  assert.equal(state.revealCard.index,index);
  assert.equal(state.revealCard.prompt,'界'.repeat(400));
  assert.equal(state.revealCard.answer,'国'.repeat(160));
  assert.ok(Buffer.byteLength(JSON.stringify(state))<=32768);
  open('next_recap');
 }
 assert.equal(g.phase,'results');
});
test('rejects duplicate, off-menu, late and stale answers',()=>{
 let g=act(newRun(seats,0),'open');g=act(g,'answer','a','Yes');assert.equal(act(g,'answer','a','No'),g);
 assert.equal(act(g,'answer','b','Not an option'),g);
 assert.equal(move(g,queue,'b',{type:'answer',value:'Yes',version:g.version},60000),g);
 assert.equal(move(g,queue,'b',{type:'answer',value:'Yes',version:g.version-1},100),g);
});
