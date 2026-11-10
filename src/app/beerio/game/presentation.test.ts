import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { audioSnapshot, noteFrequency, RaceAudio, soundEvents } from './audio';
import { RaceRenderer, parseColor, racerGeometry, dancerGeometry, twerkGeometry, figureAuraGeometry, lightningGeometry, racePose, routeOffset, barrierIntersectsShortcut } from './renderer';
import { collectPowerups, ITEM_BURST_SECONDS, ITEM_RESPAWN_SECONDS } from './powerups';
import { createRace, type GamePlayer } from './simulation';
import { ACTIVE_SHORTCUT, selectTrack, shortcutPose, SHORTCUT_LENGTH, SHORTCUT_POINTS, TRACKS, TRACK_LENGTH, TRACK_POINTS, trackPose } from './track';

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
test('comet warning is sounded once when the warning starts', () => {
  const race = createRace([player]);
  race.countdown = 0;
  const previous = audioSnapshot(race);
  race.karts[0].power.leaderWarning = 1.25;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), ['warning']);
  assert.deepEqual(soundEvents(audioSnapshot(race), audioSnapshot(race)), []);
  race.karts[0].power.leaderWarning = 0;
  assert.deepEqual(soundEvents(previous, audioSnapshot(race)), []);
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
    createDynamicsCompressor() { return { ...node(), threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter() }; },
    createWaveShaper() { return { ...node(), curve: null, oversample: 'none' }; },
    createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; },
  };
  return { context: context as unknown as AudioContext, sources, gains };
}
test('audio mute, pause and disposal silence the mix and release every source', () => {
  const { context, sources, gains } = fakeAudioContext(), audio = new RaceAudio(context, { musicBuffer: { duration: 29 } as AudioBuffer });
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
  const { context, sources } = fakeAudioContext(), audio = new RaceAudio(context, { musicBuffer: { duration: 29 } as AudioBuffer });
  const race = createRace([player]); race.countdown = 0; race.elapsed = 15; audio.update(race);
  const count = sources.length;
  audio.setMuted(true); audio.update(createRace([player]));
  assert.equal(sources.length, count);
  audio.dispose(); assert.ok(sources.every(source => source.stopped));
});

function fakeWebGL() {
  let identity = 0;
  let currentModel = new Float32Array(16);
  const buffers = new Set<object>(), programs = new Set<object>();
  const stats = { meshDraws: [] as { count: number; model: Float32Array }[], opacities: [] as number[], vertices: 0, viewports: 0, viewportRects: [] as number[][], draws: 0, uploads: 0, nonFinite: false, data: [] as Float32Array[], models: [] as Float32Array[], views: [] as Float32Array[] };
  const numeric = (values: ArrayLike<number>) => { for (let i = 0; i < values.length; i++) if (!Number.isFinite(values[i])) stats.nonFinite = true; };
  const gl = new Proxy({
    createBuffer() { const buffer = { id: identity++ }; buffers.add(buffer); return buffer; },
    deleteBuffer(buffer: object) { buffers.delete(buffer); },
    createProgram() { const program = { id: identity++ }; programs.add(program); return program; },
    deleteProgram(program: object) { programs.delete(program); },
    createShader() { return {}; }, getShaderParameter() { return true; }, getProgramParameter() { return true; },
    getAttribLocation(_program: object, name: string) { return name === 'a_color' ? 1 : 0; }, getUniformLocation(_program: object, name: string) { return { name }; },
    bufferData(_target: number, data: Float32Array) { stats.uploads++; stats.vertices += data.length / 6; stats.data.push(data.slice()); numeric(data); },
    uniformMatrix4fv(location: { name: string }, _transpose: boolean, data: Float32Array) { numeric(data); if (location.name === 'u_model') { stats.models.push(data.slice()); currentModel = data.slice(); } if (location.name === 'u_view') stats.views.push(data.slice()); },
    uniform3fv(_location: object, data: number[]) { numeric(data); },
    uniform1f(location: { name: string }, value: number) { if (location.name === 'u_opacity') stats.opacities.push(value); },
    viewport(x: number, y: number, width: number, height: number) { stats.viewports++; stats.viewportRects.push([x, y, width, height]); }, drawArrays(_mode: number, _start: number, count: number) { stats.draws++; stats.meshDraws.push({ count, model: currentModel.slice() }); },
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

test('ten-view renderer lays out cameras in the same four-column grid as the HUD', () => {
  const { gl, buffers, programs, stats } = fakeWebGL();
  const canvas = { width: 0, height: 0, getContext: () => gl, getBoundingClientRect: () => ({ width: 1440, height: 900 }) } as unknown as HTMLCanvasElement;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', { value: { devicePixelRatio: 2 }, configurable: true, writable: true });
  try {
    const players = Array.from({ length: 10 }, (_, i) => ({ ...player, id: String(i) }));
    const race = createRace(players), renderer = new RaceRenderer(canvas, players, race);
    renderer.render(race, 1 / 60);
    assert.equal(stats.viewports, 10); assert.equal(canvas.width, 1440);
    assert.deepEqual(stats.viewportRects, Array.from({ length: 10 }, (_, i) => [1 + (i % 4) * 360, 601 - Math.floor(i / 4) * 300, 358, 298]));
    assert.equal(stats.nonFinite, false);
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

test('each shortcut road, chase camera, kart and item use the physical branch', () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', { value: { devicePixelRatio: 1 }, configurable: true, writable: true });
  try {
    for (const track of TRACKS) {
      selectTrack(track.id);
      const { gl, stats } = fakeWebGL();
      const canvas = { width: 0, height: 0, getContext: () => gl, getBoundingClientRect: () => ({ width: 1280, height: 720 }) } as unknown as HTMLCanvasElement;
      const race = createRace([player]); race.countdown = 0; race.powers.boxes = [];
      const start = ACTIVE_SHORTCUT.start * TRACK_LENGTH, span = (ACTIVE_SHORTCUT.end - ACTIVE_SHORTCUT.start) * TRACK_LENGTH;
      const kart = race.karts[0]; kart.distance = start + span * .5; kart.onShortcut = true;
      race.powers.hazards.push({ id: 91, ownerId: 'other', distance: start + span * .4, lane: 2, life: 8, onShortcut: true });
      race.powers.projectiles.push({ id: 92, ownerId: 'other', distance: start + span * .6, lane: -2, life: 3, onShortcut: true });
      const renderer = new RaceRenderer(canvas, [player], race);
      renderer.render(race, 1 / 60);
      const renderedAt = (at: number, lane: number) => {
        const p = shortcutPose(at, lane).position;
        return stats.models.some(m => Math.abs(m[12] - p[0]) < 0.001 && Math.abs(m[14] - p[2]) < 0.001);
      };
      assert.ok(renderedAt(kart.distance, kart.lane), `${track.id} branch kart`);
      assert.ok(renderedAt(start + span * .4, 2), `${track.id} branch hazard`);
      assert.ok(renderedAt(start + span * .6, -2), `${track.id} branch projectile`);
      // The uploaded static world has the distinctive shortcut surface color.
      assert.ok(stats.data.some(data => { for (let i = 3; i < data.length; i += 6) if (Math.abs(data[i] - .28) < 1e-5 && Math.abs(data[i + 1] - .34) < 1e-5 && Math.abs(data[i + 2] - .37) < 1e-5) return true; return false; }), `${track.id} branch road`);
      const branchView = Array.from(stats.views.at(-1)!); renderer.dispose();
      const mainGL = fakeWebGL(), mainCanvas = { ...canvas, getContext: () => mainGL.gl } as unknown as HTMLCanvasElement;
      kart.onShortcut = false;
      const mainRenderer = new RaceRenderer(mainCanvas, [player], race); mainRenderer.render(race, 1 / 60);
      assert.notDeepEqual(Array.from(mainGL.stats.views.at(-1)!), branchView, `${track.id} branch chase camera`);
      mainRenderer.dispose();
    }
  } finally { Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true, writable: true }); selectTrack('sunset'); }
});

test('shortcut camera transitions follow main track across junctions and lap boundaries', () => {
  for (const track of TRACKS) {
    selectTrack(track.id);
    for (const lap of [0, 1, 4]) {
      const base = lap * TRACK_LENGTH, start = base + ACTIVE_SHORTCUT.start * TRACK_LENGTH, end = base + ACTIVE_SHORTCUT.end * TRACK_LENGTH;
      assert.deepEqual(racePose(start - 1, 1, 4, true), trackPose(start - 1, 1, 4));
      assert.deepEqual(racePose(end + 1, 1, 4, true), trackPose(end + 1, 1, 4));
      assert.deepEqual(racePose((start + end) / 2, 1, 4, true), shortcutPose((start + end) / 2, 1, 4));
    }
  }
  selectTrack('sunset');
});

test('branch camera and trail offsets preserve physical metres through both junctions', () => {
  for (const track of TRACKS) {
    selectTrack(track.id);
    const start = ACTIVE_SHORTCUT.start * TRACK_LENGTH, end = ACTIVE_SHORTCUT.end * TRACK_LENGTH;
    const ratio = (end - start) / SHORTCUT_LENGTH;
    for (const lap of [0, 1, 4]) {
      const base = lap * TRACK_LENGTH;
      assert.ok(Math.abs(routeOffset(base + (start + end) / 2, -5, true) - (base + (start + end) / 2 - 5 * ratio)) < 1e-7);
      assert.ok(Math.abs(routeOffset(base + start + 2 * ratio, -10, true) - (base + start - 8)) < 1e-7);
      assert.ok(Math.abs(routeOffset(base + end - 2 * ratio, 10, true) - (base + end + 8)) < 1e-7);
      assert.equal(routeOffset(base + start, -10, false), base + start - 10);
    }
  }
  selectTrack('sunset');
});

test('actual main wall boxes cannot intrude into a shortcut kart corridor', () => {
  for (const track of TRACKS) {
    selectTrack(track.id);
    let intersections = 0;
    for (let i = 0; i < TRACK_POINTS.length - 1; i += 4) {
      const from = TRACK_POINTS[i].distance, to = TRACK_POINTS[Math.min(TRACK_POINTS.length - 1, i + 4)].distance;
      const mid = (from + to) / 2;
      for (const side of [-1, 1]) {
        // Independent distance to the actual rotated rectangular rail footprint.
        const pose = trackPose(mid, side * 10.6);
        const closest = Math.min(...SHORTCUT_POINTS.map(p => {
          const dx = p.x - pose.position[0], dz = p.z - pose.position[2];
          const along = Math.abs(dx * pose.forward[0] + dz * pose.forward[2]);
          const across = Math.abs(dx * pose.right[0] + dz * pose.right[2]);
          return Math.hypot(Math.max(0, along - (to - from + .2) / 2), Math.max(0, across - .325));
        }));
        if (closest < 10.7) { intersections++; assert.equal(barrierIntersectsShortcut(from, to, side), true, `${track.id} wall at ${mid}`); }
      }
    }
    assert.ok(intersections > 0, `${track.id} should have a branch opening`);
  }
  selectTrack('sunset');
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
    assert.ok(mesh.data.length / 6 <= (character === 'bear' ? 10000 : 6400), 'combined driver and vehicle stays within six-view geometry budget');
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
    assert.ok(poses.every(pose => pose.data.every(Number.isFinite) && pose.data.length / 6 <= (character === 'bear' ? 7500 : 4000)));
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

test('global lightning cue uses the caster sequence, deduplicates ten racers and ignores snapshots/restarts', () => {
  const race = createRace(Array.from({ length: 10 }, (_, index) => ({ ...player, id: String(index) })));
  race.countdown = 0;
  const before = audioSnapshot(race);
  race.karts.forEach(kart => { kart.power.lightningStrikes = 1; });
  const struck = audioSnapshot(race);
  assert.deepEqual(soundEvents(before, struck), ['lightning'], 'simultaneous casters share one cue');
  assert.deepEqual(soundEvents(struck, audioSnapshot(race)), [], 'same host event never repeats');
  assert.deepEqual(soundEvents(null, struck), [], 'restoring an existing snapshot cannot replay its thunder');
  race.karts.forEach(kart => { kart.power.lightningStrikes = 0; });
  assert.deepEqual(soundEvents(struck, audioSnapshot(race)), [], 'rematch counter reset is silent');
  race.karts[0].power.dance = 3.5; race.karts[0].power.danceStyle = 'twerk';
  assert.deepEqual(soundEvents(struck, audioSnapshot(race)), ['twerk']);
  assert.deepEqual(soundEvents(audioSnapshot(race), audioSnapshot(race)), []);
});

test('each character has eight distinct clothed twerk poses different from Dance Break, with bounded static geometry', () => {
  const identities = new Set<string>();
  for (const character of characters) {
    const poses = Array.from({ length: 8 }, (_, frame) => twerkGeometry([0.2, 0.8, 1], frame * Math.PI / 4, character));
    assert.equal(new Set(poses.map(pose => JSON.stringify(pose.data))).size, 8);
    assert.ok(poses.every(pose => pose.data.every(Number.isFinite) && pose.data.length / 6 <= (character === 'bear' ? 7500 : 4500)));
    identities.add(JSON.stringify(poses[0].data));
    assert.notDeepEqual(poses[0].data, dancerGeometry([0.2, 0.8, 1], 0, character).data);
    assert.notDeepEqual(poses[0].data, twerkGeometry([1, 0.2, 0.3], 0, character).data, 'selected outfit color is preserved');
  }
  assert.equal(identities.size, 8);
  const lightning = lightningGeometry();
  assert.ok(lightning.data.every(Number.isFinite));
  assert.ok(lightning.data.length / 6 <= 300, 'the global effect is a tiny reused mesh');
});

test('ten-view lightning and twerk effects remain finite, use cached geometry, expire, and dispose completely', () => {
  const { gl, stats, buffers, programs } = fakeWebGL();
  const canvas = { width: 0, height: 0, getContext: () => gl, getBoundingClientRect: () => ({ width: 1440, height: 900 }) } as unknown as HTMLCanvasElement;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', { value: { devicePixelRatio: 1 }, configurable: true, writable: true });
  try {
    const players = Array.from({ length: 10 }, (_, index) => ({ ...player, id: String(index), character: characters[index % characters.length] }));
    const race = createRace(players), renderer = new RaceRenderer(canvas, players, race);
    race.powers.boxes = [];
    const uploads = stats.uploads;
    renderer.render(race, 1 / 60);
    const baseline = stats.draws;
    race.karts.slice(1).forEach(kart => { kart.power.lightning = 2.5; });
    renderer.render(race, 1 / 60);
    assert.equal(stats.draws - baseline, baseline + 270, 'nine victims each display three lightning ribbons in every viewport');
    const late = stats.draws;
    race.karts.slice(1).forEach(kart => { kart.power.lightning = 0.2; });
    renderer.render(race, 1 / 60);
    assert.equal(stats.draws - late, baseline + 180, 'the tall strike fades first, leaving only low arcs');
    race.karts.forEach((kart, index) => { kart.power.lightning = 0; kart.power.danceStyle = index % 2 ? 'twerk' : 'dance'; });
    for (const remaining of [3.5, 3.3, 2, 0.15, 0]) {
      race.karts.forEach(kart => { kart.power.dance = remaining; });
      renderer.render(race, 1 / 60);
    }
    const expired = stats.draws;
    renderer.render(race, 1 / 60);
    assert.equal(stats.draws - expired, baseline, 'expired effects return to the normal draw count');
    assert.equal(stats.uploads, uploads, 'no effects upload geometry during race frames');
    assert.equal(stats.nonFinite, false);
    renderer.dispose(); assert.equal(buffers.size, 0); assert.equal(programs.size, 0);
  } finally { Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true, writable: true }); }
});

test('collected boxes disappear on the pickup frame, burst briefly, stay gone, then respawn', () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', { value: { devicePixelRatio: 1 }, configurable: true, writable: true });
  try {
    const { gl, stats, buffers, programs } = fakeWebGL();
    const canvas = { width: 0, height: 0, getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 600 }) } as unknown as HTMLCanvasElement;
    const race = createRace([player]); race.countdown = 0; race.powers.boxes = [];
    const kart = race.karts[0]; kart.distance = 100; kart.lane = 0;
    const renderer = new RaceRenderer(canvas, [player], race), uploads = stats.uploads;
    const drawCount = () => { const before = stats.draws; renderer.render(race, 1 / 60); return stats.draws - before; };
    const empty = drawCount();
    const box = { id: 1, distance: 100, lane: 0, cooldown: 0 }; race.powers.boxes = [box];
    assert.equal(drawCount(), empty + 1);
    collectPowerups(race, new Map([[kart.id, 96]]));
    assert.equal(box.cooldown, ITEM_RESPAWN_SECONDS);
    assert.equal(drawCount(), empty + 6, 'The box itself is replaced by six outgoing sparkles');
    box.cooldown = ITEM_RESPAWN_SECONDS - ITEM_BURST_SECONDS - .01;
    assert.equal(drawCount(), empty, 'After the short burst nothing remains at the pickup point');
    box.cooldown = .01; assert.equal(drawCount(), empty, 'Box remains absent for the whole cooldown');
    box.cooldown = 0; stats.opacities.length = 0;
    assert.equal(drawCount(), empty + 1);
    assert.ok(stats.opacities.includes(.25), 'A full inventory sees a ghosted box instead of an apparently collectible one');
    kart.power.item = null; stats.opacities.length = 0;
    assert.equal(drawCount(), empty + 1);
    assert.ok(!stats.opacities.includes(.25), 'An empty inventory sees the full-bright collectible');
    assert.equal(stats.uploads, uploads, 'Pickup feedback reuses geometry instead of allocating during race frames');
    assert.equal(stats.nonFinite, false);
    renderer.dispose(); assert.equal(buffers.size, 0); assert.equal(programs.size, 0);
  } finally { Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true, writable: true }); }
});


test('all24 supplied animals have distinct finite race and dance models', () => {
  const signatures = new Set<string>();
  const suppliedAnimals = ['gorilla', 'tiger', 'monkey', 'hippo', 'flamingo', 'rabbit', 'panda', 'zebra', 'cow', 'sheep', 'lion', 'buffalo', 'orangutan', 'elephant', 'goat', 'crocodile', 'antelope', 'fish', 'pig', 'ram', 'donkey', 'bear', 'giraffe', 'horse'];
  for (const id of suppliedAnimals) {
    const character = { id };
    const mesh = racerGeometry([1, .5, .2], character.id, 'kart');
    assert.ok(mesh.data.every(Number.isFinite), character.id);
    assert.ok(mesh.data.length / 6 < 11500, `${character.id} stays within the full-body model budget`);
    signatures.add(JSON.stringify(mesh.data));
    const dance = dancerGeometry([1, .5, .2], .5, character.id);
    assert.ok(dance.data.every(Number.isFinite));
    const twerk = twerkGeometry([1, .5, .2], .5, character.id);
    assert.ok(twerk.data.every(Number.isFinite));
  }
  assert.equal(signatures.size, 24);
});

const publicFigures = ['bezos', 'trump', 'musk', 'zuckerberg', 'ye', 'huang'];
test('all six requested people have distinct bounded race models and keep every supported vehicle', () => {
  const signatures = new Set<string>();
  for (const figure of publicFigures) for (const vehicle of vehicles) {
    const mesh = racerGeometry([.2, .8, .85], figure, vehicle);
    assert.ok(mesh.data.every(Number.isFinite), `${figure}/${vehicle} has finite geometry`);
    assert.equal(mesh.data.length % 18, 0, 'All geometry consists of complete colored triangles');
    assert.ok(mesh.data.length / 6 < 9000, `${figure}/${vehicle} fits the ten-player model budget`);
    for (let at = 0; at < mesh.data.length; at += 6) {
      assert.ok(Math.abs(mesh.data[at]) < 3 && mesh.data[at + 1] >= -.01 && mesh.data[at + 1] < 4 && Math.abs(mesh.data[at + 2]) < 4, `${figure}/${vehicle} remains within its readable cosmetic silhouette`);
    }
    signatures.add(JSON.stringify(mesh.data));
    assert.notDeepEqual(mesh.data, racerGeometry([.2, .8, .85], 'fox', vehicle).data, `${figure} is not a fallback animal`);
    assert.notDeepEqual(mesh.data, racerGeometry([1, .4, .2], figure, vehicle).data, 'Player color still appears on the ride and rear outfit stripe');
    assert.deepEqual(racerGeometry([.2, .8, .85], figure, vehicle, false).data, racerGeometry([.2, .8, .85], 'fox', vehicle, false).data, 'An empty ride has no person or held prop left in the seat');
  }
  assert.equal(signatures.size, 24);
});

test('the six new people preserve their likenesses, props and selected accents in all dance and twerk poses', () => {
  const identities = new Set<string>();
  for (const figure of publicFigures) {
    const dance = Array.from({ length: 8 }, (_, frame) => dancerGeometry([.2, .8, .85], frame * Math.PI / 4, figure));
    const twerk = Array.from({ length: 8 }, (_, frame) => twerkGeometry([.2, .8, .85], frame * Math.PI / 4, figure));
    for (const [name, poses] of [['dance', dance], ['twerk', twerk]] as const) {
      assert.equal(new Set(poses.map(pose => JSON.stringify(pose.data))).size, 8, `${figure} has eight unique ${name} poses`);
      assert.ok(poses.every(pose => pose.data.every(Number.isFinite) && pose.data.length / 6 < 5000), `${figure} has bounded static ${name} geometry`);
      for (const pose of poses) for (let at = 0; at < pose.data.length; at += 6) {
        assert.ok(Math.abs(pose.data[at]) < 2 && pose.data[at + 1] >= -.02 && pose.data[at + 1] < 4.6 && Math.abs(pose.data[at + 2]) < 2, `${figure} props stay attached and in frame while ${name}`);
      }
    }
    identities.add(JSON.stringify(dance[0].data));
    assert.notDeepEqual(dance[0].data, twerk[0].data, `${figure} has distinct animations`);
    assert.notDeepEqual(dance[0].data, dancerGeometry([1, .4, .2], 0, figure).data, 'The color stripe survives both animation routes');
  }
  assert.equal(identities.size, 6);
});

test('signature rocket, buttons, holograms, sonic bars and GPU trails are distinct low-cost cosmetic meshes', () => {
  const identities = new Set<string>();
  for (const figure of publicFigures) {
    const mesh = figureAuraGeometry(figure);
    assert.ok(mesh.data.length > 0 && mesh.data.length / 6 <= 1300, `${figure} has one small aura mesh`);
    assert.ok(mesh.data.every(Number.isFinite)); assert.equal(mesh.data.length % 18, 0);
    identities.add(JSON.stringify(mesh.data));
  }
  assert.equal(identities.size, 6);
  for (const legacy of ['fox', 'gorilla', 'unknown', '__proto__']) assert.deepEqual(figureAuraGeometry(legacy).data, [], 'Existing characters do not acquire unintended effects');
});

test('ten-view celebrity effects animate and follow dancers without per-frame uploads or resource leaks', () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', { value: { devicePixelRatio: 2 }, configurable: true, writable: true });
  try {
    const { gl, stats, buffers, programs } = fakeWebGL();
    const canvas = { width: 0, height: 0, getContext: () => gl, getBoundingClientRect: () => ({ width: 1440, height: 900 }) } as unknown as HTMLCanvasElement;
    const players = Array.from({ length: 10 }, (_, index) => ({ ...player, id: String(index), character: publicFigures[index % 6], vehicle: vehicles[index % 4] }));
    const race = createRace(players); race.countdown = 0; race.powers.boxes = [];
    const renderer = new RaceRenderer(canvas, players, race), uploads = stats.uploads, vertices = stats.vertices;
    renderer.render(race, 1 / 60);
    assert.equal(stats.viewports, 10); assert.equal(canvas.width, 1440, 'Dense grids retain the bounded pixel ratio');
    const initial = stats.models.map(model => Array.from(model)); stats.models.length = 0;
    race.elapsed = .6; renderer.render(race, 1 / 60);
    assert.notDeepEqual(stats.models.map(model => Array.from(model)), initial, 'Signature effects orbit, pulse or hover without replacing geometry');
    const huangVertices = figureAuraGeometry('huang').data.length / 6;
    const huangDraws = stats.meshDraws.filter(draw => draw.count === huangVertices);
    assert.equal(huangDraws.length, 20, 'Huang has exactly one small aura draw in each viewport per frame');
    assert.notDeepEqual(Array.from(huangDraws[0].model), Array.from(huangDraws[10].model), 'The GPU aura itself orbits, independently of camera motion');
    race.karts[5].power.dance = 2; stats.meshDraws.length = 0;
    renderer.render(race, 1 / 60);
    const dancingAura = stats.meshDraws.find(draw => draw.count === huangVertices)!.model;
    const dancerPose = racePose(race.karts[5].distance, race.karts[5].lane, .04, race.karts[5].onShortcut);
    const dancerYaw = dancerPose.yaw + race.karts[5].heading;
    assert.ok(Math.abs(dancingAura[12] - (dancerPose.position[0] + Math.cos(dancerYaw) * 2.2)) < .001, 'The aura follows its dancer out of the seat');
    assert.ok(Math.abs(dancingAura[14] - (dancerPose.position[2] - Math.sin(dancerYaw) * 2.2)) < .001);
    for (const remaining of [3.5, 3.3, 2, .15, 0]) {
      race.karts.forEach((kart, index) => { kart.power.dance = remaining; kart.power.danceStyle = index % 2 ? 'twerk' : 'dance'; });
      const before = structuredClone(race); renderer.render(race, 1 / 60);
      assert.deepEqual(race, before, 'Cosmetic accessories never mutate race state, item counts or collisions');
    }
    assert.equal(stats.uploads, uploads); assert.equal(stats.vertices, vertices);
    assert.equal(stats.nonFinite, false);
    renderer.dispose(); assert.equal(buffers.size, 0); assert.equal(programs.size, 0);
  } finally { Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true, writable: true }); }
});
