"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { FINISHES, type CarFinish } from "./finishes";
import { CHARACTERS, RIDES, type RideSelection } from "./ride-selection";
import styles from "./car-lab.module.css";

const ANGLES = [{ name: "Rear ¾", angle: -39 }, { name: "Side", angle: 90 }, { name: "Front ¾", angle: 144 }] as const;
type StudioState = { angle: number; paint: string; reduced: boolean; ride: RideSelection };
const RIDE_DETAILS: Record<RideSelection["vehicle"], string> = {
  nightjar: "AFTERHOURS MOTORSPORT · ORIGINAL HYPERCAR",
  "bmw-m2": "COMPACT COUPE · SQUARED INTAKES",
  "bmw-m3": "SPORT SEDAN · TALL TWIN GRILLE",
  "bmw-m4": "SPORT COUPE · LOW FASTBACK ROOF",
  "amg-gt": "GRAND TOURER · LONG BONNET",
  "amg-g63": "BOX-SHAPED SUV · REAR SPARE WHEEL",
  lamborghini: "AVENTADOR · LOW, ANGULAR WEDGE",
  mclaren: "720S · SCULPTED AIR CHANNELS",
  ferrari: "F40 · CLASSIC WEDGE & FIXED REAR WING",
  ducati: "PANIGALE V4 · ITALIAN SUPERBIKE",
  "bmw-bike": "S 1000 RR · GERMAN SUPERBIKE",
  cybertruck: "ELECTRIC PICKUP · FACETED STEEL BODY",
  "tesla-roadster": "ELECTRIC SPORTS CAR · LOW OPEN COCKPIT",
  bugatti: "CHIRON · HORSESHOE GRILLE & C-LINE",
};

export default function CarLab({ finish, onFinish, ride, onRide, exit, race, roomSetup = false }: {
  finish: CarFinish;
  onFinish: (finish: CarFinish) => void;
  ride: RideSelection;
  onRide: (ride: RideSelection) => void;
  exit: () => void;
  race: () => void;
  roomSetup?: boolean;
}) {
  const [angle, setAngle] = useState(-39);
  const [renderer, setRenderer] = useState("");
  const [error, setError] = useState(false);
  const [safe, setSafe] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pointer: number; x: number; angle: number } | null>(null);
  const settings = useRef<StudioState>({ angle: -39, paint: finish.hex, reduced: false, ride });
  const vehicle = RIDES.find(option => option.id === ride.vehicle) ?? RIDES[0];
  const character = CHARACTERS.find(option => option.id === ride.character) ?? CHARACTERS.find(option => option.id === "fox")!;

  useEffect(() => { settings.current.paint = finish.hex; }, [finish.hex]);
  useEffect(() => { settings.current.ride = ride; }, [ride]);
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
    <section className={styles.studio} aria-label="Interactive vehicle showroom">
      <div className={styles.carName}>
        <span>THE GARAGE / {String(RIDES.findIndex(option => option.id === ride.vehicle) + 1).padStart(2, "0")} OF {RIDES.length}</span>
        <h2>{vehicle.name}</h2><small>{RIDE_DETAILS[ride.vehicle]}</small>
      </div>
      <div className={styles.driverBadge}><span aria-hidden>{character.icon}</span><div><small>AT THE WHEEL</small><strong>{character.name}</strong></div></div>
      <canvas key={String(safe)} ref={canvas} aria-label={`3D ${vehicle.name} preview with ${character.name} driving. Drag to rotate, or use the view buttons.`}
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
    <section className={styles.selection} aria-label="Choose your car and driver">
      <label className={styles.selectField}>
        <span>01 / YOUR RIDE <small>{RIDES.length} MODELS</small></span>
        <select value={ride.vehicle} onChange={event => onRide({ ...ride, vehicle: event.target.value as RideSelection["vehicle"] })}>
          {RIDES.map(option => <option value={option.id} key={option.id}>{option.icon} {option.name}</option>)}
        </select>
      </label>
      <label className={styles.selectField}>
        <span>02 / YOUR DRIVER <small>{CHARACTERS.length} CHARACTERS</small></span>
        <select value={ride.character} onChange={event => onRide({ ...ride, character: event.target.value as RideSelection["character"] })}>
          {CHARACTERS.map(option => <option value={option.id} key={option.id}>{option.icon} {option.name} · {option.id.charAt(0).toUpperCase() + option.id.slice(1)}</option>)}
        </select>
      </label>
      <p className={styles.selectionNote}>Your ride. Your racer.<br/><span>Peek out of the cockpit, then take it to the track.</span></p>
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
      <button type="button" className={styles.race} onClick={race}>{roomSetup ? "Use this setup" : "Race this car"} <span aria-hidden>↗</span></button>
      <p>Your car and driver carry into races. Solo uses your paint; online assigns driver colors.</p>
    </footer>
  </main>;
}
