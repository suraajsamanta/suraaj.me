import type { TrackDefinition, Vec3 } from './track';

/** An original orbital ribbon, not a reskin of one of the ground circuits. */
export const SPACE_COURSE: TrackDefinition = {
  id: 'space',
  name: 'Orbital Overdrive',
  description: 'Climb out of the station, thread the asteroid esses and sweep past a ringed planet.',
  // A tangent-matched maintenance bridge bypasses the first asteroid bend. Lap
  // progress still comes exclusively from the shared physical route system.
  shortcut: { start: 0.21, end: 0.32, side: -1 },
  controlPoints: [
    [-175, -95], [-95, -135], [-10, -120], [50, -160],
    [130, -150], [185, -100], [180, -40], [120, -15],
    [90, 30], [145, 68], [210, 95], [220, 155],
    [155, 195], [80, 170], [25, 125], [-30, 150],
    [-75, 215], [-140, 195], [-175, 140], [-130, 95],
    [-125, 55], [-190, 25], [-235, -15], [-220, -75],
  ],
  // Physical metres above the void. The highest grade is below 19%; neither
  // the camera nor collision model has to pretend that a flat road is a hill.
  elevations: [18, 18, 24, 32, 43, 51, 53, 48, 39, 37, 43, 54, 61, 58, 49, 40, 34, 28, 22, 16, 13, 12, 14, 17],
  obstacles: [
    { fraction: 0.14, lane: -3.3, kind: 'barrel' },
    { fraction: 0.30, lane: 3.2, kind: 'barrel' },
    { fraction: 0.34, lane: -3.2, kind: 'barrel' },
    { fraction: 0.54, lane: 2.8, kind: 'oil' },
    { fraction: 0.72, lane: -3.1, kind: 'barrel' },
    { fraction: 0.89, lane: 3.0, kind: 'oil' },
  ],
};

/** Shared landmark coordinates keep the scenery and route assertions aligned. */
export const SPACE_LANDMARKS = {
  ringedPlanet: { center: [340, 105, 125] as Vec3, radius: 76, ringInner: 93, ringOuter: 124 },
  blueMoon: { center: [-40, 155, -355] as Vec3, radius: 61 },
  station: { fraction: 0.014, halfLength: 22, halfWidth: 12.4, roofHeight: 14 },
  navigationGates: [0.105, 0.19, 0.395, 0.565, 0.79, 0.925],
  asteroidSectors: [[0.225, 0.39], [0.65, 0.79]] as [number, number][],
};

export const SPACE_SECTORS = [
  { name: 'Departure Dock', start: 0, end: 0.105 },
  { name: 'Solar Climb', start: 0.105, end: 0.225 },
  { name: 'Asteroid Esses', start: 0.225, end: 0.395 },
  { name: 'Planet Sweep', start: 0.395, end: 0.565 },
  { name: 'Comet Chicane', start: 0.565, end: 0.79 },
  { name: 'Docking Approach', start: 0.79, end: 1 },
] as const;

/** Opaque vertex colors; the renderer uses these with a matching dark sky. */
export const SPACE_THEME = {
  sky: [0.018, 0.024, 0.065] as Vec3,
  road: [0.105, 0.13, 0.23] as Vec3,
  shoulder: [0.18, 0.22, 0.35] as Vec3,
  stripe: [0.49, 0.94, 1] as Vec3,
  curb: [0.56, 0.36, 0.92] as Vec3,
  rail: [0.23, 0.85, 0.96] as Vec3,
};
