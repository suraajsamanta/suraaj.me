'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { RaceRenderer } from './renderer';
import { useRaceAudio } from './useRaceAudio';
import { createRace, currentLap, lapProgress, raceResults, rankKarts, stepRace, type GamePlayer, type RaceResult, type RaceState } from './simulation';
import { TRACK_POINTS, trackPose } from './track';
import styles from './game.module.css';

export type { DriverInput, GamePlayer, RaceResult } from './simulation';
export type GameViewProps = {
  players: GamePlayer[];
  laps?: number;
  /** Changing this value starts a fresh race. Input updates never reset it. */
  raceKey?: string | number;
  /** Arrow keys or WASD drive the first kart, in addition to phone controls. */
  localKeyboard?: boolean;
  /** Follow bends automatically. Can be changed during a race without resetting it. */
  autoSteer?: boolean;
  onFinish?: (results: RaceResult[]) => void;
};

type HudKart = { id: string; place: number; lap: number; progress: number; speed: number; boost: boolean; offRoad: boolean; finished: boolean; x: number; z: number };
type Hud = { countdown: number; elapsed: number; complete: boolean; karts: HudKart[]; results: RaceResult[] };
const EMPTY_HUD: Hud = { countdown: 3, elapsed: 0, complete: false, karts: [], results: [] };
const MAP_PATH = TRACK_POINTS.filter((_, i) => i % 4 === 0).map((point, i) => `${i ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.z.toFixed(1)}`).join(' ') + ' Z';
const KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space']);

function snapshot(race: RaceState, players: GamePlayer[]): Hud {
  const ranked = rankKarts(race);
  return {
    countdown: race.countdown, elapsed: race.elapsed, complete: race.complete,
    results: raceResults(race, players),
    karts: race.karts.map((kart) => {
      const { position } = trackPose(kart.distance, kart.lane);
      return { id: kart.id, place: ranked.findIndex((other) => other.id === kart.id) + 1,
        lap: currentLap(kart, race.laps), progress: lapProgress(kart), speed: Math.round(kart.speed * 3.6),
        boost: kart.boost > 0, offRoad: Math.abs(kart.lane) > 6.5, finished: kart.finishTime !== null, x: position[0], z: position[2] };
    }),
  };
}
function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}.${Math.floor((seconds % 1) * 10)}`;
}
function suffix(place: number) { return place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'; }

/** One authoritative simulation and one WebGL context, split into up to six chase cameras. */
export function GameView({ players, laps = 3, raceKey = 0, localKeyboard = true, autoSteer = true, onFinish }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playersRef = useRef(players);
  const finishRef = useRef(onFinish);
  const keyboardRef = useRef(localKeyboard);
  const autoSteerRef = useRef(autoSteer);
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [error, setError] = useState('');
  const [restart, setRestart] = useState(0);
  const roster = players.slice(0, 6);
  const { audioRef, updateAudio, soundControls } = useRaceAudio({ paused: Boolean(error) || roster.length === 0 });
  const rosterKey = JSON.stringify(roster.map((player) => player.id));
  const totalLaps = Number.isFinite(laps) ? Math.max(1, Math.min(9, Math.round(laps))) : 3;
  const columns = roster.length <= 1 ? 1 : roster.length <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(roster.length / columns));

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);
  useEffect(() => { keyboardRef.current = localKeyboard; }, [localKeyboard]);
  useEffect(() => { autoSteerRef.current = autoSteer; }, [autoSteer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const entrants = playersRef.current.slice(0, 6);
    if (entrants.length === 0) return;
    const race = createRace(entrants, totalLaps);
    const keys = new Set<string>();
    let renderer: RaceRenderer | null = null;
    let frame = 0, last = 0, accumulator = 0, lastHud = 0;
    let stopped = false, didFinish = false, failed = false;
    // Sound can be unlocked after this effect starts; always pause the live mix.
    const pauseAudio = () => { audioRef.current?.setPaused(true); };
    const clearKeys = () => { keys.clear(); };
    const visibility = () => { clearKeys(); last = 0; accumulator = 0; };
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!keyboardRef.current || (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)))) return;
      // Space must still activate focused race settings and sound controls.
      if (event.code === 'Space' && target instanceof HTMLElement && target.closest('button, a[href], [role="button"]')) return;
      if (KEYS.has(event.code)) { event.preventDefault(); keys.add(event.code); }
    };
    const keyUp = (event: KeyboardEvent) => { keys.delete(event.code); };
    const contextLost = (event: Event) => {
      event.preventDefault(); failed = true;
      pauseAudio();
      setError('The graphics connection was interrupted. Restart the race to reconnect.');
    };
    const contextRestored = () => { setRestart((value) => value + 1); };
    const animate = (now: number) => {
      if (stopped || failed) return;
      if (!renderer) {
        try {
          renderer = new RaceRenderer(canvas, entrants, race);
          audioRef.current?.setPaused(document.hidden);
          setError('');
        } catch (cause) {
          failed = true; pauseAudio();
          setError(cause instanceof Error ? cause.message : 'The 3D renderer could not start.');
          return;
        }
      }
      const elapsed = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (!document.hidden) {
        const currentPlayers = playersRef.current.slice(0, 6).map((player, index) => {
          if (index !== 0 || !keyboardRef.current || keys.size === 0) return player;
          const left = keys.has('ArrowLeft') || keys.has('KeyA'), right = keys.has('ArrowRight') || keys.has('KeyD');
          return { ...player, input: {
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
          setHud(snapshot(race, currentPlayers)); lastHud = now;
        }
        if (race.complete && !didFinish) {
          didFinish = true;
          finishRef.current?.(raceResults(race, currentPlayers));
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
  }, [rosterKey, totalLaps, raceKey, restart, audioRef, updateAudio]);

  const gridStyle = { '--game-columns': columns, '--game-rows': rows } as CSSProperties;
  return (
    <div className={styles.game} style={gridStyle} aria-label={`Sunset Circuit, ${roster.length} racers, ${totalLaps} laps`}>
      <canvas className={styles.canvas} ref={canvasRef} aria-label="3D split-screen race with a behind-the-kart camera for each player" />
      <div className={styles.hudGrid}>
        {roster.map((player, index) => {
          const kart = hud.karts.find((entry) => entry.id === player.id);
          const place = kart?.place || index + 1;
          return (
            <section className={styles.viewport} key={player.id} style={{ '--driver-color': player.color } as CSSProperties} aria-label={`${player.name}'s racing view`}>
              <div className={styles.topHud}>
                <div className={styles.name}><span className={styles.playerNumber}>P{index + 1}</span><strong>{player.name}</strong></div>
                <div className={styles.lap}>LAP <strong>{kart?.lap || 1}<span>/{totalLaps}</span></strong></div>
              </div>
              {hud.countdown > 0 && !error && <div className={styles.countdown}><strong>{Math.ceil(hud.countdown)}</strong><span>GET READY</span></div>}
              {hud.countdown === 0 && hud.elapsed < 0.85 && !error && <div className={`${styles.countdown} ${styles.go}`}><strong>GO!</strong></div>}
              {kart?.finished && !hud.complete && <div className={styles.finished}>FINISHED <span>{place}{suffix(place)} place</span></div>}
              <div className={styles.bottomHud}>
                <div className={styles.position}>{place}<span>{suffix(place)}</span></div>
                <div className={styles.driverStatus}>
                  {kart?.boost ? <span className={styles.boost}>BOOST!</span> : kart?.offRoad ? <span className={styles.offRoad}>OFF ROAD</span> : null}
                  <div className={styles.speed}><strong>{kart?.speed || 0}</strong><span>km/h</span></div>
                </div>
              </div>
              <div className={styles.progress}><span style={{ width: `${(kart?.progress || 0) * 100}%` }} /></div>
            </section>
          );
        })}
        {roster.length > 1 && roster.length % columns !== 0 && (
          <div className={styles.raceControl}>
            <span className={styles.eyebrow}>SUNSET CIRCUIT</span>
            <svg className={styles.map} viewBox="-151 -112 292 210" role="img" aria-label="Live circuit map">
              <path d={MAP_PATH} fill="none" stroke="#303744" strokeWidth="16" strokeLinejoin="round" />
              <path d={MAP_PATH} fill="none" stroke="#7c8797" strokeWidth="1.5" />
              {hud.karts.map((kart) => <circle key={kart.id} cx={kart.x} cy={kart.z} r="6" fill={roster.find((player) => player.id === kart.id)?.color || '#ffbe68'} stroke="#fff" strokeWidth="1.8" />)}
            </svg>
            <div className={styles.controlClock}>{clock(hud.elapsed)}</div>
          </div>
        )}
      </div>
      {roster.length === 0 && <div className={styles.overlay}><p>Add a racer to start the engine.</p></div>}
      {error && <div className={styles.overlay} role="alert"><div className={styles.errorCard}><strong>Race display paused</strong><p>{error}</p><button type="button" onClick={() => setRestart((value) => value + 1)}>Try again</button></div></div>}
      {hud.complete && !error && <div className={styles.overlay}><div className={styles.podium}>
        <span className={styles.eyebrow}>CHECKERED FLAG</span><h2>Race complete</h2>
        <ol>{hud.results.map((result) => <li key={result.id}><span className={styles.resultPlace}>{result.place}</span><span className={styles.resultName} style={{ color: result.color }}>{result.name}</span><strong>{result.time === null ? 'DNF' : clock(result.time)}</strong></li>)}</ol>
        <p>Use the race controls to head back to the lobby.</p>
      </div></div>}
      {soundControls}
      <span className={styles.srOnly} aria-live="polite">{hud.complete ? `Race complete. ${hud.results[0]?.name || 'The leader'} placed first.` : hud.countdown > 0 ? 'Race starting. Hold accelerate when the countdown ends.' : 'Race in progress.'}</span>
    </div>
  );
}

export default GameView;
