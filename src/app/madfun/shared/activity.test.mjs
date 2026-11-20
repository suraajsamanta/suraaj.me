import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const {outputText} = ts.transpileModule(await readFile(new URL('./activity.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
const {createActivityTracker} = await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));

function harness() {
  let id = 0;
  const emitted = [];
  const tracker = createActivityTracker('inside-ranks', () => `opaque-${++id}`, event => emitted.push(event));
  const observe = (now, state = {}) => tracker.observe({host:true,room:'ROOMXX',online:true,phase:'lobby',players:[],...state}, now);
  return { tracker, emitted, observe };
}

test('only connected host snapshots count actual room joins; reconnects do not inflate seats', () => {
  const {emitted, observe} = harness();
  observe(1,{host:false,players:['player-token']});
  observe(2,{online:false,players:['player-token']});
  assert.deepEqual(emitted,[]);
  observe(3,{players:['player-token']});
  observe(4);
  observe(5,{players:['player-token']});
  assert.deepEqual(emitted,[{game:'inside-ranks',kind:'game_join',matchId:'opaque-1',roomId:'opaque-1',playerId:'opaque-2'}]);
  assert.doesNotMatch(JSON.stringify(emitted), /ROOMXX|player-token/);
});

test('stops timing during player and host outages, excludes non-players and generates independent rematches', () => {
  const {emitted, observe, tracker} = harness();
  const play = (now, s={}) => observe(now,{phase:'playing',matchKey:1,players:['real','lobby'],playingPlayers:['real'],...s});
  play(50);
  play(70,{players:['lobby']});
  play(85);
  tracker.heartbeat(95);
  play(100,{online:false});
  play(110);
  observe(130,{phase:'finished',matchKey:1});
  observe(131,{phase:'finished',matchKey:1});
  play(132,{matchKey:2});
  const types = (kind) => emitted.filter(e=>e.kind===kind);
  const [start, rematch] = types('game_start');
  assert.notEqual(start.matchId,rematch.matchId);
  assert.equal(start.roomId,rematch.roomId);
  assert.deepEqual(types('game_end'),[{game:'inside-ranks',kind:'game_end',matchId:start.matchId,roomId:start.roomId,durationMs:80,outcome:'completed'}]);
  assert.deepEqual(types('game_player_duration'),[{game:'inside-ranks',kind:'game_player_duration',matchId:start.matchId,roomId:start.roomId,playerId:'opaque-2',durationMs:50,outcome:'completed',estimated:true}]);
});

test('abandoned matches and durations are estimated and only emit once', () => {
  const {emitted, observe, tracker} = harness();
  observe(20,{phase:'playing',players:['real']});
  tracker.heartbeat(50);
  tracker.abandon(75);
  tracker.abandon(90);
  observe(100,{phase:'playing',players:['real']});
  assert.deepEqual(emitted.map(e=>e.kind),['game_join','game_start','game_end','game_player_duration']);
  assert.deepEqual(emitted.slice(2).map(({outcome,estimated})=>[outcome,estimated]),[['abandoned',true],['abandoned',true]]);
  assert.equal(emitted.at(-1).durationMs,30);
});
