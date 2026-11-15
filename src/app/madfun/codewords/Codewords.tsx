'use client';

import { useEffect, useState, type FormEvent } from 'react';
import QuickStart from '../shared/QuickStart';
import Link from 'next/link';
import Image from 'next/image';
import QRCode from 'qrcode';
import { useCodewordsSession } from './useCodewordsSession';
import { clueError, type CardKind, type Team } from './engine';
import styles from './codewords.module.css';

const quickSteps = [
 { title: 'Create the shared board', body: 'On the big screen, choose Create room. This screen shows the board and starts each game. It doesn’t join a team. At least four players scan the player QR on their phones.' },
 { title: 'Pick teams and roles', body: 'Each team needs one clue-giver and at least one guesser. Only the clue-givers can see which cards belong to which team.' },
 { title: 'Give a clue, then guess', body: 'On your turn, the clue-giver sends one word and a number, like Space, 2. Guessers tap a word and confirm it. You can guess up to one more than the number or end your turn early. A wrong pick ends your turn.' },
 { title: 'Find all your words', body: 'Reveal every word of your team’s color first to win. Pick the trap card and your team immediately loses.' },
] as const;

const gamePath = '/madfun/codewords';
const teamName = { red: 'Red', blue: 'Blue' } as const;
const cardName: Record<CardKind, string> = { red: 'Red', blue: 'Blue', neutral: 'Neutral', assassin: 'Trap' };

export default function Codewords() {
 const session = useCodewordsSession();
 const { state, host, watching, roomCode, participantId } = session;
 const active = session.status !== 'idle';
 const [name, setName] = useState('');
 const [code, setCode] = useState('');
 const [tvMode, setTvMode] = useState(false);
 const [invited, setInvited] = useState(false);
 const [showInvite, setShowInvite] = useState(false);
 const [editTeamsMatch, setEditTeamsMatch] = useState<number | null>(null);
 const [qr, setQr] = useState('');
 const [copyLabel, setCopyLabel] = useState('');
 const [clue, setClue] = useState('');
 const [count, setCount] = useState(1);
 const [clueNotice, setClueNotice] = useState('');
 const [pick, setPick] = useState<{ index: number; turn: number; match: number } | null>(null);

 useEffect(() => {
  const query = new URLSearchParams(window.location.search);
  const timer = window.setTimeout(() => {
   setCode((query.get('room') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,6));
   setTvMode(query.get('watch') === '1');
   setInvited(!!query.get('room'));
  }, 0);
  return () => window.clearTimeout(timer);
 }, []);
 useEffect(() => {
  if (!roomCode) return;
  let cancelled = false;
  QRCode.toDataURL(new URL(`${gamePath}?room=${roomCode}`, window.location.origin).href, {width:240,margin:3})
   .then(src => { if (!cancelled) setQr(src); }).catch(() => {});
  return () => { cancelled = true; };
 }, [roomCode]);

 const game = state?.game ?? null;
 const connectedPlayers = state?.seats.filter(seat => seat.connected).length ?? 0;
 const display = host || watching;
 const me = !display ? state?.seats.find(s => s.id === participantId) : undefined;
 const connected = session.status === 'connected';
 const gameLive = connected && session.hostConnected;
 const canClue = gameLive && me?.team === game?.turn && me?.role === 'spymaster' && game?.phase === 'clue';
 const canGuess = gameLive && me?.team === game?.turn && me?.role === 'guesser' && game?.phase === 'guess';
 const picked = canGuess && pick && game.turnNumber === pick.turn && state?.match === pick.match && !game.board[pick.index]?.revealed ? pick.index : null;
 const joinPath = `${gamePath}?room=${roomCode}`;
 const tvPath = `${joinPath}&watch=1`;
 const leave = () => {
  session.leave();
  setShowInvite(false);
  setEditTeamsMatch(null);
  setCopyLabel('');
  setQr('');
  setPick(null);
  setClue('');
  setClueNotice('');
 };
 const share = async () => {
  const url = new URL(joinPath, window.location.origin).href;
  try {
   if (navigator.share) await navigator.share({title:'Join my Codewords game', url});
   else { await navigator.clipboard.writeText(url);setCopyLabel('Link copied'); }
  } catch (error) {
   if (!(error instanceof DOMException && error.name === 'AbortError')) setCopyLabel('Couldn’t share. Use the room code or scan the QR.');
  }
 };
 const submitClue = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (!canClue || !game) return;
  const issue = clueError(game.board,clue,count);
  if (issue) { setClueNotice(issue); return; }
  setClueNotice('');
  session.dispatch({ type:'clue',word:clue.trim(),count });
  setClue('');
  setCount(1);
 };
 const teams: Team[] = ['red','blue'];
 const invite = roomCode && <aside className={`${styles.panel} ${styles.invite}`} aria-label="Player invite">
  {qr && <Image src={qr} unoptimized alt="Player QR: scan to play Codewords on your phone" width={display ? 146 : 108} height={display ? 146 : 108}/>}
  <div className={styles.stack}><h2>Player QR · Scan to play</h2><div className={styles.roomBadge}>ROOM {roomCode}</div><div className={styles.actions}>
   {!watching && <button onClick={share}>Share player invite</button>}{host && <Link className={styles.quietLink} href={tvPath} target="_blank" rel="noopener">Open another display ↗</Link>}
  </div>{copyLabel && <span className={styles.small} role="status">{copyLabel}</span>}</div>
 </aside>;

 return <main className={styles.shell}>
  <header className={styles.header}>
   <Link className={styles.brand} href="/madfun">madfun<b>✳</b></Link>
   {active && <div className={styles.headerTools}>
    {roomCode && <span className={styles.roomBadge}>{roomCode}</span>}{display && <span className={styles.roomBadge}>{host ? "Host display" : "Watch only"}</span>}
    {roomCode && !watching && <button aria-expanded={showInvite || !game} onClick={() => setShowInvite(!showInvite)} hidden={!game}>Invite</button>}
    <button onClick={() => { if(!host || !game || game.phase==='finished' || window.confirm('End this room for everyone?')) leave(); }}>{host ? 'End room' : 'Leave'}</button>
   </div>}
  </header>
  <div className={styles.frame}>
   {session.error && <div className={styles.alert} role="alert">{session.error} {active && <button onClick={session.retry}>Reconnect</button>}</div>}
   {!game && <QuickStart game="Codewords" steps={quickSteps}/>}
   {!active ? <>
    <section className={styles.hero}>
     <span className={styles.kicker}>The secret-word party game</span>
     <h1 className={styles.title}>Codewords.</h1>
     <p className={styles.deckSubtitle}>Two teams. One word per clue. Find your team’s cards before the other side does.</p>
    </section>
    <div className={styles.entryGrid}>
     <form className={`${styles.panel} ${styles.stack}`} onSubmit={e => {
      e.preventDefault();
      if (tvMode) session.watch(code);
      else if (name.trim()) session.join(code, name.trim());
     }}>
      <h2>{tvMode ? 'Open the shared board' : 'Join a game'}</h2>
      {!tvMode && <label>Your name<input autoComplete="nickname" maxLength={40} required value={name} onChange={e => setName(e.target.value)} placeholder="Sam"/></label>}
      <label>Room code<input autoComplete="off" autoCapitalize="characters" spellCheck={false} minLength={6} maxLength={6} required value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="ABC123"/></label>
      <button className={styles.primary} disabled={code.length!==6 || (!tvMode && !name.trim())}>{tvMode ? 'Show board' : 'Join room'}</button>
      <button type="button" onClick={() => setTvMode(!tvMode)}>{tvMode ? 'Join as a player instead' : 'Watch only (TV mode)'}</button>
     </form>
     {!tvMode && !invited && <section className={`${styles.panel} ${styles.stack}`}>
      <h2>Host on this display</h2>
      <p className={styles.small}>This screen runs the shared board without playing. Invite at least four players to scan the QR on their phones.</p>
      <button className={styles.primary} onClick={session.create}>Create room</button>
     </section>}
    </div>
   </> : <>
    {!state && !session.error && <p className={styles.status} role="status">Connecting to the room…</p>}
    {state && !gameLive && !session.error && <p className={styles.status} role="status">Reconnecting…</p>}
    {(!game || showInvite) && invite}
    {state && game?.phase === 'finished' && state.canStart && !watching && editTeamsMatch !== state.match && <button onClick={() => setEditTeamsMatch(state.match)}>{host ? "View teams for next game" : "Change teams for next game"}</button>}
    {state && (!game || (game.phase === 'finished' && (!state.canStart || editTeamsMatch === state.match))) && <>
     <div><span className={styles.kicker}>Mission briefing</span><h1>{display ? 'Teams are getting ready.' : 'Pick a team on this phone.'}</h1>
      <p className={styles.deckSubtitle}>{connectedPlayers} {connectedPlayers === 1 ? 'player' : 'players'} connected · 4 minimum. Each team needs one clue-giver and at least one guesser.</p></div>
     <div className={styles.rosters}>{teams.map(team => {
      const roster = state.seats.filter(seat => seat.team === team);
      const clueGiver = roster.find(seat => seat.role === 'spymaster' && seat.connected);
      return <section key={team} className={`${styles.panel} ${styles.roster} ${styles[team]}`}>
       <h2>{teamName[team]} team</h2>
       <ul>{roster.length ? roster.map(seat => <li key={seat.id}><b>{seat.name}{seat.id === participantId ? ' (you)' : ''}</b><span className={styles.small}>{seat.role === 'spymaster' ? 'Clue-giver' : 'Guesser'}{!seat.connected ? ' · offline' : ''}</span></li>) : <li className={styles.small}>No players yet</li>}</ul>
       {!display && <div className={styles.actions}>
        <button disabled={!gameLive || (me?.team===team && me.role==='guesser')} onClick={() => session.dispatch({type:'seat',team,role:'guesser'})}>Join as guesser</button>
        <button disabled={!gameLive || !!clueGiver} onClick={() => session.dispatch({type:'seat',team,role:'spymaster'})}>{clueGiver ? 'Clue-giver taken' : 'Give clues'}</button>
       </div>}
      </section>;
     })}</div>
     {!game && (host ? <button className={styles.primary} disabled={!gameLive || !state.canStart} onClick={() => session.dispatch({type:'start'})}>Start game</button> : <p className={styles.small}>The host will start once both teams are ready.</p>)}
    </>}
    {game && <>
     <div className={styles.score} aria-label="Cards left to find">{teams.map(team => <div className={`${styles.teamScore} ${styles[team]}`} key={team}><span>{teamName[team]} cards left</span><strong>{game.remaining[team]}</strong></div>)}</div>
     <section className={`${styles.turn} ${game.winner ? styles[game.winner] : styles[game.turn]}`} aria-live="polite">
      <div><span className={styles.kicker}>{game.winner ? 'Mission complete' : `Turn ${game.turnNumber} · ${teamName[game.turn]} team`}</span><strong>
       {game.winner ? `${teamName[game.winner]} team wins!` : game.clue && game.phase==='guess' ? `${game.clue.word.toUpperCase()} · ${game.clue.count}` : canClue ? 'Your turn to give a clue' : 'Waiting for a clue…'}
      </strong></div>
      {game.phase==='guess' && <p className={styles.guesses}>{game.guessesRemaining} {game.guessesRemaining===1 ? 'guess' : 'guesses'} left</p>}
     </section>
     <div className={styles.gameIdentity}>
      <p className={styles.small}>{display ? 'Shared board · private clues stay on player phones' : me?.team ? `You’re on ${teamName[me.team]} · ${me.role === 'spymaster' ? 'Clue-giver' : 'Guesser'}` : 'Watching this round'}</p>
      {session.key && <p className={styles.keyNotice}>Private key · don’t share this screen</p>}
     </div>
     <div className={styles.board} role="group" aria-label="Word board">
      {game.board.map((card,index) => {
       const kind = card.kind ?? session.key?.[index];
       return <button type="button" className={styles.tile} key={`${index}-${card.word}`} disabled={!canGuess || card.revealed} data-selected={picked===index} data-color={kind} data-key={!!session.key && !card.revealed} data-revealed={card.revealed}
        aria-label={[card.word,kind&&cardName[kind],card.revealed&&'revealed'].filter(Boolean).join(', ')}
        onClick={() => setPick({index,turn:game.turnNumber,match:state?.match ?? -1})}>{card.word.toUpperCase()}</button>;
      })}
     </div>
     {game.lastGuess && <p className={styles.small} role="status">{teamName[game.lastGuess.team]} picked <b>{game.board[game.lastGuess.index]?.word}</b>: {cardName[game.lastGuess.kind]}.</p>}
     {canClue && <form className={`${styles.panel} ${styles.clueForm}`} onSubmit={submitClue}>
      <label>One-word clue<input autoComplete="off" maxLength={24} required value={clue} onChange={e => { setClue(e.target.value);setClueNotice(''); }} aria-describedby={clueNotice ? 'codewords-clue-error' : undefined} placeholder="Example: Ocean"/></label>
      <label>Cards<select value={count} onChange={e=>setCount(Number(e.target.value))}>{Array.from({length:9},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
      <button className={styles.primary} disabled={!clue.trim()}>Send clue</button>
      {clueNotice && <p className={styles.clueError} id="codewords-clue-error" role="alert">{clueNotice}</p>}
     </form>}
     {canGuess && <section className={`${styles.panel} ${styles.confirm}`} aria-label="Guess controls">
      {picked !== null ? <><p>Reveal <b>{game.board[picked].word.toUpperCase()}</b>?</p><button onClick={() => setPick(null)}>Cancel</button>
       <button className={styles.primary} onClick={() => { setPick(null);session.dispatch({type:'guess',index:picked}); }}>Confirm guess</button></> : <><p>Tap a word to guess.</p><button onClick={() => session.dispatch({type:'pass'})}>End turn</button></>}
     </section>}
     {host && game.phase==='finished' && <button className={styles.primary} disabled={!gameLive || !state?.canStart} onClick={() => { setPick(null);session.dispatch({type:'rematch'}); }}>Play again with new words</button>}
    </>}
   </>}
  </div>
 </main>;
}
