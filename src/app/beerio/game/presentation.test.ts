import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { audioSnapshot, noteFrequency, RaceAudio, soundEvents } from './audio';
import { RaceRenderer, parseColor } from './renderer';
import { createRace, type GamePlayer } from './simulation';
import { selectTrack, TRACKS, TRACK_LENGTH } from './track';

const player: GamePlayer = { id: 'racer', name: 'Racer', color: '#ffcb55', input: { steer: 0, accelerate: true, brake: false } };
test('original sound cues trigger once on transitions, not every frame', () => {
  const race = createRace([player]);
  let previous = audioSnapshot(race);
  assert.deepEqual(soundEvents(null, previous), ['countdown']);
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), []);
  race.countdown = 2;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), ['countdown']);
  previous = audioSnapshot(race); race.countdown = 0;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), ['go']);
  previous = audioSnapshot(race); race.karts[0].boost = 1.8; race.karts[0].bump = 0.2;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)).sort(), ['boost', 'bump']);
  previous = audioSnapshot(race);
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), []);
  race.karts[0].distance = TRACK_LENGTH + 1;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), ['lap']);
  previous = audioSnapshot(race); race.karts[0].finishTime = 40; race.complete = true;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), ['finish']);
  assert.deepEqual(soundEvents(audioSnapshot(race), audioSnapshot(race)), []);
});
test('power-up cues are edge-triggered and shield expiry is silent', () => {
  const race = createRace([player]);
  let previous = audioSnapshot(race);
  race.karts[0].power.collected++;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), ['pickup']);
  previous = audioSnapshot(race); race.karts[0].power.used++; race.karts[0].power.shield = 8;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), ['item']);
  previous = audioSnapshot(race); race.karts[0].power.shield = 0;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), []);
  race.karts[0].power.shield = 8; previous = audioSnapshot(race);
  race.karts[0].power.shield = 0; race.karts[0].power.flash = 0.55;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), ['shield']);
  assert.deepEqual(soundEvents(audioSnapshot(race), audioSnapshot(race)), []);
});
test('pitched synth notes are tuned and invalid kart colors safely fall back', () => {
  assert.equal(noteFrequency(69), 440); assert.equal(noteFrequency(81), 880);
  assert.deepEqual(parseColor('#fff'), [1, 1, 1]); assert.deepEqual(parseColor('nope'), [0.96, 0.63, 0.24]);
});

function fakeAudioContext() {
  const sources: Array<{ stop: (at?: number) => void; stopped: boolean; disconnected: boolean; onended: (() => void) | null }> = [];
  const gains: { value: number; target: number }[] = [];
  const parameter = () => ({ value: 0, target: 0, cancelScheduledValues() {}, setValueAtTime(value: number) { this.value = value; }, setTargetAtTime(value: number) { this.target = value; }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, });
  const source = () => {
    const result = { ...node(), frequency: parameter(), detune: parameter(), stopped: false, disconnected: false, onended: null as (() => void) | null,
      start() {}, stop(at = 0) { if (at <= context.currentTime) { this.stopped = true; this.onended?.(); } }, disconnect() { this.disconnected = true; } };
    sources.push(result); return result;
  };
  const context = { currentTime: 1, state: 'running', sampleRate: 8000, destination: node(),
    createGain() { const gain = parameter(); gains.push(gain); return { ...node(), gain }; },
    createOscillator: source, createBufferSource: source,
    createBiquadFilter() { return { ...node(), frequency: parameter(), Q: parameter() }; },
    createDynamicsCompressor() { return { ...node(), threshold: parameter(), ratio: parameter() }; },
    createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; },
  };
  return { context: context as unknown as AudioContext, sources, gains };
}
test('audio mute, pause and disposal silence the mix and release every source', () => {
  const { context, sources, gains } = fakeAudioContext(), audio = new RaceAudio(context);
  const race = createRace([player]);
  audio.update(race); assert.ok(sources.length > 3); assert.equal(gains[0].target, 0.62);
  audio.setMuted(true); assert.equal(gains[0].target, 0);
  const mutedCount = sources.length; race.countdown = 0; audio.update(race);
  assert.equal(sources.length, mutedCount, 'no music/effects are allocated while muted');
  audio.setMuted(false); audio.setPaused(true); assert.equal(gains[0].target, 0);
  const pausedCount = sources.length; audio.update(race); assert.equal(sources.length, pausedCount);
  audio.setPaused(false); audio.update(race); assert.ok(sources.length > pausedCount);
  audio.dispose(); audio.dispose();
  assert.equal(gains[0].value, 0); assert.ok(sources.every(source => source.stopped && source.disconnected));
  const disposedCount = sources.length; audio.update(race); assert.equal(sources.length, disposedCount);
});
test('restarting races reuses one audio graph rather than accumulating motors', () => {
  const { context, sources } = fakeAudioContext(), audio = new RaceAudio(context);
  const race = createRace([player]); race.countdown = 0; race.elapsed = 15; audio.update(race);
  const count = sources.length;
  audio.setMuted(true); audio.update(createRace([player]));
  assert.equal(sources.length, count);
  audio.dispose(); assert.ok(sources.every(source => source.stopped));
});

function fakeWebGL() {
  let identity = 0;
  const buffers = new Set<object>(), programs = new Set<object>();
  const stats = { vertices: 0, viewports: 0, draws: 0, nonFinite: false };
  const numeric = (values: ArrayLike<number>) => { for (let i = 0; i < values.length; i++) if (!Number.isFinite(values[i])) stats.nonFinite = true; };
  const gl = new Proxy({
    createBuffer() { const buffer = { id: identity++ }; buffers.add(buffer); return buffer; },
    deleteBuffer(buffer: object) { buffers.delete(buffer); },
    createProgram() { const program = { id: identity++ }; programs.add(program); return program; },
    deleteProgram(program: object) { programs.delete(program); },
    createShader() { return {}; }, getShaderParameter() { return true; }, getProgramParameter() { return true; },
    getAttribLocation(_program: object, name: string) { return name === 'a_color' ? 1 : 0; }, getUniformLocation() { return {}; },
    bufferData(_target: number, data: Float32Array) { stats.vertices += data.length / 6; numeric(data); },
    uniformMatrix4fv(_location: object, _transpose: boolean, data: Float32Array) { numeric(data); },
    uniform3fv(_location: object, data: number[]) { numeric(data); },
    viewport() { stats.viewports++; }, drawArrays() { stats.draws++; },
  }, { get(target, key) { if (key in target) return target[key as keyof typeof target]; return /^[A-Z_]+$/.test(String(key)) ? 0 : () => {}; } });
  return { gl, buffers, programs, stats };
}
test('six-view renderer builds finite geometry, draws every viewport and frees GPU resources', () => {
  const { gl, buffers, programs, stats } = fakeWebGL();
  const canvas = { width: 0, height: 0, getContext: () => gl, getBoundingClientRect: () => ({ width: 1440, height: 900 }) } as unknown as HTMLCanvasElement;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', { value: { devicePixelRatio: 2 }, configurable: true, writable: true });
  try {
    const players = Array.from({ length: 6 }, (_, i) => ({ ...player, id: String(i) }));
    const race = createRace(players), renderer = new RaceRenderer(canvas, players, race);
    race.karts[0].boost = 1; race.karts[1].bump = 0.2; race.karts[2].lane = 8; race.karts[2].speed = 25;
    race.karts[0].power.shield = 6; race.karts[1].power.flash = 0.5;
    race.powers.hazards.push({ id: 1, ownerId: '0', distance: 20, lane: -2, life: 8 });
    race.powers.projectiles.push({ id: 2, ownerId: '0', distance: 25, lane: 2, life: 3 });
    renderer.render(race, 1 / 60);
    assert.equal(stats.viewports, 6); assert.ok(stats.draws > 30); assert.ok(stats.vertices > 10000);
    assert.equal(stats.nonFinite, false); assert.ok(canvas.width <= 1800);
    renderer.dispose(); assert.equal(buffers.size, 0); assert.equal(programs.size, 0);
  } finally { Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true, writable: true }); }
});

test('all selectable circuits build finite road, scenery and hazard geometry', () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', { value: { devicePixelRatio: 1 }, configurable: true, writable: true });
  try {
    for (const track of TRACKS) {
      selectTrack(track.id);
      const { gl, stats, buffers, programs } = fakeWebGL();
      const canvas = { width: 0, height: 0, getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 600 }) } as unknown as HTMLCanvasElement;
      const race = createRace([player]), renderer = new RaceRenderer(canvas, [player], race);
      renderer.render(race, 1 / 60); assert.equal(stats.nonFinite, false, track.name);
      assert.equal(stats.viewports, 1); renderer.dispose();
      assert.equal(buffers.size, 0); assert.equal(programs.size, 0);
    }
  } finally { selectTrack('sunset'); Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true, writable: true }); }
});
