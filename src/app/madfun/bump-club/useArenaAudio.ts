"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArenaState } from "./engine";

/** Original, short arcade cues. No looping oscillator or background drone. */
export function useArenaAudio() {
  const context = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const voices = useRef(0);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const previous = useRef({ state: null as ArenaState | null, phase: "", count: 0, effectId: 0, lastAction: 0 });
  const unlock = useCallback(() => {
    try {
      const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return;
      if (!context.current || context.current.state === "closed") {
        context.current = new Constructor(); master.current = context.current.createGain();
        master.current.gain.value = mutedRef.current ? 0 : .35;
        master.current.connect(context.current.destination);
      }
      void context.current.resume().catch(() => {});
    } catch { /* Audio is optional; blocked browsers must remain playable. */ }
  }, []);
  const toggle = useCallback(() => {
    mutedRef.current = !mutedRef.current; setMuted(mutedRef.current);
    if (context.current && master.current) master.current.gain.setTargetAtTime(mutedRef.current ? 0 : .35, context.current.currentTime, .015);
    if (!mutedRef.current) unlock();
  }, [unlock]);
  const tone = useCallback((frequency: number, end: number, duration: number, delay = 0, type: OscillatorType = "sine", volume = .13) => {
    const ctx = context.current; const output = master.current;
    if (!ctx || !output || ctx.state !== "running" || mutedRef.current || voices.current >= 12) return;
    const oscillator = ctx.createOscillator(); const envelope = ctx.createGain(); const start = ctx.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start); oscillator.frequency.exponentialRampToValueAtTime(end, start + duration);
    envelope.gain.setValueAtTime(.0001, start); envelope.gain.exponentialRampToValueAtTime(volume, start + .008); envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(envelope); envelope.connect(output); voices.current++;
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); voices.current = Math.max(0, voices.current - 1); };
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }, []);
  const update = useCallback((state: ArenaState) => {
    const before = previous.current;
    if (before.state !== state) { before.state = state; before.phase = ""; before.count = 0; before.effectId = 0; }
    const count = state.phase === "countdown" ? Math.max(1, Math.ceil(state.phaseTime)) : 0;
    if (count && count !== before.count) tone(640, 580, .1, 0, "sine", .17);
    if (state.phase === "playing" && before.phase === "countdown") { tone(660, 660, .18); tone(990, 990, .26, .08); }
    if (state.phase === "roundOver" && before.phase !== "roundOver") { [523,659,784].forEach((note,index) => tone(note,note,.2,index*.09,"triangle",.13)); }
    if (state.phase === "matchOver" && before.phase !== "matchOver") { [523,659,784,1046].forEach((note,index) => tone(note,note,.35,index*.13,"triangle",.13)); }
    before.phase = state.phase; before.count = count;
    const effects = state.effects.filter(effect => effect.id > before.effectId);
    if (effects.length) before.effectId = Math.max(...effects.map(effect => effect.id));
    const now = performance.now();
    const hit = effects.find(effect => effect.kind === "hit");
    if (hit) { tone(180,55,.2,0,"triangle",.2); tone(390,180,.09,0,"sine",.1); before.lastAction = now; }
    else if (now - before.lastAction > 85) {
      const effect = effects.find(effect => effect.kind === "throw" || effect.kind === "dash" || effect.kind === "catch");
      if (effect) {
        if (effect.kind === "throw") tone(750,260,.12,0,"triangle",.09);
        if (effect.kind === "dash") tone(170,650,.11,0,"sine",.07);
        if (effect.kind === "catch") tone(1100,1500,.055,0,"sine",.055);
        before.lastAction = now;
      }
    }
  }, [tone]);
  useEffect(() => () => { void context.current?.close().catch(() => {}); }, []);
  return { unlock, toggle, update, muted };
}
