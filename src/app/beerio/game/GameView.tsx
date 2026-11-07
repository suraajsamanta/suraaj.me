'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { RaceRenderer } from './renderer';
import { useRaceAudio } from './useRaceAudio';
import { actionSequence, POWER_UPS, type PowerUp } from './powerups';
import { mergeControllerAction } from './actionMerge';
import { createRace, currentLap, lapProgress, raceResults, rankKarts, stepRace, type GamePlayer, type RaceResult, type RaceState } from './simulation';
import { sampleShortcut, sampleTrack, selectTrack, shortcutPose, TRACKS, trackPose, type TrackId } from './track';
import styles from './game.module.css';

export type { DriverInput, GamePlayer, RaceResult } from './simulation';
export type PlayerInventory = { id: string; item: PowerUp | null };
export type GameViewProps = {
  players: GamePlayer[];
  laps?: number;
  /** Circuit is selected in the lobby; changing it starts a fresh race. */
  trackId?: TrackId;
  /** Changing this value starts a fresh race. Input updates never reset it. */
  raceKey?: string | number;
  /** Arrow keys or WASD drive the first kart, in addition to phone controls. */
  localKeyboard?: boolean;
  /** Follow bends automatically. Can be changed during a race without resetting it. */
  autoSteer?: boolean;
  /** Pauses authoritative simulation while the host connection is unavailable. */
  paused?: boolean;
  onFinish?: (results: RaceResult[]) => void;
  /** Host-only item snapshot: changes at most 2 Hz, with a 2s reconnect heartbeat.
   * Never emitted while paused, on the finishing frame, or after race completion.
   */
  onInventoryChange?: (inventory: PlayerInventory[]) => void;
  /** Actions shown on the completed-race leaderboard. */
  onRematch?: () => void;
  onLobby?: () => void;
  lobbyLabel?: string;
  rematchDisabled?: boolean;
};

type HudKart = { id: string; place: number; lap: number; progress: number; speed: number; boost: boolean; offRoad: boolean; finished: boolean; item: PowerUp | null; shield: boolean; slow: boolean; dance: boolean; splatter: boolean; leaderWarning: boolean; hitLabel: string; flask: boolean; prism: boolean; jet: boolean; drifting: boolean; driftCharge: number; x: number; z: number };
type Hud = { countdown: number; elapsed: number; complete: boolean; karts: HudKart[]; results: RaceResult[] };
const EMPTY_HUD: Hud = { countdown: 3, elapsed: 0, complete: false, karts: [], results: [] };
const KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight']);

function snapshot(race: RaceState): Hud {
  const ranked = rankKarts(race);
  return {
    countdown: race.countdown, elapsed: race.elapsed, complete: race.complete,
    results: raceResults(race),
    karts: race.karts.map((kart) => {
      const { position } = (kart.onShortcut ? shortcutPose : trackPose)(kart.distance, kart.lane);
      return { id: kart.id, place: ranked.findIndex((other) => other.id === kart.id) + 1,
        lap: currentLap(kart, race.laps), progress: lapProgress(kart), speed: Math.round(kart.speed * 3.6),
        boost: kart.boost > 0, offRoad: Math.abs(kart.lane) > 6.5, finished: kart.finishTime !== null, item: kart.power.item, shield: kart.power.shield > 0, slow: kart.power.slow > 0, dance: kart.power.dance > 0, splatter: kart.power.splatter > 0, leaderWarning: kart.power.leaderWarning > 0, hitLabel: kart.power.flash > 0 ? kart.power.hitLabel : '', flask: kart.power.flask > 0, prism: kart.power.prism > 0, jet: kart.power.jet > 0, drifting: kart.drifting, driftCharge: kart.driftCharge, x: position[0], z: position[2] };
    }),
  };
}
function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}.${Math.floor((seconds % 1) * 10)}`;
}
function suffix(place: number) { return place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'; }

/** One authoritative simulation and one WebGL context, split into up to ten chase cameras. */
export function GameView({ players, laps = 3, trackId = 'sunset', raceKey = 0, localKeyboard = true, autoSteer = true, paused = false, onFinish, onInventoryChange, onRematch, onLobby, lobbyLabel = 'Back to lobby', rematchDisabled = false }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playersRef = useRef(players);
  const finishRef = useRef(onFinish);
  const inventoryRef = useRef(onInventoryChange);
  const keyboardRef = useRef(localKeyboard);
  const autoSteerRef = useRef(autoSteer);
  const pausedRef = useRef(paused);
  const pauseVersionRef = useRef(0);
  const pauseBaselineRef = useRef(new Map<string, number>());
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [error, setError] = useState('');
  const [restart, setRestart] = useState(0);
  const selectedTrack = TRACKS.find((track) => track.id === trackId) ?? TRACKS[0];
  const circuitMap = useMemo(() => {
    const points = sampleTrack(selectedTrack), branch = sampleShortcut(selectedTrack);
    const xs = [...points, ...branch].map((point) => point.x), zs = [...points, ...branch].map((point) => point.z);
    const minX = Math.min(...xs) - 24, minZ = Math.min(...zs) - 24;
    return {
      path: points.filter((_, i) => i % 4 === 0).map((point, i) => `${i ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.z.toFixed(1)}`).join(' ') + ' Z',
      branch: branch.filter((_, i) => i % 4 === 0).map((point, i) => `${i ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.z.toFixed(1)}`).join(' '),
      viewBox: `${minX} ${minZ} ${Math.max(...xs) - minX + 24} ${Math.max(...zs) - minZ + 24}`,
    };
  }, [selectedTrack]);
  const roster = players.slice(0, 10);
  const { audioRef, updateAudio, soundControls } = useRaceAudio({ paused: paused || Boolean(error) || roster.length === 0 });
  const rosterKey = JSON.stringify(roster.map((player) => player.id));
  const totalLaps = Number.isFinite(laps) ? Math.max(1, Math.min(9, Math.round(laps))) : 3;
  const columns = roster.length <= 1 ? 1 : roster.length <= 4 ? 2 : roster.length <= 6 ? 3 : 4;
  const rows = Math.max(1, Math.ceil(roster.length / columns));
  const spareMapCell = roster.length > 1 && roster.length % columns !== 0;

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);
  useEffect(() => { inventoryRef.current = onInventoryChange; }, [onInventoryChange]);
  useEffect(() => { keyboardRef.current = localKeyboard; }, [localKeyboard]);
  useEffect(() => { autoSteerRef.current = autoSteer; }, [autoSteer]);
  useEffect(() => {
    if (pausedRef.current !== paused) {
      pausedRef.current = paused;
      // Capture at the transition, not at the next animation frame: a fresh
      // post-resume item press must remain eligible even if RAF was delayed.
      pauseBaselineRef.current = new Map(playersRef.current.map(player => [player.id, actionSequence(player.input.action)]));
      pauseVersionRef.current++;
    }
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const entrants = playersRef.current.slice(0, 10);
    if (entrants.length === 0) return;
    selectTrack(trackId);
    const race = createRace(entrants, totalLaps);
    const keys = new Set<string>();
    const blockedKeys = new Set<string>();
    // One monotonic sequence combines keyboard presses with phone actions for player one.
    let keyboardDrift: boolean | undefined;
    let lastControllerAction = actionSequence(entrants[0]?.input.action);
    let localAction = lastControllerAction;
    let renderer: RaceRenderer | null = null;
    let frame = 0, last = 0, accumulator = 0, lastHud = 0;
    let observedPauseVersion = pauseVersionRef.current;
    let stopped = false, didFinish = false, failed = false;
    let lastInventoryAt = -Infinity;
    let lastInventorySignature: string | null = null;
    const publishInventory = (now: number) => {
      const callback = inventoryRef.current;
      if (!callback || race.complete || now - lastInventoryAt < 500) return;
      // Only small detached snapshots leave the authoritative simulation.
      const inventory = race.karts.map(kart => ({ id: kart.id, item: kart.power.item }));
      const signature = JSON.stringify(inventory);
      if (signature === lastInventorySignature && now - lastInventoryAt < 2000) return;
      lastInventoryAt = now;
      lastInventorySignature = signature;
      callback(inventory);
    };
    // Sound can be unlocked after this effect starts; always pause the live mix.
    const pauseAudio = () => { audioRef.current?.setPaused(true); };
    const clearKeys = () => { keys.clear(); keyboardDrift = undefined; if (race.karts[0]) { race.karts[0].drifting = false; race.karts[0].driftCharge = 0; } };
    const visibility = () => { clearKeys(); last = 0; accumulator = 0; };
    const discardPausedInput = (baseline?: ReadonlyMap<string, number>) => {
      for (const key of keys) blockedKeys.add(key);
      keys.clear(); keyboardDrift = undefined;
      const currentPlayers = playersRef.current;
      race.karts.forEach((kart, index) => {
        const action = baseline?.get(kart.id) ?? actionSequence(currentPlayers.find(player => player.id === kart.id)?.input.action);
        if (index === 0) lastControllerAction = Math.max(lastControllerAction, action);
        else kart.power.lastAction = Math.max(kart.power.lastAction, action);
      });
      if (race.karts[0]) localAction = race.karts[0].power.lastAction;
    };
    const syncPauseTransition = () => {
      if (observedPauseVersion === pauseVersionRef.current) return;
      observedPauseVersion = pauseVersionRef.current;
      last = 0; accumulator = 0; discardPausedInput(pauseBaselineRef.current);
      // A paused drift cannot turn into a free release boost on reconnect.
      if (!pausedRef.current) for (const kart of race.karts) { kart.drifting = false; kart.driftCharge = 0; }
    };
    const keyDown = (event: KeyboardEvent) => {
      syncPauseTransition();
      const target = event.target;
      if (pausedRef.current) { if (KEYS.has(event.code) || event.code === 'KeyE') blockedKeys.add(event.code); return; }
      if (blockedKeys.has(event.code)) {
        if (event.repeat) return;
        // A fresh physical press is safe even if keyup was missed in a hidden tab.
        blockedKeys.delete(event.code);
      }
      if (!keyboardRef.current || (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)))) return;
      // Keyboard item and brake controls must not interfere with focused controls.
      if ((event.code === 'Space' || event.code === 'KeyE') && target instanceof HTMLElement && target.closest('button, a[href], [role="button"], [role="switch"]')) return;
      if (event.code === 'KeyE') {
        event.preventDefault();
        if (!event.repeat) localAction = Math.min(Number.MAX_SAFE_INTEGER, localAction + 1);
        return;
      }
      if (KEYS.has(event.code)) { event.preventDefault(); keys.add(event.code); if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') keyboardDrift = true; }
    };
    const keyUp = (event: KeyboardEvent) => { syncPauseTransition(); keys.delete(event.code); blockedKeys.delete(event.code); if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') keyboardDrift = keys.has('ShiftLeft') || keys.has('ShiftRight'); };
    const contextLost = (event: Event) => {
      event.preventDefault(); failed = true;
      pauseAudio();
      setError('The graphics connection was interrupted. Restart the race to reconnect.');
    };
    const contextRestored = () => { setRestart((value) => value + 1); };
    const animate = (now: number) => {
      if (stopped || failed) return;
      syncPauseTransition();
      if (!renderer) {
        try {
          renderer = new RaceRenderer(canvas, entrants, race);
          audioRef.current?.setPaused(document.hidden || pausedRef.current);
          setError('');
        } catch (cause) {
          failed = true; pauseAudio();
          setError(cause instanceof Error ? cause.message : 'The 3D renderer could not start.');
          return;
        }
      }
      if (pausedRef.current) {
        // Discard wall time so resuming cannot fast-forward physics or a timer.
        last = 0; accumulator = 0;
        // Discard item presses arriving while paused; never fire a stale press
        // on reconnect. Movement, timers, position and inventory stay frozen.
        discardPausedInput();
        if (lastHud === 0) {
          try { renderer.render(race, 0); setHud(snapshot(race)); lastHud = now; }
          catch (cause) {
            failed = true; pauseAudio();
            setError(cause instanceof Error ? cause.message : 'The 3D renderer was interrupted.');
            return;
          }
        }
        frame = requestAnimationFrame(animate);
        return;
      }
      const elapsed = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (!document.hidden) {
        const currentPlayers = playersRef.current.slice(0, 10).map((player, index) => {
          if (index !== 0) return player;
          ({ lastControllerAction, localAction } = mergeControllerAction(lastControllerAction, localAction, player.input.action));
          if (!keyboardRef.current) return { ...player, input: { ...player.input, action: localAction } };
          const left = keys.has('ArrowLeft') || keys.has('KeyA'), right = keys.has('ArrowRight') || keys.has('KeyD');
          return { ...player, input: {
            action: localAction,
            drift: keyboardDrift === true || player.input.drift === true ? true : keyboardDrift === false ? false : player.input.drift,
            steer: left || right ? Number(right) - Number(left) : player.input.steer,
            accelerate: keys.has('ArrowUp') || keys.has('KeyW') || player.input.accelerate,
            brake: keys.has('ArrowDown') || keys.has('KeyS') || keys.has('Space') || player.input.brake,
          } };
        });
        accumulator += elapsed;
        while (accumulator >= 1 / 60) { stepRace(race, currentPlayers, 1 / 60, autoSteerRef.current); accumulator -= 1 / 60; }
        try { renderer.render(race, Math.max(elapsed, 1 / 60)); }
        catch (cause) {
          failed = true; pauseAudio();
          setError(cause instanceof Error ? cause.message : 'The 3D renderer was interrupted. Restart the race to reconnect.');
          return;
        }
        updateAudio(race);
        if (now - lastHud > 80 || lastHud === 0 || (race.complete && !didFinish)) {
          setHud(snapshot(race)); lastHud = now;
        }
        // Finish/result publication takes precedence over inventory so the two
        // callbacks cannot contend for the host's room-state send in one frame.
        if (race.complete) {
          if (!didFinish) {
            didFinish = true;
            finishRef.current?.(raceResults(race));
          }
        } else {
          publishInventory(now);
        }
      }
      frame = requestAnimationFrame(animate);
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', visibility);
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', contextRestored);
    frame = requestAnimationFrame(animate);
    return () => {
      stopped = true; cancelAnimationFrame(frame); pauseAudio(); renderer?.dispose();
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
    };
  }, [rosterKey, totalLaps, trackId, raceKey, restart, audioRef, updateAudio]);

  const gridStyle = { '--game-columns': columns, '--game-rows': rows, '--map-x': `${50 / columns}%`, '--map-y': `${100 / rows}%` } as CSSProperties;
  return (
    <div className={`${styles.game} ${roster.length > 6 ? styles.compact : ''}`} style={gridStyle} aria-label={`${selectedTrack.name}, ${roster.length} racers, ${totalLaps} laps`}>
      <canvas className={styles.canvas} ref={canvasRef} aria-label="3D split-screen race with a behind-the-kart camera for each player" />
      <div className={styles.hudGrid}>
        {roster.map((player, index) => {
          const kart = hud.karts.find((entry) => entry.id === player.id);
          const place = kart?.place || index + 1;
          return (
            <section className={styles.viewport} key={player.id} style={{ '--driver-color': player.color } as CSSProperties} aria-label={`${player.name}'s racing view`}>
              {kart?.splatter && <div className={styles.splatter} role="img" aria-label="Berry blot on this view"><i /><i /><i /><i /></div>}
              <div className={styles.topHud}>
                <div className={styles.name}><span className={styles.playerNumber}>P{index + 1}</span><strong title={player.name} aria-label={player.name}>{player.name}</strong></div>
                <div className={styles.lap}>LAP <strong>{kart?.lap || 1}<span>/{totalLaps}</span></strong></div>
              </div>
              {hud.countdown > 0 && !error && <div className={styles.countdown}><strong>{Math.ceil(hud.countdown)}</strong><span>GET READY</span></div>}
              {hud.countdown === 0 && hud.elapsed < 0.85 && !error && <div className={`${styles.countdown} ${styles.go}`}><strong>GO!</strong></div>}
              {kart?.leaderWarning && <div className={styles.warning} role="status">CROWN COMET INCOMING!</div>}
              {kart?.hitLabel && <div className={styles.hitNotice}>{kart.hitLabel}</div>}
              {kart?.finished && !hud.complete && <div className={styles.finished}>FINISHED <span>{place}{suffix(place)} place</span></div>}
              <div className={styles.itemHud} aria-label={kart?.item ? `Item: ${POWER_UPS[kart.item].name}` : 'No item held'}>
                {kart?.item ? <><span className={styles.itemIcon} style={{ color: POWER_UPS[kart.item].color }}>{POWER_UPS[kart.item].icon}</span><span><strong>{POWER_UPS[kart.item].name}</strong><small>{kart.item === 'flask' && kart.flask ? (index === 0 && localKeyboard ? 'Tap E again for bursts' : 'Tap ITEM again for bursts') : (index === 0 && localKeyboard ? 'Press E to use' : 'Press ITEM to use')}</small></span></> : <span className={styles.itemEmpty}>ITEM</span>}
              </div>
              <div className={styles.bottomHud}>
                <div className={styles.position}>{place}<span>{suffix(place)}</span></div>
                <div className={styles.driverStatus}>
                  {kart?.dance ? <span className={styles.boost}>DANCE BREAK!</span> : kart?.prism ? <span className={styles.boost}>PRISM PARTY</span> : kart?.jet ? <span className={styles.boost}>JET KEG</span> : kart?.flask ? <span className={styles.boost}>FIZZ FLASK</span> : kart?.shield ? <span className={styles.boost}>FOAM GUARD</span> : kart?.slow ? <span className={styles.offRoad}>SLOWED</span> : kart?.boost ? <span className={styles.boost}>BOOST!</span> : kart?.offRoad ? <span className={styles.offRoad}>OFF ROAD</span> : null}
                  {kart?.drifting && <div className={styles.drift} aria-label={`Drift charge ${kart.driftCharge >= 2 ? 3 : kart.driftCharge >= 1.2 ? 2 : kart.driftCharge >= 0.6 ? 1 : 0} of 3`}><span>DRIFT</span><div className={styles.driftTrack}><i style={{ width: `${Math.min(100, kart.driftCharge / 2 * 100)}%` }} /></div></div>}
                  <div className={styles.speed}><strong>{kart?.speed || 0}</strong><span>km/h</span></div>
                </div>
              </div>
              <div className={styles.progress}><span style={{ width: `${(kart?.progress || 0) * 100}%` }} /></div>
            </section>
          );
        })}
        {roster.length > 0 && (
          <div className={spareMapCell ? styles.raceControl : `${styles.raceControl} ${styles.mapInset}`}>
            {spareMapCell && <span className={styles.eyebrow}>{selectedTrack.name.toUpperCase()}</span>}
            <svg className={styles.map} viewBox={circuitMap.viewBox} role="img" aria-label="Live circuit map">
              <path d={circuitMap.path} fill="none" stroke="#303744" strokeWidth="16" strokeLinejoin="round" />
              <path d={circuitMap.path} fill="none" stroke="#7c8797" strokeWidth="1.5" />
              <path d={circuitMap.branch} fill="none" stroke="#efae55" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" aria-label="Shortcut" />
              {hud.karts.map((kart) => <circle key={kart.id} cx={kart.x} cy={kart.z} r="6" fill={roster.find((player) => player.id === kart.id)?.color || '#ffbe68'} stroke="#fff" strokeWidth="1.8" />)}
            </svg>
            {spareMapCell && <div className={styles.controlClock}>{clock(hud.elapsed)}</div>}
          </div>
        )}
      </div>
      {roster.length === 0 && <div className={styles.overlay}><p>Add a racer to start the engine.</p></div>}
      {error && <div className={styles.overlay} role="alert"><div className={styles.errorCard}><strong>Race display paused</strong><p>{error}</p><button type="button" onClick={() => setRestart((value) => value + 1)}>Try again</button></div></div>}
      {hud.complete && !error && <div className={styles.overlay}><div className={styles.podium}>
        <span className={styles.eyebrow}>CHECKERED FLAG</span><h2>Race complete</h2>
        <ol aria-label="Race leaderboard">{hud.results.map((result) => <li key={result.id}>
          <span className={styles.resultPlace} aria-label={`${result.place}${suffix(result.place)} place`}>{result.place}</span>
          <span className={styles.resultName} title={result.name} style={{ color: result.color }}>{result.name}</span>
          <span className={styles.resultItems}>{result.itemsUsed} {result.itemsUsed === 1 ? 'item' : 'items'} used</span>
          <strong>{result.time === null ? 'DNF' : clock(result.time)}</strong>
        </li>)}</ol>
        {(onRematch || onLobby) && <div className={styles.resultActions}>
          {onRematch && <button type="button" onClick={onRematch} disabled={rematchDisabled}>Rematch ↻</button>}
          {onLobby && <button type="button" onClick={onLobby}>{lobbyLabel}</button>}
        </div>}
        {rematchDisabled && onRematch && <p>Reconnect the host and at least one racer to start a rematch.</p>}
      </div></div>}
      {soundControls}
      <span className={styles.srOnly} aria-live="polite">{hud.complete ? `Race complete. ${hud.results[0]?.name || 'The leader'} placed first.` : hud.countdown > 0 ? 'Race starting. Hold accelerate when the countdown ends.' : 'Race in progress.'}</span>
    </div>
  );
}

export default GameView;
