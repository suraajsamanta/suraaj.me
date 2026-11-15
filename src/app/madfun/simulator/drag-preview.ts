// Leading and trailing updates: a single quick move followed by a stationary
// hold still reaches the display without waiting for the next move or drop.
export function createDragPreviewStream<T>(send: (sample: T) => void, clock = {
  now: () => performance.now(),
  schedule: (callback: () => void, delay: number) => window.setTimeout(callback, delay),
  cancel: (timer: number) => window.clearTimeout(timer),
}) {
  const interval = 72;
  let last = -Infinity;
  let pending: { sample: T } | null = null;
  let timer: number | null = null;
  const flush = () => {
    if (timer !== null) clock.cancel(timer);
    timer = null;
    if (!pending) return;
    const { sample } = pending;
    pending = null;
    last = clock.now();
    send(sample);
  };
  return {
    push(sample: T) {
      pending = { sample };
      const wait = interval - (clock.now() - last);
      if (wait <= 0) flush();
      else if (timer === null) timer = clock.schedule(flush, wait);
    },
    cancel() {
      if (timer !== null) clock.cancel(timer);
      timer = null;
      pending = null;
    },
  };
}
