"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./boomerang.module.css";
export type ControlInput = { x: number; y: number; throwSeq: number; dash: boolean };
export default function PhoneControls({ disabled, onInput }: { disabled: boolean; onInput: (value: ControlInput) => void }) {
  const value = useRef<ControlInput>({ x: 0, y: 0, throwSeq: 0, dash: false });
  const stickPointer = useRef<number | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const emit = (patch: Partial<ControlInput>) => { value.current = { ...value.current, ...patch }; onInput(value.current); };
  const reset = () => { stickPointer.current = null; setPosition({ x: 0, y: 0 }); emit({ x: 0, y: 0, dash: false }); };
  useEffect(() => {
    const neutralize = () => { value.current = { ...value.current, x: 0, y: 0, dash: false }; onInput(value.current); setPosition({ x: 0, y: 0 }); stickPointer.current = null; };
    window.addEventListener("blur", neutralize); document.addEventListener("visibilitychange", neutralize);
    return () => { window.removeEventListener("blur", neutralize); document.removeEventListener("visibilitychange", neutralize); };
  }, [onInput]);
  useEffect(() => {
    if (!disabled) return;
    value.current = { ...value.current, x: 0, y: 0, dash: false };
    onInput(value.current); stickPointer.current = null;
    const frame = requestAnimationFrame(() => setPosition({ x: 0, y: 0 }));
    return () => cancelAnimationFrame(frame);
  }, [disabled, onInput]);
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || stickPointer.current !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect(); const radius = bounds.width * .35;
    let x = (event.clientX - bounds.left - bounds.width / 2) / radius;
    let y = (event.clientY - bounds.top - bounds.height / 2) / radius;
    const magnitude = Math.hypot(x, y); if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    setPosition({ x, y }); emit({ x: Math.abs(x) < .1 ? 0 : x, y: Math.abs(y) < .1 ? 0 : y });
  };
  return <div className={styles.controls} aria-label="Phone controller">
    <div className={styles.stickColumn}>
      <div role="application" aria-label="Movement joystick" className={`${styles.joystick} ${disabled ? styles.disabled : ""}`}
        onPointerDown={event => { if (disabled || stickPointer.current !== null) return; event.preventDefault(); stickPointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event); }}
        onPointerMove={move} onPointerUp={reset} onPointerCancel={reset} onLostPointerCapture={() => { if (stickPointer.current !== null) reset(); }}>
        <span className={styles.stickCross}>+</span><span className={styles.stickThumb} style={{ transform: `translate(${position.x * 60}%, ${position.y * 60}%)` }} />
      </div><span className={styles.controlCaption}>MOVE / AIM</span>
    </div>
    <div className={styles.actionColumn}>
      <button className={styles.throwButton} disabled={disabled} onPointerDown={event => { event.preventDefault(); emit({ throwSeq: value.current.throwSeq + 1 }); if (navigator.vibrate) navigator.vibrate(12); }} onClick={event => { if (event.detail === 0) emit({ throwSeq: value.current.throwSeq + 1 }); }}><span>⌁</span>SHOVE<small>bump nearby</small></button>
      <button className={styles.dashButton} disabled={disabled} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); emit({ dash: true }); }} onPointerUp={() => emit({ dash: false })} onPointerCancel={() => emit({ dash: false })} onLostPointerCapture={() => emit({ dash: false })} onClick={event => { if (event.detail === 0) { emit({ dash: true }); setTimeout(() => emit({ dash: false }), 100); } }}>DASH <span>↗</span></button>
    </div>
  </div>;
}
