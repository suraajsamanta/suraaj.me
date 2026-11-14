import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('./engine.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const e = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const words = Array.from({length: 100}, (_, i) => 'word' + i);
const seat = (team, role, id = team + role) => ({ id, name: id, connected: true, team, role });
const clue = (game, count = 1) => e.applyAction(game, seat(game.turn, 'spymaster'), {type:'clue', word:'Animals', count});
const guess = (game, index) => e.applyAction(game, seat(game.turn, 'guesser'), {type:'guess', index});

test('new games contain 25 unique words and both valid starting-team allocations', () => {
  for (const rng of [() => 0.2, () => 0.8]) {
    const g = e.createGame([...words, 'WORD1   ', ''], rng);
    assert.equal(new Set(g.board.map(c => c.word)).size, 25);
    assert.equal(g.board.length, 25);
    assert.equal(g.board.filter(c => c.kind === g.turn).length, 9);
    assert.equal(g.board.filter(c => c.kind === e.otherTeam(g.turn)).length, 8);
    assert.equal(g.board.filter(c => c.kind === 'neutral').length, 7);
    assert.equal(g.board.filter(c => c.kind === 'assassin').length, 1);
  }
  assert.notDeepEqual(e.createGame(words, () => 0.2).board.map(c => c.word), e.createGame(words, () => 0.8).board.map(c => c.word));
  assert.throws(() => e.createGame(Array(30).fill('word')), RangeError);
});

test('private key is absent from unrevealed public cards and action processing does not mutate input', () => {
  const original = e.createGame(words);
  assert(e.getBoardView(original).every(c => c.kind === null));
  assert(e.getBoardView(original, true).every(c => c.kind !== null));
  const g = clue(original);
  const index = g.board.findIndex(c => c.kind === 'neutral');
  const next = guess(g, index);
  assert.equal(g.board[index].revealed, false);
  const visible = e.getBoardView(next);
  assert.equal(visible[index].kind, 'neutral');
  assert.equal(visible.filter(c => c.kind !== null).length, 1);
});

test('start requires both teams and exactly one clue-giver per team', () => {
  const red = seat('red', 'spymaster'), blue = seat('blue', 'spymaster');
  const r = seat('red', 'guesser'), b = seat('blue', 'guesser');
  assert(!e.canStart([red, blue, r]));
  assert(e.canStart([red, blue, r, b]));
  assert(!e.canStart([red, blue, r, {...b, connected:false}]));
  assert.equal(e.assignSeat([red, blue, r, b], r.id, 'red', 'spymaster'), null);
  assert.equal(e.assignSeat([red, blue, r, b], r.id, null, 'spymaster'), null);
  assert.equal(e.assignSeat([red, blue, r, b], r.id, 'blue', 'guesser')[2].team, 'blue');
});

test('only authorized turn roles can submit a valid clue or guess; correct guesses allow one bonus', () => {
  const g = e.createGame(words), side = g.turn, other = e.otherTeam(side);
  for (const actor of [seat(side, 'guesser'), seat(other, 'spymaster'), {...seat(side, 'spymaster'), connected:false}]) {
    assert.equal(e.applyAction(g, actor, {type:'clue', word:'animal', count:1}), null);
  }
  const actor = seat(side, 'spymaster');
  for (const [word, count] of [['two words',1],['animal',0],['animal',10],['animal',1.5]]) {
    assert.equal(e.applyAction(g, actor, {type:'clue',word,count}), null);
  }
  assert(e.clueError([{word:'Cat', kind:null, revealed:false}], 'cat', 1));
  assert(!e.clueError([{word:'Cat', kind:null, revealed:true}], 'cat', 1));
  assert.equal(guess(g,0), null);
  const round = clue(g), [a,b] = round.board.flatMap((c,i)=>c.kind === side ? [i] : []);
  assert.equal(round.guessesRemaining, 2);
  assert.equal(e.applyAction(round, actor, {type:'guess',index:a}), null);
  assert.equal(e.applyAction(round, seat(other, 'guesser'), {type:'guess',index:a}), null);
  assert.equal(guess(round, -1), null);
  const second = guess(round,a);
  assert.equal(second.guessesRemaining, 1);
  assert.equal(guess(second,a), null);
  const next = guess(second,b);
  assert.equal(next.turn, other);
  assert.equal(next.phase, 'clue');
  assert.equal(next.turnNumber, 2);
});

test('a pass, neutral, or opposing tap ends the turn; the assassin awards the other team the win', () => {
  const g = clue(e.createGame(words)), other = e.otherTeam(g.turn);
  for (const kind of ['neutral', other]) {
    const next = guess(g,g.board.findIndex(c=>c.kind === kind));
    assert.equal(next.turn, other);
    assert.equal(next.phase, 'clue');
  }
  assert.equal(e.applyAction(g, seat(g.turn,'guesser'), {type:'pass'}).turn, other);
  const final = guess(g,g.board.findIndex(c=>c.kind==='assassin'));
  assert.equal(final.phase, 'finished');
  assert.equal(final.winner, other);
  assert.equal(guess(final,0), null);
});

test('revealing the last target awards that team the win, even on an opposing guess', () => {
  for (const own of [true, false]) {
    const g = clue(e.createGame(words));
    const victor = own ? g.turn : e.otherTeam(g.turn);
    const index = g.board.findIndex(c=>c.kind === victor);
    const ready = {...g, board:g.board.map((c,i)=>({...c, revealed:c.kind === victor && i !== index}))};
    const final = guess(ready,index);
    assert.equal(final.winner,victor);
    assert.equal(final.phase,'finished');
    assert.equal(e.getRemaining(final)[victor],0);
    assert(e.getBoardView(final).every(c => c.kind !== null));
  }
});
