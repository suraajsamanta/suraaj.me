"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { FINISHES, type CarFinish } from "./finishes";
import styles from "./car-lab.module.css";

const ANGLES = [{ name: "Rear ¾", angle: -39 }, { name: "Side", angle: 90 }, { name: "Front ¾", angle: 144 }] as const;
type StudioState = { angle: number; paint: string; reduced: boolean };

export default function CarLab({ finish, onFinish, exit, race }: { finish: CarFinish; onFinish: (finish: CarFinish) => void; exit: () => void; race: () => void }) {
  const [angle, setAngle] = useState(-39);
  const [renderer, setRenderer] = useState("");
  const [error, setError] = useState(false);
  const [safe, setSafe] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pointer: number; x: number; angle: number } | null>(null);
  const settings = useRef<StudioState>({ angle: -39, paint: finish.hex, reduced: false });

  useEffect(() => { settings.current.paint = finish.hex; }, [finish.hex]);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    settings.current.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let active = true, cleanup: (() => void) | undefined;
    void import("./car-studio").then(({ startStudio }) => {
      if (!active) return;
      return startStudio(target, settings.current, safe).then(result => {
        if (!active) result.dispose();
        else { cleanup = result.dispose; setRenderer(result.renderer); }
      });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; cleanup?.(); };
  }, [safe]);

  function turn(angle: number) {
    const normalized = ((Math.round(angle) + 180) % 360 + 360) % 360 - 180;
    settings.current.angle = normalized;
    setAngle(normalized);
  }
  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || drag.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, x: event.clientX, angle: settings.current.angle };
  }
  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const state = drag.current;
    if (state?.pointer === event.pointerId) turn(state.angle + (event.clientX - state.x) * .52);
  }
  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (drag.current?.pointer === event.pointerId) drag.current = null;
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <button onClick={exit} type="button">‹ Garage</button>
      <h1>BEERIO<span> 02</span> <small>CAR LAB</small></h1>
      <span className={styles.status}><i aria-hidden /> {renderer || "INITIALIZING"}</span>
    </header>
    <section className={styles.studio} aria-label="Interactive hypercar showroom">
      <div className={styles.carName}><span>AFTERHOURS MOTORSPORT / 001</span><h2>NIGHTJAR<em> R</em></h2><small>HYPERCAR</small></div>
      <canvas key={String(safe)} ref={canvas} aria-label="3D hypercar preview. Drag to rotate, or use the view buttons."
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={pointerUp}/>
      <div className={styles.angleControls}>
        {ANGLES.map(view => <button type="button" key={view.name} onClick={() => turn(view.angle)} aria-pressed={angle === view.angle}>{view.name}</button>)}
      </div>
      {!renderer && !error && <p className={styles.notice} role="status">Loading the car…</p>}
      {error && <div className={styles.notice} role="alert">Couldn’t open the 3D preview.
        {!safe && <button onClick={() => { setError(false); setSafe(true); }} type="button">Use compatibility view</button>}
      </div>}
      {renderer && <p className={styles.hint}>Drag to inspect · Same model you race</p>}
    </section>
    <footer className={styles.config}>
      <div className={styles.finishes}>
        <div><small>PAINT FINISH</small><strong>{finish.name}</strong></div>
        <div className={styles.swatches} role="group" aria-label="Paint finish">
          {FINISHES.map(option => <button key={option.id} type="button" aria-label={option.name} aria-pressed={option.id === finish.id} title={option.name}
            onClick={() => onFinish(option)}><span style={{ backgroundColor: option.hex }}/></button>)}
        </div>
      </div>
      <label className={styles.orbit}>Rotate <input aria-label="Rotate car" type="range" min={-180} max={179} value={angle} onChange={event => turn(Number(event.target.value))} /></label>
      <button type="button" className={styles.race} onClick={race}>Race this car <span aria-hidden>↗</span></button>
      <p>Paint applies to solo races. Online races assign colors so drivers are easy to tell apart.</p>
    </footer>
  </main>;
}
