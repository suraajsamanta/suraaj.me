import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url),dir=mkdtempSync(join(tmpdir(),'madfun-floor-'));
const result=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),'src/app/madfun/floor-is-trouble/engine.ts','--outDir',dir,'--module','commonjs','--target','es2020','--skipLibCheck'],{cwd:process.cwd(),encoding:'utf8'});
assert.equal(result.status,0,result.stdout+result.stderr);
const {SIDE,createFloor,stepFloor}=require(join(dir,'floor.js'));
const {createArena,startMatch,tickArena}=require(join(dir,'engine.js'));
process.on('exit',()=>rmSync(dir,{recursive:true,force:true}));
const empty=new Map();
const advance=(s,n,input=empty)=>{for(let i=0;i<n;i++)stepFloor(s,input,.05);};
test('all ten players start on intact tiles at distinct locations',()=>{
  const s=createFloor(Array.from({length:10},(_,i)=>String(i)));
  assert.equal(s.players.length,10);
  assert.equal(new Set(s.players.map(p=>p.x+':'+p.y)).size,10);
  assert.equal(s.tiles.length,SIDE*SIDE);
  assert.ok(s.tiles.every(t=>t===0));
});
test('waves visibly warn before holes form',()=>{
  const s=createFloor(['a']);
  advance(s,35);
  assert.ok(s.tiles.includes(1));
  assert.ok(!s.tiles.includes(2));
  advance(s,20);
  assert.ok(s.tiles.includes(2));
});
test('last standing wins; simultaneous elimination is a draw',()=>{
  const win=createFloor(['a','b']);
  win.players[0].x=-1;
  stepFloor(win,empty,.05);
  assert.equal(win.ended,true);
  assert.deepEqual(win.winners,['b']);
  const draw=createFloor(['a','b']);
  for(const p of draw.players)p.x=-1;
  stepFloor(draw,empty,.05);
  assert.equal(draw.ended,true);
  assert.deepEqual(draw.winners,[]);
});
test('jump crosses a hole and does not repeat while held',()=>{
  const s=createFloor(['a']);
  const p=s.players[0];
  p.x=4.85;p.y=4.5;p.vx=4.5;
  s.tiles[4*SIDE+5]=2;
  const moving=new Map([['a',{x:1,y:0,jump:true}]]);
  advance(s,8,moving);
  assert.ok(p.alive && p.x>6);
  for(let i=0;i<30;i++)stepFloor(s,new Map([['a',{x:0,y:0,jump:true}]]),.05);
  assert.equal(p.airborne,0);
});
test('full five-round match and rematch reset the floor and scores',()=>{
  const s=createArena([{id:'a',name:'A',color:'#fff'},{id:'b',name:'B',color:'#000'}]);
  assert.ok(startMatch(s));
  const tick=(n)=>{for(let i=0;i<n;i++)tickArena(s,{},.05);};
  for(let i=1;i<=5;i++){
    tick(103);
    assert.equal(s.phase,'playing');
    s.floor.players[1].x=-1;
    tick(1);
    assert.equal(s.players[0].score,i);
    if(i<5){assert.equal(s.phase,'roundOver');tick(55);}
  }
  assert.equal(s.phase,'matchOver');
  assert.equal(s.winnerId,'a');
  assert.ok(startMatch(s));
  assert.equal(s.round,1);
  assert.equal(s.players[0].score,0);
  assert.ok(s.floor.tiles.every(t=>t===0));
});
