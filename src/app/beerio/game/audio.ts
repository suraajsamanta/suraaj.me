import { MAX_SPEED, type RaceState } from './simulation';
import { ROAD_HALF_WIDTH, TRACK_LENGTH } from './track';
export { createOriginalRaceMusic, renderRaceScore, SCORE_DURATION } from './audioScore';

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

export type AudioSnapshot = { countdown: number; elapsed: number; complete: boolean; karts: { id: string; boost: boolean; bump: boolean; lap: number; finished: boolean; collected: number; used: number; shield: number; flash: number; dance?: number; danceStyle?: 'dance' | 'twerk'; lightningStrikes?: number; leaderWarning?: number }[] };
export type RaceSoundEvent = 'countdown' | 'go' | 'boost' | 'bump' | 'lap' | 'finish' | 'pickup' | 'item' | 'shield' | 'dance' | 'twerk' | 'lightning' | 'warning';
export function audioSnapshot(race: RaceState): AudioSnapshot {
  return { countdown: Math.ceil(race.countdown), elapsed: race.elapsed, complete: race.complete,
    karts: race.karts.map(kart => ({ id: kart.id, boost: kart.boost > 0, bump: kart.bump > 0,
      lap: Math.max(0, Math.floor(kart.distance / TRACK_LENGTH)), finished: kart.finishTime !== null, collected: kart.power?.collected ?? 0, used: kart.power?.used ?? 0, shield: kart.power?.shield ?? 0, flash: kart.power?.flash ?? 0, dance: kart.power?.dance ?? 0, danceStyle: kart.power?.danceStyle ?? 'dance', lightningStrikes: kart.power?.lightningStrikes ?? 0, leaderWarning: kart.power?.leaderWarning ?? 0 })) };
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
    if ((kart.leaderWarning ?? 0) > 0 && (old.leaderWarning ?? 0) <= 0) events.add('warning');
    if ((kart.dance ?? 0) > 0 && (old.dance ?? 0) <= 0) events.add(kart.danceStyle === 'twerk' ? 'twerk' : 'dance');
    if ((kart.lightningStrikes ?? 0) > (old.lightningStrikes ?? 0)) events.add('lightning');
    if (old.shield > 0 && kart.shield <= 0 && kart.flash > 0) events.add('shield');
  }
  if (next.complete && !previous?.complete) events.add('finish');
  return [...events];
}

export type MusicStatus = 'loading' | 'ready' | 'unavailable';
const musicLoads = new WeakMap<BaseAudioContext, Promise<AudioBuffer>>();
/** A local original WAV keeps mobile startup smooth and preserves gapless loops.
 * Decoding and loading are asynchronous; source synthesis runs only at build time.
 */
export function loadOriginalRaceMusic(context: BaseAudioContext): Promise<AudioBuffer> {
  const cached = musicLoads.get(context);
  if (cached) return cached;
  const load = fetch('/beerio/audio/soda-pop-sprint.wav')
    .then(response => { if (!response.ok) throw new Error('Race music could not load'); return response.arrayBuffer(); })
    .then(bytes => context.decodeAudioData(bytes))
    .catch(error => { musicLoads.delete(context); throw error; });
  musicLoads.set(context, load);
  return load;
}

type Source = OscillatorNode | AudioBufferSourceNode;
type Voice = { source: Source; gain: GainNode; nodes: AudioNode[] };
const COOLDOWN: Record<RaceSoundEvent, number> = {
  countdown: 0.25, go: 1, boost: 0.35, bump: 0.28, lap: 1, finish: 1.5,
  pickup: 0.16, item: 0.2, shield: 0.3, dance: 0.8, twerk: 0.8, lightning: 0.7, warning: 0.7,
};

/** One quiet vehicle layer and one original score for the whole host screen.
 * The music is a cached PCM loop on the audio clock, never a RAF sequencer.
 */
export class RaceAudio {
  private master: GainNode;
  private mix: GainNode;
  private music: GainNode;
  private engine: GainNode;
  private gravel: GainNode;
  private motors: OscillatorNode[] = [];
  private sources = new Set<Source>();
  private nodes = new Set<AudioNode>();
  private voices = new Set<Voice>();
  private musicVoice: Voice | null = null;
  private musicOffset = 0;
  private musicStarted = 0;
  private noise: AudioBuffer;
  private previous: AudioSnapshot | null = null;
  private muted = false;
  private paused = false;
  private disposed = false;
  private lastEvent = new Map<RaceSoundEvent, number>();
  private score: AudioBuffer | null;
  private loadingMusic = false;
  private onMusicStatus?: (status: MusicStatus) => void;
  constructor(private context: BaseAudioContext, options: { musicBuffer?: AudioBuffer; onMusicStatus?: (status: MusicStatus) => void } = {}) {
    this.score = options.musicBuffer ?? null;
    this.onMusicStatus = options.onMusicStatus;
    this.master = this.keep(context.createGain()); this.master.gain.value = 0;
    this.mix = this.keep(context.createGain());
    const highpass = this.keep(context.createBiquadFilter()); highpass.type = 'highpass'; highpass.frequency.value = 28; highpass.Q.value = 0.5;
    const compressor = this.keep(context.createDynamicsCompressor());
    compressor.threshold.value = -12; compressor.knee.value = 12; compressor.ratio.value = 3;
    compressor.attack.value = 0.004; compressor.release.value = 0.18;
    const limiter = this.keep(context.createWaveShaper());
    limiter.curve = Float32Array.from({ length: 2049 }, (_, i) => {
      const input = i / 1024 - 1, level = Math.abs(input);
      return level <= 0.7 ? input : Math.sign(input) * (0.7 + 0.24 * (1 - Math.exp(-(level - 0.7) / 0.24)));
    });
    limiter.oversample = '2x';
    this.mix.connect(highpass); highpass.connect(compressor); compressor.connect(limiter); limiter.connect(this.master); this.master.connect(context.destination);
    this.music = this.keep(context.createGain()); this.music.gain.value = 0.82; this.music.connect(this.mix);
    this.engine = this.keep(context.createGain()); this.engine.gain.value = 0; this.engine.connect(this.mix);
    // Round, phase-stable fundamental + a very quiet octave. No detuned saws,
    // idle drone, frame-rate modulation, or abrasive high-speed harmonics.
    for (const [index, harmonic] of [1, 2].entries()) {
      const oscillator = context.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = 52 * harmonic;
      const gain = this.keep(context.createGain()); gain.gain.value = index ? 0.16 : 1;
      oscillator.connect(gain); gain.connect(this.engine); oscillator.start(); this.motors.push(oscillator); this.sources.add(oscillator);
    }
    this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = this.noise.getChannelData(0);
    let seed = 731;
    for (let i = 0; i < samples.length; i++) { seed = (seed * 16807) % 2147483647; samples[i] = seed / 1073741823.5 - 1; }
    this.gravel = this.keep(context.createGain()); this.gravel.gain.value = 0; this.gravel.connect(this.mix);
    const tireFilter = this.keep(context.createBiquadFilter()); tireFilter.type = 'bandpass'; tireFilter.frequency.value = 1350; tireFilter.Q.value = 0.8; tireFilter.connect(this.gravel);
    const tireNoise = context.createBufferSource(); tireNoise.buffer = this.noise; tireNoise.loop = true; tireNoise.connect(tireFilter); tireNoise.start(); this.sources.add(tireNoise);
    if (!this.score) this.retryMusic();
    else this.onMusicStatus?.('ready');
  }
  retryMusic() {
    if (this.disposed || this.loadingMusic || this.score) return;
    this.loadingMusic = true; this.onMusicStatus?.('loading');
    void loadOriginalRaceMusic(this.context).then(buffer => {
      if (this.disposed) return;
      this.score = buffer; this.loadingMusic = false; this.onMusicStatus?.('ready');
      if (this.previous && this.previous.countdown === 0 && !this.previous.complete && !this.paused && !this.muted && this.context.state === 'running') this.startMusic();
    }, () => {
      if (this.disposed) return;
      this.loadingMusic = false; this.onMusicStatus?.('unavailable');
    });
  }
  private keep<T extends AudioNode>(node: T): T { this.nodes.add(node); return node; }
  private envelope(time: number, duration: number, volume: number, destination: AudioNode): GainNode {
    const gain = this.context.createGain(); gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + Math.min(0.012, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.gain.linearRampToValueAtTime(0, time + duration + 0.015);
    gain.connect(destination); return gain;
  }
  private track(source: Source, gain: GainNode, nodes: AudioNode[] = []): Voice {
    const voice = { source, gain, nodes }; this.sources.add(source); this.voices.add(voice);
    source.onended = () => {
      source.disconnect(); gain.disconnect(); nodes.forEach(node => node.disconnect());
      this.sources.delete(source); this.voices.delete(voice);
    };
    return voice;
  }
  private tone(frequency: number, time: number, duration: number, volume: number, type: OscillatorType = 'sine', endFrequency?: number) {
    const source = this.context.createOscillator(), gain = this.envelope(time, duration, volume, this.mix);
    source.type = type; source.frequency.setValueAtTime(frequency, time);
    if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    source.connect(gain); this.track(source, gain); source.start(time); source.stop(time + duration + 0.02);
  }
  private chime(note: number, time: number, duration: number, volume: number) {
    const frequency = noteFrequency(note);
    this.tone(frequency, time, duration, volume);
    this.tone(frequency * 2, time, duration * 0.45, volume * 0.2);
  }
  private whoosh(time: number, duration: number, volume: number) {
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter();
    source.buffer = this.noise; filter.type = 'bandpass'; filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(450, time); filter.frequency.exponentialRampToValueAtTime(2100, time + duration);
    const gain = this.envelope(time, duration, volume, this.mix);
    source.connect(filter); filter.connect(gain); this.track(source, gain, [filter]); source.start(time); source.stop(time + duration + 0.02);
  }
  private effect(event: RaceSoundEvent) {
    const time = this.context.currentTime;
    if (time - (this.lastEvent.get(event) ?? -100) < COOLDOWN[event]) return;
    this.lastEvent.set(event, time);
    if (event === 'countdown') { this.chime(76, time, 0.2, 0.13); }
    if (event === 'go') [77, 81, 84, 89].forEach((note, i) => this.chime(note, time + i * 0.065, 0.38, 0.095));
    if (event === 'boost') { this.whoosh(time, 0.45, 0.11); this.tone(260, time, 0.32, 0.06, 'sine', 740); }
    if (event === 'bump') { this.tone(130, time, 0.13, 0.15, 'sine', 44); }
    if (event === 'lap') [84, 88, 91, 96].forEach((note, i) => this.chime(note, time + i * 0.085, 0.28, 0.085));
    if (event === 'pickup') {
      this.tone(220, time, 0.12, 0.09, 'sine', 520);
      [79, 86, 91, 98].forEach((note, i) => this.chime(note, time + i * 0.055, 0.3, 0.105));
    }
    if (event === 'item') {
      this.whoosh(time, 0.28, 0.12);
      this.tone(180, time, 0.22, 0.11, 'sine', 720);
      [72, 79, 84].forEach((note, i) => this.chime(note, time + 0.06 + i * 0.06, 0.36, 0.1));
    }
    if (event === 'warning') [81, 84].forEach((note, i) => this.chime(note, time + i * 0.18, 0.16, 0.085));
    if (event === 'dance') [77, 84, 81, 86, 84, 89].forEach((note, i) => this.chime(note, time + i * 0.12, 0.17, 0.065));
    if (event === 'twerk') [60, 67, 63, 70].forEach((note, i) => {
      this.tone(noteFrequency(note), time + i * 0.14, 0.16, 0.075, 'sine', noteFrequency(note + 3));
      this.chime(note + 24, time + i * 0.14 + 0.04, 0.1, 0.035);
    });
    if (event === 'lightning') {
      this.whoosh(time, 0.34, 0.12);
      this.tone(970, time, 0.22, 0.065, 'sine', 190);
      this.tone(110, time + 0.06, 0.5, 0.11, 'sine', 42);
      this.chime(88, time + 0.04, 0.24, 0.045);
    }
    if (event === 'shield') [96, 91, 84].forEach((note, i) => this.chime(note, time + i * 0.05, 0.2, 0.065));
    if (event === 'finish') {
      [77, 81, 84, 89, 88, 84, 89].forEach((note, i) => this.chime(note, time + i * 0.14, i === 6 ? 0.9 : 0.23, 0.105));
      [53, 60, 65].forEach(note => this.tone(noteFrequency(note), time + 0.84, 0.95, 0.055));
    }
    // Important cues sit clearly above the tune without becoming piercing.
    if (event === 'go' || event === 'lap' || event === 'finish' || event === 'warning' || event === 'lightning' || event === 'pickup' || event === 'item') {
      this.music.gain.cancelScheduledValues(time);
      this.music.gain.setTargetAtTime(0.48, time, 0.025);
      this.music.gain.setTargetAtTime(0.82, time + (event === 'finish' ? 1.4 : 0.45), 0.18);
    }
  }
  private startMusic() {
    if (this.musicVoice || this.disposed || !this.score) return;
    const source = this.context.createBufferSource(); source.buffer = this.score; source.loop = true;
    const gain = this.context.createGain(), now = this.context.currentTime;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(1, now + 0.06); gain.connect(this.music);
    source.connect(gain); this.musicVoice = this.track(source, gain);
    this.musicOffset %= source.buffer.duration; this.musicStarted = now; source.start(now, this.musicOffset);
  }
  private release(voice: Voice) {
    const now = this.context.currentTime;
    // Keep a click-free short release, also cancelling notes scheduled ahead.
    const parameter = voice.gain.gain;
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
    else { const current = parameter.value; parameter.cancelScheduledValues(now); parameter.setValueAtTime(current, now); }
    parameter.setTargetAtTime(0, now, 0.006);
    try { voice.source.stop(now + 0.035); } catch { /* Source already ended. */ }
  }
  private stopMusic(reset = false) {
    if (this.musicVoice) {
      this.musicOffset += Math.max(0, this.context.currentTime - this.musicStarted);
      this.release(this.musicVoice); this.musicVoice = null;
    }
    if (reset) this.musicOffset = 0;
  }
  private clearCues() { for (const voice of this.voices) if (voice !== this.musicVoice) this.release(voice); }
  setMuted(muted: boolean) {
    if (this.disposed || this.muted === muted) return;
    this.muted = muted;
    if (muted) { this.clearCues(); this.stopMusic(); }
    this.updateVolume();
  }
  setPaused(paused: boolean) {
    if (this.disposed || this.paused === paused) return;
    this.paused = paused;
    if (paused) { this.clearCues(); this.stopMusic(); }
    this.updateVolume();
  }
  private updateVolume() {
    if (this.disposed) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.muted || this.paused ? 0 : 0.62, now, 0.012);
  }
  update(race: RaceState) {
    if (this.disposed) return;
    const next = audioSnapshot(race);
    const restarted = this.previous && (next.elapsed < this.previous.elapsed || next.countdown > this.previous.countdown || next.karts.map(kart => kart.id).join() !== this.previous.karts.map(kart => kart.id).join());
    if (restarted) { this.clearCues(); this.stopMusic(true); this.previous = null; this.lastEvent.clear(); }
    const events = soundEvents(this.previous, next); this.previous = next;
    if (this.paused || this.context.state !== 'running') return;
    this.updateVolume();
    const active = !race.complete && race.countdown <= 0;
    const moving = race.karts.filter(kart => kart.finishTime === null);
    const speed = active ? Math.min(1.4, Math.max(0, ...moving.map(kart => kart.speed)) / MAX_SPEED) : 0;
    const now = this.context.currentTime;
    this.motors.forEach((motor, index) => motor.frequency.setTargetAtTime((52 + speed * 60) * (index + 1), now, 0.15));
    this.engine.gain.setTargetAtTime(speed > 0.02 ? Math.min(0.022, 0.006 + speed * 0.012) : 0, now, 0.08);
    const slipping = active && moving.some(kart => kart.speed > 12 && (kart.drifting || Math.abs(kart.lane) > ROAD_HALF_WIDTH - 0.5));
    this.gravel.gain.setTargetAtTime(slipping ? 0.018 : 0, now, 0.08);
    if (active && !this.muted) this.startMusic(); else this.stopMusic(race.complete);
    if (!this.muted) events.forEach(event => this.effect(event));
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.master.gain.cancelScheduledValues(this.context.currentTime); this.master.gain.value = 0;
    for (const source of this.sources) { source.onended = null; try { source.stop(); } catch { /* Already stopped. */ } source.disconnect(); }
    for (const voice of this.voices) { voice.gain.disconnect(); voice.nodes.forEach(node => node.disconnect()); }
    for (const node of this.nodes) node.disconnect();
    this.sources.clear(); this.voices.clear(); this.nodes.clear(); this.motors = []; this.musicVoice = null;
  }
}
