'use client';

import { useEffect, useRef } from 'react';
import { createActivityTracker, type ActivityGame, type ActivityEvent } from './activity';

type Seat = { id: string; connected: boolean };
type Phase = 'lobby'|'playing'|'finished';

function privacyOptOut() {
  return (navigator as Navigator & {globalPrivacyControl?: boolean}).globalPrivacyControl === true ||
    navigator.doNotTrack === '1' || (window as Window & {doNotTrack?: string}).doNotTrack === '1';
}

function send(event: ActivityEvent) {
  if (privacyOptOut()) return;
  // Observation is deliberately best-effort and can't block or break gameplay.
  void fetch('/api/analytics/activity', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', keepalive: true, body: JSON.stringify(event),
  }).catch(() => {});
}

export function useMadfunActivity(
  game: ActivityGame, host: boolean, room: string | null, online: boolean,
  phase: Phase, seats?: readonly Seat[], matchKey?: number, playingIds?: readonly string[],
) {
  const tracker = useRef<ReturnType<typeof createActivityTracker> | null>(null);
  const disposal = useRef<number | undefined>(undefined);
  // Client navigation does not fire pagehide. Defer cleanup so React's
  // development effect replay can cancel it rather than ending a live match.
  useEffect(() => {
    window.clearTimeout(disposal.current);
    return () => {
      const t = tracker.current;
      if (!t) return;
      const now = performance.now();
      disposal.current = window.setTimeout(() => {
        t.heartbeat(now);
        t.abandon(now);
      }, 0);
    };
  }, []);
  // Arena frames arrive frequently while the exact connected roster is stable.
  const roster = JSON.stringify(host ? seats?.filter(seat => seat.connected).map(seat => seat.id).sort() ?? [] : []);
  const playing = host && playingIds ? JSON.stringify([...playingIds].sort()) : null;
  useEffect(() => {
    let t = tracker.current;
    if (!t) {
      if (!host || !room || privacyOptOut() || !globalThis.crypto?.randomUUID) return;
      t = createActivityTracker(game, () => globalThis.crypto.randomUUID(), send);
      tracker.current = t;
    }
    t.observe({ host, room, online, phase, matchKey, players: JSON.parse(roster) as string[], playingPlayers: playing ? JSON.parse(playing) as string[] : undefined }, performance.now());
  }, [game, host, room, online, phase, matchKey, roster, playing]);
  useEffect(() => {
    if (!host || !room || phase !== 'playing') return;
    const timer = window.setInterval(() => tracker.current?.heartbeat(performance.now()), 10_000);
    const onHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      tracker.current?.heartbeat(performance.now());
      tracker.current?.abandon(performance.now());
    };
    window.addEventListener('pagehide', onHide);
    return () => { window.clearInterval(timer); window.removeEventListener('pagehide', onHide); };
  }, [host, room, phase]);
}
