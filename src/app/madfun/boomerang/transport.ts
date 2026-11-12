"use client";
import type { ArenaInput } from './engine';
export type ArenaRoomPlayer = {id:string;name:string;color:string;connected:boolean;ready:boolean;input:ArenaInput};
export type ArenaRoomSnapshot = {status:'idle'|'connecting'|'connected'|'reconnecting'|'error'|'closed';role:'host'|'player'|null;code:string|null;playerId:string|null;players:ArenaRoomPlayer[];locked:boolean;hostConnected:boolean;error:string|null};
const neutral=():ArenaInput=>({x:0,y:0,throwSeq:0,dash:false});
// The legacy relay transports a direction angle and movement bit, not kart physics.
export function encodeInput(i:ArenaInput){return {steer:Math.atan2(i.y,i.x)/Math.PI,accelerate:Math.hypot(i.x,i.y)>.15,brake:i.dash,action:Math.max(0,Math.floor(i.throwSeq))};}
export function decodeInput(i:{steer?:number;accelerate?:boolean;brake?:boolean;action?:number}):ArenaInput {return {x:i.accelerate?Math.cos((i.steer??0)*Math.PI):0,y:i.accelerate?Math.sin((i.steer??0)*Math.PI):0,dash:i.brake===true,throwSeq:i.action??0};}
export class ArenaRoomClient {
 private snapshot:ArenaRoomSnapshot={status:'idle',role:null,code:null,playerId:null,players:[],locked:false,hostConnected:false,error:null};
 private listeners=new Set<()=>void>(); private states=new Set<(state:unknown)=>void>(); private ws:WebSocket|null=null;
 private token:string|null=null;private hello:Record<string,unknown>|null=null;private timer:ReturnType<typeof setInterval>|null=null;private reconnect:ReturnType<typeof setTimeout>|null=null;private intentional=false;private retries=0;private input=neutral();private lastPublish=0;private lastInput=new Map<string,number>();private openedAt=0;private localThrowSequence=0;private wireThrowSequence=0;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return ()=>{this.listeners.delete(fn);};};getSnapshot=()=>this.snapshot;
 onState=(fn:(state:unknown)=>void)=>{this.states.add(fn);return ()=>{this.states.delete(fn);};};
 private update(p:Partial<ArenaRoomSnapshot>){this.snapshot={...this.snapshot,...p};this.listeners.forEach(f=>f());}
 private send(m:unknown){if(this.ws?.readyState===WebSocket.OPEN&&this.ws.bufferedAmount<131072){try{this.ws.send(JSON.stringify(m));}catch{/* A closing socket is handled by reconnect. */}}}
 create=()=>this.begin({type:'create',maxPlayers:10,publicMatchmaking:false},'host');
 join=(code:string,name:string)=>{code=code.trim().toUpperCase();if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)||!name.trim()||Array.from(name.trim()).length>64){this.update({error:'Enter your name (up to 64 characters) and the six-character code.'});return;}this.begin({type:'join',code,name:name.trim()},'player');};
 private begin(hello:Record<string,unknown>,role:'host'|'player'){this.leave();this.intentional=false;this.token=null;this.localThrowSequence=0;this.wireThrowSequence=0;this.hello=hello;this.retries=0;this.openedAt=Date.now();this.update({status:'connecting',role,code:null,playerId:null,players:[],error:null});this.connect();}
 private connect(){if(this.timer)clearInterval(this.timer);if(this.reconnect)clearTimeout(this.reconnect);const previous=this.ws;this.ws=null;previous?.close();const configured=process.env.NEXT_PUBLIC_BEERIO_RELAY_URL;const url=configured||(location.protocol==='https:'?'wss://beerio-relay.onrender.com/room':`ws://${location.hostname}:8787`);const ws=new WebSocket(url);this.ws=ws;
 ws.onopen=()=>{if(ws!==this.ws)return;this.send(this.token?{type:'resume',code:this.snapshot.code,token:this.token}:this.hello);};
 ws.onmessage=e=>{if(ws!==this.ws)return;let m;try{m=JSON.parse(e.data);}catch{return;}
 if(m.type==='welcome'){if(m.room.characterSelection){this.fail('That is a Beerio room. Use the code on the Boomerang Bash host screen.');return;}this.token=m.token;this.retries=0;this.update({status:'connected',role:m.role,playerId:m.playerId,error:null});this.room(m.room);if(m.role==='player')this.send({type:'ready',ready:true});}
 if(m.type==='room')this.room(m.room);
 if(m.type==='input'){this.lastInput.set(m.playerId,Date.now());this.update({players:this.snapshot.players.map(p=>p.id===m.playerId?{...p,input:decodeInput(m.input)}:p)});}
 if(m.type==='state'&&m.payload?.game==='madfun-boomerang-v1')this.states.forEach(f=>f(m.payload.state));
 if(m.type==='error'){this.update({error:m.message??'Could not connect to this room.'});if(m.fatal||['room_not_found','invalid_session','update_required'].includes(m.code))this.fail(m.message??'Room unavailable.');}
 if(m.type==='room_closed')this.fail(m.reason??'The host ended this room.');
 };
 ws.onclose=()=>{if(ws!==this.ws||this.intentional)return;if(this.timer)clearInterval(this.timer);this.input=neutral();this.update({status:'reconnecting',hostConnected:false,players:this.snapshot.players.map(p=>({...p,input:neutral()}))});if((!this.token&&Date.now()-this.openedAt<90000)||this.retries<12){this.retries++;this.reconnect=setTimeout(()=>this.connect(),Math.min(2500,500*this.retries));}else this.fail('Connection lost. Retry to reconnect, or ask the host to create a new room.');};
 ws.onerror=()=>{};
 this.timer=setInterval(()=>{if(Date.now()-this.openedAt>90000&&!this.token){this.fail('The relay is taking too long to wake up. Please retry.');return;}if(this.snapshot.role==='player'&&this.snapshot.status==='connected'){this.send({type:'input',input:encodeInput(this.snapshot.locked&&this.snapshot.hostConnected?this.input:neutral())});}if(this.snapshot.role==='host'){const now=Date.now();if(this.snapshot.players.some(p=>(Math.hypot(p.input.x,p.input.y)>0||p.input.dash||p.input.throwSeq>0)&&now-(this.lastInput.get(p.id)??0)>600))this.update({players:this.snapshot.players.map(p=>now-(this.lastInput.get(p.id)??0)>600?{...p,input:neutral()}:p)});}},50);
 }
 private room(r:{code:string;locked:boolean;hostConnected:boolean;players:Array<Omit<ArenaRoomPlayer,'input'>&{input:Parameters<typeof decodeInput>[0]}>}){const unlocked=this.snapshot.locked&&!r.locked;this.update({code:r.code,locked:r.locked,hostConnected:r.hostConnected,players:r.players.map(p=>({...p,input:decodeInput(p.input)}))});if(unlocked&&this.snapshot.role==='player')this.send({type:'ready',ready:true});}
 private fail(error:string){this.intentional=true;this.send({type:'leave'});const closing=this.ws;this.ws=null;closing?.close();if(this.timer)clearInterval(this.timer);if(this.reconnect)clearTimeout(this.reconnect);this.update({status:'error',error,hostConnected:false});}
 start=()=>this.send({type:'lock',locked:true});lobby=()=>{this.input=neutral();this.send({type:'lock',locked:false});};setInput=(input:ArenaInput)=>{const sequence=Number.isSafeInteger(input.throwSeq)?Math.max(0,input.throwSeq):0;if(sequence>this.localThrowSequence)this.wireThrowSequence+=sequence-this.localThrowSequence;this.localThrowSequence=sequence;this.input={...input,throwSeq:this.wireThrowSequence};};
 publish=(state:unknown)=>{if(this.snapshot.role!=='host'||Date.now()-this.lastPublish<55)return;this.lastPublish=Date.now();this.send({type:'state',payload:{game:'madfun-boomerang-v1',state}});};
 retry=()=>{this.intentional=false;this.retries=0;this.openedAt=Date.now();this.update({status:'connecting',error:null});this.connect();};
 leave=()=>{this.intentional=true;this.send({type:'leave'});this.ws?.close();this.ws=null;if(this.timer)clearInterval(this.timer);if(this.reconnect)clearTimeout(this.reconnect);this.input=neutral();this.update({status:'idle',role:null,players:[],locked:false,hostConnected:false,code:null,playerId:null,error:null});};
 dispose=()=>{this.leave();this.listeners.clear();this.states.clear();};
}
