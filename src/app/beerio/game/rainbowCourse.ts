import type { TrackDefinition, Vec3 } from './track';

/** Original suspended ribbon: no shoulder, invisible wall, or safety rail. */
export const RAINBOW_COURSE: TrackDefinition = {
  id: 'rainbow',
  name: 'Prism Skyway',
  description: 'A rainbow ribbon above the stars. No rails: miss an edge and fall before respawning.',
  edgeBehavior: 'fall',
  samples: 640,
  shortcut: { start: 0.18, end: 0.30, side: -1, handle: 38 },
  controlPoints: [
    [-200, -145], [-110, -155], [-15, -155], [80, -150],
    [165, -125], [220, -75], [220, -10], [170, 30],
    [105, 5], [65, 35], [90, 95], [155, 130],
    [165, 195], [100, 225], [20, 200], [-40, 145],
    [-105, 170], [-175, 210], [-240, 175], [-250, 110],
    [-200, 65], [-135, 40], [-150, -10], [-230, -45],
    [-260, -100],
  ],
  // A level shortcut plateau avoids an intersecting deck at either junction.
  elevations: [46, 46, 60, 60, 60, 60, 60, 60, 60, 66, 78, 88, 94,
    88, 74, 61, 53, 45, 38, 34, 33, 38, 42, 45, 46],
  // The exposed edges are the challenge; no blind barrels on the narrow road.
  obstacles: [],
};

export const RAINBOW_COLORS: Vec3[] = [
  [1, 0.22, 0.39], [1, 0.53, 0.19], [1, 0.88, 0.28],
  [0.28, 0.91, 0.61], [0.20, 0.76, 1], [0.40, 0.39, 1], [0.86, 0.35, 1],
];

/** Subtle alternating panels retain depth cues without animated flashing. */
export function rainbowPanel(lane: number, panel: number): Vec3 {
  const color = RAINBOW_COLORS[lane % RAINBOW_COLORS.length];
  const light = Math.floor(panel / 4) % 2 ? 0.81 : 1;
  return color.map(value => value * light) as Vec3;
}
