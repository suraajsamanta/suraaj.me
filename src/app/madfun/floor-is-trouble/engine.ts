import { createFloor, stepFloor, SIDE, type FloorState, type FloorPlayer, type FloorInput } from './floor';
export { SIDE };
export const WIN_SCORE=5;
export type ArenaInput={x:number;y:number;throwSeq:number;dash:boolean};
type Roster={id:string;name:string;color:string;bot?:boolean};
type Player=Roster & FloorPlayer & { score:number; lastJump:number };
export type ArenaId='magma'|'circuit'|'glacier';
export const ARENAS:{id:ArenaId;name:string;seed:number;color:string}[]=[
  {id:'magma',name:'Magma Works',seed:0,color:'#fb7140'},
  {id:'circuit',name:'Circuit Breaker',seed:1,color:'#a88cff'},
  {id:'glacier',name:'Glacier Grid',seed:2,color:'#68dfff'},
];
export type ArenaState={version:1;arenaId:ArenaId;phase:'lobby'|'countdown'|'playing'|'roundOver'|'matchOver';phaseTime:number;round:number;floor:FloorState;players:Player[];winnerId:string|null;announcement:string};
export function createArena(roster:Roster[],arenaId:ArenaId='magma'):ArenaState{
  const state:ArenaState={version:1,arenaId,phase:'lobby',phaseTime:0,round:0,floor:createFloor([]),players:[],winnerId:null,announcement:'Gather your crew'};
  syncRoster(state,roster);
  return state;
}
export function syncRoster(s:ArenaState,roster:Roster[]){
  if(s.phase!=='lobby') return;
  const players=roster.filter((p,i,all)=>all.findIndex(other=>other.id===p.id)===i).slice(0,10);
  s.floor=createFloor(players.map(p=>p.id));
  s.players=players.map((p,i)=>({...p,...s.floor.players[i],score:0,lastJump:0}));
}
function resetRound(s:ArenaState){
  s.round++;
  const seed=ARENAS.find(arena=>arena.id===s.arenaId)?.seed??0;
  s.floor=createFloor(s.players.map(p=>p.id),{round:(s.round-1+seed)%4});
  s.players=s.players.map((p,i)=>({...p,...s.floor.players[i]}));
  s.phase='countdown';
  s.phaseTime=5;
  s.announcement='Get ready';
}
export function startMatch(s:ArenaState){
  if(s.players.length<2 || (s.phase!=='lobby'&&s.phase!=='matchOver'))return false;
  s.round=0;s.winnerId=null;
  for(const p of s.players)p.score=0;
  resetRound(s);
  return true;
}
function botInput(f:FloorState,p:FloorPlayer,i:number):FloorInput{
  const walkable=(x:number,y:number)=>x>=0&&x<SIDE&&y>=0&&y<SIDE&&f.tiles[Math.floor(y)*SIDE+Math.floor(x)]===0;
  const phase=(f.elapsed*0.75+i*1.7);
  const axes=Array.from({length:8},(_,j)=>[Math.cos(j*Math.PI/4),Math.sin(j*Math.PI/4)]);
  const ranked=axes.map(([x,y])=>{
    const near=walkable(p.x+x*.42,p.y+y*.42);
    const far=walkable(p.x+x*1.32,p.y+y*1.32);
    return {x,y,jump:!near&&far,score:(near?3:0)+(far?2:0)+(x*Math.cos(phase)+y*Math.sin(phase))*.8};
  }).sort((a,b)=>b.score-a.score);
  const best=ranked[0];
  return best.score>1?{x:best.x*.72,y:best.y*.72,jump:best.jump}:{x:0,y:0,jump:false};
}
export function tickArena(s:ArenaState,inputs:Record<string,ArenaInput>,dt:number){
  if(!(dt>0))return;
  dt=Math.min(.05,dt);
  if(s.phase==='countdown'||s.phase==='roundOver'){
    for(const p of s.players)p.lastJump=inputs[p.id]?.throwSeq??p.lastJump;
    s.phaseTime-=dt;
    if(s.phaseTime>0)return;
    if(s.phase==='roundOver'){resetRound(s);return;}
    s.phase='playing';s.announcement='';
  }
  if(s.phase!=='playing')return;
  const movement=new Map<string,FloorInput>();
  s.players.forEach((p,i)=>{
    if(p.bot){movement.set(p.id,botInput(s.floor,s.floor.players[i],i));return;}
    const input=inputs[p.id];
    const seq=input?.throwSeq??0;
    movement.set(p.id,{x:input?.x??0,y:input?.y??0,jump:seq>p.lastJump});
    p.lastJump=Math.max(seq,p.lastJump);
  });
  stepFloor(s.floor,movement,dt);
  for(let i=0;i<s.players.length;i++)Object.assign(s.players[i],s.floor.players[i]);
  if(!s.floor.ended)return;
  const winner=s.players.find(p=>s.floor.winners.includes(p.id));
  if(winner)winner.score++;
  s.announcement=winner?`${winner.name} survived!`:'Nobody made it!';
  if(winner && winner.score>=WIN_SCORE){s.winnerId=winner.id;s.phase='matchOver';return;}
  // End an extended series of simultaneous eliminations rather than trapping a room.
  if(s.round>=15){
    const best=[...s.players].sort((a,b)=>b.score-a.score);
    s.winnerId=best[0].score>best[1].score?best[0].id:null;
    s.phase='matchOver';
    return;
  }
  s.phase='roundOver';s.phaseTime=2.7;
}
