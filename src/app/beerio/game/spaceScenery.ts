import { SHORTCUT_LENGTH, SHORTCUT_POINTS, TRACK_LENGTH, TRACK_POINTS, shortcutPose, trackPose, type Vec3 } from './track';
import { SPACE_COURSE, SPACE_LANDMARKS, SPACE_THEME } from './spaceCourse';

type Color = [number, number, number];
/** Structural contract: the existing batched WebGL Geometry already satisfies it. */
export interface SceneryGeometry {
  triangle(a: Vec3, b: Vec3, c: Vec3, color: Color, glow?: boolean): void;
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Color, glow?: boolean): void;
  box(center: Vec3, size: Vec3, color: Color, yaw?: number): void;
  cylinder(center: Vec3, radius: number, height: number, color: Color, sides?: number, topRadius?: number): void;
  sphere(center: Vec3, radius: number, color: Color, slices?: number, rings?: number, glow?: boolean): void;
  beam(a: Vec3, b: Vec3, width: number, color: Color): void;
}

const HULL: Color = [0.22, 0.28, 0.41], PALE: Color = [0.78, 0.87, 0.96];
const CYAN: Color = SPACE_THEME.stripe, VIOLET: Color = [0.66, 0.41, 0.96];
const GOLD: Color = [1, 0.7, 0.3], BLACK: Color = [0.055, 0.075, 0.14];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const seeded = (initial: number) => {
  let seed = initial;
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
};

/** Reject props against BOTH roads, including the unchosen branch corridor. */
function corridorClear(center: Vec3, radius: number): boolean {
  const margin = 13 + radius;
  return !TRACK_POINTS.some(point => Math.hypot(point.x - center[0], point.z - center[2]) < margin)
    && !SHORTCUT_POINTS.some(point => Math.hypot(point.x - center[0], point.z - center[2]) < margin);
}

export type SpaceAsteroid = { center: Vec3; radius: number; tint: Color };
/** Deterministic placements, exposed for corridor-clearance and replay tests. */
export function spaceAsteroidLayout(): SpaceAsteroid[] {
  const random = seeded(40973), asteroids: SpaceAsteroid[] = [];
  for (const [start, end] of SPACE_LANDMARKS.asteroidSectors) {
    for (let i = 0; i < 26; i++) {
      const fraction = start + (end - start) * random(), side = i % 2 ? 1 : -1;
      const radius = 2.6 + random() * 4.8;
      const pose = trackPose(fraction * TRACK_LENGTH, side * (23 + random() * 25), -5 + random() * 22);
      if (!corridorClear(pose.position, radius)) continue;
      const shade = random();
      asteroids.push({ center: pose.position, radius, tint: [0.34 + shade * 0.12, 0.32 + shade * 0.1, 0.43 + shade * 0.16] });
    }
  }
  return asteroids;
}

function ring(g: SceneryGeometry, center: Vec3, inner: number, outer: number, color: Color) {
  const point = (radius: number, angle: number): Vec3 => [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius * 0.3, center[2] + Math.sin(angle) * radius * 0.954];
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2, b = (i + 1) / 72 * Math.PI * 2;
    g.quad(point(inner, a), point(outer, a), point(outer, b), point(inner, b), color, true);
  }
}

function planet(g: SceneryGeometry) {
  const { center, radius, ringInner, ringOuter } = SPACE_LANDMARKS.ringedPlanet;
  const bands: Color[] = [[0.42, 0.27, 0.48], [0.74, 0.4, 0.48], [0.94, 0.61, 0.5], [0.98, 0.74, 0.56], [0.79, 0.47, 0.46]];
  // Latitude bands and broad rings read from the chase camera without textures.
  for (let latitude = 0; latitude < 18; latitude++) {
    for (let longitude = 0; longitude < 32; longitude++) {
      const point = (lat: number, lon: number): Vec3 => {
        const a = lat / 18 * Math.PI, b = lon / 32 * Math.PI * 2;
        return add(center, [Math.sin(a) * Math.cos(b) * radius, Math.cos(a) * radius, Math.sin(a) * Math.sin(b) * radius]);
      };
      g.quad(point(latitude, longitude), point(latitude + 1, longitude), point(latitude + 1, longitude + 1), point(latitude, longitude + 1), bands[Math.floor(latitude * 0.8) % bands.length]);
    }
  }
  ring(g, center, ringInner, ringInner + 8, [0.67, 0.48, 0.59]);
  ring(g, center, ringInner + 11, ringOuter - 4, [0.88, 0.73, 0.69]);
  ring(g, center, ringOuter - 2, ringOuter, [0.56, 0.43, 0.59]);
  const moon = SPACE_LANDMARKS.blueMoon;
  g.sphere(moon.center, moon.radius, [0.2, 0.42, 0.67], 28, 16);
  // Small faceted land-like islands sit on the visible hemisphere of the moon.
  for (const [x, y, z, size] of [[-18, 20, 50, 12], [8, 30, 48, 15], [23, 9, 52, 9], [-13, -14, 55, 11]]) {
    g.sphere(add(moon.center, [x, y, z]), size, [0.32, 0.66, 0.7], 8, 5);
  }
}

function starfield(g: SceneryGeometry) {
  const random = seeded(62039);
  for (let i = 0; i < 270; i++) {
    const angle = random() * Math.PI * 2, elevation = random() * 1.35 - 0.15;
    const radius = 580 + random() * 110;
    const p: Vec3 = [Math.cos(angle) * Math.cos(elevation) * radius, 70 + Math.sin(elevation) * radius, Math.sin(angle) * Math.cos(elevation) * radius];
    const size = 0.35 + random() * 1.1;
    const color: Color = i % 7 === 0 ? [0.64, 0.62, 0.97] : i % 5 === 0 ? [0.55, 0.88, 1] : [0.87, 0.89, 1];
    const right: Vec3 = [-Math.sin(angle) * size, 0, Math.cos(angle) * size];
    // Double-sided renderer triangles, in a vertical plane facing the circuit.
    g.quad(add(p, [-right[0], 0, -right[2]]), add(p, [0, size, 0]), add(p, right), add(p, [0, -size, 0]), color, true);
  }
  // Original angular nebula ribbons provide depth while leaving stars readable.
  for (let layer = 0; layer < 3; layer++) {
    const color: Color = [[0.055, 0.045, 0.14], [0.07, 0.055, 0.18], [0.075, 0.075, 0.19]][layer] as Color;
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * 1.8 + 3.8, b = (i + 1) / 18 * 1.8 + 3.8;
      const p = (angle: number, top: boolean): Vec3 => [Math.cos(angle) * 570, 140 + Math.sin(angle * 3 + layer) * 32 + (top ? 46 + layer * 15 : layer * 13), Math.sin(angle) * 570];
      g.quad(p(a, false), p(b, false), p(b, true), p(a, true), color, true);
    }
  }
}

function navigationGate(g: SceneryGeometry, fraction: number, index: number) {
  const at = fraction * TRACK_LENGTH, color = index % 2 ? VIOLET : CYAN;
  // All structural members are outside the physical rail or overhead. The
  // intentionally open center is the real drive-through route, not a billboard.
  for (const side of [-1, 1]) {
    g.beam(trackPose(at, side * 12, 0).position, trackPose(at, side * 12, 8).position, 0.28, HULL);
    g.beam(trackPose(at, side * 12, 8).position, trackPose(at, side * 8.8, 11).position, 0.28, PALE);
    g.beam(trackPose(at - 0.35, side * 11.6, 0.4).position, trackPose(at - 0.35, side * 11.6, 7.9).position, 0.065, color);
  }
  g.beam(trackPose(at, -8.8, 11).position, trackPose(at, 8.8, 11).position, 0.3, HULL);
  g.beam(trackPose(at - 0.35, -8.6, 10.8).position, trackPose(at - 0.35, 8.6, 10.8).position, 0.07, color);
  for (let lamp = -2; lamp <= 2; lamp++) {
    const pose = trackPose(at - 0.38, lamp * 2.8, 10.1);
    g.box(pose.position, [0.65, 0.32, 0.15], lamp === 0 ? GOLD : color, pose.yaw);
  }
}

function station(g: SceneryGeometry) {
  const { fraction, halfLength, halfWidth, roofHeight } = SPACE_LANDMARKS.station;
  const at = fraction * TRACK_LENGTH, pose = trackPose(at);
  for (const side of [-1, 1]) {
    // Walkways and module walls stay beyond the collision rail.
    g.box(trackPose(at, side * 17, -0.7).position, [13, 1.4, 48], HULL, pose.yaw);
    g.box(trackPose(at, side * 22, 4.3).position, [4.5, 9.6, 42], PALE, pose.yaw);
    g.box(trackPose(at, side * 19.7, 5.7).position, [0.13, 3.3, 32], BLACK, pose.yaw);
    for (let rib = -18; rib <= 18; rib += 9) {
      const p = trackPose(at + rib, side * halfWidth);
      g.beam(p.position, trackPose(at + rib, side * halfWidth, roofHeight).position, 0.24, PALE);
      g.box(trackPose(at + rib, side * 19.6, 5.7).position, [0.18, 1.9, 3.8], CYAN, p.yaw);
    }
    // Solar wings are modeled panels with frames and cell lines, not flat props.
    const panel = trackPose(at, side * 42, 8);
    g.beam(trackPose(at, side * 23, 8).position, panel.position, 0.45, HULL);
    g.box(panel.position, [26, 0.45, 37], [0.15, 0.23, 0.46], pose.yaw);
    for (let cell = -3; cell <= 3; cell++) {
      g.beam(trackPose(at + cell * 5, side * 29.5, 8.3).position, trackPose(at + cell * 5, side * 54.5, 8.3).position, 0.035, [0.5, 0.52, 0.86]);
    }
    for (let rail = 30; rail <= 54; rail += 6) {
      g.beam(trackPose(at - 18.5, side * rail, 8.3).position, trackPose(at + 18.5, side * rail, 8.3).position, 0.04, PALE);
    }
  }
  for (const end of [-halfLength, halfLength]) {
    g.beam(trackPose(at + end, -halfWidth, roofHeight).position, trackPose(at + end, halfWidth, roofHeight).position, 0.4, HULL);
    g.beam(trackPose(at + end - 0.5, -11, 13.3).position, trackPose(at + end - 0.5, 11, 13.3).position, 0.12, CYAN);
  }
  // A high roof makes the start an actual hangar interior with generous clearance.
  g.quad(trackPose(at - halfLength, -halfWidth, roofHeight).position, trackPose(at + halfLength, -halfWidth, roofHeight).position, trackPose(at + halfLength, halfWidth, roofHeight).position, trackPose(at - halfLength, halfWidth, roofHeight).position, HULL);
  for (const lane of [-8, 8]) g.beam(trackPose(at - 20, lane, 13.8).position, trackPose(at + 20, lane, 13.8).position, 0.1, CYAN);
}

function orbitalRoadStructure(g: SceneryGeometry) {
  // Batched underside girders make the raised road a built space structure.
  for (let i = 0; i < TRACK_POINTS.length - 1; i += 6) {
    const a = TRACK_POINTS[i].distance, b = TRACK_POINTS[Math.min(i + 6, TRACK_POINTS.length - 1)].distance;
    for (const side of [-1, 1]) {
      g.quad(trackPose(a, side * 10.8, -0.12).position, trackPose(b, side * 10.8, -0.12).position, trackPose(b, side * 10.8, -2.9).position, trackPose(a, side * 10.8, -2.9).position, HULL);
      g.beam(trackPose(a, side * 10.9, -2.7).position, trackPose(b, side * 10.9, -0.3).position, 0.09, i % 12 ? VIOLET : CYAN);
    }
    if (i % 12 === 0) g.beam(trackPose(a, -10.8, -2.9).position, trackPose(a, 10.8, -2.9).position, 0.25, HULL);
  }
  const branch = SPACE_COURSE.shortcut;
  for (let i = 0; i < SHORTCUT_POINTS.length - 1; i += 8) {
    const at = (index: number) => branch.start * TRACK_LENGTH + SHORTCUT_POINTS[index].distance / SHORTCUT_LENGTH * (branch.end - branch.start) * TRACK_LENGTH;
    const a = at(i), b = at(Math.min(i + 8, SHORTCUT_POINTS.length - 1));
    // The physics allows shoulder travel beyond the painted 7 m lane edge.
    // Give that same usable width a real deck instead of floating in the void.
    for (const side of [-1, 1]) {
      g.quad(shortcutPose(a, side * 7, -0.02).position, shortcutPose(b, side * 7, -0.02).position, shortcutPose(b, side * 11.2, -0.02).position, shortcutPose(a, side * 11.2, -0.02).position, SPACE_THEME.shoulder);
      g.beam(shortcutPose(a, side * 10.8, -0.8).position, shortcutPose(b, side * 10.8, -0.8).position, 0.3, HULL);
      g.beam(shortcutPose(a, side * 10.9, 0.12).position, shortcutPose(b, side * 10.9, 0.12).position, 0.06, CYAN);
    }
  }
}

/** Build once per race into the static world mesh, never once per racer/frame. */
export function addSpaceScenery(g: SceneryGeometry): void {
  starfield(g);
  planet(g);
  orbitalRoadStructure(g);
  station(g);
  SPACE_LANDMARKS.navigationGates.forEach((fraction, index) => navigationGate(g, fraction, index));
  for (const { center, radius, tint } of spaceAsteroidLayout()) {
    g.sphere(center, radius, tint, 7, 5);
    g.sphere(add(center, [radius * 0.4, radius * 0.25, radius * 0.7]), radius * 0.32, [tint[0] * 0.65, tint[1] * 0.65, tint[2] * 0.65], 6, 4);
  }
  // Uncrewed antenna platforms on the long return, beyond both drivable roads.
  for (const fraction of [0.59, 0.82, 0.94]) {
    const p = trackPose(fraction * TRACK_LENGTH, -35, 1);
    if (!corridorClear(p.position, 8)) continue;
    g.cylinder(add(p.position, [0, -5, 0]), 7, 3, HULL, 8, 5.5);
    g.cylinder(add(p.position, [0, -2, 0]), 0.6, 12, PALE, 8);
    g.cylinder(add(p.position, [0, 10, 0]), 5, 2, VIOLET, 12, 0.8);
    g.beam(add(p.position, [0, 12, 0]), add(p.position, [0, 16, 0]), 0.1, PALE);
    g.sphere(add(p.position, [0, 16, 0]), 0.5, GOLD, 8, 4, true);
  }
}
