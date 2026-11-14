import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PartyService} from '../../../../beerio-server/party.mjs';

const compiled=ts.transpileModule(readFileSync(new URL('./party-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {PartyClient}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const key='madfun.simulator.seat.v1';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t){
 let now=10000;
 const service=new PartyService({now:()=>now});
 const saved=new Map(),handshakes=[],clients=[];
 const previous={ws:globalThis.WebSocket,storage:globalThis.sessionStorage};
 globalThis.sessionStorage={
  getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k),
 };
 class Socket{
  static OPEN=1;
  bufferedAmount=0;
  readyState=0;
  first=true;
  constructor(){
   this.peer={send:m=>queueMicrotask(()=>this.onmessage?.({data:JSON.stringify(m)})),close:()=>this.close()};
   service.connect(this.peer);
   queueMicrotask(()=>{if(this.readyState===0){this.readyState=Socket.OPEN;this.onopen?.();}});
  }
  send(s){
   const m=JSON.parse(s);
   if(this.first){this.first=false;handshakes.push(m.type);}
   service.receive(this.peer,m);
  }
  close(){
   if(this.readyState===3)return;
   this.readyState=3;
   service.disconnect(this.peer);
   queueMicrotask(()=>this.onclose?.());
  }
 }
 globalThis.WebSocket=Socket;
 function client(remember=false){
  const c=new PartyClient('ws://local.example/party',{rememberSimulatorSeat:remember});
  clients.push(c);
  return c;
 }
 t.after(()=>{clients.forEach(c=>c.dispose());globalThis.WebSocket=previous.ws;
  if(previous.storage===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=previous.storage;});
 return {client,saved,handshakes,advance:ms=>{now+=ms;service.sweep();}};
}

test('Simulator reload restores same live player ID and latest state without changing room roster',async t=>{
 const f=fixture(t),host=f.client(true);
 host.create('simulator');await settle();const code=host.getSnapshot().code;
 assert.equal(f.saved.size,0,'host credentials must not be stored');
 const player=f.client(true);
 player.join(code,' Casey ','simulator');await settle();
 const original=player.getSnapshot();
 const stored=JSON.parse(f.saved.get(key));
 assert.equal(stored.name,'Casey');assert.deepEqual(Object.keys(stored).sort(),['code','name','session']);
 host.publish({phase:'answering',round:3});
 player.dispose();await settle();
 const reloaded=f.client(true);const events=[];reloaded.onState(s=>events.push(s));
 assert(!reloaded.restoreSimulatorPlayer('ZZZZZZ'));
 assert(reloaded.restoreSimulatorPlayer(code.toLowerCase()));await settle();
 assert.equal(f.handshakes.at(-1),'resume');
 assert.equal(reloaded.getSnapshot().playerId,original.playerId);
 assert.equal(reloaded.getSnapshot().status,'connected');
 assert.deepEqual(events,[{phase:'answering',round:3}]);
 assert.equal(host.getSnapshot().players.length,1);
 reloaded.forgetSimulatorSeat();reloaded.leave();await settle();
 assert.equal(f.saved.get(key),undefined);
});

test('an expired Simulator seat falls back to exactly one fresh mid-game join',async t=>{
 const f=fixture(t),host=f.client(),player=f.client(true);
 host.create('simulator');await settle();const code=host.getSnapshot().code;
 player.join(code,'Alex','simulator');await settle();
 const old=player.getSnapshot().playerId;
 player.dispose();await settle();f.advance(91000);
 const reloaded=f.client(true);
 assert(reloaded.restoreSimulatorPlayer(code));await settle();
 assert.deepEqual(f.handshakes.slice(-2),['resume','join']);
 assert.equal(reloaded.getSnapshot().status,'connected');
 assert.notEqual(reloaded.getSnapshot().playerId,old);
 assert.equal(host.getSnapshot().players.length,1);
});

test('only opted-in Simulator players persist; matching name can reclaim, while another name joins',async t=>{
 const f=fixture(t),host=f.client(true);
 host.create('simulator');await settle();const code=host.getSnapshot().code;
 const judge=f.client(true);judge.joinJudge(code,host.getSnapshot().judgeInvite);await settle();
 assert.equal(f.saved.size,0,'judge credentials must not be stored');
 const defaultClient=f.client();defaultClient.join(code,'Unremembered','simulator');await settle();
 assert.equal(f.saved.size,0);
 const player=f.client(true);player.join(code,'Jamie','simulator');await settle();
 const id=player.getSnapshot().playerId;
 player.dispose();await settle();
 const resume=f.client(true);resume.join(code,' JAMIE ','simulator');await settle();
 assert.equal(f.handshakes.at(-1),'resume');assert.equal(resume.getSnapshot().playerId,id);
 const newPlayer=f.client(true);newPlayer.join(code,'Blair','simulator');await settle();
 assert.equal(f.handshakes.at(-1),'join');assert.notEqual(newPlayer.getSnapshot().playerId,id);
 const triviaHost=f.client(true);triviaHost.create('jeopardy');await settle();
 const saved=f.saved.get(key);
 const trivia=f.client(true);trivia.join(triviaHost.getSnapshot().code,'Blair','jeopardy');await settle();
 assert.equal(f.saved.get(key),saved,'trivia must not overwrite Simulator recovery data');
});
