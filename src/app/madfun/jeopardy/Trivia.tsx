'use client';
import Link from 'next/link';
import QRCode from 'qrcode';
import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {PartyClient} from '../shared/party-client';
import {makeQueue,move,newRun,parseDeck,publicRun,type PublicRun,type Question,type Run} from './engine';
import {sampleDeck} from './deck';
import s from './trivia.module.css';
export default function Trivia(){
 const client=useMemo(()=>new PartyClient(),[]);
 const room=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);
 const [deck,setDeck]=useState(sampleDeck),[source,setSource]=useState(()=>JSON.stringify(sampleDeck,null,2)),[queue,setQueue]=useState<Question[]>([]);
 const [run,setRun]=useState<Run|null>(null),[remote,setRemote]=useState<PublicRun|null>(null),[name,setName]=useState(''),[code,setCode]=useState(''),[qr,setQr]=useState(''),[error,setError]=useState(''),[now,setNow]=useState(0),[sticker,setSticker]=useState(''),[hideSticker,setHideSticker]=useState(false);
 const host=room.role==='host',online=room.status==='connected',canAct=online&&(host||room.hostConnected),view=host?(run?publicRun(run,queue,deck.title):null):remote;
 const me=room.playerId??'',active=run?queue[run.index]:null;
 const mascot=sticker||(!hideSticker&&/\beesha\b/i.test(deck.title)?'/madfun/eesha-sticker.png':'');
 const joinUrl=host&&room.code&&typeof window!=='undefined'?new URL('/madfun/jeopardy?join='+room.code,location.origin).href:'';
 useEffect(()=>{const t=setTimeout(()=>{const c=new URLSearchParams(location.search).get('join');if(c)setCode(c.toUpperCase().slice(0,6));},0);return()=>clearTimeout(t);},[]);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(t);},[]);
 useEffect(()=>()=>client.dispose(),[client]);
 useEffect(()=>client.onState(x=>setRemote(x as PublicRun)),[client]);
 useEffect(()=>client.onAction(({role,playerId,payload})=>{if(role==='player')setRun(g=>g?move(g,queue,playerId,payload):g);}),[client,queue]);
 useEffect(()=>{if(host&&online&&run)client.publish(publicRun(run,queue,deck.title));},[client,deck.title,host,online,queue,run]);
 useEffect(()=>{if(!joinUrl)return;let live=true;QRCode.toDataURL(joinUrl,{margin:2,width:240}).then(x=>{if(live)setQr(x);}).catch(()=>{});return()=>{live=false;};},[joinUrl]);
 useEffect(()=>()=>{if(sticker)URL.revokeObjectURL(sticker);},[sticker]);
 useEffect(()=>{if(!host||!online||run?.phase!=='answer'||!run.deadline)return;
  const connected=run.players.filter(p=>room.players.some(x=>x.id===p.id&&x.connected));
  if(now>=run.deadline||(connected.length&&connected.every(p=>Object.hasOwn(run.answers,p.id)))){
   const t=setTimeout(()=>setRun(g=>g?move(g,queue,'host',{type:'close',version:run.version}):g),0);return()=>clearTimeout(t);
  }
 },[host,now,online,queue,room.players,run]);
 const act=(type:string,value?:string)=>{if(!view||!canAct)return;const a={type,value,version:view.version};if(host)setRun(g=>g?move(g,queue,'host',a):g);else client.sendAction(a);};
 const start=()=>{if(room.players.filter(p=>p.connected).length<2)return;setQueue(makeQueue(deck));setRun(newRun(room.players,Date.now()));client.setLocked(true);};
 const leave=()=>{client.leave();setRun(null);setRemote(null);setQr('');};
 const install=(text:string)=>{try{setDeck(parseDeck(text));setSource(text);setError('');}catch(e){setError(e instanceof Error?e.message:'Invalid JSON deck.');}};
 const scores=view&&[...view.players].sort((a,b)=>(view.scores[b.id]??0)-(view.scores[a.id]??0));
 return <main className={s.page}><header className={s.header}><Link href="/madfun">madfun<span>✳</span></Link><small>EVERYONE IN · GROUP TRIVIA</small>{room.role&&<button onClick={leave}>{host?'End room':'Leave room'}</button>}</header>
 {room.error&&<p role="alert">{room.error} <button onClick={()=>client.retry()}>Retry</button></p>}
 {room.role&&!online&&!room.error&&<p role="status">Connecting to the room…</p>}{online&&!host&&!room.hostConnected&&view&&<p role="status">Host disconnected. Keep this screen open to reconnect.</p>}
 {!room.role&&<section className={s.stage}><p className={s.kicker}>NO BUZZERS. EVERYONE PLAYS.</p><h1>Eesha <em>Lore Night</em></h1><p>One big screen. Everyone answers. Bring your own lore.</p><button className={s.primary} onClick={()=>client.create('jeopardy')}>Host on this screen</button><form className={s.form} onSubmit={e=>{e.preventDefault();client.join(code,name,'jeopardy');}}><input aria-label="Room code" placeholder="Room code" value={code} maxLength={6} onChange={e=>setCode(e.target.value.toUpperCase())} required/><input aria-label="Player name" placeholder="Your name" value={name} maxLength={32} onChange={e=>setName(e.target.value)} required/><button>Join game</button></form></section>}
 {host&&room.code&&!run&&<section className={s.lobby}><article><p className={s.kicker}>SCAN TO JOIN</p>{qr&&<div role="img" aria-label="Join QR code" className={s.qr} style={{backgroundImage:'url('+qr+')'}}/>}<h2>{room.code}</h2><a href={joinUrl}>{joinUrl}</a></article><article><p className={s.kicker}>HOST DESK</p><h2>{deck.title}</h2><p>{room.players.filter(p=>p.connected).length} joined · {deck.categories.length} rounds</p><div className={s.scores}>{room.players.map(p=><span key={p.id}>{p.name}{p.connected?'':' (offline)'}</span>)}</div><button className={s.primary} onClick={start} disabled={!online||room.players.filter(p=>p.connected).length<2}>Start game</button>
 <details><summary>Import or edit a private deck</summary><p>The full deck stays in this tab. Your room sees the current question and its reveal.</p><textarea rows={8} aria-label="Deck JSON" value={source} onChange={e=>setSource(e.target.value)}/><div className={s.form}><button onClick={()=>install(source)}>Apply deck</button><label>Load JSON <input type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>100000){setError('Choose a deck under 100 KB.');return;}try{install(await f.text());}catch{setError('Could not read the deck.');}}}/></label></div></details>
 <details><summary>Cartoon sticker</summary><p>Appears only on the TV between rounds and at reveals. The Eesha deck uses its event sticker by default.</p><input aria-label="Custom cartoon sticker" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>8000000){setError('Choose a PNG, JPEG or WebP under 8 MB.');return;}setSticker(URL.createObjectURL(f));setError('');}}/>{mascot&&<button onClick={()=>{setSticker('');setHideSticker(true);}}>Hide sticker</button>}</details>{error&&<p role="alert">{error}</p>}</article></section>}
 {!host&&room.role==='player'&&online&&!view&&<section className={s.stage}><p className={s.kicker}>ROOM {room.code}</p><h1>You’re in.</h1><p>Keep the TV in view. Your answers go here.</p></section>}
 {view&&room.status!=='closed'&&<><div className={s.scores}>{scores?.map(p=><span key={p.id}>{p.name} <b>{view.scores[p.id]??0}</b></span>)}</div><section className={s.stage}><p className={s.kicker}>{view.title} · {view.phase==='results'?'FINAL SCORES':view.phase==='round'?'UP NEXT':('QUESTION '+(view.index+1)+' / '+view.total+' · '+view.points+' POINTS')}</p>
 {host&&mascot&&['round','reveal','results'].includes(view.phase)&&<div aria-hidden className={s.sticker} key={view.version} style={{backgroundImage:'url('+mascot+')'}}/>}
 {view.phase==='round'&&<><h1>{view.round}</h1><p>All players answer every question.</p>{host&&<button className={s.primary} onClick={()=>act('open')} disabled={!online}>Show question</button>}</>}
 {view.phase==='results'&&<><h1>{scores?.filter(p=>(view.scores[p.id]??0)===(view.scores[scores[0]?.id]??0)).map(p=>p.name).join(' & ')}</h1><p>Top of the leaderboard</p><ol className={s.leaders}>{scores?.map(p=><li key={p.id}>{p.name}<b>{view.scores[p.id]??0}</b></li>)}</ol>{host&&<button className={s.primary} onClick={start} disabled={!online}>Play again</button>}</>}
 {['answer','review','reveal'].includes(view.phase)&&<><p className={s.kicker}>{view.round}{view.deadline&&now?' · '+Math.max(0,Math.ceil((view.deadline-now)/1000))+'s':''}</p><h2>{view.prompt}</h2>
 {host&&view.phase==='answer'&&view.choices&&<div className={s.choices}>{view.choices.map((x,i)=><span key={x}><b>{'ABCDEFGH'[i]}</b> {x}</span>)}</div>}
 {view.phase==='answer'&&(host?<><p>{view.submitted.length} / {view.players.length} answers locked</p><button onClick={()=>act('close')} disabled={!online}>Close answers</button></>:view.submitted.includes(me)?<p>Answer locked. Look up!</p>:<Answer key={view.version} choices={view.choices} disabled={!canAct} submit={v=>act('answer',v)}/>)}
 {view.phase==='review'&&(host&&run?<><p>{active?.manual?'Host-judged question. Mark the answers you want to award points to.':<>Accepted answer: <strong>{active?.answer}</strong>. Adjust marks before revealing.</>}</p><div className={s.replies}>{run.players.map(p=><div key={p.id}><b>{p.name}</b><span>{run.answers[p.id]??'No answer'}</span>{Object.hasOwn(run.answers,p.id)&&<button aria-pressed={run.marks[p.id]??false} onClick={()=>act('mark',p.id)}>{run.marks[p.id]?'Correct':'Incorrect'}</button>}</div>)}</div><button className={s.primary} onClick={()=>act('reveal')} disabled={!online}>Reveal answer & scores</button></>:<p>Answers closed. Waiting for the reveal…</p>)}
 {view.phase==='reveal'&&<><p className={s.reveal}>{view.answer??'Host’s picks'}</p><div className={s.replies}>{view.players.map(p=><div key={p.id}><b>{p.name}</b><span>{view.answers?.[p.id]??'No answer'}</span><strong>{view.marks?.[p.id]?'+'+view.points:'0'}</strong></div>)}</div>{host&&<button className={s.primary} onClick={()=>act('next')} disabled={!online}>{view.index+1===view.total?'Show leaderboard':queue[view.index+1]?.start?'Next round':'Next question'}</button>}</>}
 </>}</section></>}
 </main>;
}
function Answer({choices,disabled,submit}:{choices?:string[];disabled:boolean;submit:(v:string)=>void}){
 const [value,setValue]=useState('');
 return <form className={s.answer} onSubmit={e=>{e.preventDefault();if(!disabled&&value.trim())submit(value.trim());}}>{choices?<div className={s.choices}>{choices.map((x,i)=><button type="button" disabled={disabled} key={x} aria-pressed={value===x} onClick={()=>setValue(x)}><b>{'ABCDEFGH'[i]}</b> {x}</button>)}</div>:<input aria-label="Your answer" placeholder="Type your answer" disabled={disabled} value={value} onChange={e=>setValue(e.target.value)} maxLength={160} required/>}<button className={s.primary} disabled={disabled||!value.trim()}>Lock answer</button></form>;
}
