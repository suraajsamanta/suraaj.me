/** Host-authoritative, serializable party arena simulation. No network or DOM dependencies. */
export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 760;
export const WIN_SCORE = 5;
export type ArenaInput = { x: number; y: number; throwSeq: number; dash: boolean };
export type ArenaRosterPlayer = { id: string; name: string; color: string; bot?: boolean };
export type ArenaId = 'garden' | 'neon' | 'island';
export type Obstacle = { x: number; y: number; w: number; h: number };
export const ARENAS: { id: ArenaId; name: string; subtitle: string; color: string; obstacles: Obstacle[] }[] = [
  { id: 'garden', name: 'Picnic Panic', subtitle: 'Take cover. Bring snacks.', color: '#89e5a0', obstacles: [{x:340,y:230,w:150,h:75},{x:710,y:455,w:150,h:75},{x:540,y:330,w:120,h:100}] },
  { id: 'neon', name: 'Neon Noodles', subtitle: 'Fast lanes. Sharp returns.', color: '#c0a0ff', obstacles: [{x:270,y:210,w:80,h:340},{x:850,y:210,w:80,h:340},{x:490,y:330,w:220,h:85}] },
  { id: 'island', name: 'Sunset Scramble', subtitle: 'A tiny island. A big grudge.', color: '#ffbc77', obstacles: [{x:350,y:210,w:125,h:100},{x:725,y:210,w:125,h:100},{x:535,y:450,w:130,h:95}] },
];
export type Fighter = ArenaRosterPlayer & { x:number;y:number;dx:number;dy:number;alive:boolean;score:number;kills:number;lastThrow:number;dashHeld:boolean;dashTime:number;dashCooldown:number;shield:number;eliminatedAt:number };
export type Boomerang = {id:number;owner:string;x:number;y:number;vx:number;vy:number;age:number;returning:boolean;hits:string[]};
export type ArenaEffect = {id:number;x:number;y:number;kind:'throw'|'hit'|'dash'|'catch'|'win';color:string;life:number};
export type ArenaState = { version:1; arenaId:ArenaId; phase:'lobby'|'countdown'|'playing'|'roundOver'|'matchOver'; players:Fighter[]; boomerangs:Boomerang[]; effects:ArenaEffect[]; time:number; phaseTime:number; round:number; winnerId:string|null; roundWinnerId:string|null; nextId:number; safeInset:number; announcement:string };
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export function createArena(roster:ArenaRosterPlayer[],arenaId:ArenaId='garden'):ArenaState {
  const state:ArenaState={version:1,arenaId:ARENAS.some(a=>a.id===arenaId)?arenaId:'garden',phase:'lobby',players:[],boomerangs:[],effects:[],time:0,phaseTime:0,round:0,winnerId:null,roundWinnerId:null,nextId:1,safeInset:0,announcement:'Gather your crew'};
  syncRoster(state,roster); return state;
}
export function syncRoster(state:ArenaState,roster:ArenaRosterPlayer[]):void {
  if(state.phase!=='lobby') return;
  const unique=roster.filter((p,i,a)=>a.findIndex(q=>q.id===p.id)===i).slice(0,10);
  state.players=unique.map((p,i)=>({...p,x:600+Math.cos(i/unique.length*Math.PI*2)*430,y:380+Math.sin(i/unique.length*Math.PI*2)*250,dx:-Math.cos(i/unique.length*Math.PI*2),dy:-Math.sin(i/unique.length*Math.PI*2),alive:true,score:0,kills:0,lastThrow:0,dashHeld:false,dashTime:0,dashCooldown:0,shield:0,eliminatedAt:0}));
}
function resetRound(s:ArenaState) {
  const n=s.players.length;
  s.players.forEach((p,i)=>{const a=(i/n+s.round*.071)*Math.PI*2;p.x=600+Math.cos(a)*460;p.y=380+Math.sin(a)*270;p.dx=-Math.cos(a);p.dy=-Math.sin(a);p.alive=true;p.dashTime=0;p.dashCooldown=0;p.shield=1.2;p.dashHeld=false;});
  s.boomerangs=[];s.effects=[];s.phase='countdown';s.phaseTime=5;s.time=0;s.safeInset=0;s.roundWinnerId=null;s.announcement='Get ready';
}
export function startMatch(s:ArenaState):boolean {
  if(s.players.length<2 || !['lobby','matchOver'].includes(s.phase))return false;
  s.players.forEach(p=>{p.score=0;p.kills=0;});s.round=1;s.winnerId=null;resetRound(s);return true;
}
export function returnToLobby(s:ArenaState):void {s.phase='lobby';s.phaseTime=0;s.boomerangs=[];s.effects=[];s.announcement='Gather your crew';}
function effect(s:ArenaState,p:{x:number;y:number},kind:ArenaEffect['kind'],color:string){s.effects.push({id:s.nextId++,x:p.x,y:p.y,kind,color,life:.65});}
function kill(s:ArenaState,p:Fighter,attacker?:Fighter){if(!p.alive)return;p.alive=false;p.eliminatedAt=s.time;effect(s,p,'hit',p.color);if(attacker&&attacker.id!==p.id)attacker.kills++;}
function move(p:Fighter,x:number,y:number,obstacles:Obstacle[],inset:number){
  const r=22;p.x=clamp(x,35+r,WORLD_WIDTH-35-r);p.y=clamp(y,35+r,WORLD_HEIGHT-35-r);
  for(const o of obstacles){const nx=clamp(p.x,o.x,o.x+o.w),ny=clamp(p.y,o.y,o.y+o.h);const dx=p.x-nx,dy=p.y-ny;const d=Math.hypot(dx,dy);if(d<r){if(d>.001){p.x+=dx/d*(r-d);p.y+=dy/d*(r-d);}else{const sides=[Math.abs(p.x-o.x),Math.abs(p.x-o.x-o.w),Math.abs(p.y-o.y),Math.abs(p.y-o.y-o.h)];const side=sides.indexOf(Math.min(...sides));if(side===0)p.x=o.x-r;if(side===1)p.x=o.x+o.w+r;if(side===2)p.y=o.y-r;if(side===3)p.y=o.y+o.h+r;}}}
  void inset;
}
function botInput(s:ArenaState,p:Fighter):ArenaInput {
  const target=s.players.filter(q=>q.alive&&q.id!==p.id).sort((a,b)=>distance(p,a)-distance(p,b))[0];if(!target)return{x:0,y:0,throwSeq:p.lastThrow,dash:false};
  const a=Math.atan2(target.y-p.y,target.x-p.x);const wiggle=Math.sin(s.time*2+s.players.indexOf(p)*2)*.55;const dist=distance(p,target);const angle=a+(dist<160?Math.PI/2:wiggle);
  return {x:Math.cos(angle),y:Math.sin(angle),throwSeq:Math.floor(s.time/1.65)+1,dash:Math.floor(s.time*2+s.players.indexOf(p))%9===0};
}
export function tickArena(s:ArenaState,inputs:Record<string,ArenaInput>,dt:number):void {
  if(!Number.isFinite(dt)||dt<=0)return;
  // Bounded substeps prevent tunneling and make low-frame-rate hosts fair.
  let remaining=Math.min(dt,.2);while(remaining>0){const h=Math.min(remaining,1/120);step(s,inputs,h);remaining-=h;}
}
function step(s:ArenaState,inputs:Record<string,ArenaInput>,dt:number){
  s.effects.forEach(e=>e.life-=dt);s.effects=s.effects.filter(e=>e.life>0).slice(-60);
  if(s.phase==='lobby'||s.phase==='matchOver')return;
  if(s.phase==='countdown'){s.phaseTime-=dt;for(const p of s.players){const input=inputs[p.id];if(input&&Number.isSafeInteger(input.throwSeq))p.lastThrow=Math.max(p.lastThrow,input.throwSeq);p.dashHeld=input?.dash===true;}if(s.phaseTime<=0){s.phase='playing';s.phaseTime=0;s.announcement='THROW DOWN!';}return;}
  if(s.phase==='roundOver'){s.phaseTime-=dt;if(s.phaseTime<=0){const champion=s.players.find(p=>p.score>=WIN_SCORE);if(champion){s.winnerId=champion.id;s.phase='matchOver';s.announcement=`${champion.name} wins!`;}else{s.round++;resetRound(s);}}return;}
  s.time+=dt;s.safeInset=clamp((s.time-30)*7,0,330);const obstacles=ARENAS.find(a=>a.id===s.arenaId)!.obstacles;
  for(const p of s.players){
    if(!p.alive)continue;p.shield=Math.max(0,p.shield-dt);p.dashCooldown=Math.max(0,p.dashCooldown-dt);p.dashTime=Math.max(0,p.dashTime-dt);
    const input=p.bot?botInput(s,p):inputs[p.id];const x=Number.isFinite(input?.x)?clamp(input.x,-1,1):0,y=Number.isFinite(input?.y)?clamp(input.y,-1,1):0;const length=Math.hypot(x,y);if(length>.08){p.dx=x/length;p.dy=y/length;}
    if(input?.dash&&!p.dashHeld&&p.dashCooldown<=0){p.dashTime=.2;p.dashCooldown=1.65;effect(s,p,'dash',p.color);}p.dashHeld=input?.dash===true;
    const speed=p.dashTime>0?710:235;move(p,p.x+(p.dashTime>0?p.dx:x/Math.max(1,length))*speed*dt,p.y+(p.dashTime>0?p.dy:y/Math.max(1,length))*speed*dt,obstacles,s.safeInset);
    if(input&&Number.isSafeInteger(input.throwSeq)&&input.throwSeq>p.lastThrow){p.lastThrow=input.throwSeq;const active=s.boomerangs.find(b=>b.owner===p.id);if(active){active.returning=true;}else{s.boomerangs.push({id:s.nextId++,owner:p.id,x:p.x+p.dx*30,y:p.y+p.dy*30,vx:p.dx*580,vy:p.dy*580,age:0,returning:false,hits:[]});effect(s,p,'throw',p.color);}}
    if(s.safeInset>0&&(p.x<s.safeInset||p.x>WORLD_WIDTH-s.safeInset||p.y<s.safeInset||p.y>WORLD_HEIGHT-s.safeInset))kill(s,p);
  }
  for(const b of s.boomerangs){
    const owner=s.players.find(p=>p.id===b.owner);b.age+=dt;if(b.age>.68)b.returning=true;
    if(b.returning&&owner){const d=Math.max(1,distance(b,owner));b.vx=(owner.x-b.x)/d*690;b.vy=(owner.y-b.y)/d*690;if(d<30){b.age=99;effect(s,owner,'catch',owner.color);continue;}}
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    if(b.x<38||b.x>1162||b.y<38||b.y>722){b.returning=true;b.x=clamp(b.x,38,1162);b.y=clamp(b.y,38,722);}
    if(!b.returning&&obstacles.some(o=>b.x>o.x-8&&b.x<o.x+o.w+8&&b.y>o.y-8&&b.y<o.y+o.h+8))b.returning=true;
    for(const p of s.players)if(p.alive&&p.id!==b.owner&&!b.hits.includes(p.id)&&distance(p,b)<32&&p.shield<=0&&p.dashTime<=0){kill(s,p,owner);b.hits.push(p.id);b.returning=true;}
  }
  s.boomerangs=s.boomerangs.filter(b=>b.age<3);
  const alive=s.players.filter(p=>p.alive);if(alive.length<=1||s.time>=75){s.phase='roundOver';s.phaseTime=3;s.roundWinnerId=alive.length===1?alive[0].id:null;if(alive.length===1){alive[0].score++;s.announcement=`${alive[0].name} takes the round`;effect(s,alive[0],'win',alive[0].color);}else{s.announcement='A draw! Run it back.';}}
}
