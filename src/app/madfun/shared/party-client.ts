'use client';
export type PartyRole='host'|'player'|'judge';export type PartyGame='simulator'|'jeopardy';
export type PartyPlayer={id:string;name:string;connected:boolean};
export type PartyAction={playerId:string;role:'player'|'judge';payload:unknown};
export type PartySnapshot={status:'idle'|'connecting'|'connected'|'reconnecting'|'error'|'closed';role:PartyRole|null;code:string|null;game:PartyGame|null;playerId:string|null;players:PartyPlayer[];judgeConnected:boolean;judgeInvite:string|null;hostConnected:boolean;locked:boolean;error:string|null};
const roomCode=/^[A-HJ-NP-Z2-9]{6}$/;
const simulatorSeatKey='madfun.simulator.seat.v1';
type SimulatorSeat={code:string;name:string;session:string};
const normalizeName=(value:string)=>value.trim().normalize('NFKC').toLowerCase();
const initial=():PartySnapshot=>({status:'idle',role:null,code:null,game:null,playerId:null,players:[],judgeConnected:false,judgeInvite:null,hostConnected:false,locked:false,error:null});
export class PartyClient{
 private snapshot=initial();private listeners=new Set<()=>void>();private actions=new Set<(a:PartyAction)=>void>();private states=new Set<(p:unknown)=>void>();private judges=new Set<(p:unknown)=>void>();private ws:WebSocket|null=null;private hello:Record<string,unknown>|null=null;private session:string|null=null;private retryTimer:ReturnType<typeof setTimeout>|null=null;private connectTimer:ReturnType<typeof setTimeout>|null=null;private retries=0;
 constructor(private url?:string,private options:{rememberSimulatorSeat?:boolean}={}){}
 private readSimulatorSeat():SimulatorSeat|null{
  if(!this.options.rememberSimulatorSeat)return null;
  try{
   const seat=JSON.parse(sessionStorage.getItem(simulatorSeatKey)??'null') as SimulatorSeat|null;
   if(seat&&typeof seat.code==='string'&&roomCode.test(seat.code)&&typeof seat.name==='string'&&seat.name.trim()&&Array.from(seat.name).length<=64&&typeof seat.session==='string'&&/^[A-Za-z0-9_-]{32}$/.test(seat.session))return seat;
  }catch{/* Recovery is optional when storage is disabled. */}
  return null;
 }
 private saveSimulatorSeat(code:unknown,session:unknown){
  if(!this.options.rememberSimulatorSeat||this.snapshot.role!=='player'||this.snapshot.game!=='simulator'||this.hello?.type!=='join'||typeof code!=='string'||!roomCode.test(code)||typeof session!=='string'||typeof this.hello.name!=='string')return;
  try{sessionStorage.setItem(simulatorSeatKey,JSON.stringify({code,name:this.hello.name.trim(),session}));}catch{/* In-memory reconnection still works. */}
 }
 forgetSimulatorSeat=()=>{
  const seat=this.readSimulatorSeat();
  if(!seat||seat.code!==this.snapshot.code||this.snapshot.game!=='simulator'||this.snapshot.role!=='player')return;
  if(typeof this.hello?.name==='string'&&normalizeName(seat.name)!==normalizeName(this.hello.name))return;
  try{sessionStorage.removeItem(simulatorSeatKey);}catch{/* Storage is optional. */}
 };
 restoreSimulatorPlayer=(code?:string)=>{
  if(this.snapshot.status!=='idle')return false;
  const seat=this.readSimulatorSeat();
  if(!seat||(code!==undefined&&code.trim().toUpperCase()!==seat.code))return false;
  this.begin({type:'join',code:seat.code,name:seat.name,game:'simulator'},'player','simulator',seat.code,seat.session);
  return true;
 };
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};getSnapshot=()=>this.snapshot;
 onAction=(f:(a:PartyAction)=>void)=>{this.actions.add(f);return()=>{this.actions.delete(f);};};onState=(f:(p:unknown)=>void)=>{this.states.add(f);return()=>{this.states.delete(f);};};onJudgeState=(f:(p:unknown)=>void)=>{this.judges.add(f);return()=>{this.judges.delete(f);};};
 private update(p:Partial<PartySnapshot>){this.snapshot={...this.snapshot,...p};this.listeners.forEach(f=>f());}
 private send(m:Record<string,unknown>){if(this.ws?.readyState!==WebSocket.OPEN||this.ws.bufferedAmount>65536)return false;try{this.ws.send(JSON.stringify(m));return true;}catch{return false;}}
 private stop(){if(this.retryTimer)clearTimeout(this.retryTimer);if(this.connectTimer)clearTimeout(this.connectTimer);this.retryTimer=this.connectTimer=null;const w=this.ws;this.ws=null;w?.close();}
 private begin(hello:Record<string,unknown>,role:PartyRole,game:PartyGame|null,code:string|null,resumeSession:string|null=null){this.leave();this.hello=hello;this.session=resumeSession;this.retries=0;this.update({status:'connecting',role,game,code});this.connect();}
 create=(game:PartyGame)=>this.begin({type:'create',game},'host',game,null);
 join=(code:string,name:string,game?:PartyGame)=>{
  code=code.trim().toUpperCase();
  if(!roomCode.test(code)||!name.trim()){this.update({status:'error',error:'Enter your name and six-character room code.'});return;}
  const seat=game==='simulator'?this.readSimulatorSeat():null;
  const session=seat?.code===code&&normalizeName(seat.name)===normalizeName(name)?seat.session:null;
  this.begin({type:'join',code,name,game},'player',game??null,code,session);
 };
 joinJudge=(code:string,invite:string)=>this.begin({type:'judge',code:code.toUpperCase(),invite,game:'simulator'},'judge','simulator',code.toUpperCase());
 private connect(){this.stop();const url=this.url??process.env.NEXT_PUBLIC_PARTY_RELAY_URL??(process.env.NODE_ENV==='production'?'wss://beerio-relay.onrender.com/party':`${location.protocol==='https:'?'wss':'ws'}://${location.hostname}:8787/party`);let ws:WebSocket;try{ws=new WebSocket(url);}catch{this.update({status:'error',error:'Could not connect.'});return;}this.ws=ws;this.connectTimer=setTimeout(()=>{if(this.ws===ws)ws.close();},15000);
 ws.onopen=()=>{if(this.ws===ws)this.send(this.session?{type:'resume',code:this.snapshot.code,game:this.snapshot.game,session:this.session}:this.hello??{});};
 ws.onmessage=event=>{if(this.ws!==ws)return;let m;try{m=JSON.parse(event.data);}catch{return;}switch(m.type){case'welcome':if(this.connectTimer)clearTimeout(this.connectTimer);this.session=m.session;this.retries=0;if(m.role==='player'&&m.room?.game==='simulator')this.saveSimulatorSeat(m.room.code,m.session);this.update({...m.room,status:'connected',role:m.role,playerId:m.playerId,judgeInvite:m.role==='host'?m.judgeInvite??null:null,error:null});break;case'room':this.update(m.room);break;case'state':this.states.forEach(f=>f(m.payload));break;case'judge_state':if(this.snapshot.role==='judge')this.judges.forEach(f=>f(m.payload));break;case'action':if(this.snapshot.role==='host')this.actions.forEach(f=>f({playerId:m.playerId,role:m.role,payload:m.payload}));break;case'room_closed':this.forgetSimulatorSeat();this.stop();this.session=null;this.update({status:'closed',hostConnected:false,error:'The host ended the room.'});break;case'error':if(m.code==='rate_limit'){ws.close();break;}
   if(m.code==='invalid_session'&&this.options.rememberSimulatorSeat&&this.session&&this.snapshot.role==='player'&&this.snapshot.game==='simulator'&&this.hello?.type==='join'){
    this.forgetSimulatorSeat();this.session=null;this.retries=0;this.update({status:'connecting',playerId:null,hostConnected:false,error:null});this.connect();break;
   }
   if(m.code==='not_found'||m.code==='session_replaced')this.forgetSimulatorSeat();
   this.update({error:m.message??'Could not complete action.'});if(m.fatal){this.stop();this.update({status:'error',hostConnected:false});}break;}};
 ws.onclose=()=>{if(this.ws!==ws)return;if(++this.retries>15){this.stop();this.update({status:'error',hostConnected:false,error:'Connection lost. Reconnect or join a new room.'});return;}this.update({status:'reconnecting',hostConnected:false});this.retryTimer=setTimeout(()=>this.connect(),Math.min(2500,500*this.retries));};ws.onerror=()=>{};}
 retry=()=>{if(!this.hello)return;this.retries=0;this.update({status:'reconnecting',error:null});this.connect();};
 sendAction=(payload:unknown)=>this.send({type:'action',payload});publish=(payload:unknown)=>this.snapshot.role==='host'&&this.send({type:'state',payload});publishJudge=(payload:unknown)=>this.snapshot.role==='host'&&this.send({type:'judge_state',payload});setLocked=(locked:boolean)=>this.snapshot.role==='host'&&this.send({type:'lock',locked});
 leave=()=>{this.send({type:'leave'});this.stop();this.hello=null;this.session=null;this.snapshot=initial();this.listeners.forEach(f=>f());};dispose=()=>{this.stop();};
}
