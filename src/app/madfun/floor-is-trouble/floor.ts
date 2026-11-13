export type FloorInput = { x: number; y: number; jump: boolean };
export type FloorPlayer = { id:string; x:number; y:number; vx:number; vy:number; alive:boolean; jumped:boolean; airborne:number; cooldown:number; fellAt:number|null };
export type FloorState = { round:number; elapsed:number; nextWave:number; dropAt:number; wave:number; ended:boolean; winners:string[]; tiles:number[]; players:FloorPlayer[] };
export const SIDE = 13;
const tile = (x:number,y:number) => y*SIDE+x;
const clamp = (v:number,lo:number,hi:number) => Math.max(lo,Math.min(hi,v));
const unit = (v:number|undefined) => typeof v === "number" && Number.isFinite(v) ? clamp(v,-1,1) : 0;
const safe = (s:FloorState,x:number,y:number) => x>=0 && y>=0 && x<SIDE && y<SIDE && s.tiles[tile(Math.floor(x),Math.floor(y))] !== 2;

export function createFloor(ids:string[], { round = 0 } = {}):FloorState {
  return {
    round, elapsed: 0, nextWave: 1.6, dropAt: Number.MAX_SAFE_INTEGER, wave: 0, ended: false, winners: [],
    tiles: Array(SIDE*SIDE).fill(0),
    players: ids.slice(0,10).map((id,i) => {
      const angle=(i/ids.length)*2*Math.PI;
      return { id, x:SIDE/2+4*Math.cos(angle), y:SIDE/2+4*Math.sin(angle), vx:0, vy:0, alive:true, jumped:false, airborne:0, cooldown:0, fellAt:null };
    }),
  };
}

function wave(s:FloorState) {
  const cells = s.tiles.flatMap((v,i)=>v===0?[i]:[]);
  const pace = Math.min(1,s.elapsed/38);
  const count = Math.min(cells.length,5 + Math.floor(6*pace));
  // Rotate through lane, checker, and outer-ring patterns. A reproducible tie break
  // keeps server and test simulations consistent without relying on Math.random.
  const kind=(s.round+s.wave)%4;
  const key=(i:number)=>{
    const x=i%SIDE,y=Math.floor(i/SIDE);
    const center=(s.wave*7+s.round*3)%SIDE;
    const wobble=((Math.imul(i+1,104729)^Math.imul(s.wave+1,16127))>>>0)%997/997;
    if(kind===0)return Math.abs(x-center)+wobble;
    if(kind===1)return Math.abs(y-center)+wobble;
    if(kind===2)return Math.min(x,y,SIDE-1-x,SIDE-1-y)+wobble;
    return (x+y+s.wave)%2+wobble;
  };
  cells.sort((a,b)=>key(a)-key(b));
  for(const i of cells.slice(0,count)) s.tiles[i]=1;
  s.wave++;
  s.dropAt=s.elapsed+1.05-0.32*pace;
  s.nextWave=s.elapsed+1.85-0.6*pace;
}

export function stepFloor(s:FloorState, inputs:Map<string,FloorInput>, dt:number) {
  if(s.ended || !(dt>0))return s;
  // A stalled frame should not advance someone across a gap or skip telegraphs.
  dt=Math.min(0.05,dt);
  s.elapsed+=dt;
  if(s.elapsed>=s.dropAt){
    s.tiles=s.tiles.map((v)=>v===1?2:v);
    s.dropAt=Number.MAX_SAFE_INTEGER;
  }
  if(s.elapsed>=s.nextWave)wave(s);
  const survivors=s.players.filter(p=>p.alive);
  for(const p of survivors){
    const input=inputs.get(p.id);
    const x=unit(input?.x),y=unit(input?.y);
    const mag=Math.max(1,Math.hypot(x,y));
    p.cooldown=Math.max(0,p.cooldown-dt);
    if(input?.jump && !p.jumped && !p.cooldown && safe(s,p.x,p.y)){
      p.airborne=.42;
      p.cooldown=1.2;
    }
    p.jumped=!!input?.jump;
    const speed=p.airborne>0?6.9:4.5;
    const response=Math.min(1,dt*(p.airborne>0?8:16));
    p.vx+=(speed*x/mag-p.vx)*response;
    p.vy+=(speed*y/mag-p.vy)*response;
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    p.airborne=Math.max(0,p.airborne-dt);
    if(!p.airborne && !safe(s,p.x,p.y)){
      p.alive=false;
      p.fellAt=s.elapsed;
    }
  }
  const living=s.players.filter(p=>p.alive);
  if(living.length<=1 && (s.players.length>1 || !living.length)){
    s.ended=true;
    s.winners=living.length ? living.map(p=>p.id) : [];
  }
  return s;
}
