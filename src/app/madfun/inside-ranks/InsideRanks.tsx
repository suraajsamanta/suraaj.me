'use client';

import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useEffectEvent, useState } from 'react';
import { MANUAL_RANKING_SECONDS, MAX_CUSTOM_QUESTION_LENGTH, normalizeCustomQuestion, phaseTimer, type Player, type Prompt } from './engine';
import { MAX_PLAYER_QUESTIONS, useInsideRanksSession } from './useInsideRanksSession';
import { LiveRanking, RankForm, RankName } from './LiveRanking';
import { useKeepScreenAwake } from './useKeepScreenAwake';
import styles from './inside-ranks.module.css';
import QuickStart from '../shared/QuickStart';
import HostRemote, { type RemoteAction } from '../shared/HostRemote';

const path = '/madfun/inside-ranks';
const quickSteps = [
  { title: 'Create a room on the shared screen', body: 'Choose Create room on the screen everyone can see. This screen starts rounds and shows results, but it never joins as a player or sees the secret question.' },
  { title: 'Scan the player QR on your phone', body: 'At least three players scan the same QR, or enter the room code under Join a room. If the person setting up wants to play too, they scan on a separate phone.' },
  { title: 'Add your own questions', body: 'In a Classic lobby, you can write a question on your phone. Player questions come first with no hint. Dark Mode uses only the Paranoid bank.' },
  { title: 'Drag to rank', body: 'Read your secret question, then drag the grips to put the best match at #1. Rank everyone, including yourself and anyone who stepped away. Normally the group sees your moves live. Turn on Simultaneous Ranking to give each player their own question and 60 seconds to rank privately, then review the rankings one at a time. When the timer ends, whatever order is on your phone locks in automatically.' },
  { title: 'Run the room from a second phone', body: 'Optional: pair a phone with the private Host controller QR. On the display or controller, you can turn on Auto-run to time each stage.' },
  { title: 'Try Dark Mode', body: 'Optional: in the lobby, the host can switch to a separate deck of group beef, dark satire, and bad decisions. The regular deck is the default.' },
  { title: 'Guess and score', body: 'See the ranking, then try to guess the question. Only built-in questions have a hint. Guess out loud, or choose Show options for four phone choices. Correct phone guesses get 1 point. The most points wins.' },
] as const;
const cleanCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const restartWarning = 'Restart the game? Current scores and rankings will reset. Everyone stays in the room.';
const noPreview = () => {};

function QuestionBox({ questions, disabled, add, remove }: {
  questions: readonly Prompt[]; disabled: boolean; add: (text: string) => void; remove: (id: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const normalized = normalizeCustomQuestion(draft);
  const alreadyAdded = !!normalized && questions.some(question => question.text.toLowerCase() === normalized.toLowerCase());
  const full = questions.length >= MAX_PLAYER_QUESTIONS;
  return <div className={styles.questionBox}>
    <div className={styles.questionHeading}>
      <h2>Write a question</h2>
      <span className={styles.roleBadge} role="status">{questions.length > 0 ? 'Question added' : 'Optional'}</span>
    </div>
    <p>Player questions go first, and nobody gets a hint.</p>
    {!full && <form className={styles.stack} onSubmit={event => {
      event.preventDefault();
      if (disabled || !normalized || alreadyAdded) return;
      add(normalized);
      setSent(normalized);
    }}>
      <label>Your question<textarea rows={2} disabled={disabled} value={draft} maxLength={MAX_CUSTOM_QUESTION_LENGTH}
        onChange={event => { setDraft(event.target.value); setSent(null); }} placeholder="Who would start drama just to make the group chat interesting?" /></label>
      {!!draft.trim() && !normalized && <small>Enter 8–{MAX_CUSTOM_QUESTION_LENGTH} characters using normal text.</small>}
      {alreadyAdded && <small role="status">You already added that question.</small>}
      {sent && !alreadyAdded && <small role="status">Waiting for the room to confirm. If it doesn’t go through, try different wording.</small>}
      <button className={styles.primary} disabled={disabled || !normalized || alreadyAdded}>Add question</button>
    </form>}
    {questions.length > 0 && <ul className={styles.questionList} aria-label="Your submitted questions">
      {questions.map((question, index) => <li key={question.id}>
        <span>{question.text}</span>
        <button type="button" disabled={disabled} aria-label={`Remove submitted question ${index + 1}`} onClick={() => {
          remove(question.id); setSent(null);
          if (question.text === normalized) setDraft('');
        }}>Remove</button>
      </li>)}
    </ul>}
  </div>;
}

function RoundTimer({ deadline, duration }: { deadline: number; duration: number }) {
  const [seconds, setSeconds] = useState(duration);
  useEffect(() => {
    const update = () => setSeconds(Math.min(duration, Math.max(0, Math.ceil((deadline - Date.now()) / 1000))));
    const first = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 250);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, [deadline, duration]);
  return <span className={styles.roleBadge} role="timer" aria-label="Time remaining">{seconds}s left</span>;
}

function Ranking({ players, rankerId }: { players: readonly Player[]; rankerId: string }) {
  return <ol className={styles.ranking} aria-label="Group ranking">{players.map((player, index) =>
    <li key={player.id}><span className={styles.number}>{index + 1}</span><RankName player={player} role={player.id === rankerId ? 'Ranker' : undefined}/></li>)}</ol>;
}

export default function InsideRanks() {
  const session = useInsideRanksSession();
  const { state, host, watching, roomCode, participantId, prompt, draftOrder, questions } = session;
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
  const darkDeck = state?.deck === 'dark';
  const canChangeDeck = !match || match.phase === 'finished';
  const simultaneous = state?.simultaneous === true;
  const batch = match?.batch;
  const timer = match?.phase === 'ranking' && !state?.autoRun
    ? { seconds: MANUAL_RANKING_SECONDS, action: 'expire_ranking' as const }
    : (match?.phase === 'batch_ranking' || state?.autoRun) ? phaseTimer(match?.phase) : null;
  useKeepScreenAwake(active && !!roomCode && match?.phase !== 'finished');
  const deadline = timer ? state?.deadline : null;
  const advanceAutomatically = useEffectEvent((type: NonNullable<ReturnType<typeof phaseTimer>>['action'], expected: number) => {
    if (host && connected && state?.deadline === expected && timer?.action === type) {
      session.dispatch({ type });
    }
  });
  const timerAction = timer?.action;
  useEffect(() => {
    if (!host || !connected || typeof deadline !== 'number' || !timerAction) return;
    const handle = window.setTimeout(() => advanceAutomatically(timerAction, deadline), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(handle);
  }, [host, connected, deadline, timerAction]);
  const roundKey = `${state?.matchId}:${match?.round}`;
  const selected = pick?.round === roundKey ? pick.id : null;
  const display = host || watching;
  const assignedInBatch = !display && !!participantId && !!batch?.rankerIds.includes(participantId);
  const lockedInBatch = !!participantId && !!batch?.submittedIds.includes(participantId);
  const isRanker = !display && !!match && match.ranker.id === participantId;
  const canGuess = !display && !!participantId && !!match?.eligibleGuesserIds.includes(participantId);
  const hasGuessed = !!participantId && !!match?.guessedIds.includes(participantId);
  const players = state?.players ?? [];
  const online = players.filter(player => player.connected).length;
  const onlineIds = new Set(players.filter(player => player.connected).map(player => player.id));
  const withPresence = (person: Player) => ({ ...person, connected: onlineIds.has(person.id) });
  const targets = match?.rankTargets.map(withPresence) ?? [];
  const ranked = match?.ranking.map(withPresence) ?? [];
  const pendingCount = match?.eligibleGuesserIds.filter(id => players.some(player => player.id === id && player.connected) && !match.guessedIds.includes(id)).length ?? 0;
  const joinLink = `${path}?room=${roomCode ?? ''}`;
  const tvLink = `${joinLink}&watch=1`;

  const restoreOnOpen = useEffectEvent((room: string) => session.restorePlayer(room || undefined));
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const timer = window.setTimeout(() => {
      const room = cleanCode(query.get('room') ?? '');
      const watch = query.get('watch') === '1';
      setCode(room);
      setWatchMode(watch);
      setInvited(!!room);
      if (!watch) restoreOnOpen(room);
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

  const revealAnswer = () => {
    if (match?.phase === 'guessing' && pendingCount && !window.confirm('Some players are still guessing. Reveal the answer now?')) return;
    session.dispatch({ type: 'reveal' });
  };

  const autoRunControl = <label className={styles.autoRun}>
    <input type="checkbox" checked={state?.autoRun === true} disabled={!connected}
      onChange={event => session.dispatch({ type: 'set_auto', enabled: event.target.checked })}/>
    <span><strong>Auto-run</strong><small>Each stage is timed. Your current order locks in automatically when time runs out.</small></span>
  </label>;

  const darkDeckControl = <label className={`${styles.autoRun} ${styles.deckToggle}`}>
    <input type="checkbox" checked={darkDeck} disabled={!connected}
      onChange={event => session.dispatch({ type: 'set_deck', deck: event.target.checked ? 'dark' : 'classic' })}/>
    <span><strong>Dark Mode</strong><small>Play only questions from the Paranoid bank. Player questions are for Classic.</small></span>
  </label>;

  const simultaneousControl = <label className={`${styles.autoRun} ${styles.batchToggle}`}>
    <input type="checkbox" checked={simultaneous} disabled={!connected}
      onChange={event => session.dispatch({ type: 'set_simultaneous', enabled: event.target.checked })}/>
    <span><strong>Simultaneous Ranking</strong><small>Everyone gets one secret question and 60 seconds to rank privately. At zero, everyone’s current order locks in for review.</small></span>
  </label>;

  const identify = (id: string) => players.find(player => player.id === id)?.name ?? 'Player';
  const rankerOnline = !!match && players.some(player => player.id === match.ranker.id && player.connected);
  const nextLabel = match?.round === match?.totalRounds ? 'Show final scores' : match?.simultaneous ? 'Next ranking' : 'Next round';
  const endRoom = () => {
    session.leave(); setInvite(false); setCopy(''); setQr(''); setPick(null);
  };
  const phases = { ranking: 'Waiting for the ranker', batch_ranking: 'Private rankings', hint: match?.customPrompt ? 'Guess without a hint' : 'Guess from the hint', guessing: 'Option guesses', reveal: 'Answer reveal', finished: 'Final scores' } as const;
  const remoteActions: RemoteAction[] = [
    !match ? { id: 'start', label: 'Start game', disabled: !connected || online < 3, run: () => session.dispatch({type:'start'}) } :
    match.phase === 'ranking' ? { id: 'skip', label: 'Skip offline ranker', disabled: !connected || rankerOnline, run: () => session.dispatch({type:'skip'}) } :
    match.phase === 'batch_ranking' ? { id: 'batch', label: 'Waiting for private rankings', disabled: true, run: noPreview } :
    match.phase === 'hint' ? { id: 'options', label: 'Show options', disabled: !connected, run: () => session.dispatch({type:'show_options'}) } :
    match.phase === 'guessing' ? { id: 'reveal', label: 'Reveal answer', disabled: !connected, confirm: pendingCount ? 'Some players are still guessing. Reveal now?' : undefined, run: () => session.dispatch({type:'reveal'}) } :
    match.phase === 'reveal' ? { id: 'next', label: nextLabel, disabled: !connected, run: () => session.dispatch({type:'next'}) } :
    { id: 'rematch', label: 'Play again', disabled: !connected || online < 3, run: () => session.dispatch({type:'rematch'}) },
    ...(match?.phase === 'hint' ? [{ id: 'verbal-reveal', label: 'Solved aloud · Reveal answer', disabled: !connected, run: () => session.dispatch({type:'reveal'}) }] : []),
    ...(match ? [{ id: 'invite', label: invite ? 'Hide player QR' : 'Show player QR', run: () => setInvite(current => !current) }] : []),
    ...(canChangeDeck ? [{ id: 'deck', label: darkDeck ? 'Use regular deck' : 'Use Dark Mode deck', disabled: !connected, run: () => session.dispatch({type:'set_deck',deck:darkDeck?'classic':'dark'}) }] : []),
    ...(canChangeDeck ? [{ id: 'simultaneous', label: simultaneous ? 'Use turn-by-turn ranking' : 'Use simultaneous ranking', disabled: !connected, run: () => session.dispatch({type:'set_simultaneous',enabled:!simultaneous}) }] : []),
    { id: 'auto', label: state?.autoRun ? 'Turn off auto-run' : 'Turn on auto-run', disabled: !connected, run: () => session.dispatch({type:'set_auto',enabled:!state?.autoRun}) },
    ...(match && match.phase !== 'finished' ? [{ id: 'restart', label: 'Restart game', disabled: !connected, confirm: restartWarning, run: () => session.dispatch({type:'restart'}) }] : []),
    { id: 'end', label: 'End room', disabled: !connected, confirm: 'End this room for everyone?', run: endRoom },
  ];

  return <main className={styles.shell} data-deck={darkDeck ? 'dark' : 'classic'}>
    <header className={styles.header}>
      <Link href="/madfun" className={styles.brand}>madfun<span>✳</span></Link>
      {active && <div className={styles.actions}>
        {roomCode && <span className={styles.code}>{roomCode}</span>}{darkDeck && <span className={`${styles.roleBadge} ${styles.darkBadge}`}>Dark Mode</span>}{display && <span className={styles.roleBadge}>{host ? "Host display" : "Watch only"}</span>}
        {roomCode && (!host || match) && !watching && <button aria-expanded={invite} onClick={() => setInvite(!invite)}>Invite</button>}
        {host && roomCode && <HostRemote key={roomCode} game="Inside Ranks"
          phase={match?.phase === 'batch_ranking' ? `${batch?.submittedIds.length ?? 0}/${batch?.rankerIds.length ?? 0} rankings locked` :
            match ? `${match.simultaneous ? 'Ranking' : 'Round'} ${match.round}/${match.totalRounds} · ${phases[match.phase]}` : 'Lobby'}
          actions={remoteActions}/>}
        {host && match && match.phase !== 'finished' && <button type="button" disabled={!connected} onClick={() => {
          if (window.confirm(restartWarning)) session.dispatch({ type: 'restart' });
        }}>Restart game</button>}
        <button onClick={() => {
          if (host && match && match.phase !== 'finished' && !window.confirm('End the room for everyone?')) return;
          endRoom();
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
        {roomCode && ((!match && display) || (invite && !watching)) && <aside className={`${styles.panel} ${styles.share}`} aria-label="Player invite">
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
          {darkDeck ? <p>Dark Mode uses only the Paranoid bank.</p> :
            <p role="status">{state.questionCount ?? 0} player {(state.questionCount ?? 0) === 1 ? 'question' : 'questions'} added for this game.</p>}
          {!darkDeck && !display && participantId && <QuestionBox key={roomCode} questions={questions} disabled={!connected}
            add={text => session.dispatch({type:'submit_question',text})} remove={id => session.dispatch({type:'remove_question',id})}/>}
          {host ? <>{darkDeckControl}{simultaneousControl}{autoRunControl}<button className={styles.primary} disabled={!connected || online < 3} onClick={() => session.dispatch({type:'start'})}>Start game</button></> : <p role="status">Your host will start the game.</p>}
        </section>}
        {match && <section className={styles.panel} key={match.simultaneous && match.phase !== 'batch_ranking' ? roundKey : `match:${state.matchId}`}>
          <div className={styles.actions}>
            <span className={styles.kicker}>{match.phase === 'batch_ranking' ? 'Simultaneous Ranking' : match.phase === 'finished' ? 'Inside Ranks' :
              `${match.simultaneous ? 'Ranking' : 'Round'} ${match.round} of ${match.totalRounds}`}</span>
            {timer && typeof deadline === 'number' && <RoundTimer key={deadline} deadline={deadline} duration={timer.seconds}/>}
          </div>
          {match.phase === 'batch_ranking' && <>
            <h1>{lockedInBatch ? 'Ranking locked in' : assignedInBatch ? 'Rank your friends' : 'Everyone ranks at once'}</h1>
            {batch && <div className={styles.batchProgress}>
              <progress max={batch.rankerIds.length} value={batch.submittedIds.length} aria-label="Private rankings locked"/>
              <p role="status">{batch.submittedIds.length} of {batch.rankerIds.length} rankings locked in</p>
            </div>}
            {assignedInBatch && !lockedInBatch ? prompt
              ? <RankForm key={roundKey} players={targets} rankerId={participantId!} initial={draftOrder ?? undefined} prompt={prompt.text} disabled={!connected} privateDraft
                onPreview={({ orderedIds }) => session.dispatch({type:'rank_preview', orderedIds, drag:null})} onRank={orderedIds => session.dispatch({type:'rank',orderedIds})}/>
              : <p role="status">Loading your private question…</p>
              : <p>{lockedInBatch ? 'Hang tight. The group will review the rankings one at a time.' :
                'Rankings are private until everyone locks in or the minute is up. At zero, each player’s current order locks in automatically.'}</p>}
          </>}
          {match.phase === 'ranking' && <>
            {isRanker && <span className={styles.roleBadge}>You’re the ranker · Private turn</span>}
            <h1>{isRanker ? 'Rank your friends' : `${match.ranker.name} is ranking the group`}</h1>
            {isRanker && prompt ? <RankForm key={roundKey} players={targets} rankerId={match.ranker.id} initial={match.preview?.orderedIds} settleOnMount={!!match.preview?.drag} prompt={prompt.text} disabled={!connected}
              onPreview={preview => session.dispatch({type:'rank_preview',...preview})}
              onRank={orderedIds => session.dispatch({type:'rank',orderedIds})}/> : isRanker ?
              <p role="status">Loading your private question…</p> : <>
                <p>Watch the order change live. Once the ranker locks it in, try to guess their question.</p>
                <LiveRanking players={targets} rankerId={match.ranker.id} preview={match.preview}/>
              </>}
            {host && !rankerOnline &&
              <button disabled={!connected} onClick={() => session.dispatch({type:'skip'})}>Skip offline ranker</button>}
          </>}
          {match.phase === 'hint' && <>
            <h1>{match.customPrompt ? 'Guess the question' : 'Guess from the hint'}</h1>
            <div className={styles.roundGrid}>
              <div className={styles.stack}><h2>{match.ranker.name}’s ranking</h2><Ranking players={ranked} rankerId={match.ranker.id}/></div>
              <div className={styles.stack}>
                {match.hint ? <div className={styles.hint}><span className={styles.kicker}>Your hint</span><h2>{match.hint}</h2></div> :
                  <span className={styles.roleBadge}>Player question · No hint</span>}
                <p>{isRanker ? 'Keep the secret and listen to the guesses!' : 'What question fits this ranking? Try guessing out loud before showing the options.'}</p>
                {host && <div className={styles.actions}>
                  <button className={styles.primary} disabled={!connected} onClick={() => session.dispatch({type:'show_options'})}>Show options</button>
                  <button disabled={!connected} onClick={revealAnswer}>Solved aloud · Reveal answer</button>
                </div>}
              </div>
            </div>
          </>}
          {(match.phase === 'guessing' || match.phase === 'reveal') && <>
            <h1>{match.phase === 'guessing' ? 'What was the question?' : 'The secret question was…'}</h1>
            <div className={styles.roundGrid}>
              <div className={styles.stack}><h2>{match.ranker.name}’s ranking</h2><Ranking players={ranked} rankerId={match.ranker.id}/></div>
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
                  {!match.options.length ? <p>Revealed after the verbal guesses. No phone points this round.</p> :
                    match.results.some(result => result.points) ?
                    <p>Got it right: {match.results.filter(result => result.points).map(result => identify(result.playerId)).join(', ')}.</p> : <p>No one guessed it this round.</p>}
                </>}
              </div>
            </div>
            {host && (match.phase === 'guessing' ?
              <button className={styles.primary} disabled={!connected} onClick={revealAnswer}>Reveal answer</button> :
              <button className={styles.primary} disabled={!connected} onClick={() => session.dispatch({type:'next'})}>{nextLabel}</button>)}
          </>}
          {match.phase !== 'finished' && targets.some(player => !player.connected) && <p className={styles.muted}>
            Away players can still be ranked. Their names and scores stay in the game.
          </p>}
          {host && match.phase !== 'finished' && autoRunControl}
          {match.phase === 'finished' && <>
            <h1>Final scores</h1>
            <ol className={styles.ranking}>{Object.entries(match.scores).sort((a,b) => b[1]-a[1]).map(([id,score],index) =>
              <li key={id}><span className={styles.number}>{index + 1}</span><strong>{identify(id)}</strong><span className={styles.score}>{score} {score === 1 ? 'point' : 'points'}</span></li>)}</ol>
            {!darkDeck && !display && participantId && <QuestionBox key={roomCode} questions={questions} disabled={!connected}
              add={text => session.dispatch({type:'submit_question',text})} remove={id => session.dispatch({type:'remove_question',id})}/>}
            {host && <>{darkDeckControl}{simultaneousControl}<button className={styles.primary} disabled={!connected || online < 3} onClick={() => session.dispatch({type:'rematch'})}>Play again</button></>}
          </>}
        </section>}
      </>}
    </div>
  </main>;
}
