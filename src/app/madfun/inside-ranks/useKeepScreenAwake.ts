import { useEffect } from 'react';

// Browsers may release on visibility loss, power saving, or screen lock.
export function useKeepScreenAwake(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !navigator.wakeLock) return;
    let disposed = false;
    let requesting = false;
    let lock: WakeLockSentinel | undefined;
    const release = (sentinel?: WakeLockSentinel) => { void sentinel?.release().catch(() => {}); };
    const request = async () => {
      if (disposed || requesting || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      requesting = true;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (disposed || document.visibilityState !== 'visible') release(next);
        else lock = next;
      } catch {
        // Play still works if Safari or the OS declines. Retry on return or interaction.
      } finally {
        requesting = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
      else { release(lock); lock = undefined; }
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('pointerup', request, { passive: true });
    window.addEventListener('pageshow', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('pointerup', request);
      window.removeEventListener('pageshow', onVisible);
      release(lock);
    };
  }, [enabled]);
}
