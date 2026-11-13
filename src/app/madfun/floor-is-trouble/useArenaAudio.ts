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
  const previous = useRef({ state: null as ArenaState | null, phase: "", count: 0, wave: 0, dropped: 0 });
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
    if (before.state !== state) { before.state = state; before.phase = ""; before.count = 0; before.wave = 0; before.dropped = 0; }
    const count = state.phase === "countdown" ? Math.max(1, Math.ceil(state.phaseTime)) : 0;
    if (count && count !== before.count) tone(640, 580, .1, 0, "sine", .17);
    if (state.phase === "playing" && before.phase === "countdown") { tone(660, 660, .18); tone(990, 990, .26, .08); }
    if (state.phase === "roundOver" && before.phase !== "roundOver") { [523,659,784].forEach((note,index) => tone(note,note,.2,index*.09,"triangle",.13)); }
    if (state.phase === "matchOver" && before.phase !== "matchOver") { [523,659,784,1046].forEach((note,index) => tone(note,note,.35,index*.13,"triangle",.13)); }
    before.phase = state.phase; before.count = count;
    const dropped=state.floor.tiles.filter(tile=>tile===2).length;
    if(state.phase==="playing"){
      if(state.floor.wave>before.wave)tone(440,760,.17,0,"triangle",.09);
      if(dropped>before.dropped)tone(170,50,.23,0,"triangle",.17);
    }
    before.wave=state.floor.wave;before.dropped=dropped;
  }, [tone]);
  useEffect(() => () => { void context.current?.close().catch(() => {}); }, []);
  return { unlock, toggle, update, muted };
}
