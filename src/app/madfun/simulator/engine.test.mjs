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

test('a new or replacement seat waits until next round; same-id reconnect preserves score and drafts',()=>{
 const s=e.newGame('Alex'),a={id:'a',name:'A'},b={id:'b',name:'B'},c={id:'c',name:'C'},d={id:'d',name:'D'};
 assert(e.start(s,[a,b],bank,()=>0.999,0));
 assert(e.submit(s,'a','A1','a1',1000));
 assert(e.syncPlayers(s,[b,c]));
 assert(!e.syncPlayers(s,[b,c]));
 let state=e.publicState(s);
 assert.equal(state.activePlayerCount,2,'offline submitted answer still counts');
 assert.equal(state.players.find(p=>p.id==='a').connected,false);
 assert.equal(state.players.find(p=>p.id==='c').eligible,false);
 assert(!e.submit(s,'c','too soon','c1',2000));
 assert(!e.submit(s,'a','offline edit','a1',2000));
 assert(e.syncPlayers(s,[a,b,c]));
 assert(e.submit(s,'a','reconnected edit','a2',2000));
 assert(e.beginJudging(s));
 const order=getOrder(s);
 assert(e.syncPlayers(s,[a,b,c,d]));
 assert.deepEqual(getOrder(s),order,'late joins do not alter active ranking');
 assert(e.rank(s,order,s.rankingVersion));
 assert.equal(e.publicState(s).reveal[0].text,'reconnected edit');
 assert.equal(s.scores.a,1);
 assert.equal(e.publicState(s).players.find(p=>p.id==='d').eligible,false);
 assert(e.next(s,5000));
 assert(e.publicState(s).players.every(p=>p.eligible));
 assert(e.submit(s,'c','Now eligible','c2',6000));
 assert(e.submit(s,'d','Also eligible','d2',6000));
 assert.equal(s.scores.a,1);
});

test('timer expires on the deadline; answered and empty rounds advance safely',()=>{
 const s=e.newGame('Alex'),players=[{id:'a',name:'A'},{id:'b',name:'B'}];
 assert(e.start(s,players,bank,()=>0.1,500));
 assert.equal(e.publicState(s).deadline,45500);
 assert(e.submit(s,'a','Answer','a1',45499));
 assert(!e.expireAnswering(s,45499));
 assert(!e.submit(s,'b','Late','b1',45500));
 assert(!e.submit(s,'a','Late edit','a1',45500));
 assert(e.expireAnswering(s,45500));
 assert.equal(s.phase,'judging');
 assert.equal(s.deadline,null);
 assert(!e.expireAnswering(s,45501));
 assert.equal(e.judgeState(s).answers.length,1);
 assert(e.rank(s,getOrder(s),s.rankingVersion));
 assert.equal(s.scores.a,1);
 assert(e.next(s,50000));
 assert.equal(e.publicState(s).deadline,95000);
 assert(e.expireAnswering(s,95000));
 assert.equal(s.phase,'reveal');
 assert.equal(s.deadline,null);
 assert.deepEqual(e.publicState(s).reveal,[]);
 assert.equal(s.scores.a,1);
 assert.deepEqual(s.roundPoints,{a:0,b:0});
 assert(e.next(s,98000));
 assert.equal(s.round,3);
 assert.equal(s.deadline,143000);
});

test('held preview mirrors fractional motion anonymously without committing or scoring',()=>{
 const s=e.newGame('Alex'),players=[{id:'a',name:'One'},{id:'b',name:'Two'},{id:'c',name:'Three'}];
 assert(e.start(s,players,bank));
 for(const p of players)assert(e.submit(s,p.id,'Answer '+p.id,'raw-'+p.id));
 assert.equal(e.judgeState(s).rankingDrag,null);
 assert(e.beginJudging(s,()=>0.999));
 const [a,b,c]=getOrder(s),version=s.rankingVersion;
 assert(e.previewRanking(s,[a,b,c],version,{id:a,position:.112,authorId:'a'}));
 assert.deepEqual(e.judgeState(s).rankingDrag,{id:a,position:.11});
 assert(!e.previewRanking(s,[a,b,c],version,{id:a,position:.109}));
 assert(e.previewRanking(s,[b,a,c],version,{id:a,position:1.38}));
 assert.deepEqual(getOrder(s),[b,a,c]);
 assert.deepEqual(e.publicState(s).judgingAnswers,e.judgeState(s).answers);
 assert.deepEqual(e.publicState(s).rankingDrag,{id:a,position:1.38});
 assert.equal(s.rankingVersion,version);
 assert.deepEqual(s.judgingOrder,[a,b,c]);
 assert.deepEqual(s.scores,{a:0,b:0,c:0});
 assert.deepEqual(e.publicState(s).reveal,[]);
 for(const answer of e.judgeState(s).answers)assert.deepEqual(Object.keys(answer),['id','text']);
 assert(e.clearRankingPreview(s));assert(!e.clearRankingPreview(s));
 assert.deepEqual(getOrder(s),[a,b,c]);
 assert(e.previewRanking(s,[c,a,b],version,{id:c,position:0}));
 assert(e.proposeRanking(s,[c,a,b],version));
 assert.deepEqual(getOrder(s),[c,a,b]);
 assert.equal(e.publicState(s).rankingDrag,null);
 assert(!e.previewRanking(s,[a,b,c],version,{id:c,position:2}));
 assert(e.previewRanking(s,[a,b,c],s.rankingVersion,{id:c,position:2}));
 assert(e.rank(s,[a,b,c],s.rankingVersion));
 assert.equal(e.publicState(s).rankingDrag,null);
 assert.deepEqual(e.publicState(s).reveal.map(({points})=>points),[3,2,1]);
 assert(e.next(s));
 assert.equal(e.judgeState(s).rankingDrag,null);
 assert.deepEqual(getOrder(s),[]);
});

test('preview rejects stale versions, invalid coordinates and partial permutations',()=>{
 const s=e.newGame('Alex');
 assert(e.start(s,[{id:'a',name:'One'},{id:'b',name:'Two'}],bank));
 assert(!e.previewRanking(s,[],s.rankingVersion,{id:'foreign',position:0}));
 assert(e.submit(s,'a','A','raw-a')&&e.submit(s,'b','B','raw-b')&&e.beginJudging(s));
 const [a,b]=getOrder(s),version=s.rankingVersion;
 for(const drag of [null,[],{}, {id:'a',position:0},{id:a,position:-.001},{id:a,position:1.001},{id:a,position:Infinity},{id:a,position:NaN},{id:a,position:'0'}]){
  assert(!e.previewRanking(s,[a,b],version,drag));
 }
 for(const ids of [{},[a],[a,a],[a,'raw-b'],[a,b,'raw-b']])assert(!e.previewRanking(s,ids,version,{id:a,position:0}));
 assert(!e.previewRanking(s,[a,b],version+1,{id:a,position:0}));
 assert.equal(e.judgeState(s).rankingDrag,null);
 assert.deepEqual(getOrder(s),[a,b]);
});
