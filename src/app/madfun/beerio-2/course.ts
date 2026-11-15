export type Point = { x: number; y: number; z: number };
export type TrackId = 'seattle' | 'orbit';
export type TrackConfig = {
  id: TrackId;
  name: string;
  subtitle: string;
  description: string;
  roadWidth: number;
  accent: string;
  points: Point[];
};

const seattleControl: readonly number[][] = [
  [0, 0, -88], [48, 0, -88], [74, 1, -63], [79, 6, -25], [58, 13, 4],
  [56, 16, 45], [66, 11, 76], [40, 5, 96], [-8, 2, 91], [-56, 1, 80],
  [-78, 0, 55], [-73, 0, 10], [-79, 0, -29], [-66, 0, -68], [-42, 0, -87],
];

// A broad launch straight feeds a rising outer sweep, an inward S bend, then
// a descending lunar crescent. The projected loop never crosses itself: the
// same unambiguous centerline drives collisions, gates, minimap and recovery.
const orbitControl: readonly number[][] = [
  [0, 8, -110], [48, 8, -110], [94, 12, -91], [119, 19, -52],
  [115, 25, -9], [83, 26, 20], [62, 23, 52], [68, 16, 88],
  [42, 10, 120], [-3, 6, 130], [-49, 4, 115], [-77, 5, 83],
  [-68, 9, 47], [-89, 14, 16], [-119, 17, -17], [-122, 15, -56],
  [-94, 11, -91], [-50, 8, -110],
];

function splineLoop(control: readonly number[][]): Point[] {
  return control.flatMap((p, i) => Array.from({ length: 12 }, (_, j) => {
    const t = j / 12;
    const count = control.length;
    const [a, b, c] = [control[(i + count - 1) % count], control[(i + 1) % count], control[(i + 2) % count]];
    const spline = (k: number) => 0.5 * (2 * p[k] + (-a[k] + b[k]) * t +
      (2 * a[k] - 5 * p[k] + 4 * b[k] - c[k]) * t * t +
      (-a[k] + 3 * p[k] - 3 * b[k] + c[k]) * t * t * t);
    return { x: spline(0), y: spline(1), z: spline(2) };
  }));
}

export const ROAD_WIDTH = 12;
// Retain the original default export contract for existing Seattle consumers.
export const course: Point[] = splineLoop(seattleControl);
export const orbitalCourse: Point[] = splineLoop(orbitControl);
export const TRACKS: readonly TrackConfig[] = [
  {
    id: 'seattle', name: 'Seattle Night', subtitle: 'City lights. Elevated corners.',
    description: 'Thread the waterfront and climb the neon-lit viaduct beneath the Space Needle.',
    roadWidth: ROAD_WIDTH, accent: '#64ffce', points: course,
  },
  {
    id: 'orbit', name: 'Neon Orbit', subtitle: 'Deep space. Sweeping elevation.',
    description: 'Launch onto a floating circuit, climb the planetary sweep and dive through the lunar S bends.',
    roadWidth: ROAD_WIDTH, accent: '#b8a0ff', points: orbitalCourse,
  },
];

export function isTrackId(value: unknown): value is TrackId {
  return value === 'seattle' || value === 'orbit';
}

export function getTrack(id: TrackId): TrackConfig {
  return TRACKS[id === 'orbit' ? 1 : 0];
}

export function heading(i: number, path: readonly Point[] = course) {
  const index = ((i % path.length) + path.length) % path.length;
  const a = path[index], b = path[(index + 1) % path.length];
  return Math.atan2(b.x - a.x, b.z - a.z);
}

export function locate(x: number, z: number, path: readonly Point[] = course) {
  let d2 = Infinity, segment = 0, phase = 0;
  let px = 0, py = 0, pz = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const sx = a.x + dx * t, sz = a.z + dz * t, dd = (x - sx) ** 2 + (z - sz) ** 2;
    if (dd < d2) {
      d2 = dd; segment = i; phase = t; px = sx; pz = sz; py = a.y + (b.y - a.y) * t;
    }
  }
  return { x: px, y: py, z: pz, distance: Math.sqrt(d2), segment, progress: (segment + phase) % path.length };
}

export function roadTriangles(path: readonly Point[] = course, width = ROAD_WIDTH) {
  const positions: number[] = [], indices: number[] = [];
  path.forEach((p, i) => {
    const a = path[(i + path.length - 1) % path.length], b = path[(i + 1) % path.length];
    const angle = Math.atan2(b.x - a.x, b.z - a.z);
    const x = Math.cos(angle) * width / 2, z = -Math.sin(angle) * width / 2;
    positions.push(p.x - x, p.y, p.z - z, p.x + x, p.y, p.z + z);
    const k = i * 2, n = ((i + 1) % path.length) * 2;
    indices.push(k, n, k + 1, k + 1, n, n + 1);
  });
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

export function crossedForward(previous: number, current: number, marker: number, length = course.length) {
  const diff = ((current - previous + length * 1.5) % length) - length * 0.5;
  const toMarker = (marker - previous + length) % length;
  return diff > 0 && toMarker > 0 && toMarker <= diff + 1e-8;
}
