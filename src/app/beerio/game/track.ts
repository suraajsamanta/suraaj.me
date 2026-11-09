import { SPACE_COURSE } from './spaceCourse';
import { FOUNDRY_COURSE } from './foundryCourse';

/** Original closed circuit. Distances are world metres, not screen coordinates. */
export type Vec3 = [number, number, number];
export type TrackPoint = { x: number; y: number; z: number; distance: number };
export type TrackPose = { position: Vec3; forward: Vec3; right: Vec3; yaw: number };

export type TrackId = 'sunset' | 'canyon' | 'brewery' | 'seattle' | 'space' | 'foundry';
export type TrackObstacle = { fraction: number; lane: number; kind: 'barrel' | 'oil' };
export type TrackDefinition = {
  id: TrackId; name: string; description: string;
  controlPoints: [number, number][]; elevations?: number[]; samples?: number; obstacles: TrackObstacle[];
  shortcut: { start: number; end: number; side: -1 | 1; handle?: number };
};

/** Hand-authored loops and hazard placements, shared by simulation and renderer. */
export const TRACKS: TrackDefinition[] = [
  {
    id: 'sunset', name: 'Sunset Circuit', description: 'A fast desert loop with sweeping bends.',
    shortcut: { start: 0.35, end: 0.53, side: -1 },
    controlPoints: [[-90, -65], [-10, -92], [85, -70], [119, -5], [78, 55], [20, 34], [-32, 79], [-110, 53], [-128, -13]],
    obstacles: [
      { fraction: 0.27, lane: -3.6, kind: 'barrel' }, { fraction: 0.27, lane: 3.6, kind: 'barrel' },
      { fraction: 0.58, lane: 2.8, kind: 'oil' }, { fraction: 0.87, lane: -2.8, kind: 'oil' },
    ],
  },
  {
    id: 'canyon', name: 'Canyon Switchback', description: 'Tight turns and a tricky barrel slalom.',
    shortcut: { start: 0.25, end: 0.43, side: -1 },
    controlPoints: [[-115, -85], [-35, -110], [45, -93], [100, -110], [145, -58], [112, -10], [45, -25], [16, 7], [88, 36], [115, 82], [51, 105], [-5, 70], [-61, 103], [-128, 69], [-151, -5]],
    obstacles: [
      { fraction: 0.16, lane: -3, kind: 'barrel' }, { fraction: 0.20, lane: 3, kind: 'barrel' },
      { fraction: 0.35, lane: 2, kind: 'oil' }, { fraction: 0.59, lane: -3.4, kind: 'barrel' },
      { fraction: 0.64, lane: 3.4, kind: 'barrel' }, { fraction: 0.83, lane: 0, kind: 'oil' },
    ],
  },
  {
    id: 'brewery', name: 'Brewery Run', description: 'Long straights, chicanes and slippery spills.',
    shortcut: { start: 0.15, end: 0.33, side: -1 },
    controlPoints: [[-130, -70], [-45, -85], [40, -75], [124, -91], [159, -38], [130, 8], [75, 14], [30, -12], [-8, 15], [28, 46], [103, 47], [125, 89], [41, 109], [-35, 91], [-109, 103], [-155, 55], [-144, 3]],
    obstacles: [
      { fraction: 0.12, lane: 0, kind: 'oil' }, { fraction: 0.31, lane: -3.5, kind: 'barrel' },
      { fraction: 0.31, lane: 3.5, kind: 'barrel' }, { fraction: 0.52, lane: 2.8, kind: 'oil' },
      { fraction: 0.73, lane: -2.8, kind: 'oil' }, { fraction: 0.91, lane: 0, kind: 'barrel' },
    ],
  },
  {
    id: 'seattle', name: 'Seattle Skyline', description: 'Climb Rainier, circle the Needle and race through the glass Spheres.',
    // The bypass cuts across a city bend, never across the mountain or a lap gate.
    shortcut: { start: 0.58, end: 0.70, side: 1 },
    controlPoints: [
      [-165, -100], [-105, -100], [-30, -100], [45, -90], [110, -75],
      [155, -40], [170, 5], [145, 35], [110, 32], [85, 8], [65, 0],
      [30, 10], [-30, 10], [-65, 20], [-65, 75], [-90, 100],
      [-125, 95], [-145, 70], [-155, 35], [-153, 5], [-160, -25], [-180, -65],
    ],
    // A continuous physical climb and descent, measured in the same world units as the road.
    elevations: [0, 0, 0, 0, 6, 16, 28, 28, 21, 14, 7, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    obstacles: [
      { fraction: 0.12, lane: -3.4, kind: 'barrel' }, { fraction: 0.29, lane: 2.8, kind: 'oil' },
      { fraction: 0.47, lane: 3.2, kind: 'barrel' }, { fraction: 0.78, lane: -2.8, kind: 'oil' },
    ],
  },
  SPACE_COURSE,
  FOUNDRY_COURSE,
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
export let ACTIVE_SHORTCUT = ACTIVE_TRACK.shortcut;
/** Branch samples have physical (not lap-progress) distance. */
export let SHORTCUT_POINTS: TrackPoint[] = [];
export let SHORTCUT_LENGTH = 0;

/** Sample without changing the active race, for previews and minimaps. */
export function sampleTrack(track: TrackDefinition): TrackPoint[] {
  const sampled: TrackPoint[] = [];
  const samples = track.samples ?? SAMPLES;
  let distance = 0;
  const elevationPoints: [number, number][] | undefined = track.elevations?.map(value => [value, 0]);
  for (let i = 0; i <= samples; i++) {
    const t = (i % samples) / samples;
    const [x, z] = curve(t, track.controlPoints);
    const y = elevationPoints ? Math.max(0, curve(t, elevationPoints)[0]) : 0;
    const previous = sampled[i - 1];
    if (previous) distance += Math.hypot(x - previous.x, y - previous.y, z - previous.z);
    sampled.push({ x, y, z, distance });
  }
  return sampled;
}

/** Choose a circuit before creating a race and renderer. Never switch during a race. */
export function selectTrack(id: TrackId | string): TrackDefinition {
  ACTIVE_TRACK = TRACKS.find((track) => track.id === id) ?? TRACKS[0];
  TRACK_POINTS = sampleTrack(ACTIVE_TRACK);
  TRACK_LENGTH = TRACK_POINTS[TRACK_POINTS.length - 1].distance;
  ACTIVE_SHORTCUT = ACTIVE_TRACK.shortcut;
  buildShortcut();
  return ACTIVE_TRACK;
}
export const wrap = (value: number, length = TRACK_LENGTH) => ((value % length) + length) % length;
export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function trackPose(at: number, lane = 0, height = 0): TrackPose {
  return poseOnTrack(TRACK_POINTS, TRACK_LENGTH, at, lane, height);
}

function poseOnTrack(points: TrackPoint[], length: number, at: number, lane = 0, height = 0): TrackPose {
  const d = wrap(at, length);
  let low = 0, high = points.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (points[mid].distance <= d) low = mid;
    else high = mid;
  }
  const a = points[low], b = points[low + 1];
  const segmentLength = b.distance - a.distance;
  const f = segmentLength > 0 ? (d - a.distance) / segmentLength : 0;
  const dx = (b.x - a.x) / segmentLength, dy = (b.y - a.y) / segmentLength, dz = (b.z - a.z) / segmentLength;
  const horizontal = Math.hypot(dx, dz) || 1, rx = dz / horizontal, rz = -dx / horizontal;
  return {
    position: [a.x + (b.x - a.x) * f + rx * lane, a.y + (b.y - a.y) * f + height, a.z + (b.z - a.z) * f + rz * lane],
    forward: [dx, dy, dz], right: [rx, 0, rz], yaw: Math.atan2(dx, dz),
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

/** Build a tangent-matched branch, sampled in physical metres. */
function buildShortcut(): void {
  SHORTCUT_POINTS = sampleShortcut(ACTIVE_TRACK);
  SHORTCUT_LENGTH = SHORTCUT_POINTS[SHORTCUT_POINTS.length - 1].distance;
}

/** Pure branch samples for a course preview, without selecting it. */
export function sampleShortcut(track: TrackDefinition): TrackPoint[] {
  const points = sampleTrack(track), length = points[points.length - 1].distance;
  const { start, end } = track.shortcut;
  const a = poseOnTrack(points, length, start * length), b = poseOnTrack(points, length, end * length);
  const chord = Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2]);
  const handle = track.shortcut.handle ?? Math.min(chord * 0.24, 22);
  const p0 = a.position, p1 = [p0[0] + a.forward[0] * handle, p0[1] + a.forward[1] * handle, p0[2] + a.forward[2] * handle];
  const p3 = b.position, p2 = [p3[0] - b.forward[0] * handle, p3[1] - b.forward[1] * handle, p3[2] - b.forward[2] * handle];
  const result: TrackPoint[] = [];
  let distance = 0;
  for (let i = 0; i <= 128; i++) {
    const t = i / 128, u = 1 - t;
    const x = u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0];
    const y = u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1];
    const z = u ** 3 * p0[2] + 3 * u * u * t * p1[2] + 3 * u * t * t * p2[2] + t ** 3 * p3[2];
    const previous = result[i - 1];
    if (previous) distance += Math.hypot(x - previous.x, y - previous.y, z - previous.z);
    result.push({ x, y, z, distance });
  }
  return result;
}

/** Position on the branch for the equivalent distance along the main loop. */
export function shortcutPose(at: number, lane = 0, height = 0): TrackPose {
  const { start, end } = ACTIVE_SHORTCUT;
  const fraction = (wrap(at) / TRACK_LENGTH - start) / (end - start);
  // Looking ahead or behind through a junction continues onto the main road.
  if (fraction < 0 || fraction > 1) return trackPose(at, lane, height);
  const d = fraction * SHORTCUT_LENGTH;
  let low = 0, high = SHORTCUT_POINTS.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (SHORTCUT_POINTS[mid].distance <= d) low = mid; else high = mid;
  }
  const a = SHORTCUT_POINTS[low], b = SHORTCUT_POINTS[low + 1];
  const length = b.distance - a.distance;
  const f = length ? (d - a.distance) / length : 0;
  const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length, dz = (b.z - a.z) / length;
  const horizontal = Math.hypot(dx, dz) || 1, rx = dz / horizontal, rz = -dx / horizontal;
  return { position: [a.x + (b.x - a.x) * f + rx * lane, a.y + (b.y - a.y) * f + height, a.z + (b.z - a.z) * f + rz * lane],
    forward: [dx, dy, dz], right: [rx, 0, rz], yaw: Math.atan2(dx, dz) };
}

selectTrack('sunset');
