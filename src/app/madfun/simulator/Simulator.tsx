'use client';
import { useMadfunActivity } from '../shared/useMadfunActivity';
import {useState,useRef,useEffect,useCallback,useSyncExternalStore} from 'react';
import QuickStart from '../shared/QuickStart';
import HostRemote from '../shared/HostRemote';
import Link from 'next/link';import Image from 'next/image';import QRCode from 'qrcode';
import {PartyClient} from '../shared/party-client';
import {ANSWER_TIME_MS,newGame,start,submit,beginJudging,previewRanking,clearRankingPreview,proposeRanking,rank,next,syncPlayers,expireAnswering,publicState,judgeState,type PublicState,type JudgeState} from './engine';
import { JudgeRanking, LiveAnswerRanking } from './SimulatorRanking';
import contextStyles from './scene-context.module.css';
import {SIMULATOR_PROMPTS} from './prompts';import styles from './simulator.module.css';

const quickSteps = [
 { title: 'Create on the shared screen', body: 'Enter the guest’s name and tap Create room. Keep this screen open to run the game and show prompts and scores. It does not take a player slot.' },
 { title: 'Join on separate phones', body: 'All 2–10 players, including the host if they want to play, scan the Player QR. Send the separate private judge link only to the guest. Start once the judge and at least two players are connected.' },
 { title: 'Answer as the guest', body: 'Players have 45 seconds to type what the guest would say or do and tap Send answer. The host can send answers to the judge early.' },
 { title: 'Judge: rank the answers', body: 'On your phone, drag the anonymous answer cards from most to least like you. The shared screen follows each move while you drag. Tap Lock rankings & reveal to show who wrote what.' },
 { title: 'Optional: hands-free pacing', body: 'Pair a host controller privately if you want to run the shared screen from your phone. With Auto-run on, ranking results advance after 8 seconds. The guest still ranks the answers on their separate judge screen.' },
 { title: 'Win after 10 rounds', body: 'Points count down from the number of answers. With six answers, first gets 6 points and last gets 1. Highest total wins.' },
] as const;
function splitScene(text:string){
 const parts=text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 return parts.length>1?{background:parts.slice(0,-1).join(' '),question:parts.at(-1)!}:{background:'',question:text};
}
function SceneContext({ text, display = false }: { text: string; display?: boolean }) {
 return <section className={contextStyles.card} data-display={display || undefined} aria-label="Scenario background">
  <span className={contextStyles.label}>Set the scene</span>
  <p className={contextStyles.copy}>{text}</p>
 </section>;
}

export default function Simulator(){
 const [client]=useState(()=>new PartyClient(undefined,{rememberSimulatorSeat:true})),room=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);
 const state=useRef(newGame('Our guest'));
 const [view,setView]=useState<PublicState>(()=>publicState(newGame('Our guest'))),[judge,setJudge]=useState<JudgeState>(()=>judgeState(newGame('Our guest')));
 const [mode,setMode]=useState<'entry'|'host'|'player'|'judge'>('entry');
 const [guest,setGuest]=useState(''),[invited,setInvited]=useState(false),[name,setName]=useState(''),[code,setCode]=useState(''),[token,setToken]=useState(''),[answer,setAnswer]=useState(''),[notice,setNotice]=useState(''),[sticker,setSticker]=useState(''),[now,setNow]=useState(0);
 const [autoRun,setAutoRun]=useState(false);
 const [legacyRanking,setLegacyRanking]=useState<string[]>([]),[pendingVersion,setPendingVersion]=useState<number|null>(null),[qr,setQr]=useState(''),[judgeQr,setJudgeQr]=useState(''),[joinOpen,setJoinOpen]=useState(false),[privateOpen,setPrivateOpen]=useState(false),[sent,setSent]=useState(false);
 const broadcast=useCallback(()=>{const p=publicState(state.current),j=judgeState(state.current);setView(p);setJudge(j);client.publish({...p,judgingAnswers:[],rankingDrag:null});client.publishJudge(j);},[client]);
 useEffect(()=>{const t=setTimeout(()=>{const fromRoom=new URLSearchParams(location.search).get('room')??'',fromJudge=new URLSearchParams(location.hash.slice(1)).get('judge')??'';setCode(fromRoom);setToken(fromJudge);setInvited(/^[A-Z0-9]{6}$/i.test(fromRoom));if(!fromJudge&&client.restoreSimulatorPlayer(fromRoom||undefined))setMode('player');},0);return()=>{clearTimeout(t);client.dispose();};},[client]);
 useEffect(()=>client.onState(p=>{if(p&&typeof p==='object'&&'phase'in p)setView(p as PublicState);}),[client]);
 useEffect(()=>client.onJudgeState(p=>{if(p&&typeof p==='object'&&'answers'in p)setJudge(p as JudgeState);}),[client]);
 useEffect(()=>client.onAction(a=>{
  if(client.getSnapshot().role!=='host'||!a.payload||typeof a.payload!=='object')return;
  const game=state.current;
  const p=a.payload as{type?:string;round?:number;text?:string;ids?:string[];version?:number;drag?:unknown};
  if(p.round!==game.round)return;
  if(a.role==='player'&&p.type==='answer'&&typeof p.text==='string'){
   if(submit(game,a.playerId,p.text,crypto.randomUUID()))broadcast();
   return;
  }
  if(a.role!=='judge')return;
  if(p.type==='preview_rank'&&typeof p.version==='number'){
   // The shared host display follows motion directly; don't broadcast anonymous
   // texts to player phones or make every motion wait for a judge acknowledgment.
   if(previewRanking(game,p.ids,p.version,p.drag))setView(publicState(game));
   return;
  }
  if(!Array.isArray(p.ids))return;
  if(p.type==='propose_rank'&&typeof p.version==='number'&&proposeRanking(game,p.ids,p.version))broadcast();
  if(p.type==='rank'&&rank(game,p.ids,p.version??game.rankingVersion))broadcast();
 }),[client,broadcast]);
 useEffect(()=>{if(mode!=='host'||room.status!=='connected')return;const t=setInterval(broadcast,1000);return()=>clearInterval(t);},[mode,room.status,broadcast]);
 useEffect(()=>{
  if(room.role!=='host'||room.status!=='connected')return;
  const t=setTimeout(()=>{
   const cleared=!room.judgeConnected&&clearRankingPreview(state.current);
   const synced=syncPlayers(state.current,room.players.filter(p=>p.connected));
   if(cleared||synced)broadcast();
  },0);
  return()=>clearTimeout(t);
 },[room.players,room.role,room.status,room.judgeConnected,broadcast]);
 useEffect(()=>{
  if(view.phase!=='answering'||!view.deadline)return;
  const t=setInterval(()=>setNow(Date.now()),250);
  return()=>clearInterval(t);
 },[view.phase,view.deadline]);
 useEffect(()=>{
  if(room.role!=='host'||room.status!=='connected'||view.phase!=='answering'||!view.deadline)return;
  const t=setTimeout(()=>{if(expireAnswering(state.current))broadcast();},Math.max(0,view.deadline-Date.now())+10);
  return()=>clearTimeout(t);
 },[view.phase,view.deadline,room.role,room.status,broadcast]);
 useEffect(()=>{const t=setTimeout(()=>{setAnswer('');setSent(false);setLegacyRanking([]);setPendingVersion(null);},0);return()=>clearTimeout(t);},[view.phase,view.round]);
 useEffect(()=>{if(!room.code)return;let live=true;const url=`${location.origin}/madfun/simulator?room=${room.code}`;QRCode.toDataURL(url,{width:200,margin:2}).then(v=>{if(live)setQr(v);});if(room.judgeInvite)QRCode.toDataURL(`${url}#judge=${encodeURIComponent(room.judgeInvite)}`,{width:200,margin:2}).then(v=>{if(live)setJudgeQr(v);});return()=>{live=false;};},[room.code,room.judgeInvite]);
 useEffect(()=>()=>{if(sticker.startsWith('blob:'))URL.revokeObjectURL(sticker);},[sticker]);
 const leave=()=>{if(mode==='player')client.forgetSimulatorSeat();client.leave();setMode('entry');setAutoRun(false);setPrivateOpen(false);setJoinOpen(false);setNotice('');};
 const begin=()=>{if(!room.judgeConnected)return;if(start(state.current,room.players.filter(p=>p.connected),SIMULATOR_PROMPTS)){client.setLocked(false);setPrivateOpen(false);setJoinOpen(false);broadcast();}};
 useEffect(()=>{
  if(pendingVersion===null)return;
  const timer=setTimeout(()=>setPendingVersion(null),1700);
  return()=>clearTimeout(timer);
 },[pendingVersion]);
 useEffect(()=>{
  if(!autoRun||mode!=='host'||room.role!=='host'||room.status!=='connected'||view.phase!=='reveal')return;
  const round=view.round;
  const timer=setTimeout(()=>{
   if(state.current.phase==='reveal'&&state.current.round===round&&next(state.current))broadcast();
  },8000);
  return()=>clearTimeout(timer);
 },[autoRun,mode,room.role,room.status,view.phase,view.round,broadcast]);
 const hostConnected=room.role==='host'&&room.status==='connected';
 useMadfunActivity('simulator', room.role === 'host', room.code, hostConnected, view.phase === 'lobby' ? 'lobby' : view.phase === 'finished' ? 'finished' : 'playing', room.players, undefined, view.players.filter(p => p.eligible).map(p => p.id));
 const canBegin=hostConnected&&room.judgeConnected&&room.players.filter(p=>p.connected).length>=2;
 const sendAnswers=()=>{if(hostConnected&&room.judgeConnected&&state.current.phase==='answering'&&state.current.answers.length){beginJudging(state.current);broadcast();}};
 const advance=()=>{if(hostConnected&&next(state.current))broadcast();};
 const backToLobby=()=>{if(hostConnected&&state.current.phase==='finished'){state.current=newGame(view.guest);client.setLocked(false);broadcast();}};
 const remoteActions=[
  {id:'sim-auto',label:autoRun?'Turn off Auto-run':'Turn on Auto-run',run:()=>setAutoRun(v=>!v),disabled:!hostConnected},
  ...(view.phase==='lobby'?[{id:'sim-start',label:'Start 10 rounds',run:begin,disabled:!canBegin}]:[]),
  ...(view.phase==='answering'?[{id:'sim-send',label:'Send answers to judge',run:sendAnswers,disabled:!hostConnected||!view.answerCount||!room.judgeConnected}]:[]),
  ...(view.phase==='reveal'?[{id:'sim-next',label:view.round===10?'Final scoreboard':'Next round',run:advance,disabled:!hostConnected}]:[]),
  ...(view.phase==='finished'?[{id:'sim-rematch',label:'Rematch',run:begin,disabled:!canBegin},{id:'sim-lobby',label:'Back to lobby',run:backToLobby,disabled:!hostConnected}]:[]),
  ...(view.phase!=='lobby'?[{id:'sim-join-qr',label:joinOpen?'Hide player QR':'Show player QR',run:()=>setJoinOpen(v=>!v),disabled:!hostConnected}]:[]),
  {id:'sim-end',label:'End room',run:leave,confirm:'End the room for everyone?',disabled:!hostConnected},
 ];
 const canRank=room.status==='connected'&&room.hostConnected;
 const liveRank=typeof judge.rankingVersion==='number';
 // An already-open old host still supports arrows at its existing wire version.
 const supportsDrag=liveRank&&Object.hasOwn(judge,'rankingDrag');
 const rankBusy=liveRank&&pendingVersion!==null&&pendingVersion===judge.rankingVersion;
 const sendOrder=(type:'propose_rank'|'rank',ids:string[])=>{
  if(!canRank||rankBusy)return;
  if(client.sendAction({type,round:judge.round,ids,...(liveRank?{version:judge.rankingVersion}:{})})){
   if(liveRank)setPendingVersion(judge.rankingVersion);
  }else setNotice('Reconnect, then try again.');
 };
 const sendPreview=(ids:string[],drag:{id:string;position:number})=>{
  if(!supportsDrag||!canRank||rankBusy)return;
  client.sendAction({type:'preview_rank',round:judge.round,version:judge.rankingVersion,ids,drag});
 };
 const moveAnswer=(index:number,by:number)=>{
  const ids=judge.answers.map(a=>a.id),to=index+by;
  if(to<0||to>=ids.length)return;
  [ids[index],ids[to]]=[ids[to],ids[index]];
  sendOrder('propose_rank',ids);
 };
 const scene=splitScene(view.prompt),judgeScene=splitScene(judge.prompt);
 const self=view.players.find(p=>p.id===room.playerId);
 const waitingForNext=mode==='player'&&view.round>0&&view.phase!=='finished'&&(!self||self.eligible===false);
 const secondsLeft=view.phase==='answering'&&view.deadline?Math.min(ANSWER_TIME_MS/1000,Math.max(0,Math.ceil((view.deadline-(now||view.deadline-ANSWER_TIME_MS))/1000))):null;
 const clock=secondsLeft!==null&&<p className={styles.questionClock} data-urgent={secondsLeft<=10}><b>{secondsLeft}s</b> {secondsLeft?'to answer':'locking answers…'}</p>;
 const doCopyInvite=async(privateJudge=false)=>{
  if(!room.code||privateJudge&&!room.judgeInvite)return;
  const url=new URL('/madfun/simulator?room='+room.code,location.origin);
  if(privateJudge)url.hash='judge='+encodeURIComponent(room.judgeInvite!);
  try{await navigator.clipboard.writeText(url.href);setNotice(privateJudge?'Private judge link copied. Send it only to the guest.':'Player join link copied.');}
  catch{setNotice(privateJudge?'Could not copy. Ask the guest to scan the private QR.':'Could not copy. Send the room code: '+room.code);}
 };
 const isReveal=view.phase==='reveal'||view.phase==='finished';
 const results=<>{view.phase==='reveal'&&!view.reveal.length&&<p>No answers this round. Nobody gets points.</p>}<div className={styles.reveal}>{view.reveal.map((a,i)=><article key={i}><b>#{i+1} · {a.name}</b><p>{a.text}</p><strong>+{a.points}</strong></article>)}</div><h2>Leaderboard</h2><ol className={styles.leaderboard}>{[...view.players].sort((a,b)=>b.score-a.score).map(p=><li key={p.id}><span>{p.name}</span><b>{p.score} points</b></li>)}</ol></>;
 const mascot=sticker||(view.guest.trim().toLowerCase()==='eesha'?'/madfun/eesha-sticker.png':'');
 const top=<><header className={styles.top}><Link href='/madfun'>madfun / simulator</Link>{mode==='host'&&room.role==='host'&&<HostRemote game="The Simulator" active={hostConnected} phase={view.phase==='judging'?'Waiting for the judge':view.phase==='lobby'?'Waiting for players and judge':'Round '+view.round+' of 10'} actions={remoteActions}/>}{mode!=='entry'&&<div className={styles.roomControls}>{mode==='host'&&room.code&&view.phase!=='lobby'&&<><span>JOIN <b>{room.code}</b></span><button aria-expanded={joinOpen} onClick={()=>setJoinOpen(v=>!v)}>{joinOpen?'Hide join QR':'Show join QR'}</button></>}<button onClick={leave}>Leave</button></div>}</header>{mode==='host'&&view.phase!=='lobby'&&joinOpen&&room.code&&<aside className={`${styles.panel} ${styles.joinPanel}`} aria-label="Join during the match">{qr&&<Image unoptimized src={qr} width={160} height={160} alt="Player join QR"/>}<div><h2>Scan to join</h2><p>New players start on the next question.</p><button onClick={()=>void doCopyInvite()}>Copy player link</button></div></aside>}</>;
 const errors=<>{room.error&&<p role='alert'>{room.error} <button onClick={()=>client.retry()}>Reconnect</button></p>}{notice&&<p role='status'>{notice}</p>}</>;
 if(mode==='entry')return <main className={styles.shell}>{top}<section className={styles.entry}><span className={styles.kicker}>HOW WELL DO YOU KNOW THEM?</span><h1>THE <em>SIMULATOR.</em></h1><p>One guest. Ten situations. Everybody guesses what they would do.</p><QuickStart game="The Simulator" steps={quickSteps}/>{errors}{token?<article className={styles.panel}><h2>You’re the guest judge.</h2><p>Your private invitation lets you rank anonymous answers. Don’t share it.</p><button className={styles.primary} onClick={()=>{setMode('judge');client.joinJudge(code,token);}}>Join as judge</button></article>:<div className={invited?styles.panel:styles.columns}>{!invited&&<article className={styles.panel}><h2>Create a room on the shared screen</h2><label>GUEST’S NAME<input value={guest} maxLength={50} placeholder='Who are we simulating?' onChange={e=>setGuest(e.target.value)}/></label><button className={styles.primary} disabled={!guest.trim()} onClick={()=>{state.current=newGame(guest);setView(publicState(state.current));setMode('host');client.create('simulator');}}>Create room ↗</button><p>This screen runs the game and does not take a player slot.</p></article>}<form className={styles.panel} onSubmit={e=>{e.preventDefault();setMode('player');client.join(code,name,'simulator');}}><h2>Join as a player</h2><p>Use your own phone to submit answers.</p><label>YOUR NAME<input required maxLength={64} value={name} onChange={e=>setName(e.target.value)}/></label><label>ROOM CODE<input required minLength={6} maxLength={6} value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/></label><button className={styles.primary}>Join game</button></form></div>}</section></main>;
 if(mode==='judge')return <main className={`${styles.shell} ${styles.phone}`}>{top}{errors}<span className={styles.kicker}>PRIVATE JUDGE SCREEN · {view.guest}</span><h1>{judge.phase==='judging'?'You decide.':view.phase==='finished'?'That’s a wrap.':view.phase==='reveal'?'Round results':'You’re the judge.'}</h1>{judge.phase==='judging'?<>{judgeScene.background&&<SceneContext text={judgeScene.background}/>}<p>{judgeScene.question}</p></>:isReveal?<section className={styles.phoneResults}>{results}</section>:<p>Anonymous answers will appear here when everyone is done.</p>}{judge.phase==='judging'&&(supportsDrag?<JudgeRanking key={judge.round}
  answers={judge.answers} revision={judge.rankingVersion} canRank={canRank} busy={rankBusy} onPreview={sendPreview}
  onDrop={ids=>sendOrder('propose_rank',ids)} onLock={ids=>sendOrder('rank',ids)}/>:liveRank?<><p>Use the arrows to move answers up or down. The host screen follows along live. First place earns {judge.answers.length} points, then one fewer per place.</p><ol className={styles.draftList}>{judge.answers.map((a,i)=><li key={a.id} data-podium={i<3}><span className={styles.draftPlace}>#{i+1}</span><span className={styles.draftText}>{a.text}</span><span className={styles.draftPoints}>{judge.answers.length-i} pts</span><div className={styles.rankButtons}><button type="button" aria-label={`Move answer ${i+1} up`} disabled={!canRank||rankBusy||i===0} onClick={()=>moveAnswer(i,-1)}>↑</button><button type="button" aria-label={`Move answer ${i+1} down`} disabled={!canRank||rankBusy||i===judge.answers.length-1} onClick={()=>moveAnswer(i,1)}>↓</button></div></li>)}</ol><button className={styles.primary} disabled={!canRank||rankBusy||!judge.answers.length} onClick={()=>sendOrder('rank',judge.answers.map(a=>a.id))}>Lock rankings &amp; reveal</button></>:<><p>Tap answers from best to least likely. The host screen will show final rankings.</p><div className={styles.answers}>{judge.answers.map(a=><button key={a.id} className={legacyRanking.includes(a.id)?styles.selected:''} onClick={()=>setLegacyRanking(v=>v.includes(a.id)?v.filter(id=>id!==a.id):[...v,a.id])}><b>{legacyRanking.includes(a.id)?legacyRanking.indexOf(a.id)+1:'+'}</b>{a.text}</button>)}</div><button onClick={()=>setLegacyRanking([])}>Reset order</button><button className={styles.primary} disabled={legacyRanking.length!==judge.answers.length||!legacyRanking.length||!canRank} onClick={()=>sendOrder('rank',legacyRanking)}>Reveal rankings</button></>)}</main>;
 if(mode==='player')return <main className={`${styles.shell} ${styles.phone}`}>{top}{errors}<span className={styles.kicker}>ROUND {view.round} / 10</span><h1>{waitingForNext?'You’re in for the next question.':view.phase==='answering'?`Think like ${view.guest}.`:view.phase==='judging'?'The guest is deciding…':view.phase==='finished'?'That’s a wrap.':view.phase==='reveal'?'Round results':'You’re in.'}</h1>{waitingForNext?<p>Your first question will show up here automatically.</p>:view.phase==='answering'?<form onSubmit={e=>{e.preventDefault();if(client.sendAction({type:'answer',round:view.round,text:answer}))setSent(true);else setNotice('Reconnect, then send your answer again.');}}>{scene.background&&<SceneContext text={scene.background}/>}<p className={styles.prompt}>{scene.question}</p>{clock}<label>WHAT WOULD THEY DO?<textarea rows={4} required maxLength={280} value={answer} onChange={e=>setAnswer(e.target.value)}/></label><p>{answer.length}/280 · Your name stays hidden until the reveal.</p><button className={styles.primary} disabled={!answer.trim()||!room.hostConnected||secondsLeft===0}>{sent?'Update answer':'Send answer'}</button>{sent&&<p>{view.players.find(p=>p.id===room.playerId)?.submitted?'Answer received. You can edit until judging starts.':'Sending your answer…'}</p>}</form>:<><p>{view.phase==='lobby'?'Waiting for the host and guest judge.':view.phase==='judging'?'Your answer is anonymous. Keep a straight face.':'Here are the rankings and points.'}</p><div className={styles.score}>{view.players.find(p=>p.id===room.playerId)?.score??0}<span>YOUR POINTS</span></div>{isReveal&&<section className={styles.phoneResults}>{results}</section>}</>}</main>;
 return <main className={styles.shell}>{top}{errors}<section className={styles.host}><label className={styles.autoRun}><input type="checkbox" checked={autoRun} onChange={e=>setAutoRun(e.target.checked)}/> Auto-run after the judge reveals rankings</label>{autoRun&&view.phase==='reveal'&&<p role="status">Auto-run · advancing after 8 seconds</p>}{view.phase==='lobby'&&<QuickStart game="The Simulator" steps={quickSteps}/>}<span className={styles.kicker}>{view.phase==='lobby'?'HOST DISPLAY · NO PLAYER SLOT':`HOST DISPLAY · ROUND ${view.round} OF 10 · ${view.category}`}</span>{scene.background&&view.phase!=='lobby'&&view.phase!=='finished'&&<SceneContext text={scene.background} display/>}<h1>{view.phase==='lobby'?`${view.guest} Simulator`:view.phase==='finished'?'Who knows them best?':scene.question}</h1>{view.phase==='lobby'?<><div className={styles.columns}><article className={styles.panel}><h2>Player QR · Scan to play</h2><p>Everyone who wants to play scans this on their own phone.</p>{qr&&<Image unoptimized src={qr} width={180} height={180} alt='Player join QR'/>}<strong className={styles.code}>{room.code??'••••••'}</strong><p>{room.players.length}/10 players · {room.judgeConnected?'Judge connected':'Waiting for guest judge'}</p>{room.code&&<button onClick={()=>void doCopyInvite()}>Copy player link</button>}</article><article className={styles.panel}><h2>Private judge invite for {view.guest}</h2><p>Copy the link and send it only to the guest. Don’t show the judge QR on a shared screen.</p>{room.judgeInvite&&<button onClick={()=>void doCopyInvite(true)}>Copy private judge link</button>}<button aria-expanded={privateOpen} onClick={()=>{if(privateOpen||window.confirm('Show the private judge QR on this screen? Make sure only the guest can see it.'))setPrivateOpen(v=>!v);}}>{privateOpen?'Hide judge QR':'Show judge QR privately'}</button>{privateOpen&&<div className={styles.privateInvite}>{judgeQr&&<Image unoptimized src={judgeQr} width={180} height={180} alt='Private judge invitation'/>}</div>}<label>OPTIONAL LOCAL MASCOT<input type='file' accept='image/*' onChange={e=>{const f=e.target.files?.[0];if(f&&f.size<=8*1024*1024)setSticker(URL.createObjectURL(f));else if(f)setNotice('Choose an image under 8 MB.');}}/></label><p>Your uploaded image stays on this device.</p></article></div><div className={styles.players}>{room.players.map(p=><span key={p.id}>{p.name}{p.connected?' ✓':' · reconnecting'}</span>)}</div><button className={styles.primary} disabled={!canBegin} onClick={begin}>Start 10 rounds →</button><p>Players can rejoin from the same browser. Keep this host tab open throughout the game.</p></>:<><div className={styles.players}>{view.players.map(p=><span key={p.id}>{p.name} · {p.score} pts{view.phase==='answering'?(p.eligible===false?' · next round':p.submitted?' ✓':' …'):''}</span>)}</div>{view.phase==='answering'&&<article className={styles.panel}><h2>{view.answerCount} / {view.activePlayerCount??view.players.length} answers in</h2>{clock}<p>Answers lock automatically at zero. Or send them to the judge early.</p><button className={styles.primary} disabled={!view.answerCount||!room.judgeConnected} onClick={sendAnswers}>Send answers to {view.guest}</button></article>}{view.phase==='judging'&&<article className={styles.panel}><h2>{view.guest} is ranking the answers…</h2><p>{room.judgeConnected?'Live ranking · names stay hidden until the guest locks it in.':'Judge disconnected. Keep the original tab open and use Reconnect. Reloading loses the seat.'}</p><LiveAnswerRanking key={view.round} answers={view.judgingAnswers} drag={view.rankingDrag??null}/></article>}{isReveal&&<>{results}{mascot&&<Image key={`${view.round}-${view.phase}`} className={styles.mascot} unoptimized src={mascot} width={120} height={140} alt={`${view.guest} celebration mascot`}/>}{view.phase==='reveal'?<button className={styles.primary} onClick={advance}>{view.round===10?'Final scoreboard':'Next round →'}</button>:<><button className={styles.primary} onClick={begin}>Rematch · 10 random prompts</button><button onClick={backToLobby}>Back to lobby</button></>}</>}</>}</section></main>;
}
