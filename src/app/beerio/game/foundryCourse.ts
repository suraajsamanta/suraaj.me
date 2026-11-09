import type { TrackDefinition, Vec3 } from './track';

/** A technical, folded industrial circuit with two climbing switchback sections. */
export const FOUNDRY_COURSE: TrackDefinition = {
  id: 'foundry',
  name: 'Foundry Frenzy',
  // Keep the longest circuit as smooth as the shorter roads at every seam.
  samples: 720,
  description: 'Master furnace hairpins, climbing switchbacks and a risky maintenance bridge.',
  // Long tangent handles keep the bypass a drivable arc, not a kink at its joins.
  shortcut: { start: 0.18, end: 0.28, side: -1, handle: 44 },
  controlPoints: [
    [-240, -180], [-150, -180], [-70, -180], [20, -180], [110, -180],
    [185, -170], [225, -130], [225, -85], [185, -55], [125, -60],
    [70, -80], [15, -55], [-45, -70], [-105, -55], [-145, -20],
    [-130, 20], [-75, 35], [-20, 20], [35, 45], [95, 30],
    [150, 50], [195, 90], [185, 145], [135, 175], [75, 150],
    [25, 125], [-30, 150], [-70, 190], [-135, 190], [-185, 155],
    [-175, 100], [-215, 65], [-260, 30], [-285, -35], [-280, -150],
  ],
  // The first furnace plateau is level across BOTH routes. Diverging road
  // surfaces must not slice through each other at an elevated merge.
  elevations: [8, 8, 14, 24, 24, 24, 24, 24, 24, 24, 24, 18, 15, 14, 14,
    15, 22, 30, 37, 39, 36, 29, 21, 15, 12, 10, 8, 8, 8, 8, 9, 10, 10, 9, 8],
  // Deliberate alternating hazards, with room to pass and no blind crest blockers.
  obstacles: [
    { fraction: 0.11, lane: -3.5, kind: 'barrel' },
    { fraction: 0.30, lane: 3.3, kind: 'barrel' },
    { fraction: 0.35, lane: -3.3, kind: 'barrel' },
    { fraction: 0.39, lane: 3.0, kind: 'oil' },
    { fraction: 0.59, lane: -3.5, kind: 'barrel' },
    { fraction: 0.67, lane: 3.1, kind: 'oil' },
    { fraction: 0.73, lane: -3.4, kind: 'barrel' },
    { fraction: 0.88, lane: 3.3, kind: 'barrel' },
  ],
};

export const FOUNDRY_SECTORS = [
  { name: 'Loading Straight', start: 0, end: 0.18 },
  { name: 'Furnace Hairpin', start: 0.18, end: 0.30 },
  { name: 'Slag Slalom', start: 0.30, end: 0.43 },
  { name: 'Skyline Switchbacks', start: 0.43, end: 0.59 },
  { name: 'Crucible Carousel', start: 0.59, end: 0.72 },
  { name: 'Cooling Coil', start: 0.72, end: 0.90 },
  { name: 'Home Conveyor', start: 0.90, end: 1 },
] as const;

export const FOUNDRY_THEME = {
  ground: [0.17, 0.19, 0.23] as Vec3,
  road: [0.22, 0.25, 0.31] as Vec3,
  shoulder: [0.31, 0.33, 0.37] as Vec3,
  stripe: [0.96, 0.90, 0.72] as Vec3,
  curb: [1, 0.62, 0.16] as Vec3,
  rail: [0.48, 0.57, 0.62] as Vec3,
};
