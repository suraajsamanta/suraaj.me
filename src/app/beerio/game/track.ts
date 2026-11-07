/** Original closed circuit. Distances are world metres, not screen coordinates. */
export type Vec3 = [number, number, number];
export type TrackPoint = { x: number; z: number; distance: number };
export type TrackPose = { position: Vec3; forward: Vec3; right: Vec3; yaw: number };

export type TrackId = 'sunset' | 'canyon' | 'brewery';
export type TrackObstacle = { fraction: number; lane: number; kind: 'barrel' | 'oil' };
export type TrackDefinition = {
  id: TrackId; name: string; description: string;
  controlPoints: [number, number][]; obstacles: TrackObstacle[];
};

/** Hand-authored loops and hazard placements, shared by simulation and renderer. */
export const TRACKS: TrackDefinition[] = [
  {
    id: 'sunset', name: 'Sunset Circuit', description: 'A fast desert loop with sweeping bends.',
    controlPoints: [[-90, -65], [-10, -92], [85, -70], [119, -5], [78, 55], [20, 34], [-32, 79], [-110, 53], [-128, -13]],
    obstacles: [
      { fraction: 0.27, lane: -3.6, kind: 'barrel' }, { fraction: 0.27, lane: 3.6, kind: 'barrel' },
      { fraction: 0.58, lane: 2.8, kind: 'oil' }, { fraction: 0.87, lane: -2.8, kind: 'oil' },
    ],
  },
  {
    id: 'canyon', name: 'Canyon Switchback', description: 'Tight turns and a tricky barrel slalom.',
    controlPoints: [[-115, -85], [-35, -110], [45, -93], [100, -110], [145, -58], [112, -10], [45, -25], [16, 7], [88, 36], [115, 82], [51, 105], [-5, 70], [-61, 103], [-128, 69], [-151, -5]],
    obstacles: [
      { fraction: 0.16, lane: -3, kind: 'barrel' }, { fraction: 0.20, lane: 3, kind: 'barrel' },
      { fraction: 0.35, lane: 2, kind: 'oil' }, { fraction: 0.59, lane: -3.4, kind: 'barrel' },
      { fraction: 0.64, lane: 3.4, kind: 'barrel' }, { fraction: 0.83, lane: 0, kind: 'oil' },
    ],
  },
  {
    id: 'brewery', name: 'Brewery Run', description: 'Long straights, chicanes and slippery spills.',
    controlPoints: [[-130, -70], [-45, -85], [40, -75], [124, -91], [159, -38], [130, 8], [75, 14], [30, -12], [-8, 15], [28, 46], [103, 47], [125, 89], [41, 109], [-35, 91], [-109, 103], [-155, 55], [-144, 3]],
    obstacles: [
      { fraction: 0.12, lane: 0, kind: 'oil' }, { fraction: 0.31, lane: -3.5, kind: 'barrel' },
      { fraction: 0.31, lane: 3.5, kind: 'barrel' }, { fraction: 0.52, lane: 2.8, kind: 'oil' },
      { fraction: 0.73, lane: -2.8, kind: 'oil' }, { fraction: 0.91, lane: 0, kind: 'barrel' },
    ],
  },
];
export const ROAD_HALF_WIDTH = 7;
export const BARRIER_OFFSET = 10.2;
export const BOOST_LANES = [-3.5, 3.5, 0];
export const BOOST_FRACTIONS = [0.18, 0.47, 0.76];
const SAMPLES = 432;

function curve(t: number, points: [number, number][]): [number, number] {
  const scaled = t * points.length;
  const index = Math.floor(scaled);
  const a = scaled - index;
  const p = (offset: number) => points[(index + offset + points.length) % points.length];
  const p0 = p(-1), p1 = p(0), p2 = p(1), p3 = p(2);
  const coordinate = (i: number) => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * a +
    (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * a * a +
    (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * a * a * a);
  return [coordinate(0), coordinate(1)];
}

export let ACTIVE_TRACK: TrackDefinition = TRACKS[0];
export let TRACK_POINTS: TrackPoint[] = [];
export let TRACK_LENGTH = 0;

/** Sample without changing the active race, for previews and minimaps. */
export function sampleTrack(track: TrackDefinition): TrackPoint[] {
  const sampled: TrackPoint[] = [];
  let distance = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const [x, z] = curve((i % SAMPLES) / SAMPLES, track.controlPoints);
    const previous = sampled[i - 1];
    if (previous) distance += Math.hypot(x - previous.x, z - previous.z);
    sampled.push({ x, z, distance });
  }
  return sampled;
}

/** Choose a circuit before creating a race and renderer. Never switch during a race. */
export function selectTrack(id: TrackId | string): TrackDefinition {
  ACTIVE_TRACK = TRACKS.find((track) => track.id === id) ?? TRACKS[0];
  TRACK_POINTS = sampleTrack(ACTIVE_TRACK);
  TRACK_LENGTH = TRACK_POINTS[TRACK_POINTS.length - 1].distance;
  return ACTIVE_TRACK;
}
selectTrack('sunset');
export const wrap = (value: number, length = TRACK_LENGTH) => ((value % length) + length) % length;
export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function trackPose(at: number, lane = 0, height = 0): TrackPose {
  const d = wrap(at);
  let low = 0, high = SAMPLES;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (TRACK_POINTS[mid].distance <= d) low = mid;
    else high = mid;
  }
  const a = TRACK_POINTS[low], b = TRACK_POINTS[low + 1];
  const segmentLength = b.distance - a.distance;
  const f = segmentLength > 0 ? (d - a.distance) / segmentLength : 0;
  const dx = (b.x - a.x) / segmentLength, dz = (b.z - a.z) / segmentLength;
  return {
    position: [a.x + (b.x - a.x) * f + dz * lane, height, a.z + (b.z - a.z) * f - dx * lane],
    forward: [dx, 0, dz], right: [dz, 0, -dx], yaw: Math.atan2(dx, dz),
  };
}

export function trackCurve(at: number): number {
  const a = trackPose(at - 3).yaw, b = trackPose(at + 3).yaw;
  return Math.atan2(Math.sin(b - a), Math.cos(b - a)) / 6;
}

export function circularDistance(a: number, b: number): number {
  const delta = wrap(a - b);
  return delta > TRACK_LENGTH / 2 ? delta - TRACK_LENGTH : delta;
}
