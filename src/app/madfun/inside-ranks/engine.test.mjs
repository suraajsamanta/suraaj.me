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
  const guesser = s.eligibleGuesserIds[0];
  assert.equal(e.privateView(s,guesser),null);
  assert.deepEqual(e.privateView(s,s.ranker.id),{prompt:s.correct});
  const guessed=e.submitGuess(e.showOptions(rank(s)),guesser,s.correct.id);
  const view=e.publicView(guessed);
  assert.equal(view.options.length,6);
  assert(new Set(view.options.map(p=>p.id)).size===6);
  assert.equal(view.correct,null);
  assert.equal(e.privateView(guessed,s.ranker.id),null);
  assert.deepEqual(view.guessedIds,[guesser]);
  assert.deepEqual(view.results,[]);
  assert(!Object.hasOwn(view,'guesses'));
});

test('only ranker can rank everyone exactly once, including themself; only eligible friends can guess',()=>{
  const s=round(), ids=s.rankTargets.map(p=>p.id), [a,b]=s.eligibleGuesserIds;
  assert(ids.includes(s.ranker.id));
  assert(!s.eligibleGuesserIds.includes(s.ranker.id));
  assert.equal(e.submitRanking(s,a,ids),null);
  assert.equal(e.submitRanking(s,s.ranker.id,ids.filter(id=>id!==s.ranker.id)),null);
  assert.equal(e.submitRanking(s,s.ranker.id,[...ids.slice(1),ids[1]]),null);
  assert.equal(e.submitRanking(s,s.ranker.id,[...ids.slice(1),'unknown']),null);
  assert.equal(e.submitGuess(s,a,s.correct.id),null);
  const g=e.showOptions(rank(s));
  assert.deepEqual(g.ranking.map(p=>p.id),ids.toReversed());
  assert.equal(e.submitGuess(g,s.ranker.id,s.correct.id),null);
  assert.equal(e.submitGuess(g,a,'made-up'),null);
  assert.equal(e.submitGuess(e.submitGuess(g,a,s.correct.id),a,s.correct.id),null);
  assert(e.submitGuess(g,b,s.correct.id));
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
    const g=e.showOptions(rank(s)), [a,b]=s.eligibleGuesserIds;
    const correct=e.submitGuess(g,a,s.correct.id);
    const wrong=e.submitGuess(correct,b,s.options.find(p=>p.id!==s.correct.id).id);
    const revealed=e.reveal(wrong);
    assert.equal(e.reveal(revealed),null);
    assert.equal(revealed.scores[a],s.scores[a]+1);
    assert.equal(revealed.scores[b],s.scores[b]);
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
  assert(!next.rankTargets.some(p=>p.id===late.id));
  assert(!next.queue.some(p=>p.id===late.id));
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
  assert.equal(view.ranking.length, players.length);
  assert.match(view.hint, /^Think|^Picture/);
  assert.deepEqual(view.options, []);
  assert.equal(view.correct, null);
  assert.equal(e.privateView(hint, s.ranker.id), null);
  for (const option of s.options) {
    assert(!JSON.stringify(view).includes(option.text));
    assert(!JSON.stringify(view).includes(option.id));
  }
  assert.equal(e.submitGuess(hint, s.eligibleGuesserIds[0], s.correct.id), null);
  const choosing = e.showOptions(hint);
  assert.equal(e.showOptions(choosing), null);
  assert.equal(e.publicView(choosing).options.length, 6);
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
  assert.deepEqual(e.phaseTimer('ranking'), { seconds: 90, action: 'expire_ranking' });
  assert.equal(e.phaseTimer('finished'), null);
  assert.deepEqual(e.phaseTimer('hint'), { seconds: 20, action: 'show_options' });
  assert.deepEqual(e.phaseTimer('guessing'), { seconds: 25, action: 'reveal' });
  assert.deepEqual(e.phaseTimer('reveal'), { seconds: 8, action: 'next' });
});

test('live ranking preview broadcasts only the draft order and bounded drag position', () => {
  const s = round(), [a,b,c,d] = s.rankTargets, ids = [b.id,c.id,a.id,d.id];
  assert.equal(a.id,s.ranker.id);
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
  for (const order of [null,[],[ids[0],ids[0],...ids.slice(2)],[...ids.slice(0,-1),'unknown']]) {
    assert.equal(e.updateRankingPreview(s,who,order,null),null);
  }
  for (const drag of [undefined,[],{}, {id:'unknown',position:0},{id:ids[0],position:NaN},{id:ids[0],position:Infinity},
    {id:ids[0],position:-0.05},{id:ids[0],position:ids.length-0.99},{id:ids[0],position:'1'}]) {
    assert.equal(e.updateRankingPreview(s,who,ids,drag),null);
  }
  assert.equal(e.updateRankingPreview(s,s.eligibleGuesserIds[0],ids,{id:ids[0],position:1}),null);
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
  assert.equal(e.roundDeadline(true,'ranking',start,start+25_000),190_000);
  assert.equal(e.roundDeadline(false,'hint',null,start),null);
  assert.equal(e.roundDeadline(true,'hint',null,start),120_000);
});

test('a temporarily offline player retains points and takes their next turn when back', () => {
  const s = round(), gone = s.queue[2], next = s.queue[1];
  const correct = e.submitGuess(e.showOptions(rank(s)),gone.id,s.correct.id);
  const after = e.reveal(correct);
  const onlyOne = players.map(p => ({ ...p, connected: p.id === next.id }));
  const progress = e.nextRound(after,onlyOne,bank,()=>0.8);
  assert.equal(progress.phase,'ranking');
  assert.equal(progress.round,2);
  assert.equal(progress.ranker.id,next.id);
  assert.deepEqual(progress.rankTargets.map(p=>p.id),players.map(p=>p.id));
  assert(progress.rankTargets.some(p=>p.id===gone.id && !p.connected));
  assert(progress.eligibleGuesserIds.includes(gone.id));
  const canAnswerOnReturn = e.submitGuess(e.showOptions(rank(progress)),gone.id,progress.correct.id);
  assert(canAnswerOnReturn);
  assert.equal(e.reveal(canAnswerOnReturn).scores[gone.id],2);
  assert.equal(progress.scores[gone.id],1);
  const further = e.nextRound(e.reveal(rank(progress)),players,bank,()=>0.8);
  assert.equal(further.phase,'ranking');
  assert.equal(further.round,3);
  assert.equal(further.ranker.id,gone.id);
  assert.equal(further.scores[gone.id],1);
});

test('a player who stepped away in the lobby is included in all ranks, eligible to return, and never starts alone', () => {
  const [away,...online] = players;
  const beforeStart = [{...away,connected:false},...online];
  assert.equal(e.createMatch(beforeStart.slice(0,3),bank,()=>0.8),null);
  const s = e.createMatch(beforeStart,bank,()=>0.8);
  assert.equal(s.round,1);
  assert.equal(s.totalRounds,players.length);
  assert.notEqual(s.ranker.id,away.id);
  assert.deepEqual(s.rankTargets,beforeStart);
  assert(s.eligibleGuesserIds.includes(away.id));
  const next = e.nextRound(e.reveal(rank(s)),online,bank,()=>0.8);
  assert.notEqual(next.ranker.id,away.id);
  assert(next.rankTargets.some(p=>p.id===away.id && p.name===away.name && !p.connected));
  assert(next.eligibleGuesserIds.includes(away.id));
  assert.equal(next.scores[away.id],0);
  assert(e.updateRankingPreview(next,next.ranker.id,next.rankTargets.map(p=>p.id),{id:away.id,position:0}));
});

test('Dark Mode has its own deck, private prompts and category hints across rounds', async () => {
  const { INSIDE_RANKS_DARK_PROMPTS: dark, DARK_OPENING_CATEGORIES } = await load('./dark-prompts.ts');
  assert(dark.length >= 150);
  assert.equal(new Set(dark.map(p => p.text.toLowerCase().replace(/[?.!]+$/u, ''))).size, dark.length);
  for (const category of new Set(dark.map(p => p.category))) {
    const categoryDeck = dark.filter(p => p.category === category);
    assert(categoryDeck.length >= 4);
    const categoryMatch = e.createMatch(players, categoryDeck, () => 0.8);
    assert.notEqual(e.publicView(rank(categoryMatch)).hint, 'Think about the situation this group’s ranking might fit.');
  }
  assert.equal(new Set([...bank, ...dark].map(p => p.id)).size, bank.length + dark.length);
  const darkIds = new Set(dark.map(p => p.id));
  for (const value of [0.05, 0.25, 0.5, 0.8, 0.95]) {
    const opener = e.createMatch(players, dark, () => value, DARK_OPENING_CATEGORIES);
    assert(DARK_OPENING_CATEGORIES.includes(opener.correct.category));
    assert(opener.options.every(option => option.category === opener.correct.category));
  }
  const useDeck = e.createMatch(players, dark, () => 0.8, DARK_OPENING_CATEGORIES);
  const privatePrompt = e.privateView(useDeck, useDeck.ranker.id).prompt;
  assert(darkIds.has(privatePrompt.id));
  assert.equal(e.publicView(useDeck).options.length, 0);
  assert.equal(e.publicView(useDeck).correct, null);
  const locked = rank(useDeck);
  const hint = e.publicView(locked).hint;
  assert.notEqual(hint, 'Think about the situation this group’s ranking might fit.');
  assert(!hint.includes(privatePrompt.text));
  const guessing = e.showOptions(locked);
  assert.equal(e.publicView(guessing).options.length, 6);
  assert(e.publicView(guessing).options.every(option => darkIds.has(option.id)));
  const next = e.nextRound(e.reveal(guessing), players, dark, () => 0.2);
  assert(next.options.every(option => darkIds.has(option.id)));
  assert(!darkIds.has(round().correct.id));
});

const customPrompts = [
  { id: 'room-q-a', text: 'Who would bring a karaoke machine camping?' },
  { id: 'room-q-b', text: 'Who could plan an entire reunion in ten minutes?' },
];
const makeBatch = (people = players, custom = customPrompts) =>
  e.createMatch(people, bank, () => 0.8, undefined, { customPrompts: custom, simultaneous: true });

test('room questions go first without hints; they never become decoys', () => {
  assert.equal(e.normalizeCustomQuestion('  Who\t wins  karaoke?\n'), 'Who wins karaoke?');
  assert.equal(e.normalizeCustomQuestion('tool\u202egame?'), null);
  assert.equal(e.normalizeCustomQuestion('x'.repeat(e.MAX_CUSTOM_QUESTION_LENGTH + 1)), null);
  assert.equal(e.normalizeCustomQuestion({ text: 'not a string' }), null);
  const extended = [...customPrompts, { id: 'dupe', text: customPrompts[0].text.toUpperCase().replace('?', '!') }];
  let match = e.createMatch(players, bank, () => 0.8, undefined, { customPrompts: extended });
  for (const custom of customPrompts) {
    assert.deepEqual(e.privateView(match, match.ranker.id), { prompt: custom });
    assert(!JSON.stringify(e.publicView(match)).includes(custom.text));
    assert(!match.consumedCustomPromptIds.includes(custom.id));
    const review = rank(match);
    assert(review.consumedCustomPromptIds.includes(custom.id));
    assert.equal(e.publicView(review).hint, null);
    assert.equal(e.publicView(review).customPrompt, true);
    assert.deepEqual(e.publicView(review).options, []);
    assert.equal(e.publicView(review).correct, null);
    const guessing = e.showOptions(review);
    assert.equal(guessing.options.length, 6);
    assert.equal(guessing.options.filter(o => !bank.some(p => p.id === o.id)).length, 1);
    const sent = e.publicView(guessing).options;
    assert(sent.every(option => /^choice-[1-6]$/.test(option.id) && Object.keys(option).length === 2));
    const correctChoice = sent.find(option => option.text === custom.text);
    const guesser = review.eligibleGuesserIds[0];
    assert.equal(e.submitGuess(guessing, guesser, custom.id), null);
    const reveal = e.reveal(e.submitGuess(guessing, guesser, correctChoice.id));
    assert.deepEqual(e.publicView(reveal).correct, correctChoice);
    assert.equal(e.publicView(reveal).results[0].optionId, correctChoice.id);
    match = e.nextRound(reveal, players, bank, () => 0.8);
  }
  assert.equal(match.customPrompt, false);
  assert(bank.some(p => p.id === match.correct.id));
  assert(e.publicView(rank(match)).hint);
});

test('a missed sequential rank does not lose the queued room question', () => {
  const match = e.createMatch(players, bank, () => 0.8, undefined, { customPrompts });
  const next = e.skipRound(match, players, bank, () => 0.8);
  assert.notEqual(next.ranker.id, match.ranker.id);
  assert.equal(next.correct.id, customPrompts[0].id);
  assert.equal(e.nextRound(e.reveal(rank(next)), players, bank).correct.id, customPrompts[1].id);
});

test('90-second simultaneous phase keeps unique assignments and all draft orders private', () => {
  const roster = players.map((p, index) => index === 3 ? { ...p, connected: false } : p);
  let match = makeBatch(roster);
  const view = e.publicView(match);
  assert.equal(match.phase, 'batch_ranking');
  assert.deepEqual(view.rankTargets, roster);
  assert.equal(view.simultaneous, true);
  assert.equal(view.batch.rankerIds.length, 3);
  assert.equal(new Set(view.batch.rankerIds.map(id => e.privateView(match, id).prompt.id)).size, 3);
  assert.equal(e.privateView(match, players[3].id), null);
  assert.equal(e.privateView(match, 'late-guest'), null);
  assert.deepEqual(e.phaseTimer(match.phase), { seconds: 90, action: 'expire_ranking' });
  assert.equal(e.roundDeadline(false, match.phase, 1000, 1000), 91000);
  assert.equal(e.roundDeadline(true, match.phase, 1000, 22000), 91000);
  for (const id of view.batch.rankerIds) {
    const { prompt } = e.privateView(match, id);
    assert(!JSON.stringify(view).includes(prompt.text));
    assert(!JSON.stringify(view).includes(prompt.id));
  }
  const [first, second] = view.batch.rankerIds;
  const ids = players.map(player => player.id);
  assert.equal(e.updateRankingPreview(match, first, ids, null), null);
  assert.equal(e.updateRankingPreview(match, first, ids.filter(id => id !== first), null), null);
  assert.equal(e.updateRankingPreview(match, players[3].id, ids.toReversed(), null), null);
  const privateDraft = ids.slice(1).concat(ids[0]);
  match = e.updateRankingPreview(match, first, privateDraft, { id: first, position: 0 });
  assert.deepEqual(e.privateView(match, first).orderedIds, privateDraft, 'refresh can restore own draft');
  assert.equal(e.privateView(match, second).orderedIds, undefined, 'other ranker has not saved a draft');
  assert.deepEqual(e.publicView(match), view, 'public projection is identical before and after a draft');
  assert.equal(e.updateRankingPreview(match, first, privateDraft, null), null, 'ignore duplicate snapshots');
  assert.equal(e.submitRanking(match, first, ids.filter(id => id !== first)), null);
  assert.equal(e.submitRanking(match, players[3].id, ids), null);
  match = e.submitRanking(match, first, ids.toReversed());
  assert.equal(e.privateView(match, first), null);
  assert(e.privateView(match, second));
  assert.deepEqual(e.publicView(match).batch.submittedIds, [first]);
  assert.deepEqual(e.publicView(match).ranking, []);
  assert.equal(e.submitRanking(match, first, ids), null);
  assert.equal(e.updateRankingPreview(match, first, ids, null), null);
  assert.equal(e.reveal(match), null);
});

test('all simultaneous locks show slides immediately and score guesses one review at a time', () => {
  let match = makeBatch();
  const rankers = e.publicView(match).batch.rankerIds;
  const assignments = rankers.map(id => e.privateView(match, id).prompt);
  const names = players.map(p => p.id);
  const late = { id: 'late-guest', name: 'Late Guest', connected: true };
  for (let i = rankers.length - 1; i >= 0; i--) {
    match = e.submitRanking(match, rankers[i], i % 2 ? names : names.toReversed(), [...players, late]);
    if (i > 0) assert.equal(match.phase, 'batch_ranking');
  }
  for (let i = 0; i < rankers.length; i++) {
    const start = e.publicView(match);
    assert.equal(start.phase, 'hint');
    assert.equal(start.round, i + 1);
    assert.equal(start.totalRounds, rankers.length);
    assert.equal(start.ranker.id, rankers[i]);
    assert.deepEqual(start.ranking.map(p => p.id), i % 2 ? names : names.toReversed());
    assert.equal(start.batch, null);
    assert.equal(start.correct, null);
    assert.equal(start.customPrompt, i < customPrompts.length);
    assert(start.eligibleGuesserIds.includes(late.id));
    assert(!start.eligibleGuesserIds.includes(rankers[i]));
    assert.equal(e.privateView(match, rankers[i]), null);
    const guessing = e.showOptions(match);
    assert.equal(guessing.options.length, 6);
    assert(!guessing.options.some(option => assignments.some((other, j) => j !== i && option.id === other.id)));
    const correctChoice = e.publicView(guessing).options.find(option => option.text === assignments[i].text);
    const locked = e.submitGuess(guessing, late.id, correctChoice.id);
    const revealed = e.reveal(locked);
    assert.equal(e.publicView(revealed).correct.id, correctChoice.id);
    assert.equal(revealed.scores[late.id], i + 1);
    match = e.nextRound(revealed, [...players, late], bank);
  }
  assert.equal(match.phase, 'finished');
  assert.deepEqual(match.consumedCustomPromptIds, customPrompts.map(prompt => prompt.id));
});

test('simultaneous timeout locks explicit orders and latest drafts, with default for untouched seats', () => {
  let match = makeBatch();
  const rankers = e.publicView(match).batch.rankerIds;
  const roster = players.map(player => player.id);
  const draft = roster.slice(1).concat(roster[0]);
  const lastDraft = roster.slice(2).concat(roster.slice(0, 2));
  const explicitlyLocked = roster.toReversed();
  assert.equal(e.skipRound(match, players, bank), null, 'simultaneous ranking cannot be manually skipped');
  match = e.updateRankingPreview(match, rankers[0], draft, null);
  match = e.updateRankingPreview(match, rankers[0], lastDraft, null);
  match = e.updateRankingPreview(match, rankers[1], draft, null);
  match = e.submitRanking(match, rankers[1], explicitlyLocked);
  assert.equal(match.phase, 'batch_ranking');
  const later = players.map(p => p.id === rankers[0] ? { ...p, connected: false } : p);
  match = e.expireRanking(match, later);
  for (const [index, expected] of [lastDraft, explicitlyLocked, roster, roster].entries()) {
    const view = e.publicView(match);
    assert.equal(view.phase, 'hint');
    assert.equal(view.ranker.id, rankers[index]);
    assert.equal(view.ranker.connected, index > 0);
    assert.equal(view.totalRounds, rankers.length);
    assert.equal(view.round, index + 1);
    assert.deepEqual(view.ranking.map(p => p.id), expected);
    assert.equal(view.correct, null);
    assert.equal(e.expireRanking(match, later), null);
    match = e.nextRound(e.reveal(match), later, bank);
  }
  assert.equal(match.phase, 'finished');
  assert.deepEqual(match.consumedCustomPromptIds, customPrompts.map(prompt => prompt.id));
});

test('turn-by-turn timeout reviews the last live order or the displayed default instead of skipping', () => {
  const base = round();
  const originalOrder = base.rankTargets.map(player => player.id);
  const reversed = originalOrder.toReversed();
  const draft = e.updateRankingPreview(base, base.ranker.id, reversed, { id: reversed[0], position: 0.3 });
  const reviewed = e.expireRanking(draft, players);
  assert.equal(reviewed.phase, 'hint');
  assert.equal(reviewed.ranker.id, base.ranker.id);
  assert.equal(reviewed.round, base.round);
  assert.deepEqual(reviewed.ranking.map(player => player.id), reversed);
  assert.equal(reviewed.preview, null);
  assert.deepEqual(e.expireRanking(base, players).ranking.map(player => player.id), originalOrder);
  const offline = players.map(player => player.id === base.ranker.id ? { ...player, connected: false } : player);
  assert.notEqual(e.skipRound(base, offline, bank).ranker.id, base.ranker.id);
});

test('a player question matching a built-in still goes first, without duplicating its choice', () => {
  const custom = { id: 'room-builtin-match', text: bank[0].text };
  const match = e.createMatch(players, bank, () => 0.8, undefined, { customPrompts: [custom] });
  assert.equal(match.correct.id, custom.id);
  assert.equal(match.options.filter(option => option.text === custom.text).length, 1);
  const next = e.nextRound(e.reveal(rank(match)), players, bank);
  assert(!next.options.some(option => option.id === bank[0].id));
});

test('six distinct options stay in the chosen bank over whole matches including full-size simultaneous rooms', async () => {
  const { INSIDE_RANKS_DARK_PROMPTS: dark } = await load('./dark-prompts.ts');
  for (const deck of [bank, dark]) for (const simultaneous of [false, true]) {
    const largeGroup = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: `Player ${i}`, connected: true }));
    const deckIds = new Set(deck.map(prompt => prompt.id));
    for (const seed of [2, 19, 42]) {
      let n = seed;
      const rng = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 2 ** 32);
      let match = e.createMatch(largeGroup, deck, rng, undefined, { simultaneous });
      for (let reviewNumber = 1; reviewNumber <= largeGroup.length; reviewNumber++) {
        if (match.phase === 'ranking' || match.phase === 'batch_ranking') match = e.expireRanking(match, largeGroup);
        assert.equal(match.reviewNumber, reviewNumber);
        assert.equal(e.publicView(match).options.length, 0);
        const guess = e.showOptions(match);
        assert.equal(guess.options.length, 6);
        assert.equal(new Set(guess.options.map(o => o.text)).size, 6);
        assert.equal(guess.options.filter(o => o.id === guess.correct.id).length, 1);
        assert(guess.options.every(o => deckIds.has(o.id)));
        match = e.nextRound(e.reveal(guess), largeGroup, deck, rng);
      }
      assert.equal(match.phase, 'finished');
    }
  }
});

test('ranking warnings appear briefly at 30 and 10 seconds, not at zero', () => {
  assert.deepEqual([31, 30, 27, 26, 11, 10, 7, 6, 0].map(e.rankingTimeWarning),
    [null, 30, 30, null, null, 10, 10, null, null]);
});

test('Dark reshuffles are private and bounded per player, preserve drafts and leave custom no-hint behavior intact', async () => {
  const { INSIDE_RANKS_DARK_PROMPTS: dark } = await load('./dark-prompts.ts');
  const customPrompts = [
    { id: 'custom-first', text: 'Who would leave everyone on read after borrowing their charger?', authorId: players[0].id },
    { id: 'custom-second', text: 'Who would bring three desserts to a potluck?', authorId: players[1].id },
  ];
  for (const simultaneous of [false, true]) {
    const start = e.createMatch(players, dark, () => 0.8, undefined, { simultaneous, anonymous: true, customPrompts });
    const player = simultaneous ? start.batchAssignments[0].ranker : start.ranker;
    const ids = [...players].reverse().map(p => p.id);
    const initial = e.privateView(start, player.id).prompt;
    const seen = new Set([initial.id]);
    assert.equal(initial.id, 'custom-first');
    const other = players.find(p => p.id !== player.id);
    assert.equal(e.reshuffleQuestion(start, other.id, initial.id, dark), null);
    assert.equal(e.reshuffleQuestion({ ...start, anonymous: false }, player.id, initial.id, dark), null);
    let match = e.updateRankingPreview(start, player.id, ids, null);
    for (let left = 2; left >= 0; left--) {
      const priorId = e.privateView(match, player.id).prompt.id;
      match = e.reshuffleQuestion(match, player.id, priorId, dark, () => 0.8);
      assert(match);
      const { prompt, orderedIds } = e.privateView(match, player.id);
      assert(!seen.has(prompt.id));
      seen.add(prompt.id);
      assert.deepEqual(orderedIds, ids);
      assert.equal(e.reshufflesLeft(match, player.id), left);
      assert.equal(e.reshufflesLeft(match, other.id), 3);
      assert.equal(e.reshuffleQuestion(match, player.id, priorId, dark), null);
      assert(!JSON.stringify(e.publicView(match)).includes(prompt.text));
      assert.notEqual(customPrompts.find(p => p.id === prompt.id)?.authorId, player.id);
    }
    assert.equal(e.reshuffleQuestion(match, player.id, e.privateView(match, player.id).prompt.id, dark), null);
    const expired = e.expireRanking(match, players);
    assert.deepEqual(expired.ranking.map(p => p.id), ids);
    assert.equal(expired.options.length, 6);
    assert.equal(e.publicView(expired).options.length, 0);
    assert.equal(e.reshuffleQuestion(expired, player.id, expired.correct.id, dark), null);
    assert.equal(e.reshufflesLeft(start, player.id), 3);
  }
});

test('reveal publishes every choice’s share of valid submitted guesses without exposing Dark identities', async () => {
  const { INSIDE_RANKS_DARK_PROMPTS: dark } = await load('./dark-prompts.ts');
  for (const simultaneous of [false, true]) for (const anonymous of [false, true]) {
    const custom = { id: 'my-question', text: 'Who would show up with three lunches?' };
    const initial = e.createMatch(players, anonymous ? dark : bank, () => 0.8, undefined,
      { simultaneous, anonymous, customPrompts: [custom] });
    const review = e.expireRanking(initial, players);
    assert.equal(e.publicView(review).hint, null);
    assert.equal(e.publicView(review).guessBreakdown, null);
    assert.equal(e.publicView(e.reveal(review)).guessBreakdown, null);
    let guessing = e.showOptions(review);
    const opts = e.publicView(guessing).options;
    const right = opts.find(option => option.text === custom.text);
    const wrong = opts.find(option => option.id !== right.id);
    assert.equal(e.publicView(e.reveal(guessing)).guessBreakdown.total, 0);
    assert(e.publicView(e.reveal(guessing)).guessBreakdown.choices.every(choice => choice.percent === 0));
    const [first, second] = guessing.eligibleGuesserIds;
    guessing = e.submitGuess(guessing, first, right.id);
    assert.equal(e.submitGuess(guessing, first, wrong.id), null);
    assert.equal(e.submitGuess(guessing, second, 'invalid'), null);
    guessing = e.submitGuess(guessing, second, wrong.id);
    assert.equal(e.publicView(guessing).guessBreakdown, null);
    const result = e.publicView(e.reveal(guessing));
    assert.equal(result.guessBreakdown.total, 2);
    assert.equal(result.correct.id, right.id);
    assert.deepEqual(result.guessBreakdown.choices, opts.map(option => ({
      optionId: option.id, percent: [right.id, wrong.id].includes(option.id) ? 50 : 0,
    })));
    if (anonymous) {
      assert.deepEqual(result.guessedIds, []);
      assert.deepEqual(result.results, []);
      assert(!JSON.stringify(result.guessBreakdown).includes(first));
    }
  }
});
