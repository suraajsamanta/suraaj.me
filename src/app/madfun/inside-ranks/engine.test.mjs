import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const load = async file => {
  const code = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
};
const e = await load('./engine.ts');
const { INSIDE_RANKS_PROMPTS: bank } = await load('./prompts.ts');
const players = ['Ada','Jim','Sam','Jess'].map(name => ({ id:name.toLowerCase(),name,connected:true }));
const round = () => e.createMatch(players, bank, () => 0.8);
const rank = s => e.submitRanking(s,s.ranker.id,[...s.rankTargets].reverse().map(p=>p.id));

test('at least three connected players; randomized bank and turn queue',()=>{
  assert.equal(e.createMatch(players.slice(0,2),bank),null);
  assert.equal(e.createMatch(players,bank.slice(0,3)),null);
  assert.equal(e.createMatch(players,bank,()=>0.8).totalRounds,4);
  assert.notEqual(e.createMatch(players,bank,()=>0.8).ranker.id,e.createMatch(players,bank,()=>0.2).ranker.id);
  assert.equal(bank.length,64);
  assert.equal(new Set(bank.map(p=>p.text)).size,64);
});

test('ranking and guessing redact the correct prompt and identities until allowed',()=>{
  const s=round();
  assert(e.publicView(s).options.length===0);
  assert.equal(e.publicView(s).correct,null);
  assert.equal(e.privateView(s,s.rankTargets[0].id),null);
  assert.deepEqual(e.privateView(s,s.ranker.id),{prompt:s.correct});
  const guessed=e.submitGuess(e.showOptions(rank(s)),s.rankTargets[0].id,s.correct.id);
  const view=e.publicView(guessed);
  assert.equal(view.options.length,4);
  assert(new Set(view.options.map(p=>p.id)).size===4);
  assert.equal(view.correct,null);
  assert.equal(e.privateView(guessed,s.ranker.id),null);
  assert.deepEqual(view.guessedIds,[s.rankTargets[0].id]);
  assert.deepEqual(view.results,[]);
  assert(!Object.hasOwn(view,'guesses'));
});

test('only ranker can rank each friend exactly once; eligible friends each lock one answer',()=>{
  const s=round(), [a,b,c]=s.rankTargets;
  assert.equal(e.submitRanking(s,a.id,[a.id,b.id,c.id]),null);
  assert.equal(e.submitRanking(s,s.ranker.id,[a.id,b.id,b.id]),null);
  assert.equal(e.submitRanking(s,s.ranker.id,[a.id,b.id,'unknown']),null);
  assert.equal(e.submitGuess(s,a.id,s.correct.id),null);
  const g=e.showOptions(rank(s));
  assert.deepEqual(g.ranking.map(p=>p.id),[c.id,b.id,a.id]);
  assert.equal(e.submitGuess(g,s.ranker.id,s.correct.id),null);
  assert.equal(e.submitGuess(g,a.id,'made-up'),null);
  assert.equal(e.submitGuess(e.submitGuess(g,a.id,s.correct.id),a.id,s.correct.id),null);
});

test('one point for a correct guess; only reveal unlocks the answer; rotate all rankers without repeats',()=>{
  let s=round();
  const order=[];
  const seen=new Set();
  for (let i=0;i<players.length;i++) {
    order.push(s.ranker.id);
    assert.equal(s.phase,'ranking');
    assert.equal(s.round,i+1);
    for(const option of s.options){
      assert(!seen.has(option.id));
      seen.add(option.id);
    }
    const g=e.showOptions(rank(s)), [a,b]=s.rankTargets;
    const correct=e.submitGuess(g,a.id,s.correct.id);
    const wrong=e.submitGuess(correct,b.id,s.options.find(p=>p.id!==s.correct.id).id);
    const revealed=e.reveal(wrong);
    assert.equal(e.reveal(revealed),null);
    assert.equal(revealed.scores[a.id],s.scores[a.id]+1);
    assert.equal(revealed.scores[b.id],s.scores[b.id]);
    assert.equal(e.publicView(revealed).correct.id,s.correct.id);
    s=e.nextRound(revealed,players,bank,()=>0.8);
  }
  assert.equal(new Set(order).size,players.length);
  assert.equal(s.phase,'finished');
  assert.equal(Object.values(s.scores).reduce((a,b)=>a+b,0),players.length);
});

test('host can skip during ranking; late joiners guess next round, and skipped prompts never leak',()=>{
  const s=round(), late={id:'late',name:'Lee',connected:true};
  const next=e.skipRound(s,[...players,late],bank,()=>0.8);
  assert.equal(next.round,2);
  assert.notEqual(next.ranker.id,s.ranker.id);
  assert(next.eligibleGuesserIds.includes(late.id));
  assert.equal(next.scores[late.id],0);
  assert(!next.options.some(p=>s.options.some(q=>q.id===p.id)));
  assert.equal(e.skipRound(rank(s),players,bank),null);
  const finished=e.skipRound(s,[],bank);
  assert.equal(finished.phase,'finished');
  assert.equal(e.publicView(finished).correct,null);
  assert.deepEqual(e.publicView(finished).options,[]);
});

test('hint stage exposes context and ranking, but no candidate wording, IDs, or answers', () => {
  const s = round();
  assert.equal(e.showOptions(s), null);
  const hint = rank(s);
  const view = e.publicView(hint);
  assert.equal(view.phase, 'hint');
  assert.equal(view.ranking.length, 3);
  assert.match(view.hint, /^Think|^Picture/);
  assert.deepEqual(view.options, []);
  assert.equal(view.correct, null);
  assert.equal(e.privateView(hint, s.ranker.id), null);
  for (const option of s.options) {
    assert(!JSON.stringify(view).includes(option.text));
    assert(!JSON.stringify(view).includes(option.id));
  }
  assert.equal(e.submitGuess(hint, s.rankTargets[0].id, s.correct.id), null);
  const choosing = e.showOptions(hint);
  assert.equal(e.showOptions(choosing), null);
  assert.equal(e.publicView(choosing).options.length, 4);
  assert.equal(e.publicView(choosing).correct, null);
});

test('verbal solve reveals the correct question without opening options or changing scores', () => {
  const s = round();
  const revealed = e.reveal(rank(s));
  const view = e.publicView(revealed);
  assert.equal(view.phase, 'reveal');
  assert.deepEqual(view.correct, s.correct);
  assert.deepEqual(view.options, []);
  assert.deepEqual(view.scores, s.scores);
  assert.equal(e.nextRound(revealed, players, bank).phase, 'ranking');
});

test('auto-run sets deadlines without choosing rankings or guesses', () => {
  assert.deepEqual(e.phaseTimer('ranking'), { seconds: 75, action: 'expire_ranking' });
  assert.equal(e.phaseTimer('finished'), null);
  assert.deepEqual(e.phaseTimer('hint'), { seconds: 20, action: 'show_options' });
  assert.deepEqual(e.phaseTimer('guessing'), { seconds: 25, action: 'reveal' });
  assert.deepEqual(e.phaseTimer('reveal'), { seconds: 8, action: 'next' });
});

test('live ranking preview broadcasts only the draft order and bounded drag position', () => {
  const s = round(), [a,b,c] = s.rankTargets, ids = [b.id,c.id,a.id];
  const updated = e.updateRankingPreview(s,s.ranker.id,ids,{id:a.id,position:1.235,prompt:s.correct});
  const view = e.publicView(updated);
  assert.deepEqual(view.preview,{orderedIds:ids,drag:{id:a.id,position:1.24}});
  assert.equal(view.phase,'ranking');
  assert.deepEqual(view.ranking,[]);
  assert.deepEqual(view.options,[]);
  assert.equal(view.correct,null);
  assert.equal(view.hint,null);
  assert(!JSON.stringify(view).includes(s.correct.text));
  assert.deepEqual(e.privateView(updated,s.ranker.id),{prompt:s.correct});
  assert.deepEqual(e.publicView(updated,false).preview,{orderedIds:ids,drag:null});
  assert.equal(e.updateRankingPreview(updated,s.ranker.id,ids,{id:a.id,position:1.239}),null);
  const dropped = e.updateRankingPreview(updated,s.ranker.id,ids,null);
  assert.deepEqual(e.publicView(dropped).preview,{orderedIds:ids,drag:null});
  const committed = e.submitRanking(dropped,s.ranker.id,ids);
  assert.equal(e.publicView(committed).preview,null);
  assert.deepEqual(e.publicView(committed).ranking.map(p=>p.id),ids);
});

test('only current ranker can preview a complete valid order and preview cannot persist to a new round', () => {
  const s = round(), ids = s.rankTargets.map(p=>p.id), who = s.ranker.id;
  for (const order of [null,[],[ids[0],ids[0],ids[1]],[who,ids[1],ids[2]]]) {
    assert.equal(e.updateRankingPreview(s,who,order,null),null);
  }
  for (const drag of [undefined,[],{}, {id:who,position:0},{id:ids[0],position:NaN},{id:ids[0],position:Infinity},
    {id:ids[0],position:-0.05},{id:ids[0],position:2.01},{id:ids[0],position:'1'}]) {
    assert.equal(e.updateRankingPreview(s,who,ids,drag),null);
  }
  assert.equal(e.updateRankingPreview(s,ids[0],ids,{id:ids[0],position:1}),null);
  assert.equal(e.updateRankingPreview(s,who,ids,null),null);
  assert.equal(e.updateRankingPreview(rank(s),who,ids,{id:ids[0],position:1}),null);
  const draft = e.updateRankingPreview(s,who,ids,{id:ids[0],position:1});
  assert.equal(e.publicView(e.skipRound(draft,players,bank,()=>0.8)).preview,null);
  assert.equal(e.publicView(e.skipRound(draft,[],bank)).preview,null);
});

test('manual mode gives a fixed 90-second ranking window; toggling auto-run cannot restart it', () => {
  const start = 100_000;
  assert.equal(e.roundDeadline(false,'ranking',start,start),190_000);
  assert.equal(e.roundDeadline(false,'ranking',start,start+20_000),190_000);
  assert.equal(e.roundDeadline(true,'ranking',start,start+25_000),175_000);
  assert.equal(e.roundDeadline(false,'hint',null,start),null);
  assert.equal(e.roundDeadline(true,'hint',null,start),120_000);
});

test('a temporarily offline player retains points and takes their next turn when back', () => {
  const s = round(), gone = s.queue[2], next = s.queue[1];
  const correct = e.submitGuess(e.showOptions(rank(s)),gone.id,s.correct.id);
  const after = e.reveal(correct);
  const onlyTwo = players.map(p => ({ ...p, connected: p.id === s.ranker.id || p.id === next.id }));
  const progress = e.nextRound(after,onlyTwo,bank,()=>0.8);
  assert.equal(progress.phase,'ranking');
  assert.equal(progress.round,2);
  assert.equal(progress.ranker.id,next.id);
  assert.equal(progress.rankTargets.length,1);
  assert.equal(progress.scores[gone.id],1);
  const further = e.nextRound(e.reveal(rank(progress)),players,bank,()=>0.8);
  assert.equal(further.phase,'ranking');
  assert.equal(further.round,3);
  assert.equal(further.ranker.id,gone.id);
  assert.equal(further.scores[gone.id],1);
});
