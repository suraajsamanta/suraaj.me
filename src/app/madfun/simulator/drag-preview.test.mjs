import assert from 'node:assert/strict';
import test from 'node:test';
import { createDragPreviewStream } from './drag-preview.ts';

function fakeClock() {
  let now = 0;
  let next = 0;
  const queue = new Map();
  return {
    now: () => now,
    schedule(fn, delay) { queue.set(++next, { fn, at: now + delay }); return next; },
    cancel(id) { queue.delete(id); },
    advance(ms) {
      const end = now + ms;
      for (const [id, task] of queue) {
        if (task.at > end) continue;
        now = task.at;
        queue.delete(id);
        task.fn();
      }
      now = end;
    },
  };
}

test('a quick movement and stationary hold still stream the latest position before drop', () => {
  const clock = fakeClock();
  const samples = [];
  const stream = createDragPreviewStream((value) => samples.push(value), clock);
  stream.push(.08);
  assert.deepEqual(samples, [.08]);
  clock.advance(10);
  stream.push(.12);
  stream.push(.74);
  assert.deepEqual(samples, [.08]);
  clock.advance(62);
  assert.deepEqual(samples, [.08, .74]);
});

test('drop or cancellation discards an unsent moving frame', () => {
  const clock = fakeClock();
  const samples = [];
  const stream = createDragPreviewStream((value) => samples.push(value), clock);
  stream.push(.1);
  clock.advance(10);
  stream.push(.8);
  stream.cancel();
  clock.advance(500);
  assert.deepEqual(samples, [.1]);
});
