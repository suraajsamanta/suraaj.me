import type { TrackId } from './track';

/** Six arrangements for seven courses are original, built locally from authored note data. */
export const RACE_SCORES = {
  sunset: { title: 'Golden Hour Rally', bpm: 148, file: 'golden-hour-rally.wav', character: 'Stadium brass, marching snares and a soaring victory hook' },
  canyon: { title: 'Red Rock Regiment', bpm: 144, file: 'red-rock-regiment.wav', character: 'Low horns, stomping toms and wide canyon echoes' },
  brewery: { title: 'Brass on Tap', bpm: 148, file: 'brass-on-tap.wav', character: 'Bouncing low brass, bright horn answers and a rolling drumline' },
  seattle: { title: 'Skyline Sound', bpm: 144, file: 'skyline-sound.wav', character: 'Electric keys, warm synth brass and a tight city breakbeat' },
  space: { title: 'Orbital Anthem', bpm: 148, file: 'orbital-anthem.wav', character: 'Cosmic synth horns, shimmering pads and orbiting arpeggios' },
  // The suspended rainbow course shares the original cosmic arrangement.
  rainbow: { title: 'Orbital Anthem', bpm: 148, file: 'orbital-anthem.wav', character: 'Cosmic synth horns, shimmering pads and orbiting arpeggios' },
  foundry: { title: 'Ironworks Uprising', bpm: 152, file: 'ironworks-uprising.wav', character: 'Heavy low brass, metallic percussion and a driving pulse' },
} as const satisfies Record<TrackId, { title: string; bpm: number; file: string; character: string }>;

export function raceScore(trackId: TrackId = 'sunset') { return RACE_SCORES[trackId] ?? RACE_SCORES.sunset; }
export function raceScoreUrl(trackId: TrackId = 'sunset') { return `/beerio/audio/${raceScore(trackId).file}`; }
