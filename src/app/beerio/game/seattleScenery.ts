import { SHORTCUT_POINTS, TRACK_LENGTH, TRACK_POINTS, trackPose, type Vec3 } from './track';

type Color = [number, number, number];
/** Structural subset of the renderer's one-time geometry builder. */
export type SeattleGeometry = {
  triangle(a: Vec3, b: Vec3, c: Vec3, color: Color, glow?: boolean): void;
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Color, glow?: boolean): void;
  box(center: Vec3, size: Vec3, color: Color, yaw?: number): void;
  cylinder(center: Vec3, radius: number, height: number, color: Color, sides?: number, topRadius?: number): void;
  disc(center: Vec3, radiusX: number, radiusZ: number, color: Color, sides?: number): void;
  beam(a: Vec3, b: Vec3, width: number, color: Color): void;
};

export const SEATTLE_NEEDLE: Vec3 = [-105, 0, 55];
/** The route runs through all three overlapping glasshouse shells. */
export const SEATTLE_SPHERE_FRACTIONS = [0.92, 0.943, 0.966] as const;

/** Original low-poly Seattle-inspired landmarks, built once and reused by all views. */
export function addSeattleScenery(g: SeattleGeometry): void {
  const rock: Color = [0.39, 0.46, 0.47], snow: Color = [0.86, 0.92, 0.91];
  const evergreen: Color = [0.09, 0.32, 0.26], steel: Color = [0.61, 0.78, 0.79];
  // An actual raised mountain road: flanking terrain follows the very same
  // sampled road elevations, dropping away from the clear driving corridor.
  for (let i = 0; i < TRACK_POINTS.length - 1; i++) {
    const a = TRACK_POINTS[i], b = TRACK_POINTS[i + 1];
    if (a.y < 0.08 && b.y < 0.08) continue;
    for (const side of [-1, 1]) {
      const point = (distance: number, lane: number, drop: number): Vec3 => {
        const p = trackPose(distance, side * lane).position;
        return [p[0], Math.max(-0.1, p[1] - drop), p[2]];
      };
      const edges = [11, 18, 25, 33, 42, 55];
      const drop = (lane: number, height: number) => Math.min(height + .1, Math.max(.18, (lane - 11) / 44 * (height + .1)));
      for (let band = 0; band < edges.length - 1; band++) {
        const inner = edges[band], outer = edges[band + 1], middle = (inner + outer) / 2;
        const center = trackPose((a.distance + b.distance) / 2, side * middle).position;
        // On tight switchbacks, omit hillside patches that would intersect any
        // other part of the road or the physical branch corridor.
        const clearance = (outer - inner) / 2 + 9;
        const nearOtherRoad = TRACK_POINTS.some(q => {
          const delta = Math.abs(q.distance - (a.distance + b.distance) / 2);
          return Math.min(delta, TRACK_LENGTH - delta) > 25 && Math.hypot(q.x-center[0], q.z-center[2]) < clearance;
        });
        const nearBranch = SHORTCUT_POINTS.some(q => Math.hypot(q.x-center[0], q.z-center[2]) < clearance);
        if (nearOtherRoad || nearBranch) continue;
        const color = Math.max(a.y, b.y) > 23 && band < 2 ? snow : rock;
        g.quad(point(a.distance, inner, drop(inner, a.y)), point(b.distance, inner, drop(inner, b.y)),
          point(b.distance, outer, drop(outer, b.y)), point(a.distance, outer, drop(outer, a.y)), color);
      }
    }
  }
  // Distant snow summit behind the climb, made as faceted, irregular wedges.
  const summit: Vec3 = [268, 87, 7], base: Vec3[] = [[198, 0, -36], [252, 0, -77], [331, 0, -50], [344, 0, 37], [294, 0, 72], [214, 0, 67]];
  for (let i = 0; i < base.length; i++) {
    const a = base[i], b = base[(i + 1) % base.length];
    const pa: Vec3 = [summit[0] * 0.48 + a[0] * 0.52, summit[1] * 0.48, summit[2] * 0.48 + a[2] * 0.52];
    const pb: Vec3 = [summit[0] * 0.48 + b[0] * 0.52, summit[1] * 0.48, summit[2] * 0.48 + b[2] * 0.52];
    g.quad(a, b, pb, pa, i % 2 ? [0.39, 0.47, 0.51] : [0.48, 0.55, 0.58]);
    g.triangle(pa, pb, summit, i % 2 ? [0.8, 0.88, 0.9] : [0.94, 0.97, 0.96]);
  }
  // Needle on the inside of a roughly three-quarter circuit, with tapered legs,
  // observation saucer and spire; all elements are original geometry.
  const [nx, , nz] = SEATTLE_NEEDLE;
  const ivory: Color = [0.89, 0.88, 0.78], shadow: Color = [0.48, 0.58, 0.59];
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    g.beam([nx + Math.cos(a) * 9, 0, nz + Math.sin(a) * 9], [nx + Math.cos(a) * 2.8, 38, nz + Math.sin(a) * 2.8], 1.05, ivory);
    g.beam([nx + Math.cos(a) * 2.8, 38, nz + Math.sin(a) * 2.8], [nx + Math.cos(a) * 8, 55, nz + Math.sin(a) * 8], 0.8, ivory);
  }
  g.cylinder([nx, 0, nz], 2, 52, shadow, 10, 1.6);
  g.cylinder([nx, 51, nz], 12, 2.2, shadow, 24, 15);
  g.cylinder([nx, 53.2, nz], 15, 3, ivory, 24, 13.5);
  g.cylinder([nx, 56.2, nz], 13.5, 2.2, [0.32, 0.55, 0.61], 24, 10.5);
  g.cylinder([nx, 58.4, nz], 10.5, 1.4, ivory, 24, 3);
  g.cylinder([nx, 59.8, nz], 1.2, 16, ivory, 8, 0.15);
  g.disc([nx, 0.01, nz], 14, 14, [0.43, 0.53, 0.5]);

  // Three airy, open lattice spheres span the race road. No opaque shell or
  // posts obstruct driving; the bottom hoop sits below the road surface.
  for (const fraction of SEATTLE_SPHERE_FRACTIONS) {
    const p = trackPose(fraction * TRACK_LENGTH).position;
    const center: Vec3 = [p[0], p[1] + 14, p[2]], radius = 16;
    const sphere = (lat: number, lon: number): Vec3 => [center[0] + radius * Math.cos(lat) * Math.cos(lon), center[1] + radius * Math.sin(lat), center[2] + radius * Math.cos(lat) * Math.sin(lon)];
    for (let latIndex = -3; latIndex <= 3; latIndex++) {
      const lat = latIndex * Math.PI / 8;
      // Low hoops cross the road at each shell entrance. Keep the lattice
      // above even the tallest driver's head, as with the meridian beams.
      if (center[1] + radius * Math.sin(lat) <= p[1] + 3.5) continue;
      for (let i = 0; i < 24; i++) g.beam(sphere(lat, i * Math.PI / 12), sphere(lat, (i + 1) * Math.PI / 12), 0.075, steel);
    }
    for (let lon = 0; lon < 12; lon++) for (let i = -6; i < 6; i++) {
      const a = sphere(i * Math.PI / 12, lon * Math.PI / 6), b = sphere((i + 1) * Math.PI / 12, lon * Math.PI / 6);
      // The wire never crosses the road at kart height.
      if (Math.min(a[1], b[1]) > p[1] + 3.5) g.beam(a, b, 0.075, steel);
    }
  }
  // Cluster of small, varied buildings beyond the track, with bright windows.
  const buildings: [number, number, number, number, number][] = [
    [-245,-75,21,17,39],[-230,-42,17,19,52],[-231,-12,18,16,31],[-220,28,20,17,45],
    [-203,82,20,19,43],[-176,118,18,19,35],[-118,151,23,19,38],[-78,151,22,17,48],
    [-40,137,18,16,29],[5,120,19,18,34],[30,100,18,18,28],[-233,-111,22,18,33],
  ];
  for (let i = 0; i < buildings.length; i++) {
    const [x,z,w,d,h] = buildings[i];
    g.box([x,h/2,z], [w,h,d], i % 2 ? [0.31,0.43,0.46] : [0.42,0.53,0.53]);
    for (let y = 5; y < h - 3; y += 6) for (let dx = -w / 2 + 3; dx < w / 2 - 1; dx += 5)
      g.box([x+dx,y,z+d/2+0.05], [2.1,2.4,0.12], [0.65,0.8,0.77]);
  }
  // Sparse evergreens by the mountain, safely beyond both road corridors.
  for (let i = 0; i < 24; i++) {
    const fraction = 0.24 + i / 24 * 0.29, side = i % 2 ? -1 : 1;
    const p = trackPose(fraction * TRACK_LENGTH, side * (21 + i % 3 * 5)).position;
    if (SHORTCUT_POINTS.some(q => Math.hypot(q.x - p[0], q.z - p[2]) < 15)) continue;
    const h = 5 + i % 4, y = Math.max(0, p[1] - 4);
    g.cylinder([p[0], y, p[2]], 0.3, h, [0.36,0.28,0.2], 6);
    g.cylinder([p[0], y + h * 0.25, p[2]], 2.3, h * 0.7, evergreen, 7, 0);
    g.cylinder([p[0], y + h * 0.52, p[2]], 1.7, h * 0.6, [0.14,0.4,0.31], 7, 0);
  }
}
