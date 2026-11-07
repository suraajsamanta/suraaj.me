import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { audioSnapshot, noteFrequency, RaceAudio, soundEvents } from './audio';
import { RaceRenderer, parseColor, racerGeometry, dancerGeometry } from './renderer';
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
  previous = audioSnapshot(race); race.karts[0].power.dance = 3.5; race.karts[0].power.used++;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), ['item', 'dance']);
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
  const stats = { vertices: 0, viewports: 0, draws: 0, uploads: 0, nonFinite: false };
  const numeric = (values: ArrayLike<number>) => { for (let i = 0; i < values.length; i++) if (!Number.isFinite(values[i])) stats.nonFinite = true; };
  const gl = new Proxy({
    createBuffer() { const buffer = { id: identity++ }; buffers.add(buffer); return buffer; },
    deleteBuffer(buffer: object) { buffers.delete(buffer); },
    createProgram() { const program = { id: identity++ }; programs.add(program); return program; },
    deleteProgram(program: object) { programs.delete(program); },
    createShader() { return {}; }, getShaderParameter() { return true; }, getProgramParameter() { return true; },
    getAttribLocation(_program: object, name: string) { return name === 'a_color' ? 1 : 0; }, getUniformLocation() { return {}; },
    bufferData(_target: number, data: Float32Array) { stats.uploads++; stats.vertices += data.length / 6; numeric(data); },
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
    race.karts[0].power.shield = 6; race.karts[1].power.flash = 0.5; race.karts[2].power.dance = 2.1;
    race.powers.hazards.push({ id: 1, ownerId: '0', distance: 20, lane: -2, life: 8 });
    race.powers.projectiles.push({ id: 2, ownerId: '0', distance: 25, lane: 2, life: 3 });
    renderer.render(race, 1 / 60);
    assert.equal(stats.viewports, 6); assert.ok(stats.draws > 30); assert.ok(stats.vertices > 10000);
    assert.equal(stats.nonFinite, false); assert.ok(canvas.width <= 1800);
    renderer.dispose(); assert.equal(buffers.size, 0); assert.equal(programs.size, 0);
  } finally { Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true, writable: true }); }
});

test('overtaken racers and their shields remain rendered throughout the chase-camera gap', () => {
  const { gl, stats } = fakeWebGL();
  const canvas = { width: 0, height: 0, getContext: () => gl, getBoundingClientRect: () => ({ width: 1280, height: 720 }) } as unknown as HTMLCanvasElement;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', { value: { devicePixelRatio: 1 }, configurable: true, writable: true });
  try {
    const players = [player, { ...player, id: 'opponent', color: '#39cbb4' }];
    const race = createRace(players), renderer = new RaceRenderer(canvas, players, race);
    race.powers.boxes = [];
    race.karts.forEach(kart => { kart.power.shield = 5; });
    // Cross the old 2.4m disappearing boundary, move close to and behind the
    // camera, and cross the lap seam. Both viewports still submit both karts.
    for (const distance of [100, TRACK_LENGTH + 1]) {
      race.karts[0].distance = distance;
      for (const gap of [2.3, 0, -2.3, -2.5, -5, -10, -17.9, -18.1]) {
        race.karts[1].distance = distance + gap;
        const draws = stats.draws;
        renderer.render(race, 1 / 60);
        assert.equal(stats.draws - draws, 16, `every kart, shadow and shield should be submitted at gap ${gap}`);
      }
    }
    renderer.dispose();
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

const characters = ['fox', 'robot', 'frog', 'cat', 'alien', 'bear', 'bird', 'blob'];
const vehicles = ['kart', 'buggy', 'roadster', 'motorcycle'];
test('all 32 original racer and vehicle combinations are distinct, finite and low-poly', () => {
  const signatures = new Set<string>();
  for (const character of characters) for (const vehicle of vehicles) {
    const mesh = racerGeometry([1, 0.25, 0.5], character, vehicle);
    assert.ok(mesh.data.every(Number.isFinite), `${character}/${vehicle} has finite geometry`);
    assert.equal(mesh.data.length % 18, 0, 'complete triangles with interleaved color');
    assert.ok(mesh.data.length / 6 <= 6400, 'combined driver and vehicle stays within six-view geometry budget');
    signatures.add(JSON.stringify(mesh.data));
    const withoutDriver = racerGeometry([1, 0.25, 0.5], character, vehicle, false);
    assert.ok(withoutDriver.data.length < mesh.data.length, 'dancing leaves the selected ride empty');
    assert.deepEqual(withoutDriver.data, racerGeometry([1, 0.25, 0.5], 'robot', vehicle, false).data, 'empty ride has no leftover character geometry');
  }
  assert.equal(signatures.size, 32, 'every chosen character and ride produces its own model');
  assert.deepEqual(racerGeometry([1, 0.25, 0.5], 'unknown', 'unknown').data, racerGeometry([1, 0.25, 0.5], 'fox', 'kart').data);
  assert.deepEqual(racerGeometry([1, 0.25, 0.5], '__proto__', 'toString').data, racerGeometry([1, 0.25, 0.5], 'fox', 'kart').data);
});
test('every cartoon racer keeps a distinct identity and selected palette in eight dance poses', () => {
  const identities = new Set<string>();
  for (const character of characters) {
    const poses = Array.from({ length: 8 }, (_, frame) => dancerGeometry([0.2, 0.8, 1], frame * Math.PI / 4, character));
    assert.equal(new Set(poses.map(pose => JSON.stringify(pose.data))).size, 8, 'each pose has motion');
    assert.ok(poses.every(pose => pose.data.every(Number.isFinite) && pose.data.length / 6 <= 4000));
    identities.add(JSON.stringify(poses[0].data));
    assert.notDeepEqual(poses[0].data, dancerGeometry([1, 0.2, 0.3], 0, character).data, 'outfit follows the selected color');
  }
  assert.equal(identities.size, 8);
});
test('mixed six-player appearances and repeated dance transitions never upload geometry per frame', () => {
  const { gl, stats, buffers, programs } = fakeWebGL();
  const canvas = { width: 0, height: 0, getContext: () => gl, getBoundingClientRect: () => ({ width: 1440, height: 900 }) } as unknown as HTMLCanvasElement;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', { value: { devicePixelRatio: 2 }, configurable: true, writable: true });
  try {
    const players = characters.slice(0, 6).map((character, i) => ({ ...player, id: String(i), character, vehicle: vehicles[i % 4], color: ['#ff5c5c', '#50baf8', '#92db57', '#b88bff', '#ffd25f', '#ff8dc4'][i] }));
    const race = createRace(players), renderer = new RaceRenderer(canvas, players, race);
    const uploads = stats.uploads, vertices = stats.vertices;
    for (const remaining of [3.5, 3.3, 2, 0.15, 0, 3.5, 0]) {
      race.karts.forEach((kart, i) => { kart.power.dance = remaining; kart.power.shield = i % 2 ? 5 : 0; kart.heading = i * 0.1; });
      renderer.render(race, 1 / 60);
    }
    assert.equal(stats.viewports, 42); assert.equal(stats.uploads, uploads); assert.equal(stats.vertices, vertices);
    assert.equal(stats.nonFinite, false); renderer.dispose();
    assert.equal(buffers.size, 0); assert.equal(programs.size, 0);
  } finally { Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true, writable: true }); }
});
