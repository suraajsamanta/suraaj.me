import { raceScore } from './audioTracks';
import type { TrackId } from './track';

/** Original stadium anthems: authored melody/harmony, additive instruments and
 * synthesized percussion. No samples, recordings or third-party compositions.
 * Rendered offline, so drums and melody stay tight even during slow race frames.
 */
export const SCORE_BPM = raceScore().bpm;
export const SCORE_SAMPLE_RATE = 24000;
export const SCORE_BARS = 16;
export const SCORE_DURATION = SCORE_BARS * 4 * 60 / SCORE_BPM;
const TAU = Math.PI * 2;
const frequency = (note: number) => 440 * 2 ** ((note - 69) / 12);
// Each phrase has a strong call, breathing room, then a rising ensemble answer.
// An eight-bar B section develops the hook instead of looping a short arpeggio.
const MELODY = [
  [72, 0, 72, 79, 0, 76, 79, 0], [81, 0, 79, 76, 0, 74, 72, 0],
  [69, 0, 72, 76, 0, 79, 76, 0], [74, 74, 0, 76, 79, 0, 0, 0],
  [77, 0, 77, 81, 0, 79, 77, 0], [76, 0, 79, 84, 0, 81, 79, 0],
  [74, 0, 77, 79, 0, 77, 74, 0], [79, 0, 74, 0, 71, 0, 0, 0],
  [84, 0, 79, 0, 81, 79, 76, 0], [81, 0, 84, 88, 0, 84, 81, 0],
  [77, 0, 81, 0, 84, 81, 79, 0], [79, 0, 84, 0, 83, 0, 79, 0],
  [81, 0, 77, 81, 0, 84, 81, 0], [79, 0, 76, 79, 0, 84, 79, 0],
  [77, 0, 74, 77, 79, 0, 83, 0], [84, 0, 79, 0, 84, 0, 0, 0],
];
const CHORDS = [
  [36, 55, 60, 64], [36, 55, 60, 64], [33, 57, 60, 64], [43, 55, 59, 62],
  [41, 57, 60, 65], [36, 55, 60, 64], [38, 57, 62, 65], [43, 55, 59, 62],
  [36, 55, 60, 64], [33, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62],
  [41, 57, 60, 65], [36, 55, 60, 64], [43, 55, 59, 62], [36, 55, 60, 64],
];
const TRANSPOSE: Record<TrackId, number> = { sunset: 0, canyon: -2, brewery: 2, seattle: -5, space: -2, rainbow: -2, foundry: -7 };

export function renderRaceScore(sampleRate = SCORE_SAMPLE_RATE, trackId: TrackId = 'sunset'): [Float32Array, Float32Array] {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('Score sample rate must be between 8 kHz and 192 kHz');
  const bpm = raceScore(trackId).bpm, duration = SCORE_BARS * 4 * 60 / bpm;
  const length = Math.round(sampleRate * duration), eighth = 60 / bpm / 2;
  const channels: [Float32Array, Float32Array] = [new Float32Array(length), new Float32Array(length)];
  const space = trackId === 'space' || trackId === 'rainbow', foundry = trackId === 'foundry', canyon = trackId === 'canyon', brewery = trackId === 'brewery', seattle = trackId === 'seattle';
  const transpose = TRANSPOSE[trackId] ?? 0;
  let seed = 8137;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
  const add = (at: number, seconds: number, gain: number, pan: number, voice: (seconds: number) => number, attack = 0.006) => {
    const start = Math.round(at * sampleRate), count = Math.ceil(seconds * sampleRate);
    const left = Math.sqrt((1 - pan) / 2) * gain, right = Math.sqrt((1 + pan) / 2) * gain;
    for (let i = 0; i < count; i++) {
      const time = i / sampleRate;
      const envelope = Math.min(1, time / attack) * Math.max(0, Math.min(1, (seconds - time) / 0.035));
      const sample = voice(time) * envelope, index = (start + i + length) % length;
      channels[0][index] += sample * left; channels[1][index] += sample * right;
    }
  };
  // Finite, band-limited harmonics give the horns body without buzzy saw waves.
  const horn = (note: number, at: number, seconds: number, gain: number, pan: number) => {
    const f = frequency(note), harmonics = Math.min(space ? 4 : 7, Math.floor(sampleRate * 0.43 / f));
    add(at, seconds, gain, pan, t => {
      const vibrato = Math.max(0, t - 0.1) * 0.014 * Math.sin(TAU * 5 * t);
      const phase = TAU * f * t + vibrato;
      let value = 0;
      for (let h = 1; h <= harmonics; h++) value += Math.sin(phase * h) * (h === 1 ? 0.72 : 0.64 / h) * (h === 1 ? 1 : 0.65 + 0.35 * Math.exp(-t * 8));
      return value * (0.8 + 0.2 * Math.exp(-t * 14));
    }, space ? 0.024 : 0.016);
  };
  const bell = (note: number, at: number, gain: number, pan: number) => {
    const f = frequency(note);
    add(at, 0.6, gain, pan, t => Math.exp(-t * (seattle ? 8 : 6)) * (Math.sin(TAU * f * t) + (f * 2 < sampleRate * 0.43 ? 0.22 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 9) : 0)));
  };
  const kick = (at: number, gain = 0.22) => add(at, 0.28, gain, 0, t => Math.sin(TAU * (49 * t + 95 * 0.018 * (1 - Math.exp(-t / 0.018)))) * Math.exp(-t * 19), 0.002);
  const snare = (at: number, gain: number, pan = 0.12) => {
    let last = 0;
    add(at, 0.15, gain, pan, t => {
      const noise = random(), crisp = noise - last * 0.55; last = noise;
      return crisp * 0.65 * Math.exp(-t * 29) + Math.sin(TAU * 188 * t) * 0.36 * Math.exp(-t * 35);
    }, 0.0015);
  };
  const tom = (at: number, pitch: number, gain: number, pan: number) => add(at, 0.28, gain, pan, t => Math.sin(TAU * (pitch * t + 1.5 * (1 - Math.exp(-t * 20)))) * Math.exp(-t * 17));
  const hat = (at: number, gain: number, open = false) => {
    let last = 0;
    add(at, open ? 0.16 : 0.055, gain, -0.35, t => { const noise = random(), high = noise - last; last = noise; return high * Math.exp(-t * (open ? 25 : 70)); }, 0.0015);
  };
  for (let bar = 0; bar < SCORE_BARS; bar++) {
    const [root, ...chord] = CHORDS[bar].map(note => note + transpose), phraseEnd = bar % 4 === 3;
    const barTime = bar * 8 * eighth;
    // Space has a suspended upper colour and a long, wide, slowly blooming pad.
    if (space) [chord[0], chord[1] + 12, chord[2] + 7].forEach((pitch, index) => {
      const f = frequency(pitch);
      add(barTime, eighth * 8 + 0.5, 0.028, index === 0 ? -0.72 : 0.72, t => (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * f * 1.002 * t)) * (0.7 + 0.3 * Math.cos(TAU * 0.6 * t)), 0.3);
    });
    for (let step = 0; step < 8; step++) {
      const at = barTime + step * eighth, rawNote = MELODY[bar][step];
      if (rawNote) {
        const note = rawNote + transpose;
        const sustain = MELODY[bar][step + 1] === 0 ? eighth * 1.48 : eighth * 0.73;
        horn(note, at, sustain, bar >= 8 ? 0.135 : 0.123, -0.18);
        // Lower octave answers make the hook feel like a band, not a lone beep.
        if (step === 0 || bar >= 8 || brewery) horn(note - 12, at + 0.008, sustain * 0.9, 0.052, 0.24);
        if (space || canyon) horn(note, at + eighth * 1.5, sustain, 0.022, 0.7);
      }
      if (step % 2 === 0 || (!brewery && (step === 3 || step === 7))) {
        const pitch = root + (brewery && step % 4 === 2 ? 7 : step === 7 ? 12 : 0), f = frequency(pitch);
        add(at, eighth * (brewery ? 0.78 : 0.94), 0.17, 0, t => (Math.sin(TAU * f * t) + (foundry ? 0.3 : 0.15) * Math.sin(TAU * f * 2 * t)) * Math.exp(-t * 4));
      }
      // Offbeat ensemble stabs provide the fight-song call-and-response.
      if ([1, 3, 5].includes(step) || (step === 7 && !phraseEnd)) chord.forEach((pitch, index) => {
        if (seattle) bell(pitch + 12, at + index * 0.006, 0.055, index % 2 ? -0.5 : 0.5);
        else horn(pitch, at + index * 0.004, eighth * 0.66, brewery ? 0.053 : 0.036, index % 2 ? -0.5 : 0.5);
      });
      if (space) {
        const arp = chord[(step + bar % 2) % 3] + (step % 4 >= 2 ? 24 : 12);
        bell(arp, at + eighth / 2, 0.044, step % 2 ? -0.64 : 0.64);
        bell(arp + 12, at + eighth * 1.25, 0.012, step % 2 ? 0.75 : -0.75);
      }
      if (step === 0 || step === 4 || (foundry && step === 3) || (phraseEnd && step === 7)) kick(at);
      if (step === 2 || step === 6) {
        snare(at, 0.15);
        // A quiet flam and ghost stroke add a human drumline feel.
        snare(at - 0.014, 0.032, -0.08);
        if (!seattle) snare(at + eighth * 0.75, 0.027, -0.16);
      }
      hat(at, step % 2 ? 0.025 : 0.016, step === 7 && bar % 2 === 1);
      if (canyon && step % 2 === 0) tom(at, step === 0 ? 80 : 110, 0.08, step % 4 ? 0.35 : -0.35);
      if (foundry && step % 2 === 1) {
        add(at, 0.12, 0.026, step % 4 === 1 ? -0.5 : 0.5, t => (Math.sin(TAU * 540 * t) + 0.32 * Math.sin(TAU * 857 * t)) * Math.exp(-t * 32));
      }
      if (phraseEnd && step >= 6) {
        snare(at + eighth * 0.5, 0.06 + (step - 6) * 0.02, -0.12);
        tom(at + eighth * 0.75, step === 6 ? 150 : 105, 0.09, step === 6 ? -0.36 : 0.36);
      }
    }
    if (bar % 4 === 0) {
      let last = 0;
      add(barTime, 0.65, 0.034, 0.3, t => { const n = random(), high = n - last; last = n; return high * Math.exp(-t * 9); }, 0.004);
    }
  }
  // Small circular room reflections blend the ensemble; space gets a wider tail.
  // The dry copy prevents recursive accumulation, and wrap preserves loop tails.
  const dry = channels.map(channel => channel.slice());
  for (const [seconds, amount] of space ? [[0.11, 0.13], [0.23, 0.09], [0.37, 0.06]] : [[0.037, 0.075], [0.067, 0.05]]) {
    const delay = Math.round(seconds * sampleRate);
    for (let i = 0; i < length; i++) {
      const from = (i - delay + length) % length;
      channels[0][i] += dry[1][from] * amount; channels[1][i] += dry[0][from] * amount;
    }
  }
  // Remove DC, bridge the sub-2ms seam and preserve headroom for live cues.
  for (const channel of channels) {
    const mean = channel.reduce((sum, sample) => sum + sample, 0) / length;
    for (let i = 0; i < length; i++) channel[i] -= mean;
    const seam = (channel[0] + channel[length - 1]) / 2, width = Math.round(sampleRate * 0.0015);
    for (let i = 0; i < width; i++) {
      const blend = (1 + Math.cos(Math.PI * i / width)) / 2;
      const left = i, right = length - 1 - i;
      channel[left] = channel[left] * (1 - blend) + seam * blend;
      channel[right] = channel[right] * (1 - blend) + seam * blend;
    }
  }
  let peak = 0, energy = 0;
  for (const channel of channels) for (const sample of channel) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
  // Match the arrangements' average level without flattening drum transients.
  const rms = Math.sqrt(energy / length / 2);
  const gain = Math.min(0.72 / Math.max(0.001, peak), 0.11 / Math.max(0.001, rms));
  for (const channel of channels) for (let i = 0; i < length; i++) channel[i] *= gain;
  return channels;
}

const scores = new WeakMap<BaseAudioContext, Map<TrackId, AudioBuffer>>();
export function createOriginalRaceMusic(context: BaseAudioContext, trackId: TrackId = 'sunset'): AudioBuffer {
  let tracks = scores.get(context);
  if (!tracks) { tracks = new Map(); scores.set(context, tracks); }
  const existing = tracks.get(trackId);
  if (existing) return existing;
  const channels = renderRaceScore(SCORE_SAMPLE_RATE, trackId);
  const buffer = context.createBuffer(2, channels[0].length, SCORE_SAMPLE_RATE);
  channels.forEach((samples, index) => buffer.getChannelData(index).set(samples));
  tracks.set(trackId, buffer);
  return buffer;
}
