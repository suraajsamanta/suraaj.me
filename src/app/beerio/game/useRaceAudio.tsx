'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getRaceAudioContext, RaceAudio, unlockRaceAudio } from './audio';
import type { RaceState } from './simulation';
import styles from './audio.module.css';

/** Context creation is primed by Start/Practice clicks; the fallback button also unlocks it. */
export function useRaceAudio({ paused = false }: { paused?: boolean } = {}) {
  const pausedRef = useRef(paused);
  const audioRef = useRef<RaceAudio | null>(null);
  const mutedRef = useRef(false);
  const mountedRef = useRef(false);
  const [sound, setSound] = useState<'locked' | 'on' | 'off' | 'unavailable'>('locked');
  const activate = useCallback(async () => {
    if (!mountedRef.current) return false;
    if (!await unlockRaceAudio() || !mountedRef.current) return false;
    const context = getRaceAudioContext();
    if (!context) return false;
    try {
      if (!audioRef.current) audioRef.current = new RaceAudio(context);
      audioRef.current.setMuted(mutedRef.current);
      audioRef.current.setPaused(document.hidden || pausedRef.current);
    } catch {
      audioRef.current?.dispose(); audioRef.current = null; setSound('unavailable'); return false;
    }
    setSound(mutedRef.current ? 'off' : 'on');
    return true;
  }, []);
  useEffect(() => {
    pausedRef.current = paused; audioRef.current?.setPaused(paused || document.hidden);
  }, [paused]);
  useEffect(() => {
    mountedRef.current = true;
    try { mutedRef.current = window.localStorage.getItem('beerio.sound-muted') === 'true'; } catch { /* Private browsing can disable storage. */ }
    const context = getRaceAudioContext();
    if (context?.state === 'running') queueMicrotask(() => { void activate(); });
    const gesture = () => { if (!audioRef.current || getRaceAudioContext()?.state !== 'running') void activate(); };
    const visibility = () => { audioRef.current?.setPaused(document.hidden || pausedRef.current); };
    const contextReady = () => { if (context?.state === 'running' && !audioRef.current) void activate(); };
    context?.addEventListener('statechange', contextReady);
    window.addEventListener('pointerdown', gesture); window.addEventListener('keydown', gesture);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mountedRef.current = false; audioRef.current?.dispose(); audioRef.current = null;
      window.removeEventListener('pointerdown', gesture); window.removeEventListener('keydown', gesture);
      document.removeEventListener('visibilitychange', visibility);
      context?.removeEventListener('statechange', contextReady);
    };
  }, [activate]);
  const updateAudio = useCallback((race: RaceState) => {
    try { audioRef.current?.update(race); } catch {
      audioRef.current?.dispose(); audioRef.current = null;
      if (mountedRef.current) setSound('unavailable');
    }
  }, []);
  const toggle = async () => {
    if (sound === 'locked' || sound === 'unavailable') {
      mutedRef.current = false;
      if (!await activate()) { if (mountedRef.current) setSound('unavailable'); return; }
    } else {
      mutedRef.current = !mutedRef.current;
      audioRef.current?.setMuted(mutedRef.current);
      if (!mutedRef.current) await activate();
      if (mountedRef.current) setSound(mutedRef.current ? 'off' : 'on');
    }
    try { window.localStorage.setItem('beerio.sound-muted', String(mutedRef.current)); } catch { /* Optional preference. */ }
  };
  const enabled = sound === 'on';
  const soundControls = <button type="button" className={styles.sound} onClick={() => void toggle()} aria-pressed={enabled}
    aria-label={enabled ? 'Mute race music and sound effects' : 'Enable race music and sound effects'} title={sound === 'unavailable' ? 'Sound is unavailable in this browser. Tap to retry.' : 'Original race music, engine, and arcade sound effects'}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 4 5 9H2v6h3l6 5V4Z" />{enabled ? <><path d="M15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16" /></> : <path d="m16 9 6 6m0-6-6 6" />}</svg>
    <span>{enabled ? 'SOUND ON' : sound === 'off' ? 'SOUND OFF' : sound === 'unavailable' ? 'RETRY SOUND' : 'ENABLE SOUND'}</span>
  </button>;
  return { audioRef, updateAudio, soundControls };
}
