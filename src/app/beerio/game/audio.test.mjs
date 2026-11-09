import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';
const directory = dirname(fileURLToPath(import.meta.url));
const cache = new Map();
function load(file) {
  file = resolve(directory, file);
  if (cache.has(file)) return cache.get(file);
  const compiledModule = { exports: {} }; cache.set(file, compiledModule.exports);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', source)(name => load(resolve(dirname(file), `${name}.ts`)), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { RaceAudio, loadOriginalRaceMusic, renderRaceScore } = load('audio.ts');
const { createRace } = load('simulation.ts');
const driver = index => ({ id: `racer-${index}`, name: 'Racer', color: '#ffe199', input: { steer: 0, accelerate: false, brake: false } });
function audioContext() {
  const sources = [], nodes = [];
  const param = () => ({ value: 0, target: 0, events: [],
    cancelScheduledValues(at) { this.events = this.events.filter(event => event.at < at); },
    cancelAndHoldAtTime(at) { this.cancelScheduledValues(at); },
    setValueAtTime(value, at) { this.value = value; this.events.push({ value, at }); },
    setTargetAtTime(value, at) { this.target = value; this.events.push({ value, at }); },
    linearRampToValueAtTime(value, at) { this.events.push({ value, at }); },
    exponentialRampToValueAtTime(value, at) { this.events.push({ value, at }); },
  });
  const node = kind => { const n = { kind, connections: [], disconnected: false, connect(other) { this.connections.push(other); }, disconnect() { this.disconnected = true; } }; nodes.push(n); return n; };
  const source = kind => {
    const s = { ...node(kind), frequency: param(), detune: param(), onended: null, stopped: false,
      start(at = 0, offset = 0) { this.started = at; this.offset = offset; },
      stop(at = 0) { this.stopAt = at; if (at <= context.currentTime) { this.stopped = true; this.onended?.(); } },
    }; sources.push(s); return s;
  };
  const context = { currentTime: 0, state: 'running', sampleRate: 8000, destination: node('output'),
    createGain() { return { ...node('gain'), gain: param() }; },
    createBiquadFilter() { return { ...node('filter'), frequency: param(), Q: param() }; },
    createDynamicsCompressor() { return { ...node('compressor'), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; },
    createWaveShaper() { return { ...node('limiter'), curve: null }; },
    createOscillator() { return source('oscillator'); }, createBufferSource() { return source('buffer'); },
    createBuffer(channels, frames, rate) { const data = Array.from({ length: channels }, () => new Float32Array(frames)); return { duration: frames / rate, getChannelData: index => data[index] }; },
    decodeAudioData: async () => ({ duration: 29.09 }),
  };
  return { context, sources, nodes, tick(time) { context.currentTime = time; for (const source of sources) if (!source.stopped && source.stopAt <= time) { source.stopped = true; source.onended?.(); } } };
}
const musicBuffer = { duration: 29.09 };
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('music is one audio-clock loop, independent of slow animation frames or player count', () => {
  const f = audioContext(), mix = new RaceAudio(f.context, { musicBuffer }), race = createRace(Array.from({ length: 10 }, (_, i) => driver(i)));
  race.countdown = 0; race.karts.forEach(kart => { kart.speed = 43; }); mix.update(race);
  const initial = f.sources.length;
  for (const time of [0.05, 0.3, 2, 31, 90]) { f.tick(time); race.elapsed = time; mix.update(race); }
  assert.equal(f.sources.length, initial, 'RAF timing must not allocate or skip score notes');
  assert.equal(f.sources.filter(source => source.buffer === musicBuffer).length, 1);
  assert.equal(f.sources.filter(source => source.kind === 'oscillator').length, 2);
  assert.ok(f.sources.filter(source => source.kind === 'oscillator').every(source => source.type === 'sine'));
  mix.dispose();
});

test('mute and pause release future cues, preserve music position and do not allocate in silence', () => {
  const f = audioContext(), mix = new RaceAudio(f.context, { musicBuffer }), race = createRace([driver(0)]); race.countdown = 0;
  mix.update(race); f.tick(5); race.elapsed = 5; mix.update(race); mix.setMuted(true);
  const first = f.sources.find(source => source.buffer === musicBuffer);
  assert.equal(first.stopAt, 5.035);
  const before = f.sources.length; f.tick(7); mix.update(race); assert.equal(f.sources.length, before);
  mix.setMuted(false); mix.update(race);
  const second = f.sources.filter(source => source.buffer === musicBuffer).at(-1); assert.equal(second.offset, 5);
  mix.setPaused(true); f.tick(20); mix.update(race);
  mix.setPaused(false); mix.update(race);
  assert.equal(f.sources.filter(source => source.buffer === musicBuffer).at(-1).offset, 5);
  race.elapsed = 0; race.countdown = 3; mix.update(race); f.tick(21); race.countdown = 0; mix.update(race);
  assert.equal(f.sources.filter(source => source.buffer === musicBuffer).at(-1).offset, 0, 'Rematch resets the score');
  mix.dispose(); assert.ok(f.sources.every(source => source.stopped && source.disconnected));
});

test('idling is silent, speed is bounded, and one or ten players receive the same cue mix', () => {
  const counts = [];
  for (const count of [1, 10]) {
    const f = audioContext(), mix = new RaceAudio(f.context, { musicBuffer }), race = createRace(Array.from({ length: count }, (_, i) => driver(i)));
    race.countdown = 0; mix.update(race);
    assert.equal(mix.engine.gain.target, 0, 'No idle buzz');
    const baseline = f.sources.length;
    for (const kart of race.karts) {
      kart.speed = 999; kart.boost = 1; kart.bump = 1; kart.power.collected++; kart.power.used++; kart.power.dance = 1; kart.power.leaderWarning = 1; kart.power.lightningStrikes = 1;
    }
    mix.update(race); counts.push(f.sources.length - baseline);
    assert.ok(mix.engine.gain.target <= 0.022);
    assert.ok(f.sources.filter(source => source.kind === 'oscillator').every(source => source.type !== 'sawtooth' && source.type !== 'square'));
    mix.dispose();
  }
  assert.equal(counts[0], counts[1], 'Ten-player events must not become ten times louder');
});

test('repeated collision edges are rate-limited, and delayed cues are cancelled on restart/dispose', () => {
  const f = audioContext(), mix = new RaceAudio(f.context, { musicBuffer }), race = createRace([driver(0)]); race.countdown = 0;
  mix.update(race); const initial = f.sources.length;
  for (let i = 0; i < 60; i++) { f.tick(i / 60); race.elapsed = i / 60; race.karts[0].bump = i % 2; mix.update(race); }
  assert.ok(f.sources.length - initial <= 4, 'A rattling collision cannot retrigger at frame rate');
  race.karts[0].power.dance = 1; mix.update(race); const pending = f.sources.filter(source => source.started > f.context.currentTime);
  assert.ok(pending.length > 0); mix.setPaused(true);
  assert.ok(pending.every(source => source.stopAt <= f.context.currentTime + 0.035));
  mix.dispose(); const count = f.sources.length; mix.dispose(); mix.update(race); mix.setMuted(false);
  assert.equal(f.sources.length, count);
});

test('safety limiter is monotonic, transparent at normal levels, and bounded with simultaneous cues', () => {
  const f = audioContext(), mix = new RaceAudio(f.context, { musicBuffer });
  const limiter = [...mix.nodes].find(node => node.kind === 'limiter'), curve = limiter.curve;
  assert.equal(curve[1024], 0);
  for (let i = 0; i < curve.length; i++) {
    assert.ok(Number.isFinite(curve[i]) && Math.abs(curve[i]) < 0.94);
    if (i) assert.ok(curve[i] >= curve[i - 1]);
    const x = i / 1024 - 1; if (Math.abs(x) < 0.7) assert.ok(Math.abs(curve[i] - x) < 1e-6);
  }
  mix.dispose();
});

test('original WAV exactly matches reproducible score and loops below an audible discontinuity', () => {
  const data = readFileSync(resolve(directory, '../../../../public/beerio/audio/soda-pop-sprint.wav'));
  assert.equal(data.toString('ascii', 0, 4), 'RIFF'); assert.equal(data.readUInt32LE(24), 24000);
  const channels = renderRaceScore(), frames = (data.length - 44) / 4;
  assert.equal(frames, channels[0].length);
  let peak = 0, sum = 0;
  for (let i = 0; i < frames; i++) for (let channel = 0; channel < 2; channel++) {
    const sample = data.readInt16LE(44 + (i * 2 + channel) * 2) / 32767;
    assert.ok(Number.isFinite(sample)); assert.ok(Math.abs(sample - channels[channel][i]) <= 1 / 32767);
    peak = Math.max(peak, Math.abs(sample)); sum += sample * sample;
  }
  assert.ok(peak < 0.73); assert.ok(Math.sqrt(sum / frames / 2) > 0.04);
  for (const channel of channels) assert.ok(Math.abs(channel[0] - channel.at(-1)) < 0.001);
});

test('concurrent score loads share one fetch/decode, and HTTP or invalid audio failures can retry', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const f = audioContext(); let fetches = 0, decodes = 0;
  globalThis.fetch = async () => { fetches++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  f.context.decodeAudioData = async () => { decodes++; return musicBuffer; };
  const [first, second] = await Promise.all([loadOriginalRaceMusic(f.context), loadOriginalRaceMusic(f.context)]);
  assert.equal(first, second); assert.equal(fetches, 1); assert.equal(decodes, 1);
  const broken = audioContext(); globalThis.fetch = async () => ({ ok: false });
  await assert.rejects(loadOriginalRaceMusic(broken.context), /could not load/);
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  broken.context.decodeAudioData = async () => { throw new Error('Invalid WAV'); };
  await assert.rejects(loadOriginalRaceMusic(broken.context), /Invalid WAV/);
  broken.context.decodeAudioData = async () => musicBuffer;
  assert.equal(await loadOriginalRaceMusic(broken.context), musicBuffer);
});

test('late asynchronous decoding never starts music after mute, pause, completion or disposal', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  for (const action of ['mute', 'pause', 'complete', 'dispose']) {
    const f = audioContext(), pending = deferred(), states = [];
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    f.context.decodeAudioData = () => pending.promise;
    const mix = new RaceAudio(f.context, { onMusicStatus: state => states.push(state) });
    const race = createRace([driver(0)]); race.countdown = 0; mix.update(race);
    if (action === 'mute') mix.setMuted(true);
    if (action === 'pause') mix.setPaused(true);
    if (action === 'complete') { race.complete = true; mix.update(race); }
    if (action === 'dispose') mix.dispose();
    pending.resolve(musicBuffer); await flush();
    assert.equal(f.sources.filter(source => source.buffer === musicBuffer).length, 0, action);
    assert.deepEqual(states, action === 'dispose' ? ['loading'] : ['loading', 'ready']);
    mix.dispose();
  }
});

test('music failure keeps effects alive, bounded retry succeeds, and stale disposed races cannot play', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const f = audioContext(), states = []; let fetches = 0;
  globalThis.fetch = async () => { fetches++; return { ok: false }; };
  const mix = new RaceAudio(f.context, { onMusicStatus: state => states.push(state) }); await flush();
  assert.deepEqual(states, ['loading', 'unavailable']);
  const race = createRace([driver(0)]); mix.update(race); assert.ok(f.sources.length > 3, 'Countdown effects work without music');
  globalThis.fetch = async () => { fetches++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  f.context.decodeAudioData = async () => musicBuffer;
  mix.retryMusic(); mix.retryMusic(); mix.retryMusic(); await flush();
  assert.equal(fetches, 2); assert.equal(states.at(-1), 'ready');
  race.countdown = 0; mix.update(race); assert.equal(f.sources.filter(source => source.buffer === musicBuffer).length, 1);
  mix.dispose();
});

test('lightning and twerk cues are original bounded one-shots that honor mute and pause', () => {
  const f = audioContext(), mix = new RaceAudio(f.context, { musicBuffer });
  const race = createRace(Array.from({ length: 10 }, (_, index) => driver(index))); race.countdown = 0;
  mix.update(race);
  const initial = f.sources.length;
  race.karts.forEach(kart => { kart.power.lightningStrikes++; });
  mix.update(race);
  const lightningSources = f.sources.length - initial;
  assert.ok(lightningSources > 0 && lightningSources <= 6, 'all ten simultaneous strikes use one soft cue');
  mix.update(race); assert.equal(f.sources.length - initial, lightningSources);
  f.tick(1);
  race.karts[1].power.dance = 3.5; race.karts[1].power.danceStyle = 'twerk';
  mix.update(race);
  assert.ok(f.sources.length > initial + lightningSources);
  mix.setPaused(true);
  assert.ok(f.sources.slice(initial).every(source => source.stopAt <= f.context.currentTime + 0.035), 'pause cancels all effect voices while the silent engine graph is retained');
  const paused = f.sources.length;
  race.karts[0].power.lightningStrikes++; mix.update(race);
  assert.equal(f.sources.length, paused);
  mix.setPaused(false); mix.setMuted(true); race.karts[0].power.lightningStrikes++; mix.update(race);
  assert.equal(f.sources.length, paused);
  mix.dispose();
});
