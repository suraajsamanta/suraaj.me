"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { OnlineRaceView, RaceHud, RaceInput, RaceSettings } from "./race";
import { getTrack, type TrackId } from "./course";
import raceUi from "./race-ui.module.css";
import styles from "./beerio2.module.css";

type Pedal = "throttle" | "brake" | "drift";
const DEFAULT_HUD: RaceHud = { speed: 0, lap: 1, seconds: 0, best: null, boost: false, renderer: "" };
const PEDAL_KEYS: Record<Pedal, string[]> = { throttle: ["ArrowUp", "KeyW"], brake: ["ArrowDown", "KeyS"], drift: ["Space"] };
const RACER_KEYS = new Set([...Object.values(PEDAL_KEYS).flat(), "ArrowLeft", "KeyA", "ArrowRight", "KeyD", "KeyR"]);
const PAD_SYMBOLS = { throttle: "↑", brake: "↓", drift: "↝" };
const PAD_LABELS = { throttle: "Gas", brake: "Brake", drift: "Drift" };

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00.00";
  const hundredths = Math.max(0, Math.floor(seconds * 100));
  return `${Math.floor(hundredths / 6000)}:${String(Math.floor(hundredths / 100) % 60).padStart(2, "0")}.${String(hundredths % 100).padStart(2, "0")}`;
}

export type RaceBanner = { label: string; title: string; detail?: string; countdown?: boolean };
type RaceScreenProps = { ride?: import("./ride-selection").RideSelection; paint?: string; spectator?: boolean; host?: boolean; pause?: () => void; trackId?: TrackId; mode?: "race" | "time-trial"; onlineView?: OnlineRaceView; banner?: RaceBanner; exit: () => void; racing?: boolean; laps?: number; panel?: ReactNode; };
export default function RaceScreen({ onlineView, banner, exit, racing = true, laps, panel, paint, ride, spectator = false, host = false, pause, trackId = "seattle", mode = "time-trial" }: RaceScreenProps) {
  const live = !!onlineView;
  const soloGrid = !live && mode === "race";
  const track = getTrack(trackId);

  const frame = onlineView?.getFrame();
  const finished = !!onlineView && !!frame?.cars[onlineView.id]?.finished;
  const driveEnabled = useRef(!spectator && racing && !finished);
  const canvas = useRef<HTMLCanvasElement>(null);
  const shell = useRef<HTMLElement>(null);
  const input = useRef<RaceInput>({ steer: 0, throttle: false, brake: false, drift: false, reset: false });
  const keys = useRef(new Set<string>());
  const wheel = useRef<{ pointer: number; steer: number; center: number; span: number } | null>(null);
  const wheelKnob = useRef<HTMLSpanElement>(null);
  const soundSettings = useRef<RaceSettings>({});
  const [muted, setMuted] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [awake, setAwake] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);
  const [bestLocal, setBestLocal] = useState<number | null>(null);
  const map = useMemo(() => {
    const x0 = Math.min(...track.points.map(p => p.x)), x1 = Math.max(...track.points.map(p => p.x));
    const z0 = Math.min(...track.points.map(p => p.z)), z1 = Math.max(...track.points.map(p => p.z));
    const scale = 67 / Math.max(x1 - x0, z1 - z0, 1);
    const x = (value: number) => 40 + (value - (x0 + x1) / 2) * scale;
    const y = (value: number) => 40 - (value - (z0 + z1) / 2) * scale;
    return { x, y, outline: track.points.map(p => `${x(p.x).toFixed(1)},${y(p.z).toFixed(1)}`).join(" ") };
  }, [track]);
  const pedals = useRef<Record<Pedal, number | null>>({ throttle: null, brake: null, drift: null });
  const [hud, setHud] = useState(DEFAULT_HUD);
  const driving = !spectator && racing && !finished && !(soloGrid && hud.soloRace?.finished);
  const [controls, setControls] = useState({ steer: 0, throttle: false, brake: false, drift: false });
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    driveEnabled.current = driving;
    if (driving) return;
    keys.current.clear();
    wheel.current = null;
    wheelKnob.current?.style.setProperty("--steer", "0%");
    pedals.current = { throttle: null, brake: null, drift: null };
    Object.assign(input.current, { steer: 0, throttle: false, brake: false, drift: false, reset: false });
    onlineView?.setInput(input.current);
    const id = requestAnimationFrame(() => setControls({ steer: 0, throttle: false, brake: false, drift: false }));
    return () => cancelAnimationFrame(id);
  }, [driving, onlineView]);

  function sync() {
    const isDown = (...values: string[]) => values.some((k) => keys.current.has(k));
    const next = {
      steer: wheel.current?.steer ?? Number(isDown("ArrowRight", "KeyD")) - Number(isDown("ArrowLeft", "KeyA")),
      throttle: pedals.current.throttle !== null || isDown(...PEDAL_KEYS.throttle, "focus-throttle"),
      brake: pedals.current.brake !== null || isDown(...PEDAL_KEYS.brake, "focus-brake"),
      drift: pedals.current.drift !== null || isDown(...PEDAL_KEYS.drift, "focus-drift"),
    };
    const changed = next.steer !== input.current.steer || next.throttle !== input.current.throttle
      || next.brake !== input.current.brake || next.drift !== input.current.drift;
    if (!changed) return;
    const pedalsChanged = next.throttle !== input.current.throttle || next.brake !== input.current.brake || next.drift !== input.current.drift;
    Object.assign(input.current, next);
    wheelKnob.current?.style.setProperty("--steer", `${next.steer * 65}%`);
    if (driveEnabled.current) onlineView?.setInput(input.current);
    if (pedalsChanged) setControls(next);
    if (next.throttle && pedalsChanged) setMoved(true);
  }

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let restore = 0;
    try {
      const saved = Number(localStorage.getItem(`beerio2-best-v1:${trackId}`));
      const startsMuted = spectator || localStorage.getItem("beerio2-muted") === "true";
      soundSettings.current.muted = startsMuted;
      restore = requestAnimationFrame(() => {
        setMuted(startsMuted);
        setBestLocal(Number.isFinite(saved) && saved > 0 ? saved : null);
      });
    } catch {}
    soundSettings.current.trackId = trackId;
    soundSettings.current.paint = paint;
    soundSettings.current.ride = ride;
    soundSettings.current.mode = mode;
    soundSettings.current.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import("./race").then(({ startRace }) => {
      if (cancelled) return;
      return startRace(target, input.current, (next) => {
        if (!cancelled) setHud(next);
      }, onlineView, soundSettings.current).then((stop) => {
        if (cancelled) stop();
        else dispose = stop;
      });
    }).catch((cause: unknown) => {
      if (!cancelled) {
        console.warn("Beerio 2 graphics initialization failed", cause);
        setError(cause instanceof Error ? cause.message : "Unknown graphics error");
      }
    });
    return () => { cancelled = true; cancelAnimationFrame(restore); dispose?.(); };
  }, [retry, onlineView, trackId, mode, spectator, paint, ride]);

  useEffect(() => {
    if (!(host || spectator) || !keepAwake || !navigator.wakeLock) return;
    let stopped = false;
    let pending = false;
    let lock: WakeLockSentinel | null = null;
    const update = () => {
      if (stopped || pending || document.hidden || (lock && !lock.released)) return;
      pending = true;
      void navigator.wakeLock.request("screen").then(next => {
        if (stopped || document.hidden) { void next.release().catch(() => {}); return; }
        lock = next;
        setAwake(true);
        next.addEventListener("release", () => { if (!stopped) setAwake(false); }, { once: true });
      }).catch(() => {}).finally(() => { pending = false; });
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", update);
      if (lock) void lock.release().catch(() => {});
    };
  }, [host, spectator, keepAwake]);

  useEffect(() => {
    if (!spectator) return;
    const onFullScreen = () => setFullScreen(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", onFullScreen);
    return () => document.removeEventListener("fullscreenchange", onFullScreen);
  }, [spectator]);

  useEffect(() => {
    if (live || soloGrid || hud.best === null || (bestLocal !== null && hud.best >= bestLocal)) return;
    try { localStorage.setItem(`beerio2-best-v1:${trackId}`, String(hud.best)); } catch {}
    const id = requestAnimationFrame(() => setBestLocal(hud.best));
    return () => cancelAnimationFrame(id);
  }, [live, soloGrid, hud.best, bestLocal, trackId]);

  useEffect(() => {
    if (spectator) return;
    function keyDown(event: KeyboardEvent) {
      if (!driveEnabled.current || event.altKey || event.metaKey || event.ctrlKey || !RACER_KEYS.has(event.code)) return;
      if (event.target instanceof Element && event.target.closest("input, select, textarea, [contenteditable='true']")) return;
      if (event.defaultPrevented || (event.code === "Space" && event.target instanceof Element && event.target.closest("button, a"))) return;
      event.preventDefault();
      if (event.code === "KeyR") {
        if (!live && !event.repeat) input.current.reset = true;
        return;
      }
      if (keys.current.has(event.code)) return;
      keys.current.add(event.code);
      sync();
    }
    function keyUp(event: KeyboardEvent) {
      if (keys.current.delete(event.code)) sync();
    }
    function clear() {
      keys.current.clear();
      wheel.current = null;
      pedals.current = { throttle: null, brake: null, drift: null };
      input.current.reset = false;
      sync();
    }
    document.addEventListener("keydown", keyDown);
    document.addEventListener("keyup", keyUp);
    document.addEventListener("visibilitychange", clear);
    window.addEventListener("blur", clear);
    return () => {
      document.removeEventListener("keydown", keyDown);
      document.removeEventListener("keyup", keyUp);
      document.removeEventListener("visibilitychange", clear);
      window.removeEventListener("blur", clear);
    };
    // The hardware input callback must follow a new online session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, onlineView, spectator]);

  function steer(event: PointerEvent<HTMLButtonElement>, start = false) {
    if (start) {
      if (!driveEnabled.current || wheel.current || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = event.currentTarget.getBoundingClientRect();
      wheel.current = { pointer: event.pointerId, steer: 0, center: rect.left + rect.width / 2, span: Math.max(1, rect.width * .36) };
    }
    const current = wheel.current;
    if (!current || current.pointer !== event.pointerId) return;
    const offset = (event.clientX - current.center) / current.span;
    const unit = Math.max(0, Math.min(1, (Math.abs(offset) - .07) / .93));
    current.steer = Math.sign(offset) * unit ** 1.2;
    sync();
  }

  function releaseSteer(event: PointerEvent<HTMLButtonElement>) {
    if (wheel.current?.pointer === event.pointerId) {
      wheel.current = null;
      sync();
    }
  }

  function releasePedal(event: PointerEvent<HTMLButtonElement>, name: Pedal) {
    if (pedals.current[name] === event.pointerId) {
      pedals.current[name] = null;
      sync();
    }
  }

  function releaseKeyboardPedal(name: Pedal) {
    if (keys.current.delete(`focus-${name}`)) sync();
  }

  const soloStatus = hud.soloRace;
  const soloFinished = soloGrid && soloStatus?.finished === true;
  const showCountdown = soloGrid && soloStatus && soloStatus.countdown > 0;
  const startAgain = () => { setHud(DEFAULT_HUD); setMoved(false); setRetry(v => v + 1); };
  const visibleBanner = banner ?? (showCountdown ? {
    label: track.name.toUpperCase(), title: String(Math.ceil(soloStatus.countdown)), countdown: true,
  } : undefined) ?? (!spectator && frame?.phase === "race" && (finished ? {
    label: "FINISH LINE", title: "Race complete", detail: "Waiting for the remaining drivers.",
  } : frame.elapsed < .65 ? { label: track.name.toUpperCase(), title: "GO!", countdown: true } : undefined)) ?? undefined;
  const order = frame ? Object.entries(frame.cars).sort(([idA, a], [idB, b]) =>
    ((a.finishTime ?? Infinity) - (b.finishTime ?? Infinity)) || b.progress - a.progress || idA.localeCompare(idB)
  ) : [];
  const place = order.findIndex(([id]) => id === onlineView?.id);
  const stats = onlineView?.getNetworkStats?.();
  const shownBest = hud.best === null ? bestLocal : bestLocal === null ? hud.best : Math.min(hud.best, bestLocal);
  const onlinePlace = frame?.phase === "lobby" || place < 0 ? "—" : `${place + 1}/${order.length}`;

  const cameraDriver = spectator ? frame?.players.find(p => p.id === onlineView?.id)?.name : null;
  return (
    <main ref={shell} className={`${styles.shell}${spectator ? ` ${styles.tvShell}` : ""}`}>
      <header className={styles.top}>
        {live
          ? <button type="button" className={`${styles.home} ${styles.homeButton}`} onClick={exit} aria-label={host ? "End room" : spectator ? "Exit TV view" : "Leave online race"}><span aria-hidden>‹</span> Exit</button>
          : <button type="button" className={`${styles.home} ${styles.homeButton}`} onClick={exit} aria-label="Back to Beerio 2 garage"><span aria-hidden>‹</span> Garage</button>}
        <h1>BEERIO<span>02</span></h1>
        <span className={`${styles.edition} ${spectator ? styles.tvTitle : ""}`}><i aria-hidden /> <span>{host ? "SHARED SCREEN · HOST" : spectator ? "TV VIEW · LIVE" : live ? "ONLINE RACE" : soloGrid ? "RACE AI" : "TIME TRIAL"}</span></span>
      </header>
      <section className={styles.stage} data-course={trackId} aria-label={`${track.name} ${spectator ? "TV race view" : live ? "online race" : soloGrid ? "AI race" : "time trial"}`}>
        <canvas key={retry} ref={canvas} className={styles.canvas} aria-label="Live 3D race view" />
        <div className={styles.vignette} aria-hidden />
        <div className={styles.telemetry} aria-label="Lap and time">
          <div className={styles.track}><span className={styles.marker} aria-hidden>◆</span><span>{track.name.toUpperCase()}<small>{trackId === "orbit" ? "CIRCUIT 02" : "CIRCUIT 01"}</small></span></div>
          <div className={styles.timing}>
            <div><small>LAP</small><b>{String(hud.lap).padStart(2, "0")}{laps || soloGrid ? `/${laps ?? 3}` : ""}</b></div>
            <div><small>TIME</small><b>{clock(hud.seconds)}</b></div>
            <div><small>{live || soloGrid ? "PLACE" : "BEST"}</small><b>{live ? onlinePlace : soloGrid ? (soloStatus ? `${soloStatus.place}/${soloStatus.total}` : "—") : shownBest === null ? "—" : clock(shownBest)}</b></div>
          </div>
        </div>
        {!!hud.renderer && <svg className={raceUi.minimap} viewBox="0 0 80 80" aria-label="Circuit map" role="img">
          <polygon points={map.outline} className={raceUi.mapOutline}/>
          <polygon points={map.outline} className={raceUi.mapLine}/>
          <rect x={map.x(track.points[0].x) - 2} y={map.y(track.points[0].z) - 2} width="4" height="4" fill="white" opacity=".75"/>
          {(hud.map ?? []).map(mark => <circle key={mark.id} cx={map.x(mark.x)} cy={map.y(mark.z)} r={mark.own ? 3.4 : 2.25} fill={mark.own ? "#fff" : mark.color ?? "#82edff"} stroke="#071024" strokeWidth="1.2"/>)}
        </svg>}
        <div className={styles.speed} aria-label={`${Math.round(hud.speed)} miles per hour`}>
          <b>{String(Math.max(0, Math.round(hud.speed))).padStart(2, "0")}</b><span>MPH</span>
          <span className={hud.boost ? styles.boostOn : styles.boostOff}>↯ BOOST</span>
          {!!hud.driftCharge && !hud.boost && <span className={raceUi.driftCharge} aria-label="Drift boost charge"><i style={{width: `${Math.min(100, hud.driftCharge * 100)}%`}}/></span>}
        </div>
        {!live && !soloGrid && !moved && hud.renderer && !error && <p className={styles.startHint}>Hold <strong>Gas</strong> to start<span className={styles.keysOnly}> <span aria-hidden>·</span> ↑ or W</span></p>}
        {!spectator && <div className={styles.controls} aria-label="Race controls" data-disabled={driving ? undefined : true}>
          <div className={styles.wheelWrap}>
            <button type="button" className={styles.wheel} disabled={!driving} aria-label="Steer left or right. Drag horizontally or use the arrow keys."
              onPointerDown={(event) => steer(event, true)} onPointerMove={(event) => steer(event)}
              onPointerUp={releaseSteer} onPointerCancel={releaseSteer} onLostPointerCapture={releaseSteer}
              onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") event.preventDefault(); }}>
              <span className={styles.wheelTicks} aria-hidden>‹ <span>›</span></span>
              <span className={styles.wheelKnob} aria-hidden ref={wheelKnob} style={{ transform: "translateX(var(--steer, 0%))" }}><i/><i/><i/></span>
            </button>
            <span className={styles.controlLabel} aria-hidden>STEERING</span>
          </div>
          <div className={styles.pedals}>
            {(["drift", "brake", "throttle"] as const).map((name) => (
              <button key={name} type="button" className={`${styles.pedal} ${styles[name]}`}
                aria-label={PAD_LABELS[name]} aria-pressed={controls[name]} disabled={!driving}
                onPointerDown={(event) => {
                  if (!driveEnabled.current || event.button !== 0 || pedals.current[name] !== null) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  pedals.current[name] = event.pointerId;
                  sync();
                }}
                onPointerUp={(event) => releasePedal(event, name)}
                onPointerCancel={(event) => releasePedal(event, name)}
                onLostPointerCapture={(event) => releasePedal(event, name)}
                onKeyDown={(event) => {
                  if (event.key !== " " && event.key !== "Enter") return;
                  event.preventDefault();
                  if (event.repeat) return;
                  keys.current.add(`focus-${name}`);
                  sync();
                }}
                onKeyUp={(event) => {
                  if (event.key === " " || event.key === "Enter") releaseKeyboardPedal(name);
                }}
                onBlur={() => releaseKeyboardPedal(name)}>
                <span aria-hidden>{PAD_SYMBOLS[name]}</span>{PAD_LABELS[name]}
              </button>
            ))}
          </div>
        </div>}
        {visibleBanner && !error && <div className={`${styles.raceBanner} ${visibleBanner.countdown ? styles.countdownBanner : ""}`} role="status" aria-live="polite">
          <span>{visibleBanner.label}</span><strong key={visibleBanner.title}>{visibleBanner.title}</strong>{visibleBanner.detail && <small>{visibleBanner.detail}</small>}
        </div>}
        {!panel && !visibleBanner && !hud.renderer && !error && <div className={styles.notice} role="status"><i /> Loading {track.name}…</div>}
        {error && <div className={`${styles.notice} ${styles.error}`} role="alert">
          <strong>Couldn’t start the 3D engine.</strong>
          <span>{error}</span>
          <button type="button" onClick={() => { setError(""); setHud(DEFAULT_HUD); setMoved(false); setRetry((v) => v + 1); }}>Try again</button>
          <button type="button" className={styles.compatibility} onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("webgl", "1");
            window.history.replaceState(window.history.state, "", url);
            setError(""); setHud(DEFAULT_HUD); setMoved(false); setRetry((v) => v + 1);
          }}>Use compatibility renderer</button>
        </div>}
        {soloFinished && !error && <div className={raceUi.finish} role="status">
          <small>CHECKERED FLAG · {track.name.toUpperCase()}</small>
          <strong>{soloStatus.place === 1 ? "You win" : `P${soloStatus.place} finish`}</strong>
          <span>Best lap {hud.best === null ? "—" : clock(hud.best)}</span>
          <button type="button" onClick={startAgain}>Race again</button>
          <button type="button" onClick={exit}>Back to garage</button>
        </div>}
        {panel && <div className={styles.racePanel}>{panel}</div>}
      </section>
      <footer className={`${styles.bottom} ${spectator ? styles.tvControls : ""}`}>
        <span className={styles.mode}>{spectator ? (cameraDriver ? `FOLLOWING ${cameraDriver}` : "SHARED DISPLAY") : live ? "ONLINE RACE" : "SOLO RUN"} <span>·</span> {hud.renderer || "3D"}{hud.roadKernel === "WASM SIMD" && <span> · WASM SIMD</span>}</span>
        <span className={raceUi.connection} title="FPS and applied-input round-trip time">
          {!!hud.fps && `${hud.fps} FPS`}{stats?.inputAckMs != null && `  ·  ${Math.round(stats.inputAckMs)} ms input`}
        </span>
        {!spectator && <span className={styles.help}>WASD / arrows <span>·</span> Space to drift</span>}
        <div className={styles.raceActions}>
          {pause && <button className={styles.reset} type="button" onClick={pause}>Pause race</button>}
          {(host || spectator) && awake && keepAwake && <button className={`${styles.reset} ${raceUi.wakeStatus}`} type="button" onClick={() => { setKeepAwake(false); setAwake(false); }} title="Allow this screen to sleep">Screen awake</button>}
          {(host || spectator) && !keepAwake && <button className={`${styles.reset} ${raceUi.wakeStatus}`} type="button" onClick={() => setKeepAwake(true)}>Keep awake</button>}
          {spectator && <button className={styles.reset} type="button" onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
            else void shell.current?.requestFullscreen?.().catch(() => {});
          }}>{fullScreen ? "Exit full screen" : "Full screen"}</button>}
          <button className={styles.reset} type="button" aria-pressed={muted} onClick={() => {
            const next = !muted;
            soundSettings.current.muted = next;
            setMuted(next);
            if (!spectator) { try { localStorage.setItem("beerio2-muted", String(next)); } catch {} }
          }}>{muted ? "Sound off" : "Sound on"}</button>
          {!live && !soloGrid && <button className={styles.reset} type="button" onClick={() => { input.current.reset = true; }} aria-label="Reset car to track">↺ Reset</button>}
          {!spectator && <button className={styles.reset} type="button" onClick={exit}>{live ? "Leave room" : "Garage"}</button>}
        </div>
      </footer>
    </main>
  );
}
