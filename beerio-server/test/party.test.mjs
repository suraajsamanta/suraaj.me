import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createRelay} from '../server.mjs';
import {PartyService} from '../party.mjs';

test('party route delivers only role-authorized private/public state and keeps /room separate',async t=>{
  const relay=createRelay();
  relay.server.listen(0,'127.0.0.1');await once(relay.server,'listening');
  t.after(()=>relay.close());
  const connect=async(path='/party')=>{
    const ws=new WebSocket(`ws://127.0.0.1:${relay.server.address().port}${path}`);
    const messages=[];ws.on('message',d=>messages.push(JSON.parse(d.toString())));
    await once(ws,'open');
    return {messages,send:m=>ws.send(JSON.stringify(m)),async read(type,p=()=>true){
      for(let n=0;n<300;n++){
        const i=messages.findIndex(m=>m.type===type&&p(m));
        if(i>=0)return messages.splice(i,1)[0];
        await new Promise(r=>setTimeout(r,10));
      }
      throw Error('Timed out: '+type);
    }};
  };
  const host=await connect();host.send({type:'create',game:'simulator'});
  const h=await host.read('welcome');assert.match(h.judgeInvite,/^[\w-]{32}$/);
  const code=h.room.code;
  const other=await connect();other.send({type:'create',game:'jeopardy'});await other.read('welcome');
  const intruder=await connect();intruder.send({type:'judge',code,invite:code});
  assert.equal((await intruder.read('error')).code,'invalid_invite');
  const player=await connect();player.send({type:'join',code,name:'Player',game:'simulator'});
  const p=await player.read('welcome');assert.equal(p.judgeInvite,undefined);
  const judge=await connect();judge.send({type:'judge',code,invite:h.judgeInvite});
  const j=await judge.read('welcome');assert.equal(j.role,'judge');assert.equal(j.judgeInvite,undefined);
  player.send({type:'judge_state',payload:{rank:['fake']}});
  assert.equal((await player.read('error')).code,'forbidden');
  player.send({type:'action',role:'judge',playerId:j.playerId,payload:{text:'secret'}});
  assert.deepEqual(await host.read('action'),{type:'action',role:'player',playerId:p.playerId,payload:{text:'secret'}});
  judge.send({type:'action',payload:{rank:['a']}});
  assert.equal((await host.read('action')).role,'judge');
  host.send({type:'judge_state',payload:{answers:['anonymous']}});
  assert.deepEqual((await judge.read('judge_state')).payload,{answers:['anonymous']});
  host.send({type:'state',payload:{phase:'ranking'}});await player.read('state');
  assert.ok(!player.messages.some(x=>x.type==='judge_state'));
  assert.ok(!other.messages.some(x=>['action','judge_state','state'].includes(x.type)));
  const resumed=await connect();resumed.send({type:'resume',code,session:j.session});
  assert.equal((await resumed.read('welcome')).playerId,j.playerId);await resumed.read('judge_state');
  const racer=await connect('/room');racer.send({type:'create',name:'Racer'});await racer.read('welcome');
  assert.equal(relay.rooms.rooms.size,1);assert.equal(relay.parties.rooms.size,2);
});

test('party rooms enforce capacity, locks, payload bounds and seat expiration',()=>{
  let now=1000;const service=new PartyService({now:()=>now,maxPlayers:1});
  const connect=()=>{
    const messages=[];const peer={send:m=>messages.push(m),close:()=>service.disconnect(peer)};
    service.connect(peer);
    return {peer,send:m=>service.receive(peer,m),read:t=>messages.findLast(m=>m.type===t)};
  };
  const h=connect();h.send({type:'create',game:'simulator'});
  const code=h.read('welcome').room.code;
  const join=()=>{const c=connect();c.send({type:'join',code,name:'Player'});return c;};
  const p=join();assert.equal(p.read('welcome').role,'player');assert.equal(join().read('error').code,'capacity');
  p.send({type:'action',payload:{text:'x'.repeat(5000)}});assert.equal(p.read('error').code,'invalid_action');
  h.send({type:'lock',locked:true});assert.equal(join().read('error').code,'locked');
  h.send({type:'lock',locked:false});service.disconnect(p.peer);
  now+=90001;service.sweep();assert.equal(join().read('welcome').role,'player');
  const r=connect();r.send({type:'resume',code,session:p.read('welcome').session});
  assert.equal(r.read('error').code,'invalid_session');
  service.disconnect(h.peer);now+=120001;service.sweep();
  assert.equal(service.rooms.size,0);
});
