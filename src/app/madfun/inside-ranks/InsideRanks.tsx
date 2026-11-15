'use client';

import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import type { Player } from './engine';
import { useInsideRanksSession } from './useInsideRanksSession';
import styles from './inside-ranks.module.css';
import QuickStart from '../shared/QuickStart';

const path = '/madfun/inside-ranks';
const quickSteps = [
  { title: 'Create a room on the shared screen', body: 'Choose Create room on the screen everyone can see. This screen starts rounds and shows results, but it never joins as a player or sees the secret question.' },
  { title: 'Scan the player QR on your phone', body: 'At least three players scan the same QR, or enter the room code under Join a room. If the person setting up wants to play too, they scan on a separate phone.' },
  { title: 'Rank in private', body: 'The game picks a different ranker each round. When your phone says YOU’RE THE RANKER, read the secret question, move people up or down to put the best match at #1, then lock it in. No second QR is needed.' },
  { title: 'Guess and score', body: 'Everyone else sees the ranking and picks which of four questions fits it. Correct guesses get 1 point. Most points after everyone has had a turn wins.' },
] as const;
const cleanCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

function Ranking({ players }: { players: readonly Player[] }) {
  return <ol className={styles.ranking} aria-label="Group ranking">{players.map((player, index) =>
    <li key={player.id}><span className={styles.number}>{index + 1}</span><strong>{player.name}</strong></li>)}</ol>;
}

function RankForm({ players, prompt, disabled, onRank }: {
  players: readonly Player[]; prompt: string; disabled: boolean; onRank: (ids: string[]) => void;
}) {
  const [order, setOrder] = useState(() => [...players]);
  const move = (index: number, step: number) => {
    const to = index + step;
    if (to < 0 || to >= order.length) return;
    setOrder(current => {
      const next = [...current];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };
  return <form className={styles.stack} onSubmit={event => { event.preventDefault(); onRank(order.map(player => player.id)); }}>
    <div className={styles.private}><span className={styles.kicker}>Private • Only you can see this</span><h2>{prompt}</h2></div>
    <p>Put your best match at #1. Keep the question a secret!</p>
    <ol className={styles.ranking} aria-label="Rank your friends">{order.map((player,index) =>
      <li key={player.id}><span className={styles.number}>{index + 1}</span><strong>{player.name}</strong>
        <div className={styles.move}>
          <button type="button" disabled={disabled || index === 0} onClick={() => move(index,-1)} aria-label={`Move ${player.name} up`}>↑</button>
          <button type="button" disabled={disabled || index === order.length - 1} onClick={() => move(index,1)} aria-label={`Move ${player.name} down`}>↓</button>
        </div>
      </li>)}</ol>
    <button className={styles.primary} disabled={disabled}>Lock in ranking</button>
  </form>;
}

export default function InsideRanks() {
  const session = useInsideRanksSession();
  const { state, host, watching, roomCode, participantId, prompt } = session;
  const [name,setName] = useState('');
  const [code,setCode] = useState('');
  const [watchMode,setWatchMode] = useState(false);
  const [invited,setInvited] = useState(false);
  const [invite,setInvite] = useState(false);
  const [qr,setQr] = useState('');
  const [copy,setCopy] = useState('');
  const [pick,setPick] = useState<{ round: string; id: string } | null>(null);
  const active = session.status !== 'idle';
  const connected = session.status === 'connected';
  const match = state?.match;
  const roundKey = `${state?.matchId}:${match?.round}`;
  const selected = pick?.round === roundKey ? pick.id : null;
  const display = host || watching;
  const isRanker = !display && !!match && match.ranker.id === participantId;
  const canGuess = !display && !!participantId && !!match?.eligibleGuesserIds.includes(participantId);
  const hasGuessed = !!participantId && !!match?.guessedIds.includes(participantId);
  const players = state?.players ?? [];
  const online = players.filter(player => player.connected).length;
  const pendingCount = match?.eligibleGuesserIds.filter(id => players.some(player => player.id === id && player.connected) && !match.guessedIds.includes(id)).length ?? 0;
  const joinLink = `${path}?room=${roomCode ?? ''}`;
  const tvLink = `${joinLink}&watch=1`;

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const timer = window.setTimeout(() => {
      setCode(cleanCode(query.get('room') ?? ''));
      setWatchMode(query.get('watch') === '1');
      setInvited(!!query.get('room'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    let current = true;
    QRCode.toDataURL(new URL(joinLink, window.location.origin).href, { width: 208, margin: 3 })
      .then(value => { if (current) setQr(value); })
      .catch(() => {});
    return () => { current = false; };
  }, [roomCode,joinLink]);

  const share = async () => {
    const url = new URL(joinLink,window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: 'Join my Inside Ranks game', url });
      else {
        await navigator.clipboard.writeText(url);
        setCopy('Invite copied.');
      }
    } catch (issue) {
      if (!(issue instanceof DOMException && issue.name === 'AbortError')) setCopy('Use the QR or the room code to join.');
    }
  };

  const identify = (id: string) => players.find(player => player.id === id)?.name ?? 'Player';

  return <main className={styles.shell}>
    <header className={styles.header}>
      <Link href="/madfun" className={styles.brand}>madfun<span>✳</span></Link>
      {active && <div className={styles.actions}>
        {roomCode && <span className={styles.code}>{roomCode}</span>}{display && <span className={styles.roleBadge}>{host ? "Host display" : "Watch only"}</span>}
        {roomCode && match && !watching && <button aria-expanded={invite} onClick={() => setInvite(!invite)}>Invite</button>}
        <button onClick={() => {
          if (host && match && match.phase !== 'finished' && !window.confirm('End the room for everyone?')) return;
          session.leave(); setInvite(false); setCopy(''); setQr(''); setPick(null);
        }}>{host ? 'End room' : 'Leave'}</button>
      </div>}
    </header>
    <div className={styles.frame}>
      {session.error && <div className={styles.alert} role="alert">{session.error} {active && <button onClick={session.retry}>Reconnect</button>}</div>}
      {(!active || !match) && <QuickStart game="Inside Ranks" steps={quickSteps} />}
      {!active ? <>
        <section className={styles.hero}>
          <span className={styles.kicker}>A social guessing game for 3+ players</span>
          <h1>Inside Ranks<span>.</span></h1>
          <p>One friend gets a secret question and ranks the group. Everyone else sees the ranking and tries to guess what the question was.</p>
        </section>
        <div className={styles.entry}>
          <form className={styles.panel} onSubmit={event => {
            event.preventDefault();
            if (code.length !== 6) return;
            if (watchMode) session.watch(code);
            else if (name.trim()) session.join(code, name.trim());
          }}>
            <h2>{watchMode ? 'Watch the game' : 'Join a room'}</h2>
            {!watchMode && <label>Your name<input required autoComplete="nickname" maxLength={40} value={name} onChange={event => setName(event.target.value)} placeholder="Sam"/></label>}
            <label>Room code<input required autoComplete="off" autoCapitalize="characters" spellCheck={false} minLength={6} maxLength={6} value={code} onChange={event => setCode(cleanCode(event.target.value))} placeholder="ABC123"/></label>
            <button className={styles.primary} disabled={code.length !== 6 || (!watchMode && !name.trim())}>{watchMode ? 'Show shared screen' : 'Join room'}</button>
            <button type="button" onClick={() => setWatchMode(!watchMode)}>{watchMode ? 'Join as a player' : 'Watch only (TV mode)'}</button>
          </form>
          {!watchMode && !invited && <section className={styles.panel}>
            <h2>Host on this display</h2>
            <p>This screen runs the room without playing. Everyone scans the QR on their own phone. The secret question only appears on the current ranker’s phone.</p>
            <button className={styles.primary} onClick={session.create}>Create room</button>
          </section>}
        </div>
      </> : <>
        {!connected && !session.error && <p className={styles.alert} role="status">{state ? 'Reconnecting…' : 'Connecting to the room…'}</p>}
        {roomCode && (!match || (invite && !watching)) && <aside className={`${styles.panel} ${styles.share}`} aria-label="Player invite">
          {qr && <Image src={qr} unoptimized alt="Player QR: scan with your phone to join Inside Ranks" width={display ? 146 : 112} height={display ? 146 : 112}/>}
          <div className={styles.stack}><h2>Player QR · Scan to play</h2><span className={styles.code}>{roomCode}</span>
            <p>One QR for everyone. When it’s your turn to rank, the secret question appears on your phone automatically.</p>
            {!watching && <div className={styles.actions}><button onClick={share}>Share player invite</button>{host && <Link href={tvLink} target="_blank" rel="noopener">Open another display ↗</Link>}</div>}
            {host && <p className={styles.muted}>This is already the shared screen. Players join on their phones.</p>}
            {copy && <small role="status">{copy}</small>}
          </div>
        </aside>}
        {state && !match && <section className={styles.panel}>
          <span className={styles.kicker}>{display ? 'Waiting for phones to join' : 'Waiting for the group'}</span>
          <h1>Who’s playing?</h1>
          <p>{online} {online === 1 ? "player" : "players"} connected · 3 minimum</p>
          <ul className={styles.players}>{players.map(player => <li key={player.id}>{player.name}{player.id === participantId ? ' (you)' : ''}{!player.connected ? ' · offline' : ''}</li>)}</ul>
          {host ? <button className={styles.primary} disabled={!connected || online < 3} onClick={() => session.dispatch({type:'start'})}>Start game</button> : <p role="status">Your host will start the game.</p>}
        </section>}
        {match && <section className={styles.panel}>
          <span className={styles.kicker}>Round {match.round} of {match.totalRounds}</span>
          {match.phase === 'ranking' && <>
            {isRanker && <span className={styles.roleBadge}>You’re the ranker · Private turn</span>}
            <h1>{isRanker ? 'Rank your friends' : `${match.ranker.name} is ranking the group`}</h1>
            {isRanker && prompt ? <RankForm key={roundKey} players={match.rankTargets} prompt={prompt.text} disabled={!connected} onRank={orderedIds => session.dispatch({type:'rank',orderedIds})}/> :
              <p role="status">{isRanker ? 'Loading your private question…' : 'Only the ranker’s phone shows the secret question. Guessing opens after they lock the order.'}</p>}
            {host && !players.some(player => player.id === match.ranker.id && player.connected) &&
              <button disabled={!connected} onClick={() => session.dispatch({type:'skip'})}>Skip offline ranker</button>}
          </>}
          {(match.phase === 'guessing' || match.phase === 'reveal') && <>
            <h1>{match.phase === 'guessing' ? 'What was the question?' : 'The secret question was…'}</h1>
            <div className={styles.roundGrid}>
              <div className={styles.stack}><h2>{match.ranker.name}’s ranking</h2><Ranking players={match.ranking}/></div>
              <div className={styles.stack}>
                {match.phase === 'guessing' ? <>
                  {canGuess && !hasGuessed && <p>Choose the question that best fits this ranking.</p>}
                  {hasGuessed && <p className={styles.notice} role="status">Guess locked in. No spoilers until the reveal!</p>}
                  {!canGuess && <p>{isRanker ? 'Your friends are guessing your question.' : 'The group is guessing the question.'}</p>}
                  <ol className={styles.options} aria-label="Question options">{match.options.map((option,index) =>
                    <li key={option.id}>
                      {canGuess && !hasGuessed ? <button className={styles.option} aria-pressed={selected === option.id} disabled={!connected} onClick={() => setPick({round:roundKey,id:option.id})}><b>{'ABCD'[index]}</b>{option.text}</button> :
                        <span className={styles.option}><b>{'ABCD'[index]}</b>{option.text}</span>}
                    </li>)}</ol>
                  {canGuess && !hasGuessed && <button className={styles.primary} disabled={!connected || !selected} onClick={() => { if (selected) session.dispatch({type:'guess',optionId:selected}); }}>Lock in guess</button>}
                  <p className={styles.muted} role="status">{match.guessedIds.length} of {match.eligibleGuesserIds.length} guesses received</p>
                </> : <>
                  {match.correct && <h2 className={styles.answer}>{match.correct.text}</h2>}
                  {match.results.some(result => result.points) ?
                    <p>Got it right: {match.results.filter(result => result.points).map(result => identify(result.playerId)).join(', ')}.</p> : <p>No one guessed it this round.</p>}
                </>}
              </div>
            </div>
            {host && (match.phase === 'guessing' ?
              <button className={styles.primary} disabled={!connected} onClick={() => {
                if (pendingCount && !window.confirm('Some players are still guessing. Reveal the answer now?')) return;
                session.dispatch({type:'reveal'});
              }}>Reveal answer</button> :
              <button className={styles.primary} disabled={!connected} onClick={() => session.dispatch({type:'next'})}>{match.round === match.totalRounds ? 'Show final scores' : 'Next round'}</button>)}
          </>}
          {match.phase === 'finished' && <>
            <h1>Final scores</h1>
            <ol className={styles.ranking}>{Object.entries(match.scores).sort((a,b) => b[1]-a[1]).map(([id,score],index) =>
              <li key={id}><span className={styles.number}>{index + 1}</span><strong>{identify(id)}</strong><span className={styles.score}>{score} {score === 1 ? 'point' : 'points'}</span></li>)}</ol>
            {host && <button className={styles.primary} disabled={!connected || online < 3} onClick={() => session.dispatch({type:'rematch'})}>Play again</button>}
          </>}
        </section>}
      </>}
    </div>
  </main>;
}
