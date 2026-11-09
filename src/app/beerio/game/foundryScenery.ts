import { SHORTCUT_LENGTH, SHORTCUT_POINTS, TRACK_LENGTH, TRACK_POINTS, shortcutPose, trackPose, type Vec3 } from './track';
import { FOUNDRY_COURSE, FOUNDRY_THEME } from './foundryCourse';
import type { SceneryGeometry } from './spaceScenery';

type Color = Vec3;
export interface FoundryGeometry extends SceneryGeometry {
  disc(center: Vec3, radiusX: number, radiusZ: number, color: Color, sides?: number): void;
}
const STEEL: Color = [0.25, 0.31, 0.36], DARK: Color = [0.10, 0.13, 0.18];
const RUST: Color = [0.58, 0.28, 0.20], GOLD: Color = [1, 0.62, 0.16];
const MOLTEN: Color = [1, 0.31, 0.07], HOT: Color = [1, 0.82, 0.27];
const PALE: Color = [0.70, 0.77, 0.77], CYAN: Color = [0.38, 0.87, 0.91];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Radius includes every part of the prop. Reject against both possible routes. */
export function foundryCorridorClear(center: Vec3, radius: number): boolean {
  return [...TRACK_POINTS, ...SHORTCUT_POINTS].every(point => Math.hypot(point.x - center[0], point.z - center[2]) >= radius + 14);
}
export type FoundryProp = { center: Vec3; radius: number; height: number; kind: 'furnace' | 'tank' | 'warehouse'; yaw: number };
/** Authored candidates with deterministic clearance, independent of player count. */
export function foundryPropLayout(): FoundryProp[] {
  const result: FoundryProp[] = [];
  for (let i = 0; i < 40; i++) {
    const pose = trackPose((i + 0.3) / 40 * TRACK_LENGTH, (i % 2 ? -1 : 1) * (36 + i % 4 * 13));
    const center: Vec3 = [pose.position[0], 0, pose.position[2]];
    const radius = i % 3 === 0 ? 16 : 9;
    if (!foundryCorridorClear(center, radius) || result.some(prop => Math.hypot(prop.center[0] - center[0], prop.center[2] - center[2]) < prop.radius + radius + 6)) continue;
    result.push({ center, radius, height: 17 + i % 5 * 6, kind: i % 3 === 0 ? 'warehouse' : i % 3 === 1 ? 'furnace' : 'tank', yaw: pose.yaw });
  }
  return result;
}

function roadStructure(g: FoundryGeometry) {
  // All undersides follow the same physical curve and elevation as the road.
  for (let i = 0; i < TRACK_POINTS.length - 1; i += 3) {
    const a = TRACK_POINTS[i].distance, b = TRACK_POINTS[Math.min(i + 3, TRACK_POINTS.length - 1)].distance;
    // The main deck and its diagonal underside can overlap a slightly lower
    // branch at a junction. Leave those joined spans open underneath too.
    const joined = [a, (a + b) / 2, b].some(at => {
      const p = trackPose(at).position;
      return SHORTCUT_POINTS.some(q => Math.hypot(p[0] - q.x, p[2] - q.z) < 25 && Math.abs(p[1] - q.y) < 6);
    });
    if (joined) continue;
    for (const side of [-1, 1]) {
      g.quad(trackPose(a, side * 11.1, -0.1).position, trackPose(b, side * 11.1, -0.1).position,
        trackPose(b, side * 11.1, -2.1).position, trackPose(a, side * 11.1, -2.1).position, STEEL);
      if (i % 6 === 0) g.beam(trackPose(a, side * 11.15, -1.9).position, trackPose(b, side * 11.15, -0.3).position, 0.10, GOLD);
    }
    g.quad(trackPose(a, -11.1, -2.1).position, trackPose(a, 11.1, -2.1).position,
      trackPose(b, 11.1, -2.1).position, trackPose(b, -11.1, -2.1).position, DARK);
    if (i % 15 === 0) {
      const pose = trackPose(a), height = pose.position[1] - 2.1;
      for (const side of [-1, 1]) {
        const p = trackPose(a, side * 7.5).position;
        g.box([p[0], height / 2, p[2]], [2.4, height, 2.4], STEEL, pose.yaw);
        g.box([p[0], 0.8, p[2]], [4, 1.6, 4], DARK, pose.yaw);
      }
      g.beam(trackPose(a, -9.5, -2.3).position, trackPose(a, 9.5, -2.3).position, 0.6, PALE);
    }
  }
  const { start, end } = FOUNDRY_COURSE.shortcut;
  const at = (i: number) => (start + SHORTCUT_POINTS[i].distance / SHORTCUT_LENGTH * (end - start)) * TRACK_LENGTH;
  for (let i = 0; i < SHORTCUT_POINTS.length - 1; i += 4) {
    const a = at(i), b = at(Math.min(i + 4, SHORTCUT_POINTS.length - 1));
    for (const side of [-1, 1]) {
      g.quad(shortcutPose(a, side * 7, -0.02).position, shortcutPose(b, side * 7, -0.02).position,
        shortcutPose(b, side * 11.2, -0.02).position, shortcutPose(a, side * 11.2, -0.02).position, FOUNDRY_THEME.shoulder);
      g.quad(shortcutPose(a, side * 11.2, -0.05).position, shortcutPose(b, side * 11.2, -0.05).position,
        shortcutPose(b, side * 11.2, -1.9).position, shortcutPose(a, side * 11.2, -1.9).position, RUST);
      // A branch-edge marker must never cut across the main driving surface
      // while the two roads are still separating at either junction.
      const railStart = shortcutPose(a, side * 10.9, 0.15).position;
      const railEnd = shortcutPose(b, side * 10.9, 0.15).position;
      const clearance = [0, 0.25, 0.5, 0.75, 1].every(t => {
        const x = railStart[0] + (railEnd[0] - railStart[0]) * t;
        const y = railStart[1] + (railEnd[1] - railStart[1]) * t;
        const z = railStart[2] + (railEnd[2] - railStart[2]) * t;
        return TRACK_POINTS.every(p => Math.abs(y - p.y) > 3 || Math.hypot(p.x - x, p.z - z) > 11.5);
      });
      if (clearance) g.beam(railStart, railEnd, 0.08, GOLD);
    }
  }
}

function furnace(g: FoundryGeometry, prop: FoundryProp) {
  const { center: c, height: h } = prop;
  g.cylinder(c, 7.5, h * 0.65, RUST, 14, 6);
  g.cylinder(add(c, [0, h * 0.65, 0]), 6, h * 0.14, STEEL, 14, 3.4);
  g.cylinder(add(c, [0, h * 0.79, 0]), 3.4, h * 0.21, DARK, 12);
  for (const f of [0.17, 0.40, 0.63]) g.cylinder(add(c, [0, h * f, 0]), 7.7 - f * 2.2, 0.65, PALE, 14);
  g.disc(add(c, [0, h + 0.03, 0]), 3.0, 3.0, MOLTEN, 16);
  g.disc(add(c, [0, h + 0.04, 0]), 1.6, 1.6, HOT, 12);
  for (let i = 0; i < 5; i++) {
    const angle = i / 5 * Math.PI * 2;
    g.box(add(c, [Math.sin(angle) * 6.7, h * 0.34, Math.cos(angle) * 6.7]), [2.4, 4.1, 0.25], GOLD, angle);
  }
  // Stylized rising sparks are fixed batched quads, not per-frame particles.
  for (let i = 0; i < 9; i++) {
    const p = add(c, [Math.sin(i * 2.3) * 3.5, h + 2 + i * 1.6, Math.cos(i * 2.3) * 3.5]);
    g.triangle(add(p, [-0.2, 0, 0]), add(p, [0, 0.9, 0]), add(p, [0.2, 0, 0]), i % 2 ? HOT : MOLTEN, true);
  }
}
function tank(g: FoundryGeometry, prop: FoundryProp) {
  const { center: c, height: h } = prop;
  g.cylinder(c, 8, 1.2, DARK, 14);
  g.cylinder(add(c, [0, 1.2, 0]), 7, h * 0.6, PALE, 14, 5.3);
  g.cylinder(add(c, [0, 1.2 + h * 0.6, 0]), 5.3, h * 0.4, STEEL, 14, 7.5);
  g.cylinder(add(c, [0, h + 0.8, 0]), 7.8, 1.2, DARK, 14);
  g.disc(add(c, [0, h + 2.01, 0]), 6.6, 6.6, CYAN, 14);
  for (const x of [-2, 2]) g.beam(add(c, [x, 0, 7.5]), add(c, [x, h + 2, 7.5]), 0.11, GOLD);
  for (let y = 2; y < h + 1; y += 2) g.beam(add(c, [-2, y, 7.5]), add(c, [2, y, 7.5]), 0.07, GOLD);
}
function warehouse(g: FoundryGeometry, prop: FoundryProp) {
  const { center: c, height: h, yaw } = prop;
  g.box(add(c, [0, h * 0.24, 0]), [22, h * 0.48, 18], STEEL, yaw);
  g.box(add(c, [0, h * 0.48 + 0.6, 0]), [23, 1.2, 19], RUST, yaw);
  const p = (x: number, y: number, z: number): Vec3 => [c[0] + x * Math.cos(yaw) + z * Math.sin(yaw), y, c[2] + z * Math.cos(yaw) - x * Math.sin(yaw)];
  for (const side of [-1, 1]) for (let x = -8; x <= 8; x += 4) {
    g.box(p(x, h * 0.29, side * 9.06), [2.4, 2.5, 0.08], x % 8 ? GOLD : CYAN, yaw);
  }
  g.cylinder(p(6, h * 0.48, 2), 2.2, h * 0.72, DARK, 10, 1.9);
  for (let band = 0; band < 3; band++) g.cylinder(p(6, h * (0.75 + band * 0.13), 2), 2.3, 1.1, RUST, 10);
}

/** A genuinely hollow furnace gantry on the long straight, with a 12m roof. */
export const FOUNDRY_GANTRY = { start: 0.055, end: 0.095, halfWidth: 13, roofHeight: 12 };
function gantry(g: FoundryGeometry) {
  const { start, end, halfWidth, roofHeight } = FOUNDRY_GANTRY;
  for (let rib = 0; rib <= 5; rib++) {
    const at = (start + (end - start) * rib / 5) * TRACK_LENGTH;
    for (const side of [-1, 1]) {
      g.beam(trackPose(at, side * halfWidth).position, trackPose(at, side * halfWidth, roofHeight).position, 0.55, RUST);
      g.box(trackPose(at, side * halfWidth, 4).position, [1.3, 1, 1.3], GOLD);
    }
    g.beam(trackPose(at, -halfWidth, roofHeight).position, trackPose(at, halfWidth, roofHeight).position, 0.5, RUST);
    g.beam(trackPose(at, -11, roofHeight - 0.65).position, trackPose(at, 11, roofHeight - 0.65).position, 0.10, HOT);
  }
  for (const side of [-1, 1]) {
    g.beam(trackPose(start * TRACK_LENGTH, side * halfWidth, roofHeight).position, trackPose(end * TRACK_LENGTH, side * halfWidth, roofHeight).position, 0.5, STEEL);
    g.beam(trackPose(start * TRACK_LENGTH, side * halfWidth, 5.5).position, trackPose(end * TRACK_LENGTH, side * halfWidth, 5.5).position, 0.35, STEEL);
  }
}

function warningGates(g: FoundryGeometry) {
  // Route markers sit outside the rail and illuminate the approaching turns.
  for (const fraction of [0.195, 0.295, 0.405, 0.49, 0.575, 0.685, 0.79, 0.875]) {
    const at = fraction * TRACK_LENGTH;
    for (const side of [-1, 1]) {
      const pose = trackPose(at, side * 16);
      if (!foundryCorridorClear(pose.position, 1)) continue;
      g.beam(pose.position, trackPose(at, side * 16, 7).position, 0.13, PALE);
      g.box(trackPose(at, side * 16, 6.5).position, [1.8, 0.55, 0.8], HOT, pose.yaw);
    }
    const p = trackPose(at, -16.2, 3.3);
    if (!foundryCorridorClear(p.position, 2)) continue;
    g.box(p.position, [3.4, 2.2, 0.3], GOLD, p.yaw);
    for (let stripe = -1; stripe <= 1; stripe++) {
      g.beam(trackPose(at - 0.22, -17 + stripe * 0.8, 2.5).position,
        trackPose(at - 0.22, -16.1 + stripe * 0.8, 4.1).position, 0.12, DARK);
    }
  }
}

/** All scenery is one static world mesh shared by every chase camera. */
export function addFoundryScenery(g: FoundryGeometry): void {
  roadStructure(g);
  gantry(g);
  warningGates(g);
  for (const prop of foundryPropLayout()) {
    g.disc(add(prop.center, [0, 0.01, 0]), prop.radius + 2, prop.radius + 2, DARK, 16);
    if (prop.kind === 'furnace') furnace(g, prop);
    else if (prop.kind === 'tank') tank(g, prop);
    else warehouse(g, prop);
  }
  // Sunken channels of glowing metal beneath the raised deck. Their elevation
  // is always below the lowest road underside and outside the collision model.
  for (const z of [-116, 78, 224]) {
    g.box([-20, -0.45, z], [550, 0.8, 18], DARK);
    g.quad([-295, 0.015, z - 6], [255, 0.015, z - 6], [255, 0.015, z + 6], [-295, 0.015, z + 6], MOLTEN, true);
    for (let x = -280; x < 240; x += 28) {
      g.quad([x, 0.025, z - 1.4], [x + 17, 0.025, z - 1.4], [x + 20, 0.025, z + 1.4], [x + 3, 0.025, z + 1.4], HOT, true);
    }
    for (const side of [-1, 1]) g.box([-20, 0.35, z + side * 8], [550, 0.7, 1.2], RUST);
  }
  // A few large distant cranes establish the foundry silhouette without a
  // forest of overlapping props near the increasingly technical road.
  for (const [x, z] of [[-360, -130], [305, 30], [20, 275]]) {
    for (const dx of [-20, 20]) g.box([x + dx, 25, z], [3.2, 50, 4], RUST);
    g.box([x, 50, z], [72, 4, 5], GOLD);
    g.box([x + 27, 44, z], [8, 8, 7], STEEL);
    g.beam([x - 7, 48, z], [x - 7, 28, z], 0.18, PALE);
    g.cylinder([x - 7, 22, z], 7, 6, RUST, 12, 9);
    g.disc([x - 7, 28.03, z], 8, 8, MOLTEN, 12);
    for (let brace = -27; brace < 27; brace += 9) {
      g.beam([x + brace, 48, z - 2.6], [x + brace + 9, 52, z - 2.6], 0.16, DARK);
    }
  }
}
