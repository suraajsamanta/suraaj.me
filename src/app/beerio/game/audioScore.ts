/** “Soda Pop Sprint”: an original 16-bar instrumental, synthesized from scratch.
 * No samples, recordings, quotations, or third-party compositions. Rendering a
 * loop once lets the audio clock keep time even when a 10-player frame is slow.
 */
export const SCORE_BPM = 132;
export const SCORE_SAMPLE_RATE = 24000;
export const SCORE_BARS = 16;
export const SCORE_DURATION = SCORE_BARS * 4 * 60 / SCORE_BPM;
const TAU = Math.PI * 2;
const frequency = (note: number) => 440 * 2 ** ((note - 69) / 12);
// Eight eighth-note positions per bar. Rests and a contrasting B section keep
// the tune from becoming an incessant arpeggio. All note data is authored here.
const MELODY = [
  [77, 0, 81, 79, 0, 77, 74, 0], [72, 74, 77, 0, 79, 0, 81, 0],
  [77, 0, 76, 74, 0, 72, 69, 0], [72, 0, 74, 77, 0, 76, 74, 0],
  [74, 0, 77, 81, 0, 79, 77, 0], [76, 0, 79, 0, 81, 79, 76, 0],
  [74, 77, 0, 79, 0, 76, 72, 0], [74, 0, 76, 0, 77, 0, 0, 0],
  [84, 0, 81, 0, 79, 81, 77, 0], [79, 0, 81, 84, 0, 81, 79, 0],
  [81, 0, 77, 74, 0, 77, 79, 0], [82, 0, 81, 79, 0, 77, 74, 0],
  [79, 0, 77, 76, 0, 74, 77, 0], [79, 81, 0, 84, 0, 82, 79, 0],
  [76, 0, 79, 82, 0, 79, 76, 0], [77, 0, 81, 0, 84, 0, 0, 0],
];
const CHORDS = [
  [41, 57, 60, 64], [41, 57, 60, 65], [38, 57, 60, 65], [38, 57, 60, 64],
  [34, 53, 57, 62], [36, 55, 60, 64], [43, 58, 62, 65], [36, 58, 60, 64],
  [41, 57, 60, 65], [45, 60, 64, 67], [38, 57, 60, 65], [34, 57, 62, 65],
  [43, 58, 62, 65], [36, 55, 60, 64], [36, 58, 60, 64], [41, 57, 60, 65],
];

export function renderRaceScore(sampleRate = SCORE_SAMPLE_RATE): [Float32Array, Float32Array] {
  const length = Math.round(sampleRate * SCORE_DURATION);
  const channels: [Float32Array, Float32Array] = [new Float32Array(length), new Float32Array(length)];
  const eighth = 60 / SCORE_BPM / 2;
  let seed = 8137;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
  const add = (at: number, duration: number, gain: number, pan: number, voice: (seconds: number, index: number) => number) => {
    const start = Math.round(at * sampleRate), count = Math.ceil(duration * sampleRate);
    const left = Math.sqrt((1 - pan) / 2) * gain, right = Math.sqrt((1 + pan) / 2) * gain;
    for (let i = 0; i < count; i++) {
      const time = i / sampleRate;
      const envelope = Math.min(1, time / 0.005) * Math.min(1, (duration - time) / 0.025);
      const sample = voice(time, i) * envelope;
      // Wrap release tails into the beginning: a seamless loop, not a hard cut.
      const index = (start + i) % length;
      channels[0][index] += sample * left; channels[1][index] += sample * right;
    }
  };
  const pluck = (note: number, at: number, gain: number, pan: number, soft = false) => {
    const f = frequency(note);
    add(at, soft ? 0.28 : 0.44, gain, pan, time => {
      const phase = TAU * f * time;
      return Math.exp(-time * (soft ? 13 : 8)) * (Math.sin(phase) + 0.28 * Math.sin(phase * 2) * Math.exp(-time * 12) + 0.08 * Math.sin(phase * 3) * Math.exp(-time * 20));
    });
  };
  for (let bar = 0; bar < SCORE_BARS; bar++) {
    const [root, ...chord] = CHORDS[bar];
    for (let step = 0; step < 8; step++) {
      const time = (bar * 8 + step) * eighth, note = MELODY[bar][step];
      if (note) {
        pluck(note, time, step % 2 ? 0.235 : 0.27, -0.13);
        pluck(note, time + eighth * 1.5, 0.034, 0.32, true);
      }
      if ([0, 3, 4, 6].includes(step)) {
        const bass = frequency(root + (step === 6 ? 7 : step === 3 ? 12 : 0));
        add(time, step === 4 ? 0.36 : 0.24, 0.235, 0, t => Math.exp(-t * 9) * (Math.sin(TAU * bass * t) + 0.12 * Math.sin(TAU * bass * 2 * t)));
      }
      if ([1, 3, 5, 7].includes(step)) chord.forEach((pitch, i) => pluck(pitch, time + i * 0.009, bar >= 8 ? 0.067 : 0.057, i % 2 ? -0.48 : 0.48, true));
      if (step === 0 || step === 4 || (bar % 4 === 3 && step === 7)) {
        add(time, 0.25, 0.27, 0, t => Math.sin(TAU * (47 * t + 85 * 0.025 * (1 - Math.exp(-t / 0.025)))) * Math.exp(-t * 20));
      }
      if (step === 2 || step === 6) {
        let previous = 0;
        add(time, 0.15, 0.12, 0.1, t => {
          const noise = random(), crisp = noise - previous * 0.6; previous = noise;
          return crisp * Math.exp(-t * 30) * 0.55 + Math.sin(TAU * 185 * t) * Math.exp(-t * 36) * 0.45;
        });
      }
      let previous = 0;
      add(time, step % 2 ? 0.055 : 0.035, step % 2 ? 0.026 : 0.017, -0.24, t => {
        const noise = random(), high = noise - previous; previous = noise;
        return high * Math.exp(-t * 70);
      });
      // A tiny tom pickup at the end of each phrase, rather than a loud cymbal.
      if (bar % 4 === 3 && step >= 6) add(time + eighth / 2, 0.12, 0.1, 0.24, t => Math.sin(TAU * (step === 6 ? 145 : 115) * t) * Math.exp(-t * 26));
    }
  }
  // Fixed headroom for the live engine and overlapping item cues. Normalize
  // both channels together, preserving stereo placement and musical dynamics.
  let peak = 0;
  for (const channel of channels) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  const gain = 0.72 / Math.max(0.72, peak);
  for (const channel of channels) for (let i = 0; i < length; i++) channel[i] *= gain;
  return channels;
}

const scores = new WeakMap<BaseAudioContext, AudioBuffer>();
export function createOriginalRaceMusic(context: BaseAudioContext): AudioBuffer {
  const existing = scores.get(context);
  if (existing) return existing;
  const channels = renderRaceScore();
  const buffer = context.createBuffer(2, channels[0].length, SCORE_SAMPLE_RATE);
  channels.forEach((samples, index) => buffer.getChannelData(index).set(samples));
  scores.set(context, buffer);
  return buffer;
}
