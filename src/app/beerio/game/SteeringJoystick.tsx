"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./steering-joystick.module.css";

const DEAD_ZONE = 0.08;
const KNOB_DIAMETER = 68;

/** A spring-centered, horizontal analog stick. Only the owning finger can move it. */
export default function SteeringJoystick({ onSteer }: { onSteer: (value: number) => void }) {
  const callback = useRef(onSteer);
  useEffect(() => { callback.current = onSteer; }, [onSteer]);
  const pointer = useRef<number | null>(null);
  const keys = useRef(new Set<string>());
  const [value, setValue] = useState(0);

  function change(next: number) {
    setValue(next);
    callback.current(next);
  }

  useEffect(() => {
    const heldKeys = keys.current;
    const reset = () => {
      pointer.current = null;
      keys.current.clear();
      setValue(0);
      callback.current(0);
    };
    window.addEventListener("blur", reset);
    window.addEventListener("pagehide", reset);
    window.addEventListener("orientationchange", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("blur", reset);
      window.removeEventListener("pagehide", reset);
      window.removeEventListener("orientationchange", reset);
      document.removeEventListener("visibilitychange", reset);
      pointer.current = null;
      heldKeys.clear();
      callback.current(0);
    };
  }, []);

  const move = (clientX: number, element: HTMLDivElement) => {
    const box = element.getBoundingClientRect();
    const radius = Math.max(1, (box.width - KNOB_DIAMETER) / 2);
    const raw = Math.max(-1, Math.min(1, (clientX - (box.left + box.width / 2)) / radius));
    const magnitude = Math.max(0, (Math.abs(raw) - DEAD_ZONE) / (1 - DEAD_ZONE));
    change(Math.sign(raw) * magnitude || 0);
  };
  const release = (id: number) => {
    if (pointer.current !== id) return;
    pointer.current = null;
    change(0);
  };
  const keyboardValue = () => Number(keys.current.has("ArrowRight")) - Number(keys.current.has("ArrowLeft"));

  return <div className={styles.joystick} role="slider" tabIndex={0}
    aria-label="Steering joystick" aria-valuemin={-100} aria-valuemax={100}
    aria-valuenow={Math.round(value * 100)}
    aria-valuetext={value === 0 ? "Centered" : `${Math.round(Math.abs(value) * 100)}% ${value < 0 ? "left" : "right"}`}
    aria-describedby="steering-joystick-help"
    style={{ "--steer": value } as CSSProperties}
    onPointerDown={(event) => {
      if (pointer.current !== null || event.button !== 0) return;
      event.preventDefault();
      keys.current.clear();
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      move(event.clientX, event.currentTarget);
    }}
    onPointerMove={(event) => { if (pointer.current === event.pointerId) move(event.clientX, event.currentTarget); }}
    onPointerUp={(event) => release(event.pointerId)}
    onPointerCancel={(event) => release(event.pointerId)}
    onLostPointerCapture={(event) => release(event.pointerId)}
    onKeyDown={(event) => {
      if ((event.key !== "ArrowLeft" && event.key !== "ArrowRight") || pointer.current !== null) return;
      event.preventDefault();
      keys.current.add(event.key);
      change(keyboardValue());
    }}
    onKeyUp={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      if (keys.current.delete(event.key) && pointer.current === null) change(keyboardValue());
    }}
    onBlur={() => { if (keys.current.size) { keys.current.clear(); if (pointer.current === null) change(0); } }}
    onContextMenu={(event) => event.preventDefault()}>
    <span id="steering-joystick-help" className={styles.srOnly}>Drag left or right to steer. Release to center. With a keyboard, hold the left or right arrow key.</span>
    <span className={styles.track} aria-hidden="true"><span>◀</span><span>STEER</span><span>▶</span></span>
    <span className={styles.knob} aria-hidden="true"><span>↔</span></span>
  </div>;
}
