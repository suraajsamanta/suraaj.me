import { MAX_SPEED, type RaceState } from './simulation';
import { ROAD_HALF_WIDTH, TRACK_LENGTH } from './track';

/** All music and effects are synthesized here. No recordings or third-party compositions. */
let sharedContext: AudioContext | null = null;
export function unlockRaceAudio(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return Promise.resolve(false);
    const Constructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) return Promise.resolve(false);
    if (!sharedContext || sharedContext.state === 'closed') sharedContext = new Constructor();
    return sharedContext.resume().then(() => sharedContext?.state === 'running', () => false);
  } catch { return Promise.resolve(false); }
}
export function getRaceAudioContext(): AudioContext | null { return sharedContext; }
export const noteFrequency = (note: number) => 440 * 2 ** ((note - 69) / 12);

export type AudioSnapshot = { countdown: number; elapsed: number; complete: boolean; karts: { id: string; boost: boolean; bump: boolean; lap: number; finished: boolean; collected: number; used: number; shield: number; flash: number; dance?: number }[] };
export type RaceSoundEvent = 'countdown' | 'go' | 'boost' | 'bump' | 'lap' | 'finish' | 'pickup' | 'item' | 'shield' | 'dance';
export function audioSnapshot(race: RaceState): AudioSnapshot {
  return { countdown: Math.ceil(race.countdown), elapsed: race.elapsed, complete: race.complete,
    karts: race.karts.map(kart => ({ id: kart.id, boost: kart.boost > 0, bump: kart.bump > 0,
      lap: Math.max(0, Math.floor(kart.distance / TRACK_LENGTH)), finished: kart.finishTime !== null, collected: kart.power?.collected ?? 0, used: kart.power?.used ?? 0, shield: kart.power?.shield ?? 0, flash: kart.power?.flash ?? 0, dance: kart.power?.dance ?? 0 })) };
}
export function soundEvents(previous: AudioSnapshot | null, next: AudioSnapshot): RaceSoundEvent[] {
  const events = new Set<RaceSoundEvent>();
  if (next.countdown > 0 && previous?.countdown !== next.countdown) events.add('countdown');
  if (previous && previous.countdown > 0 && next.countdown === 0) events.add('go');
  for (const kart of next.karts) {
    const old = previous?.karts.find(other => other.id === kart.id);
    if (!old) continue;
    if (kart.boost && !old.boost) events.add('boost');
    if (kart.bump && !old.bump) events.add('bump');
    if (kart.lap > old.lap && !kart.finished) events.add('lap');
    if (kart.finished && !old.finished) events.add('finish');
    if (kart.collected > old.collected) events.add('pickup');
    if (kart.used > old.used) events.add('item');
    if ((kart.dance ?? 0) > 0 && (old.dance ?? 0) <= 0) events.add('dance');
    if (old.shield > 0 && kart.shield <= 0 && kart.flash > 0) events.add('shield');
  }
  if (next.complete && !previous?.complete) events.add('finish');
  return [...events];
}

// An original eight-bar melody over D / B minor / G / A, at 148 BPM.
const MELODY = [
  74, 0, 78, 81, 0, 78, 76, 74, 78, 0, 81, 85, 83, 81, 0, 78,
  71, 0, 74, 78, 81, 0, 78, 76, 74, 78, 0, 81, 78, 76, 74, 0,
  79, 0, 83, 81, 79, 0, 78, 74, 76, 79, 0, 83, 81, 79, 0, 76,
  73, 0, 76, 81, 85, 83, 81, 0, 76, 78, 81, 0, 85, 81, 78, 73,
];
const ROOTS = [50, 50, 47, 47, 43, 43, 45, 45];
type Source = OscillatorNode | AudioBufferSourceNode;

/** One mix per host screen, not per split-screen viewport or phone. */
export class RaceAudio {
  private master: GainNode;
  private music: GainNode;
  private compressor: DynamicsCompressorNode;
  private engine: GainNode;
  private gravel: GainNode;
  private motors: OscillatorNode[] = [];
  private sources = new Set<Source>();
  private noise: AudioBuffer;
  private previous: AudioSnapshot | null = null;
  private nextBeat = 0;
  private beat = 0;
  private muted = false;
  private paused = false;
  private disposed = false;
  private lastFinish = -100;
  constructor(private context: AudioContext) {
    this.master = context.createGain(); this.master.gain.value = 0;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -16; this.compressor.ratio.value = 5;
    this.master.connect(this.compressor); this.compressor.connect(context.destination);
    this.music = context.createGain(); this.music.gain.value = 0.42; this.music.connect(this.master);
    this.engine = context.createGain(); this.engine.gain.value = 0; this.engine.connect(this.master);
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 620; filter.Q.value = 0.5; filter.connect(this.engine);
    for (const detune of [-9, 7]) {
      const oscillator = context.createOscillator(); oscillator.type = 'sawtooth'; oscillator.frequency.value = 45; oscillator.detune.value = detune;
      oscillator.connect(filter); oscillator.start(); this.motors.push(oscillator); this.sources.add(oscillator);
    }
    this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = this.noise.getChannelData(0);
    let seed = 731;
    for (let i = 0; i < samples.length; i++) { seed = (seed * 16807) % 2147483647; samples[i] = seed / 1073741823 - 1; }
    this.gravel = context.createGain(); this.gravel.gain.value = 0; this.gravel.connect(this.master);
    const tireFilter = context.createBiquadFilter(); tireFilter.type = 'bandpass'; tireFilter.frequency.value = 920; tireFilter.Q.value = 0.7; tireFilter.connect(this.gravel);
    const tireNoise = context.createBufferSource(); tireNoise.buffer = this.noise; tireNoise.loop = true; tireNoise.connect(tireFilter); tireNoise.start(); this.sources.add(tireNoise);
  }
  private envelope(time: number, duration: number, volume: number, destination: AudioNode): GainNode {
    const gain = this.context.createGain(); gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.012, duration)); gain.connect(destination); return gain;
  }
  private track(source: Source, gain: GainNode, stop: number) {
    this.sources.add(source);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.sources.delete(source); };
    source.stop(stop);
  }
  private tone(frequency: number, time: number, duration: number, volume: number, type: OscillatorType = 'triangle', destination = this.master, endFrequency?: number) {
    const source = this.context.createOscillator(), gain = this.envelope(time, duration, volume, destination);
    source.type = type; source.frequency.setValueAtTime(frequency, time);
    if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    source.connect(gain); source.start(time); this.track(source, gain, time + duration + 0.02);
  }
  private percussion(time: number, duration: number, volume: number, high: boolean) {
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter();
    source.buffer = this.noise; filter.type = high ? 'highpass' : 'bandpass'; filter.frequency.value = high ? 6500 : 1800;
    const gain = this.envelope(time, duration, volume, this.music);
    source.connect(filter); filter.connect(gain); source.start(time);
    this.track(source, gain, time + duration + 0.02);
    const end = source.onended; source.onended = event => { end?.call(source, event); filter.disconnect(); };
  }
  private sequence(time: number) {
    const step = this.beat % 64, bar = Math.floor(step / 8), note = MELODY[step], root = ROOTS[bar];
    if (note) {
      this.tone(noteFrequency(note), time, 0.18, 0.13, 'triangle', this.music);
      this.tone(noteFrequency(note + 12), time, 0.09, 0.025, 'sine', this.music);
    }
    if (step % 2 === 0) this.tone(noteFrequency(root + (step % 4 === 2 ? 7 : 0)), time, 0.18, 0.14, 'triangle', this.music);
    if (step % 4 === 0) this.tone(135, time, 0.15, 0.26, 'sine', this.music, 42);
    if (step % 4 === 2) this.percussion(time, 0.11, 0.12, false);
    this.percussion(time, step % 2 ? 0.045 : 0.025, step % 2 ? 0.045 : 0.025, true);
    this.beat++;
  }
  private effect(event: RaceSoundEvent) {
    const time = this.context.currentTime;
    if (event === 'countdown') this.tone(660, time, 0.16, 0.16, 'square');
    if (event === 'go') [74, 78, 81].forEach((note, i) => this.tone(noteFrequency(note), time + i * 0.07, 0.45, 0.13));
    if (event === 'boost') { this.tone(170, time, 0.28, 0.15, 'sawtooth', this.master, 1080); this.tone(880, time + 0.1, 0.26, 0.11, 'triangle', this.master, 1480); }
    if (event === 'bump') { this.tone(115, time, 0.16, 0.16, 'triangle', this.master, 35); this.tone(190, time, 0.08, 0.06, 'sawtooth', this.master, 50); }
    if (event === 'lap') [81, 85, 88].forEach((note, i) => this.tone(noteFrequency(note), time + i * 0.09, 0.22, 0.11));
    if (event === 'pickup') [81, 88, 93].forEach((note, i) => this.tone(noteFrequency(note), time + i * 0.055, 0.18, 0.1, 'sine'));
    if (event === 'item') { this.tone(420, time, 0.2, 0.11, 'triangle', this.master, 980); this.tone(1200, time + 0.08, 0.19, 0.07, 'sine', this.master, 600); }
    if (event === 'dance') [74, 81, 78, 85, 81, 88].forEach((note, i) => this.tone(noteFrequency(note), time + i * 0.1, 0.16, 0.09, 'square'));
    if (event === 'shield') [88, 81, 74].forEach((note, i) => this.tone(noteFrequency(note), time + i * 0.045, 0.18, 0.085, 'sine'));
    if (event === 'finish' && time - this.lastFinish > 1.5) {
      this.lastFinish = time;
      [74, 78, 81, 86, 85, 81, 86].forEach((note, i) => this.tone(noteFrequency(note), time + i * 0.13, i === 6 ? 0.8 : 0.22, 0.14));
    }
  }
  setMuted(muted: boolean) { this.muted = muted; this.updateVolume(); }
  setPaused(paused: boolean) { this.paused = paused; this.nextBeat = 0; this.updateVolume(); }
  private updateVolume() {
    if (this.disposed) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(this.muted || this.paused ? 0 : 0.62, this.context.currentTime, 0.015);
  }
  update(race: RaceState) {
    if (this.disposed) return;
    const next = audioSnapshot(race);
    const restarted = this.previous && (next.elapsed < this.previous.elapsed || next.countdown > this.previous.countdown || next.karts.map(kart => kart.id).join() !== this.previous.karts.map(kart => kart.id).join());
    if (restarted) { this.previous = null; this.nextBeat = 0; this.beat = 0; this.lastFinish = -100; }
    const events = soundEvents(this.previous, next); this.previous = next;
    if (this.paused || this.context.state !== 'running') return;
    this.updateVolume();
    if (!this.muted) events.forEach(event => this.effect(event));
    const active = !race.complete && race.countdown <= 0;
    const speed = active ? Math.max(0, ...race.karts.map(kart => kart.finishTime === null ? kart.speed : 0)) : 0;
    const now = this.context.currentTime;
    for (const motor of this.motors) motor.frequency.setTargetAtTime(42 + speed / MAX_SPEED * 122, now, 0.1);
    this.engine.gain.setTargetAtTime(active ? 0.009 + speed / MAX_SPEED * 0.018 : 0, now, 0.08);
    const slipping = active && race.karts.some(kart => kart.speed > 12 && (Math.abs(kart.lane) > ROAD_HALF_WIDTH - 0.5 || Math.abs(kart.lateral) > 8));
    this.gravel.gain.setTargetAtTime(slipping ? 0.045 : 0, now, 0.08);
    if (active && !this.muted) {
      if (this.nextBeat < now) this.nextBeat = now + 0.025;
      while (this.nextBeat < now + 0.13) { this.sequence(this.nextBeat); this.nextBeat += 60 / 148 / 2; }
    } else this.nextBeat = 0;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.master.gain.value = 0;
    for (const source of this.sources) { try { source.stop(); } catch { /* Already stopped. */ } source.disconnect(); }
    this.sources.clear(); this.motors = [];
    this.engine.disconnect(); this.gravel.disconnect(); this.music.disconnect(); this.master.disconnect(); this.compressor.disconnect();
  }
}
