"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { OnlineRaceView, RaceHud, RaceInput } from "./race";
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
type RaceScreenProps = { onlineView?: OnlineRaceView; banner?: RaceBanner; exit: () => void; racing?: boolean; laps?: number; panel?: ReactNode; };
export default function RaceScreen({ onlineView, banner, exit, racing = true, laps, panel }: RaceScreenProps) {
  const live = !!onlineView;

  const frame = onlineView?.getFrame();
  const finished = !!onlineView && !!frame?.cars[onlineView.id]?.finished;
  const driving = racing && !finished;
  const driveEnabled = useRef(driving);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<RaceInput>({ steer: 0, throttle: false, brake: false, drift: false, reset: false });
  const keys = useRef(new Set<string>());
  const wheel = useRef<{ pointer: number; steer: number } | null>(null);
  const pedals = useRef<Record<Pedal, number | null>>({ throttle: null, brake: null, drift: null });
  const [hud, setHud] = useState(DEFAULT_HUD);
  const [controls, setControls] = useState({ steer: 0, throttle: false, brake: false, drift: false });
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    driveEnabled.current = driving;
    if (driving) return;
    keys.current.clear();
    wheel.current = null;
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
    Object.assign(input.current, next);
    setControls(next);
    if (next.throttle) setMoved(true);
  }

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import("./race").then(({ startRace }) => {
      if (cancelled) return;
      return startRace(target, input.current, (next) => {
        if (!cancelled) setHud(next);
      }, onlineView).then((stop) => {
        if (cancelled) stop();
        else dispose = stop;
      });
    }).catch((cause: unknown) => {
      if (!cancelled) {
        console.warn("Beerio 2 graphics initialization failed", cause);
        setError(cause instanceof Error ? cause.message : "Unknown graphics error");
      }
    });
    return () => { cancelled = true; dispose?.(); };
  }, [retry, onlineView]);

  useEffect(() => {
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
  }, [live]);

  function steer(event: PointerEvent<HTMLButtonElement>, start = false) {
    if (start) {
      if (!driveEnabled.current || wheel.current || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (wheel.current?.pointer !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = (event.clientX - rect.left - rect.width / 2) / (rect.width * .37);
    const amount = Math.sign(offset) * Math.max(0, Math.min(1, (Math.abs(offset) - .10) / .90));
    wheel.current = { pointer: event.pointerId, steer: amount };
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

  const visibleBanner = banner ?? (frame?.phase === "race" && (finished ? {
    label: "FINISH LINE", title: "Race complete", detail: "Waiting for the remaining drivers.",
  } : frame.elapsed < .65 ? { label: "SEATTLE NIGHT", title: "GO!", countdown: true } : undefined)) ?? undefined;
  const order = frame ? Object.entries(frame.cars).sort(([idA, a], [idB, b]) =>
    ((a.finishTime ?? Infinity) - (b.finishTime ?? Infinity)) || b.progress - a.progress || idA.localeCompare(idB)
  ) : [];
  const place = order.findIndex(([id]) => id === onlineView?.id);
  const onlinePlace = frame?.phase === "lobby" || place < 0 ? "—" : `${place + 1}/${order.length}`;

  return (
    <main className={styles.shell}>
      <header className={styles.top}>
        {live
          ? <button type="button" className={`${styles.home} ${styles.homeButton}`} onClick={exit} aria-label="Leave online race"><span aria-hidden>‹</span> Exit</button>
          : <Link className={styles.home} href="/madfun" aria-label="Back to Madfun"><span aria-hidden>‹</span> Madfun</Link>}
        <h1>BEERIO<span>02</span></h1>
        <span className={styles.edition}><i aria-hidden /> <span>{live ? "ONLINE RACE" : "TIME TRIAL"}</span></span>
      </header>
      <section className={styles.stage} aria-label={live ? "Seattle Night online race" : "Seattle Night time trial"}>
        <canvas key={retry} ref={canvas} className={styles.canvas} aria-label="Live 3D race view" />
        <div className={styles.vignette} aria-hidden />
        <div className={styles.telemetry} aria-label="Lap and time">
          <div className={styles.track}><span className={styles.marker} aria-hidden>◆</span><span>SEATTLE NIGHT<small>CIRCUIT 01</small></span></div>
          <div className={styles.timing}>
            <div><small>LAP</small><b>{String(hud.lap).padStart(2, "0")}{laps ? `/${laps}` : ""}</b></div>
            <div><small>TIME</small><b>{clock(hud.seconds)}</b></div>
            <div><small>{live ? "PLACE" : "BEST"}</small><b>{live ? onlinePlace : hud.best === null ? "—" : clock(hud.best)}</b></div>
          </div>
        </div>
        <div className={styles.speed} aria-label={`${Math.round(hud.speed)} miles per hour`}>
          <b>{String(Math.max(0, Math.round(hud.speed))).padStart(2, "0")}</b><span>MPH</span>
          <span className={hud.boost ? styles.boostOn : styles.boostOff}>↯ BOOST</span>
        </div>
        {!live && !moved && hud.renderer && !error && <p className={styles.startHint}>Hold <strong>Gas</strong> to start<span className={styles.keysOnly}> <span aria-hidden>·</span> ↑ or W</span></p>}
        <div className={styles.controls} aria-label="Race controls" data-disabled={driving ? undefined : true}>
          <div className={styles.wheelWrap}>
            <button type="button" className={styles.wheel} disabled={!driving} aria-label="Steer left or right. Drag horizontally or use the arrow keys."
              onPointerDown={(event) => steer(event, true)} onPointerMove={(event) => steer(event)}
              onPointerUp={releaseSteer} onPointerCancel={releaseSteer} onLostPointerCapture={releaseSteer}
              onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") event.preventDefault(); }}>
              <span className={styles.wheelTicks} aria-hidden>‹ <span>›</span></span>
              <span className={styles.wheelKnob} aria-hidden style={{ transform: `translateX(${controls.steer * 55}%)` }}><i/><i/><i/></span>
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
        </div>
        {visibleBanner && !error && <div className={`${styles.raceBanner} ${visibleBanner.countdown ? styles.countdownBanner : ""}`} role="status" aria-live="polite">
          <span>{visibleBanner.label}</span><strong key={visibleBanner.title}>{visibleBanner.title}</strong>{visibleBanner.detail && <small>{visibleBanner.detail}</small>}
        </div>}
        {!panel && !visibleBanner && !hud.renderer && !error && <div className={styles.notice} role="status"><i /> Loading Seattle Night…</div>}
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
        {panel && <div className={styles.racePanel}>{panel}</div>}
      </section>
      <footer className={styles.bottom}>
        <span className={styles.mode}>{live ? "ONLINE RACE" : "SOLO RUN"} <span>·</span> {hud.renderer || "3D"}</span>
        <span className={styles.help}>WASD / arrows <span>·</span> Space to drift</span>
        <div className={styles.raceActions}>
          {!live && <button className={styles.reset} type="button" onClick={() => { input.current.reset = true; }} aria-label="Reset car to track">↺ Reset</button>}
          <button className={styles.reset} type="button" onClick={exit}>{live ? "Leave room" : "Exit trial"}</button>
        </div>
      </footer>
    </main>
  );
}
