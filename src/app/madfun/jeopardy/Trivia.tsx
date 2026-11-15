'use client';
import Link from 'next/link';
import QuickStart from '../shared/QuickStart';
import HostRemote from '../shared/HostRemote';
import QRCode from 'qrcode';
import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {PartyClient} from '../shared/party-client';
import {advanceReviewed,loreAutoStep,makeQueue,move,newRun,publicRun,type PublicRun,type Question,type Run} from './engine';
import {unlockEeshaDeck} from './deck';
import type {Deck} from './engine';
import s from './trivia.module.css';

const quickSteps = [
 { title: 'Host with the private link', body: 'Open the private Eesha Lore Night host link on the shared screen and tap Create room. It runs the game without taking a player slot. Point everyone to the Player QR, not the private host link. Start with at least two players on separate phones.' },
 { title: 'Join and answer on your phone', body: 'Scan the player QR or enter the room code and your name. Pick a choice or type your answer, then tap Lock answer before time runs out. Everyone answers every question.' },
 { title: 'Optional: run the show from your phone', body: 'Pair a host controller privately. Auto-run advances round intros, automatically scored questions, and the final reveal. Questions that need a person to score them still wait for the host.' },
 { title: 'Reveal the answers at the end', body: 'After all 26 questions, the host taps Start the big reveal and reveals each answer one at a time. Correct answers earn that question’s points. The final leaderboard shows who scored most.' },
] as const;
const savedHostKey='madfun.eesha-lore.host-unlock.v1';
export default function Trivia(){
 const client=useMemo(()=>new PartyClient(),[]);
 const room=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);
 const [deck,setDeck]=useState<Deck|null>(null),[queue,setQueue]=useState<Question[]>([]);
 const [run,setRun]=useState<Run|null>(null),[remote,setRemote]=useState<PublicRun|null>(null),[name,setName]=useState(''),[invited,setInvited]=useState(false),[code,setCode]=useState(''),[qr,setQr]=useState(''),[error,setError]=useState(''),[now,setNow]=useState(0),[inviteNotice,setInviteNotice]=useState('');
 const [autoRun,setAutoRun]=useState(false),[privateReviewVersion,setPrivateReviewVersion]=useState<number|null>(null);
 const host=room.role==='host',online=room.status==='connected',canAct=online&&(host||room.hostConnected),view=host?(run?publicRun(run,queue,deck?.title??'Eesha Lore Night'):null):remote;
 const me=room.playerId??'',active=run?queue[run.index]:null;
 const mascot='/madfun/eesha-sticker.png';
 const joinUrl=host&&room.code&&typeof window!=='undefined'?new URL('/madfun/jeopardy?join='+room.code,location.origin).href:'';
 useEffect(()=>{const t=setTimeout(()=>{const c=new URLSearchParams(location.search).get('join');if(c){setCode(c.toUpperCase().slice(0,6));setInvited(/^[A-Z0-9]{6}$/i.test(c));}},0);return()=>clearTimeout(t);},[]);
 useEffect(()=>{
  let stopped=false;
  const fromLink=new URLSearchParams(location.hash.slice(1)).get('host');
  let key=fromLink;
  if(!key&&!new URLSearchParams(location.search).has('join'))try{key=localStorage.getItem(savedHostKey);}catch{/* no storage */}
  if(!key)return;
  const unlockKey=key;
  void unlockEeshaDeck(unlockKey).then(value=>{
   if(stopped)return;
   setDeck(value);
   if(fromLink){
    try{localStorage.setItem(savedHostKey,unlockKey);}catch{/* this tab still works */}
    history.replaceState(history.state,'',location.pathname+location.search);
   }
  }).catch(()=>{if(!stopped&&fromLink)setError('This host link could not unlock the Eesha deck.');});
  return()=>{stopped=true;};
 },[]);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(t);},[]);
 useEffect(()=>()=>client.dispose(),[client]);
 useEffect(()=>client.onState(x=>setRemote(x as PublicRun)),[client]);
 useEffect(()=>client.onAction(({role,playerId,payload})=>{if(role==='player')setRun(g=>g?move(g,queue,playerId,payload):g);}),[client,queue]);
 useEffect(()=>{if(host&&online&&run)client.publish(publicRun(run,queue,deck?.title??'Eesha Lore Night'));},[client,deck?.title,host,online,queue,run]);
 useEffect(()=>{if(!joinUrl)return;let live=true;QRCode.toDataURL(joinUrl,{margin:2,width:240}).then(x=>{if(live)setQr(x);}).catch(()=>{});return()=>{live=false;};},[joinUrl]);
 useEffect(()=>{if(!host||!online||run?.phase!=='answer'||!run.deadline)return;
  const connected=run.players.filter(p=>room.players.some(x=>x.id===p.id&&x.connected));
  if(now>=run.deadline||(connected.length&&connected.every(p=>Object.hasOwn(run.answers,p.id)))){
   const t=setTimeout(()=>setRun(g=>g?move(g,queue,'host',{type:'close',version:run.version}):g),0);return()=>clearTimeout(t);
  }
 },[host,now,online,queue,room.players,run]);
 const act=(type:string,value?:string)=>{if(!view||!canAct)return;const a={type,value,version:view.version};if(host)setRun(g=>g?move(g,queue,'host',a):g);else client.sendAction(a);};
 const start=()=>{if(!deck||!online||room.players.filter(p=>p.connected).length<2)return;setQueue(makeQueue(deck));setRun(newRun(room.players,Date.now()));client.setLocked(true);};
 const leave=()=>{client.leave();setAutoRun(false);setPrivateReviewVersion(null);setRun(null);setRemote(null);setQr('');setInviteNotice('');};
 const reviewLabel=view&&view.index+1===view.total?'Start the big reveal':view&&queue[view.index+1]?.start?'Next round':'Next question';
 const recapLabel=!view?.recapOpen?'Reveal answer':view.revealCard?.index===view.total-1?'Show final leaderboard':'Next answer';
 const nextAfterReview=()=>{if(!host||!online)return;setRun(g=>g?advanceReviewed(g,queue):g);};
 const canStart=online&&!!deck&&room.players.filter(p=>p.connected).length>=2;
 const privateReviewOpen=run?.phase==='review'&&privateReviewVersion===run.version;
 const autoStep=run&&!privateReviewOpen?loreAutoStep(run,queue):null;
 const autoAction=autoStep?.action, autoDelay=autoStep?.delay, runVersion=run?.version;
 useEffect(()=>{
  if(!autoRun||!host||!online||!autoAction||!autoDelay||runVersion===undefined)return;
  const timer=setTimeout(()=>setRun(g=>{
   if(!g||g.version!==runVersion)return g;
   return autoAction==='advance_review'?advanceReviewed(g,queue):move(g,queue,'host',{type:autoAction,version:g.version});
  }),autoDelay);
  return()=>clearTimeout(timer);
 },[autoRun,host,online,queue,autoAction,autoDelay,runVersion]);
 const remoteActions=[
  {id:'lore-auto',label:autoRun?'Turn off Auto-run':'Turn on Auto-run',run:()=>setAutoRun(v=>!v)},
  ...(!run?[{id:'lore-start',label:'Start game',run:start,disabled:!canStart}]:[]),
  ...(view?.phase==='round'?[{id:'lore-open',label:'Show question',run:()=>act('open')}]:[]),
  ...(view?.phase==='answer'?[{id:'lore-close',label:'Close answers',run:()=>act('close')}]:[]),
  ...(view?.phase==='review'&&!active?.manual?[{id:'lore-next',label:reviewLabel,run:nextAfterReview}]:[]),
  ...(view?.phase==='recap'?[{id:'lore-recap',label:recapLabel,run:()=>act(view.recapOpen?'next_recap':'reveal_recap')}]:[]),
  ...(view?.phase==='results'?[{id:'lore-rematch',label:'Play again',run:start,disabled:!canStart}]:[]),
  {id:'lore-end',label:'End room',run:leave,confirm:'End the room for everyone?'},
 ];
 const copyInvite=async()=>{
  if(!joinUrl)return;
  try{await navigator.clipboard.writeText(joinUrl);setInviteNotice('Join link copied.');}
  catch{setInviteNotice('Send your friends the room code: '+room.code);}
 };
 const scores=view&&[...view.players].sort((a,b)=>(view.scores[b.id]??0)-(view.scores[a.id]??0));
 return <main className={s.page}><header className={s.header}><Link href="/madfun">madfun<span>✳</span></Link><small>EVERYONE IN · GROUP TRIVIA</small>{host&&<HostRemote game="Eesha Lore Night" active={online} phase={view?.phase==='review'&&active?.manual?'Manual judging: use the host screen':view?.phase==='results'?'Final scores':!run?'Waiting for players':'Trivia in progress'} actions={remoteActions}/>}{room.role&&<button onClick={leave}>{host?'End room':'Leave room'}</button>}</header>
 {host&&<label className={s.autoRun}><input type="checkbox" checked={autoRun} onChange={e=>setAutoRun(e.target.checked)}/> Auto-run questions and reveals</label>}
 {host&&autoRun&&run&&<p role="status">{run.phase==='review'&&active?.manual?'Auto-run paused · host judging required':privateReviewOpen?'Auto-run paused · private review open':autoStep?'Auto-run · advancing after '+(autoStep.delay/1000)+' seconds':'Auto-run is on'}</p>}
 {room.error&&<p role="alert">{room.error} <button onClick={()=>client.retry()}>Retry</button></p>}
 {room.role&&!online&&!room.error&&<p role="status">Connecting to the room…</p>}{online&&!host&&!room.hostConnected&&view&&<p role="status">Host disconnected. Keep this screen open to reconnect.</p>}
 {!room.role&&<section className={s.stage}><p className={s.kicker}>NO BUZZERS. EVERYONE PLAYS.</p><h1>Eesha <em>Lore Night</em></h1><p>Create the room on the shared screen. All players answer on their own phones. Answers and scores are revealed at the end.</p><QuickStart game="Eesha Lore Night" steps={quickSteps}/>{!invited&&(deck?<button className={s.primary} onClick={()=>client.create('jeopardy')}>Create room</button>:<p>Hosting? Open the private Eesha Lore Night host link on the shared screen.</p>)}{error&&<p role="alert">{error}</p>}<form className={s.form} onSubmit={e=>{e.preventDefault();client.join(code,name,'jeopardy');}}><input aria-label="Room code" placeholder="Room code" value={code} maxLength={6} onChange={e=>setCode(e.target.value.toUpperCase())} required/><input aria-label="Player name" placeholder="Your name" value={name} maxLength={32} onChange={e=>setName(e.target.value)} required/><button>Join game</button></form></section>}
 {room.role&&!view&&<QuickStart game="Eesha Lore Night" steps={quickSteps}/>}
 {host&&room.code&&!run&&<section className={s.lobby}><article><p className={s.kicker}>PLAYER QR · SCAN TO PLAY</p>{qr&&<div role="img" aria-label="Player QR: scan with your phone to join Eesha Lore Night" className={s.qr} style={{backgroundImage:'url('+qr+')'}}/>}<h2>{room.code}</h2><p>Everyone who wants to play joins from a separate phone.</p><button onClick={()=>void copyInvite()}>Copy join link</button>{inviteNotice&&<p role="status">{inviteNotice}</p>}</article><article><p className={s.kicker}>HOST DISPLAY · NO PLAYER SLOT</p><h2>Eesha Lore Night</h2><p>{room.players.filter(p=>p.connected).length} joined{deck&&' · '+deck.categories.length+' rounds + finale'}</p><div className={s.scores}>{room.players.map(p=><span key={p.id}>{p.name}{p.connected?'':' (offline)'}</span>)}</div><button className={s.primary} onClick={start} disabled={!online||!deck||room.players.filter(p=>p.connected).length<2}>Start game</button>
 {room.players.filter(p=>p.connected).length<2&&<p>Waiting for two players to join on their phones. The host doesn’t count.</p>}</article></section>}
 {!host&&room.role==='player'&&online&&!view&&<section className={s.stage}><p className={s.kicker}>ROOM {room.code}</p><h1>You’re in.</h1><p>The questions and your answers will appear here.</p></section>}
 {view&&room.status!=='closed'&&<><div className={s.scores}>{view.players.map(p=><span key={p.id}>{p.name}{view.phase==='results'&&<> <b>{view.scores[p.id]??0}</b></>}</span>)}</div><section className={s.stage}><p className={s.kicker}>{view.title} · {view.phase==='results'?'FINAL SCORES':view.phase==='recap'?'THE BIG REVEAL':view.phase==='round'?'UP NEXT':('QUESTION '+(view.index+1)+' / '+view.total+' · '+view.points+' POINTS')}</p>
 {host&&mascot&&(['round','results'].includes(view.phase)||(view.phase==='recap'&&view.recapOpen))&&<div aria-hidden className={s.sticker} key={view.version} style={{backgroundImage:'url('+mascot+')'}}/>}
 {view.phase==='round'&&<><h1>{view.round}</h1><p>All players answer every question.</p>{host&&<button className={s.primary} onClick={()=>act('open')} disabled={!online}>Show question</button>}</>}
 {view.phase==='recap'&&view.revealCard&&<div className={s.recapFrame} key={view.revealCard.index}>
  <div className={s.recapMeta}><span>ANSWER {view.revealCard.index+1} / {view.total}</span><span>{view.revealCard.round}</span><span>{view.revealCard.points} PTS</span></div>
  <div className={s.recapProgress} aria-hidden="true"><i style={{width:((view.revealCard.index+Number(view.recapOpen))/view.total*100)+'%'}}/></div>
  <h2>{view.revealCard.prompt}</h2>
  <div className={s.recapAnswer} data-revealed={!!view.recapOpen} aria-live="polite">{view.recapOpen
   ?<div className={s.recapHit}><span>THE ANSWER</span><strong>{view.revealCard.answer??'Host’s call'}</strong></div>
   :<div className={s.recapCovered}><span aria-hidden="true">✦</span><b>Answer sealed</b></div>}</div>
  {host?<button className={s.primary} disabled={!online} onClick={()=>act(view.recapOpen?'next_recap':'reveal_recap')}>{recapLabel}</button>:<p>The answers appear here, one by one. The leaderboard follows the last answer.</p>}
 </div>}
 {view.phase==='results'&&<><h1>{scores?.filter(p=>(view.scores[p.id]??0)===(view.scores[scores[0]?.id]??0)).map(p=>p.name).join(' & ')}</h1><p>Top of the leaderboard</p><ol className={s.leaders}>{scores?.map(p=><li key={p.id}>{p.name}<b>{view.scores[p.id]??0}</b></li>)}</ol>{host&&<button className={s.primary} onClick={start} disabled={!online}>Play again</button>}</>}
 {['answer','review','reveal'].includes(view.phase)&&<><p className={s.kicker}>{view.round}{view.deadline&&now?' · '+Math.max(0,Math.ceil((view.deadline-now)/1000))+'s':''}</p><h2>{view.prompt}</h2>
 {host&&view.phase==='answer'&&view.choices&&<div className={s.choices}>{view.choices.map((x,i)=><span key={x}><b>{'ABCDEFGH'[i]}</b> {x}</span>)}</div>}
 {view.phase==='answer'&&(host?<><p>{view.submitted.length} / {view.players.length} answers locked</p><button onClick={()=>act('close')} disabled={!online}>Close answers</button></>:view.submitted.includes(me)?<p>Answer locked. The next question will appear here.</p>:<Answer key={view.version} choices={view.choices} disabled={!canAct} submit={v=>act('answer',v)}/>)}
 {view.phase==='review'&&(host&&run?<><p>Answers locked. The answer key and scores stay hidden until the end.</p><details key={run.version} onToggle={e=>setPrivateReviewVersion(e.currentTarget.open?run.version:null)}><summary onClick={e=>{if(!e.currentTarget.parentElement?.hasAttribute('open')&&!window.confirm('Open private scoring? Make sure players cannot see this screen before continuing.'))e.preventDefault();}}>{active?.manual?'Private judging (hide shared screen first)':'Private scoring (hide shared screen first)'}</summary><p>Close this panel before showing the screen to players.</p><div className={s.replies}>{run.players.map(p=><div key={p.id}><b>{p.name}</b><span>{run.answers[p.id]??'No answer'}</span>{Object.hasOwn(run.answers,p.id)&&<button aria-pressed={run.marks[p.id]??false} onClick={()=>act('mark',p.id)}>{run.marks[p.id]?'Correct':'Incorrect'}</button>}</div>)}</div></details><button className={s.primary} onClick={nextAfterReview} disabled={!online}>{reviewLabel}</button></>:<p>Answers locked. The answer key and scores will appear at the end.</p>)}
 {view.phase==='reveal'&&<p>Answers locked. The answer key and scores will appear at the end.</p>}
 </>}</section></>}
 </main>;
}
function Answer({choices,disabled,submit}:{choices?:string[];disabled:boolean;submit:(v:string)=>void}){
 const [value,setValue]=useState('');
 return <form className={s.answer} onSubmit={e=>{e.preventDefault();if(!disabled&&value.trim())submit(value.trim());}}>{choices?<div className={s.choices}>{choices.map((x,i)=><button type="button" disabled={disabled} key={x} aria-pressed={value===x} onClick={()=>setValue(x)}><b>{'ABCDEFGH'[i]}</b> {x}</button>)}</div>:<input aria-label="Your answer" placeholder="Type your answer" disabled={disabled} value={value} onChange={e=>setValue(e.target.value)} maxLength={160} required/>}<button className={s.primary} disabled={disabled||!value.trim()}>Lock answer</button></form>;
}
