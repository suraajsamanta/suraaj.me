export type Point = { x: number; y: number; z: number };
const control: readonly number[][] = [
  [0, 0, -88], [48, 0, -88], [74, 1, -63], [79, 6, -25], [58, 13, 4],
  [56, 16, 45], [66, 11, 76], [40, 5, 96], [-8, 2, 91], [-56, 1, 80],
  [-78, 0, 55], [-73, 0, 10], [-79, 0, -29], [-66, 0, -68], [-42, 0, -87],
];
export const ROAD_WIDTH = 12;
export const course: Point[] = control.flatMap((p, i) =>
  Array.from({ length: 12 }, (_, j) => {
    const t = j / 12;
    const count = control.length;
    const [a, b, c] = [control[(i + count - 1) % count], control[(i + 1) % count], control[(i + 2) % count]];
    const spline = (k: number) => 0.5 * (2 * p[k] + (-a[k] + b[k]) * t +
      (2 * a[k] - 5 * p[k] + 4 * b[k] - c[k]) * t * t +
      (-a[k] + 3 * p[k] - 3 * b[k] + c[k]) * t * t * t);
    return { x: spline(0), y: spline(1), z: spline(2) };
  }),
);

export function heading(i: number) {
  const a = course[i], b = course[(i + 1) % course.length];
  return Math.atan2(b.x - a.x, b.z - a.z);
}

export function locate(x: number, z: number) {
  let d2 = Infinity, segment = 0, phase = 0;
  let px = 0, py = 0, pz = 0;
  for (let i = 0; i < course.length; i++) {
    const a = course[i], b = course[(i + 1) % course.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const sx = a.x + dx * t, sz = a.z + dz * t, dd = (x - sx) ** 2 + (z - sz) ** 2;
    if (dd < d2) {
      d2 = dd; segment = i; phase = t; px = sx; pz = sz; py = a.y + (b.y - a.y) * t;
    }
  }
  return { x: px, y: py, z: pz, distance: Math.sqrt(d2), segment, progress: (segment + phase) % course.length };
}

export function roadTriangles() {
  const positions: number[] = [], indices: number[] = [];
  course.forEach((p, i) => {
    const a = course[(i + course.length - 1) % course.length], b = course[(i + 1) % course.length];
    const angle = Math.atan2(b.x - a.x, b.z - a.z);
    const x = Math.cos(angle) * ROAD_WIDTH / 2, z = -Math.sin(angle) * ROAD_WIDTH / 2;
    positions.push(p.x - x, p.y, p.z - z, p.x + x, p.y, p.z + z);
    const k = i * 2, n = ((i + 1) % course.length) * 2;
    indices.push(k, n, k + 1, k + 1, n, n + 1);
  });
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

export function crossedForward(previous: number, current: number, marker: number, length = course.length) {
  const diff = ((current - previous + length * 1.5) % length) - length * 0.5;
  const toMarker = (marker - previous + length) % length;
  return diff > 0 && toMarker > 0 && toMarker <= diff + 1e-8;
}
