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
  const guessed=e.submitGuess(rank(s),s.rankTargets[0].id,s.correct.id);
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
  const g=rank(s);
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
    const g=rank(s), [a,b]=s.rankTargets;
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
