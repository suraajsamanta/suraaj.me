'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getRaceAudioContext, RaceAudio, unlockRaceAudio, type MusicStatus } from './audio';
import type { RaceState } from './simulation';
import styles from './audio.module.css';

type SoundStatus = 'locked' | 'on' | 'off' | 'suspended' | 'unavailable';
/** Context creation is primed by Start/Practice clicks; gestures can resume it.
 * One graph survives pauses/rematches, but never an unmounted host screen.
 */
export function useRaceAudio({ paused = false }: { paused?: boolean } = {}) {
  const pausedRef = useRef(paused);
  const audioRef = useRef<RaceAudio | null>(null);
  const mutedRef = useRef(false);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const contextRef = useRef<AudioContext | null>(null);
  const unbindRef = useRef<(() => void) | null>(null);
  const activationRef = useRef<((inGesture?: boolean) => Promise<boolean>) | null>(null);
  const attemptRef = useRef(0);
  const pendingRef = useRef<{ generation: number; promise: Promise<boolean> } | null>(null);
  const [sound, setSound] = useState<SoundStatus>('locked');
  const [music, setMusic] = useState<MusicStatus>('loading');
  const bindContext = useCallback((context: AudioContext) => {
    if (contextRef.current === context) return;
    unbindRef.current?.();
    if (contextRef.current) { audioRef.current?.dispose(); audioRef.current = null; }
    contextRef.current = context;
    const changed = () => {
      if (!mountedRef.current || contextRef.current !== context) return;
      const running = context.state === 'running';
      audioRef.current?.setPaused(!running || document.hidden || pausedRef.current);
      setSound(mutedRef.current ? 'off' : running && audioRef.current ? 'on' : 'suspended');
      if (running && !audioRef.current) void activationRef.current?.();
      if (context.state === 'closed') { audioRef.current?.dispose(); audioRef.current = null; }
    };
    context.addEventListener('statechange', changed);
    unbindRef.current = () => context.removeEventListener('statechange', changed);
  }, []);
  const activate = useCallback((inGesture = false): Promise<boolean> => {
    if (!mountedRef.current) return Promise.resolve(false);
    const generation = generationRef.current;
    // Browsers may leave an automatic resume pending until a user gesture.
    // A real gesture must call resume again, rather than reuse that promise.
    if (!inGesture && pendingRef.current?.generation === generation) return pendingRef.current.promise;
    const attempt = ++attemptRef.current;
    const promise = (async () => {
      const unlocked = await unlockRaceAudio();
      if (!mountedRef.current || generation !== generationRef.current || attempt !== attemptRef.current) return false;
      const context = getRaceAudioContext();
      if (context) bindContext(context);
      if (!unlocked || !context || context.state !== 'running') {
        setSound(mutedRef.current ? 'off' : context ? 'suspended' : 'unavailable'); return false;
      }
      try {
        if (!audioRef.current) audioRef.current = new RaceAudio(context, {
          onMusicStatus: status => { if (mountedRef.current && generation === generationRef.current) setMusic(status); },
        });
        audioRef.current.setMuted(mutedRef.current);
        audioRef.current.setPaused(document.hidden || pausedRef.current);
      } catch {
        audioRef.current?.dispose(); audioRef.current = null; setSound('unavailable'); return false;
      }
      setSound(mutedRef.current ? 'off' : 'on');
      return true;
    })();
    pendingRef.current = { generation, promise };
    void promise.finally(() => { if (pendingRef.current?.promise === promise) pendingRef.current = null; });
    return promise;
  }, [bindContext]);
  useEffect(() => { activationRef.current = activate; return () => { activationRef.current = null; }; }, [activate]);
  useEffect(() => {
    pausedRef.current = paused;
    audioRef.current?.setPaused(paused || document.hidden || contextRef.current?.state !== 'running');
  }, [paused]);
  useEffect(() => {
    mountedRef.current = true;
    const generation = ++generationRef.current;
    try { mutedRef.current = window.localStorage.getItem('beerio.sound-muted') === 'true'; } catch { /* Storage is optional. */ }
    const context = getRaceAudioContext();
    if (context) bindContext(context);
    queueMicrotask(() => {
      if (!mountedRef.current || generation !== generationRef.current) return;
      if (context?.state === 'running') void activate();
      else if (mutedRef.current) setSound('off');
    });
    const gesture = () => {
      if (!mutedRef.current && (!audioRef.current || getRaceAudioContext()?.state !== 'running')) void activate(true);
    };
    const visibility = () => {
      const context = getRaceAudioContext();
      audioRef.current?.setPaused(document.hidden || pausedRef.current || context?.state !== 'running');
      // Best-effort recovery needs no permissions. Safari may require a fresh
      // gesture; keep the control at RESUME SOUND if this resume is rejected.
      if (!document.hidden && !mutedRef.current && context && context.state !== 'running') void activate();
    };
    const hide = () => audioRef.current?.setPaused(true);
    window.addEventListener('pointerdown', gesture); window.addEventListener('keydown', gesture);
    window.addEventListener('pagehide', hide); window.addEventListener('pageshow', visibility);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mountedRef.current = false; generationRef.current = generation + 1;
      audioRef.current?.dispose(); audioRef.current = null;
      unbindRef.current?.(); unbindRef.current = null; contextRef.current = null;
      window.removeEventListener('pointerdown', gesture); window.removeEventListener('keydown', gesture);
      window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', visibility);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [activate, bindContext]);
  const updateAudio = useCallback((race: RaceState) => {
    try { audioRef.current?.update(race); } catch {
      audioRef.current?.dispose(); audioRef.current = null;
      if (mountedRef.current) setSound('unavailable');
    }
  }, []);
  const toggle = async () => {
    if (sound === 'on') {
      mutedRef.current = true; audioRef.current?.setMuted(true); setSound('off');
    } else {
      mutedRef.current = false;
      await activate(true);
    }
    try { window.localStorage.setItem('beerio.sound-muted', String(mutedRef.current)); } catch { /* Optional preference. */ }
  };
  const enabled = sound === 'on';
  const label = enabled ? (music === 'unavailable' ? 'EFFECTS ON' : 'SOUND ON') : sound === 'off' ? 'SOUND OFF' : sound === 'suspended' ? 'RESUME SOUND' : sound === 'unavailable' ? 'RETRY SOUND' : 'ENABLE SOUND';
  const soundControls = <div className={styles.controls}>
    <button type="button" className={styles.sound} onClick={() => void toggle()} aria-pressed={enabled}
      aria-label={enabled ? 'Mute race music and sound effects' : 'Enable race music and sound effects'}
      title={sound === 'unavailable' ? 'Sound is unavailable in this browser. Tap to retry.' : sound === 'suspended' ? 'Your browser paused audio. Tap to resume.' : 'Original music, soft engine, and arcade sound effects'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 4 5 9H2v6h3l6 5V4Z" />{enabled ? <path d="M15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16" /> : <path d="m16 9 6 6m0-6-6 6" />}</svg>
      <span>{label}</span>
    </button>
    {enabled && music === 'unavailable' && <button type="button" className={styles.retry} onClick={() => audioRef.current?.retryMusic()} title="The music could not load. Sound effects still work.">Retry music</button>}
  </div>;
  return { audioRef, updateAudio, soundControls };
}
