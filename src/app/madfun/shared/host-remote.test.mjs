import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createRelay} from '../../../../beerio-server/server.mjs';

const require=createRequire(new URL('../../../../beerio-server/server.mjs',import.meta.url));
const NodeSocket=require('ws');
async function load(path) {
 const bytes=await readFile(new URL(path,import.meta.url),'utf8');
 const js=ts.transpileModule(bytes,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const {PartyClient}=await load('./party-client.ts');
const {HOST_REMOTE,remoteBoard,readRemoteBoard,validateRemoteCommand}=await load('./host-remote-protocol.ts');
const tick=ms=>new Promise(r=>setTimeout(r,ms));
async function until(pred, label) { for(let i=0;i<300;i++){if(pred())return;await tick(7);}assert.fail(label); }

test('remote snapshots contain only button labels and state, and reject outdated/disabled/unconfirmed commands',()=>{
 const actions=[{id:'start',label:'Start',run(){}},{id:'next',label:'Next',disabled:true,run(){}},{id:'end',label:'End',confirm:'End?',run(){}}];
 const board=remoteBoard('Test Game',1,'Lobby',actions);
 assert.equal(readRemoteBoard(JSON.parse(JSON.stringify(board))).buttons.length,3);
 assert.equal(JSON.stringify(board).includes('run'),false);
 assert.equal(readRemoteBoard({...board,buttons:[board.buttons[0],board.buttons[0]]}),null);
 const command=(id,change={},role='judge')=>({role,playerId:'test',payload:{protocol:HOST_REMOTE,revision:1,id,...change}});
 assert.equal(validateRemoteCommand(command('start'),1,actions)?.id,'start');
 assert.equal(validateRemoteCommand(command('start'),2,actions),null);
 assert.equal(validateRemoteCommand(command('start',{},'player'),1,actions),null);
 assert.equal(validateRemoteCommand(command('next'),1,actions),null);
 assert.equal(validateRemoteCommand(command('end'),1,actions),null);
 assert.equal(validateRemoteCommand(command('end',{confirmed:true}),1,actions)?.id,'end');
});

test('real relay gives an opt-in controller a distinct private seat with no ordinary player authority',async t=>{
 const old=globalThis.WebSocket;
 globalThis.WebSocket=NodeSocket;
 const relay=createRelay();
 await new Promise(r=>relay.server.listen(0,'127.0.0.1',r));
 const url=`ws://127.0.0.1:${relay.server.address().port}/party`;
 const all=Array.from({length:5},()=>new PartyClient(url));
 const [game,host,unauthorized,phone,second]=all;
 t.after(async()=>{all.forEach(p=>p.leave());await relay.close();globalThis.WebSocket=old;});
 game.create('jeopardy');host.create('simulator');
 await until(()=>game.getSnapshot().code&&host.getSnapshot().judgeInvite,'two separate relay rooms');
 const {code,judgeInvite}=host.getSnapshot();
 assert.notEqual(code,game.getSnapshot().code);
 let count=0, own=null, leaked=null;
 const actions=[{id:'start',label:'Start game',run(){count++;}}];
 host.onAction(a=>validateRemoteCommand(a,1,actions)?.run());
 const view=remoteBoard('Eesha Lore Night',1,'Lobby',actions);
 host.publishJudge(view);
 unauthorized.onJudgeState(s=>{leaked=s;});
 unauthorized.join(code,'Not controller','simulator');
 await until(()=>unauthorized.getSnapshot().status==='connected','ordinary player connected to auxiliary room');
 unauthorized.sendAction({protocol:HOST_REMOTE,revision:1,id:'start'});
 phone.onJudgeState(s=>{own=s;});phone.joinJudge(code,judgeInvite);
 await until(()=>own,'private authorized controller received board');
 assert.deepEqual(readRemoteBoard(own),JSON.parse(JSON.stringify(view)));
 assert.equal(leaked,null);
 assert.equal(count,0);
 assert.equal(game.getSnapshot().players.length,0,'controller does not occupy actual game seat');
 second.joinJudge(code,judgeInvite);
 await until(()=>second.getSnapshot().status==='error','other controller cannot occupy existing private seat');
 phone.sendAction({protocol:HOST_REMOTE,revision:1,id:'start'});
 await until(()=>count===1,'confirmed judge command reached the correct host');
 host.leave();
 await until(()=>phone.getSnapshot().status==='closed','host revoked controller access');
 assert.equal(game.getSnapshot().status,'connected','disabling controller does not end main game');
});
