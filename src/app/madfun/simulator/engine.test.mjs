import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const e=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync(new URL('./engine.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const bank=Array.from({length:500},(_,i)=>({id:`q${i}`,category:'Test',text:`{name} scenario ${i}`}));
const getOrder=s=>e.judgeState(s).answers.map(a=>a.id);

test('full ten unique rounds, anonymous rank tokens, scoring, and rematch',()=>{
 const s=e.newGame('Alex');
 assert(e.start(s,[{id:'a',name:'Jamie'},{id:'b',name:'Sam'}],bank));
 assert.equal(new Set(s.prompts.map(p=>p.id)).size,10);
 for(let r=1;r<=10;r++){
  assert.equal(s.round,r);assert(e.submit(s,'a','One','submitted_by_a'));assert(e.submit(s,'b','Two','submitted_by_b'));
  assert(e.submit(s,'a','Edited','unused'));assert.equal(s.answers.length,2);
  assert.deepEqual(e.publicState(s).reveal,[]);assert.deepEqual(e.publicState(s).judgingAnswers,[]);
  assert(e.beginJudging(s,()=>0.999));
  const j=e.judgeState(s);
  assert.deepEqual(j.answers,e.publicState(s).judgingAnswers);
  for(const a of j.answers){assert.deepEqual(Object.keys(a),['id','text']);assert(!['a','b','submitted_by_a','submitted_by_b'].includes(a.id));}
  const [a,b]=getOrder(s);
  assert(!e.rank(s,[a,a],s.rankingVersion));
  assert(e.rank(s,[b,a],s.rankingVersion));assert(!e.rank(s,[b,a],s.rankingVersion));
  assert.equal(s.scores.b,r*2);assert.equal(s.scores.a,r);assert.equal(e.publicState(s).reveal[0].name,'Sam');assert(e.next(s));
 }
 assert.equal(s.phase,'finished');const previousVersion=s.rankingVersion;
 assert(e.start(s,s.players,bank));assert.equal(s.scores.a,0);assert.equal(s.rankingVersion,previousVersion);
});

test('draft reorders live anonymously, stale submits fail, and all ranked answers score once',()=>{
 const s=e.newGame('Alex'),players=Array.from({length:5},(_,i)=>({id:'player-'+i,name:'Test '+i}));
 assert(e.start(s,players,bank));for(const [i,p] of players.entries())assert(e.submit(s,p.id,'Answer '+i,'same-input-id'));
 assert(e.beginJudging(s,()=>0.999));
 const oldVersion=s.rankingVersion,initial=getOrder(s),reversed=[...initial].reverse();
 assert(!e.proposeRanking(s,reversed.slice(1),oldVersion));
 assert(e.proposeRanking(s,reversed,oldVersion));
 assert.equal(s.rankingVersion,oldVersion+1);
 assert(!e.proposeRanking(s,initial,oldVersion));
 assert(!e.rank(s,initial,oldVersion));
 assert.deepEqual(e.publicState(s).judgingAnswers.map(a=>a.id),reversed);
 assert.deepEqual(getOrder(s),reversed);
 assert.deepEqual(Object.values(s.scores),[0,0,0,0,0]);
 assert.deepEqual(s.roundPoints,{});
 assert.deepEqual(e.publicState(s).reveal,[]);
 assert(e.rank(s,reversed,s.rankingVersion));assert(!e.rank(s,reversed,s.rankingVersion));
 assert.deepEqual(e.publicState(s).reveal.map(a=>a.points),[5,4,3,2,1]);
 assert.deepEqual(Object.values(s.scores),[1,2,3,4,5]);
 assert.deepEqual(e.publicState(s).judgingAnswers,[]);
 assert(e.next(s));
 assert.deepEqual(s.judgingOrder,[]);assert.deepEqual(s.authorForToken,{});
 assert(e.submit(s,players[0].id,'New answer','new'));assert(e.beginJudging(s));
 assert(getOrder(s).every(id=>!initial.includes(id)));
 assert(!e.rank(s,getOrder(s),oldVersion));assert(e.rank(s,getOrder(s),s.rankingVersion));
 assert.deepEqual(Object.values(s.roundPoints),[1,0,0,0,0]);
});

test('reject absent players and empty judging',()=>{
 const s=e.newGame('Alex');
 assert(!e.start(s,[],bank));assert(e.start(s,[{id:'a',name:'A'},{id:'b',name:'B'}],bank));
 assert(!e.beginJudging(s));assert(!e.submit(s,'x','Hi','x'));assert(!e.submit(s,'a','  ','x'));
});
