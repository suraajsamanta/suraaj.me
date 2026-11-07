/** Original closed circuit. Distances are world metres, not screen coordinates. */
export type Vec3 = [number, number, number];
export type TrackPoint = { x: number; z: number; distance: number };
export type TrackPose = { position: Vec3; forward: Vec3; right: Vec3; yaw: number };

const CONTROL_POINTS: [number, number][] = [
  [-90, -65], [-10, -92], [85, -70], [119, -5],
  [78, 55], [20, 34], [-32, 79], [-110, 53], [-128, -13],
];
export const ROAD_HALF_WIDTH = 7;
export const BARRIER_OFFSET = 10.2;
export const BOOST_LANES = [-3.5, 3.5, 0];
export const BOOST_FRACTIONS = [0.18, 0.47, 0.76];
const SAMPLES = 432;

function curve(t: number): [number, number] {
  const scaled = t * CONTROL_POINTS.length;
  const index = Math.floor(scaled);
  const a = scaled - index;
  const p = (offset: number) => CONTROL_POINTS[(index + offset + CONTROL_POINTS.length) % CONTROL_POINTS.length];
  const p0 = p(-1), p1 = p(0), p2 = p(1), p3 = p(2);
  const coordinate = (i: number) => 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * a +
    (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * a * a +
    (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * a * a * a);
  return [coordinate(0), coordinate(1)];
}

export const TRACK_POINTS: TrackPoint[] = [];
let distance = 0;
for (let i = 0; i <= SAMPLES; i++) {
  const [x, z] = curve((i % SAMPLES) / SAMPLES);
  const previous = TRACK_POINTS[i - 1];
  if (previous) distance += Math.hypot(x - previous.x, z - previous.z);
  TRACK_POINTS.push({ x, z, distance });
}
export const TRACK_LENGTH = distance;
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
