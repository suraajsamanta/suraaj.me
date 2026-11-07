import { ACTIVE_SHORTCUT, ACTIVE_TRACK, BARRIER_OFFSET, BOOST_FRACTIONS, BOOST_LANES, ROAD_HALF_WIDTH, SHORTCUT_LENGTH, SHORTCUT_POINTS, TRACK_LENGTH, TRACK_POINTS, shortcutPose, trackPose, wrap, type Vec3 } from './track';
import type { GamePlayer, RaceState } from './simulation';
import { DANCE_SECONDS } from './powerups';

type Color = [number, number, number];
type Mesh = { buffer: WebGLBuffer; count: number };
type Camera = { eye: Vec3; target: Vec3 };
const SKY: Color = [0.94, 0.76, 0.62];
const CORAL: Color = [1, 0.38, 0.3], TEAL: Color = [0.09, 0.76, 0.72], CREAM: Color = [1, 0.94, 0.76];
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function parseColor(hex: string): Color {
  const expanded = /^#[\da-f]{3}$/i.test(hex) ? hex.slice(1).split('').map((c) => c + c).join('') : hex.replace('#', '');
  if (!/^[\da-f]{6}$/i.test(expanded)) return [0.96, 0.63, 0.24];
  return [parseInt(expanded.slice(0, 2), 16) / 255, parseInt(expanded.slice(2, 4), 16) / 255, parseInt(expanded.slice(4, 6), 16) / 255];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(...v) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function subtract(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
  }
  return out;
}
function viewProjection(camera: Camera, aspect: number, boost: boolean): Float32Array {
  const z = normalize(subtract(camera.eye, camera.target));
  const x = normalize(cross([0, 1, 0], z)), y = cross(z, x);
  const view = new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, camera.eye), -dot(y, camera.eye), -dot(z, camera.eye), 1]);
  const f = 1 / Math.tan((boost ? 67 : 62) * Math.PI / 360), near = 0.15, far = 900;
  const projection = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]);
  return multiply(projection, view);
}
function model(position: Vec3, yaw = 0, scale = 1): Float32Array {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return new Float32Array([c * scale, 0, -s * scale, 0, 0, scale, 0, 0, s * scale, 0, c * scale, 0, position[0], position[1], position[2], 1]);
}

class Geometry {
  data: number[] = [];
  triangle(a: Vec3, b: Vec3, c: Vec3, color: Color, glow = false) {
    const normal = normalize(cross(subtract(b, a), subtract(c, a)));
    const light = glow ? 1 : 0.8 + Math.max(0, dot(normal, [0.32, 0.87, -0.37])) * 0.2;
    for (const point of [a, b, c]) this.data.push(...point, color[0] * light, color[1] * light, color[2] * light);
  }
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Color, glow = false) {
    this.triangle(a, b, c, color, glow); this.triangle(a, c, d, color, glow);
  }
  box(center: Vec3, size: Vec3, color: Color, yaw = 0) {
    const p = (x: number, y: number, z: number): Vec3 => [center[0] + (x * Math.cos(yaw) + z * Math.sin(yaw)) * 0.5, center[1] + y * 0.5, center[2] + (z * Math.cos(yaw) - x * Math.sin(yaw)) * 0.5];
    const [x, y, z] = size;
    const a = p(-x, -y, -z), b = p(x, -y, -z), c = p(x, y, -z), d = p(-x, y, -z);
    const e = p(-x, -y, z), f = p(x, -y, z), g = p(x, y, z), h = p(-x, y, z);
    this.quad(a, d, c, b, color); this.quad(e, f, g, h, color);
    this.quad(a, e, h, d, color); this.quad(b, c, g, f, color);
    this.quad(d, h, g, c, color); this.quad(a, b, f, e, color);
  }
  cylinder(center: Vec3, radius: number, height: number, color: Color, sides = 8, topRadius = radius) {
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
      const p1: Vec3 = [center[0] + Math.sin(a) * radius, center[1], center[2] + Math.cos(a) * radius];
      const p2: Vec3 = [center[0] + Math.sin(b) * radius, center[1], center[2] + Math.cos(b) * radius];
      const p3: Vec3 = [center[0] + Math.sin(b) * topRadius, center[1] + height, center[2] + Math.cos(b) * topRadius];
      const p4: Vec3 = [center[0] + Math.sin(a) * topRadius, center[1] + height, center[2] + Math.cos(a) * topRadius];
      this.quad(p1, p4, p3, p2, color);
      this.triangle([center[0], center[1] + height, center[2]], p3, p4, color);
    }
  }
  sphere(center: Vec3, radius: number, color: Color, slices = 10, rings = 6, glow = false) {
    for (let r = 0; r < rings; r++) for (let s = 0; s < slices; s++) {
      const p = (ring: number, slice: number): Vec3 => {
        const a = ring / rings * Math.PI, b = slice / slices * Math.PI * 2;
        return [center[0] + Math.sin(a) * Math.cos(b) * radius, center[1] + Math.cos(a) * radius, center[2] + Math.sin(a) * Math.sin(b) * radius];
      };
      this.quad(p(r, s), p(r + 1, s), p(r + 1, s + 1), p(r, s + 1), color, glow);
    }
  }
  ellipsoid(center: Vec3, radius: Vec3, color: Color, slices = 10, rings = 6) {
    for (let r = 0; r < rings; r++) for (let s = 0; s < slices; s++) {
      const p = (ring: number, slice: number): Vec3 => {
        const a = ring / rings * Math.PI, b = slice / slices * Math.PI * 2;
        return [center[0] + Math.sin(a) * Math.cos(b) * radius[0], center[1] + Math.cos(a) * radius[1], center[2] + Math.sin(a) * Math.sin(b) * radius[2]];
      };
      this.quad(p(r, s), p(r + 1, s), p(r + 1, s + 1), p(r, s + 1), color);
    }
  }
  disc(center: Vec3, radiusX: number, radiusZ: number, color: Color, sides = 20) {
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
      this.triangle(center, [center[0] + Math.cos(b) * radiusX, center[1], center[2] + Math.sin(b) * radiusZ], [center[0] + Math.cos(a) * radiusX, center[1], center[2] + Math.sin(a) * radiusZ], color, true);
    }
  }
  wheel(center: Vec3, radius: number, width: number, color: Color, sides = 12) {
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
      const p = (side: number, angle: number, r = radius): Vec3 => [center[0] + side * width / 2, center[1] + Math.cos(angle) * r, center[2] + Math.sin(angle) * r];
      this.quad(p(-1, a), p(1, a), p(1, b), p(-1, b), color);
      for (const side of [-1, 1]) {
        this.triangle([center[0] + side * width / 2, center[1], center[2]], p(side, a), p(side, b), [0.11, 0.15, 0.22]);
        this.triangle([center[0] + side * (width / 2 + 0.005), center[1], center[2]], [center[0] + side * (width / 2 + 0.005), center[1] + Math.cos(a) * radius * 0.54, center[2] + Math.sin(a) * radius * 0.54], [center[0] + side * (width / 2 + 0.005), center[1] + Math.cos(b) * radius * 0.54, center[2] + Math.sin(b) * radius * 0.54], i % 3 ? [0.8, 0.86, 0.89] : [0.3, 0.37, 0.48]);
      }
    }
  }
  beam(a: Vec3, b: Vec3, width: number, color: Color) {
    const direction = subtract(b, a), right = normalize(cross(direction, [0, 1, 0]));
    const side = Math.hypot(...right) > 0.1 ? right : [1, 0, 0] as Vec3;
    const up = normalize(cross(side, direction));
    const p = (point: Vec3, x: number, y: number): Vec3 => [point[0] + (side[0] * x + up[0] * y) * width, point[1] + (side[1] * x + up[1] * y) * width, point[2] + (side[2] * x + up[2] * y) * width];
    this.quad(p(a, -1, -1), p(a, 1, -1), p(b, 1, -1), p(b, -1, -1), color);
    this.quad(p(a, 1, -1), p(a, 1, 1), p(b, 1, 1), p(b, 1, -1), color);
    this.quad(p(a, 1, 1), p(a, -1, 1), p(b, -1, 1), p(b, 1, 1), color);
    this.quad(p(a, -1, 1), p(a, -1, -1), p(b, -1, -1), p(b, -1, 1), color);
  }
  roadStrip(from: number, to: number, left: number, right: number, color: Color, y = 0.04, glow = false) {
    this.quad(trackPose(from, left, y).position, trackPose(to, left, y).position, trackPose(to, right, y).position, trackPose(from, right, y).position, color, glow);
  }
}

/** Continue a branch chase camera along the main course outside the branch. */
export function racePose(at: number, lane = 0, height = 0, onShortcut = false) {
  const d = wrap(at);
  return onShortcut && d >= ACTIVE_SHORTCUT.start * TRACK_LENGTH && d <= ACTIVE_SHORTCUT.end * TRACK_LENGTH
    ? shortcutPose(at, lane, height) : trackPose(at, lane, height);
}
/** Advance a camera or trail by physical metres, continuing on the main road at either junction. */
export function routeOffset(at: number, metres: number, onShortcut: boolean): number {
  if (!onShortcut) return at + metres;
  const d = wrap(at), start = ACTIVE_SHORTCUT.start * TRACK_LENGTH, end = ACTIVE_SHORTCUT.end * TRACK_LENGTH;
  if (d < start || d > end || SHORTCUT_LENGTH <= 0) return at + metres;
  const ratio = (end - start) / SHORTCUT_LENGTH;
  if (metres >= 0) {
    const remaining = (end - d) / ratio;
    return metres <= remaining ? at + metres * ratio : at + (end - d) + (metres - remaining);
  }
  const remaining = (d - start) / ratio;
  return -metres <= remaining ? at + metres * ratio : at - (d - start) + (metres + remaining);
}
/** Exclude barriers whose footprint would cut through the shortcut road. */
export function barrierIntersectsShortcut(from: number, to: number, side: number): boolean {
  // Match the rendered midpoint-oriented boxes, including the wider top rail.
  const pose = trackPose((from + to) / 2, side * 10.6);
  const halfLength = (to - from + 0.2) / 2, halfWidth = 0.65 / 2;
  return SHORTCUT_POINTS.some(point => {
    const dx = point.x - pose.position[0], dz = point.z - pose.position[2];
    const along = dx * pose.forward[0] + dz * pose.forward[2];
    const across = dx * pose.right[0] + dz * pose.right[2];
    const beyondEnd = Math.max(0, Math.abs(along) - halfLength);
    const beyondSide = Math.max(0, Math.abs(across) - halfWidth);
    return Math.hypot(beyondEnd, beyondSide) < BARRIER_OFFSET + 0.5;
  });
}
function worldGeometry(): Geometry {
  const g = new Geometry();
  g.quad([-1500, -0.15, -1500], [-1500, -0.15, 1500], [1500, -0.15, 1500], [1500, -0.15, -1500], [0.9, 0.7, 0.46]);
  const dark: Color = [0.2, 0.25, 0.32], cream = CREAM, orange = CORAL;
  for (let i = 0; i < TRACK_POINTS.length - 1; i++) {
    const a = TRACK_POINTS[i].distance, b = TRACK_POINTS[i + 1].distance;
    g.roadStrip(a, b, -11.2, 11.2, [0.51, 0.68, 0.42], 0);
    g.roadStrip(a, b, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, dark, 0.035);
    g.roadStrip(a, b, -6.9, -6.72, cream, 0.055); g.roadStrip(a, b, 6.72, 6.9, cream, 0.055);
    const curb = Math.floor(i / 3) % 2 === 0 ? cream : orange;
    g.roadStrip(a, b, -7.7, -7, curb, 0.07); g.roadStrip(a, b, 7, 7.7, curb, 0.07);
    if (i % 10 < 4) g.roadStrip(a, b, -0.07, 0.07, [0.48, 0.49, 0.55], 0.05);
    if (i % 4 === 0) {
      const next = TRACK_POINTS[Math.min(TRACK_POINTS.length - 1, i + 4)].distance;
      for (const side of [-1, 1]) {
        // Leave generous openings where the branch separates and rejoins.
        const mid = (a + next) / 2;
        if ((side === ACTIVE_SHORTCUT.side && Math.min(Math.abs(mid - ACTIVE_SHORTCUT.start * TRACK_LENGTH), Math.abs(mid - ACTIVE_SHORTCUT.end * TRACK_LENGTH)) < 35) || barrierIntersectsShortcut(a, next, side)) continue;
        const pose = trackPose(mid, side * 10.6, 0.55);
        g.box(pose.position, [0.55, 1.05, next - a + 0.2], i % 12 === 0 ? orange : cream, pose.yaw);
        g.box([pose.position[0], 1.12, pose.position[2]], [0.65, 0.15, next - a + 0.2], TEAL, pose.yaw);
      }
    }
  }
  // Physical shortcut road, following the same sampled curve as the physics.
  const branchStart = ACTIVE_SHORTCUT.start * TRACK_LENGTH, branchSpan = (ACTIVE_SHORTCUT.end - ACTIVE_SHORTCUT.start) * TRACK_LENGTH;
  const branchAt = (index: number) => branchStart + SHORTCUT_POINTS[index].distance / SHORTCUT_LENGTH * branchSpan;
  for (let i = 0; i < SHORTCUT_POINTS.length - 1; i++) {
    const a = branchAt(i), b = branchAt(i + 1);
    const strip = (left: number, right: number, color: Color, height: number) => g.quad(shortcutPose(a, left, height).position, shortcutPose(b, left, height).position, shortcutPose(b, right, height).position, shortcutPose(a, right, height).position, color, true);
    strip(-ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, [0.28, 0.34, 0.37], 0.08);
    strip(-6.8, -6.55, [1, 0.77, 0.35], 0.095); strip(6.55, 6.8, [1, 0.77, 0.35], 0.095);
    if (i % 12 < 5) strip(-0.13, 0.13, [0.95, 0.79, 0.49], 0.1);
  }
  // Warm entry markers are deliberately distinct from the ordinary lap gate.
  const signAt = branchStart - 10, sign = trackPose(signAt, ACTIVE_SHORTCUT.side * 8.7, 2.7);
  g.box(sign.position, [2.8, 1.5, 0.35], [0.97, 0.63, 0.2], sign.yaw);
  // A contrasting arrow points toward the right-hand shortcut lane.
  const signLane = ACTIVE_SHORTCUT.side * 8.7, darkArrow: Color = [0.15, 0.19, 0.24];
  g.box(trackPose(signAt - 0.2, signLane - ACTIVE_SHORTCUT.side * 0.25, 2.7).position, [1.15, 0.18, 0.08], darkArrow, sign.yaw);
  g.triangle(trackPose(signAt - 0.2, signLane + ACTIVE_SHORTCUT.side * 1.0, 2.7).position, trackPose(signAt - 0.2, signLane + ACTIVE_SHORTCUT.side * 0.35, 3.1).position, trackPose(signAt - 0.2, signLane + ACTIVE_SHORTCUT.side * 0.35, 2.3).position, darkArrow, true);
  g.box(trackPose(signAt, ACTIVE_SHORTCUT.side * 8.7, 1.1).position, [0.2, 2.2, 0.2], [0.9, 0.9, 0.8], sign.yaw);
  // Static course hazards use the simulation's exact lane and distance coordinates.
  for (const obstacle of ACTIVE_TRACK.obstacles) {
    const at = obstacle.fraction * TRACK_LENGTH, pose = trackPose(at, obstacle.lane);
    const [x, , z] = pose.position;
    if (obstacle.kind === 'barrel') {
      g.disc([x + 0.2, 0.07, z + 0.25], 1, 0.85, [0.11, 0.16, 0.22]);
      g.cylinder([x, 0.08, z], 0.72, 1.35, [0.92, 0.4, 0.17], 12, 0.72);
      for (const height of [0.22, 1.05]) g.cylinder([x, height, z], 0.75, 0.18, [1, 0.91, 0.58], 12);
      g.cylinder([x, 1.44, z], 0.69, 0.07, [0.55, 0.25, 0.12], 12);
      g.cylinder([x, 1.52, z], 0.16, 0.08, [0.23, 0.22, 0.24], 8);
    } else {
      g.disc([x, 0.075, z], 2.05, 2.25, [0.075, 0.07, 0.14]);
      g.disc([x - 0.4, 0.078, z], 1.25, 1.6, [0.2, 0.14, 0.31]);
      g.disc([x + 0.4, 0.08, z + 0.2], 1, 1.25, [0.1, 0.29, 0.35]);
      g.disc([x + 0.75, 0.083, z + 0.1], 0.5, 0.6, [0.24, 0.4, 0.44]);
    }
  }
  BOOST_FRACTIONS.forEach((fraction, i) => {
    const distance = fraction * TRACK_LENGTH, lane = BOOST_LANES[i];
    g.roadStrip(distance - 4, distance + 4, lane - 1.8, lane + 1.8, [0.04, 0.63, 0.65], 0.09, true);
    for (let stripe = -3; stripe <= 3; stripe += 2) {
      const a = trackPose(distance + stripe, lane - 1.3, 0.1).position;
      const b = trackPose(distance + stripe + 0.9, lane, 0.1).position;
      const c = trackPose(distance + stripe, lane + 1.3, 0.1).position;
      const d = trackPose(distance + stripe - 0.7, lane, 0.1).position;
      g.triangle(a, b, d, [0.46, 1, 0.87], true); g.triangle(b, c, d, [0.46, 1, 0.87], true);
    }
  });
  for (let row = 0; row < 4; row++) for (let column = 0; column < 14; column++) {
    g.roadStrip(row * 0.7, (row + 1) * 0.7, column - 7, column - 6, (row + column) % 2 === 0 ? cream : [0.12, 0.14, 0.21], 0.08);
  }
  const gate = trackPose(1.3);
  for (const side of [-1, 1]) g.box(trackPose(1.3, side * 9, 4.4).position, [0.9, 8.8, 1], orange, gate.yaw);
  g.box(trackPose(1.3, 0, 8.4).position, [19, 1.4, 1], [0.2, 0.2, 0.32], gate.yaw);
  for (let i = -4; i <= 4; i++) g.box(trackPose(1.3, i * 1.9, 8.4).position, [0.9, 0.7, 1.03], i % 2 ? cream : orange, gate.yaw);

  // Keep decorative scenery out of the drivable branch corridor.
  const nearShortcut = (point: Vec3, margin = 12) => SHORTCUT_POINTS.some(p => Math.hypot(p.x - point[0], p.z - point[2]) < margin);
  let seed = 487;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  // Purpose-built low-poly desert scenery, with no downloaded assets.
  for (let i = 0; i < 60; i++) {
    const at = random() * TRACK_LENGTH, side = random() > 0.5 ? 1 : -1;
    const pose = trackPose(at, side * (16 + random() * 19));
    const [x, , z] = pose.position;
    const height = 3 + random() * 5;
    if (nearShortcut(pose.position)) continue;
    g.disc([x + 0.8, 0.012, z + 0.8], 2.2, 1.5, [0.74, 0.56, 0.35], 10);
    if (i % 3 === 0) {
      g.cylinder([x, 0, z], 1.7 + random(), height * 0.55, [0.85, 0.43, 0.3], 6, 1.2);
      g.cylinder([x, height * 0.55, z], 1.25, height * 0.4, [0.98, 0.62, 0.38], 6, 0.9);
    } else {
      g.cylinder([x, 0, z], 0.45, height, [0.2, 0.43, 0.34], 6);
      g.box([x + 0.9, height * 0.52, z], [1.8, 0.5, 0.55], [0.23, 0.48, 0.35]);
      g.cylinder([x + 1.7, height * 0.52, z], 0.29, height * 0.28, [0.23, 0.48, 0.35], 6);
      g.box([x - 0.6, height * 0.72, z], [1.3, 0.48, 0.5], [0.28, 0.53, 0.37]);
      g.cylinder([x - 1.2, height * 0.72, z], 0.26, height * 0.2, [0.28, 0.53, 0.37], 6);
    }
  }
  for (let i = 0; i < 28; i++) {
    const angle = i / 28 * Math.PI * 2;
    const radius = 330 + random() * 100;
    g.cylinder([Math.sin(angle) * radius, -1, Math.cos(angle) * radius], 35 + random() * 35, 40 + random() * 70, [0.78 + random() * 0.12, 0.48, 0.4], 6, 12 + random() * 16);
  }
  // Sculptural trackside flags make turns visible from the chase cameras.
  for (let i = 0; i < 18; i++) {
    const pose = trackPose(i / 18 * TRACK_LENGTH, 13.5);
    if (nearShortcut(pose.position)) continue;
    g.cylinder(pose.position, 0.12, 6, [0.35, 0.32, 0.3], 5);
    g.box([pose.position[0], 5.25, pose.position[2]], [0.15, 1.4, 2.4], i % 2 ? [0.28, 0.74, 0.71] : [0.95, 0.61, 0.27], pose.yaw);
  }
  // Original festival scenery: palms, colorful crowds, bunting, and floating balloons.
  for (let i = 0; i < 25; i++) {
    const pose = trackPose((i + 0.5) / 25 * TRACK_LENGTH, (i % 2 ? -1 : 1) * (15 + random() * 11));
    const [x, , z] = pose.position, height = 5.5 + random() * 3.5;
    if (nearShortcut(pose.position)) continue;
    g.disc([x + 1.1, 0.02, z + 1.1], 3.2, 2, [0.68, 0.59, 0.33]);
    g.cylinder([x, 0, z], 0.35, height, [0.63, 0.39, 0.23], 7, 0.23);
    for (let leaf = 0; leaf < 7; leaf++) {
      const a = leaf / 7 * Math.PI * 2 + i, dx = Math.cos(a), dz = Math.sin(a);
      const root: Vec3 = [x, height, z], mid: Vec3 = [x + dx * 2.1, height + 0.7, z + dz * 2.1], tip: Vec3 = [x + dx * 4, height - 1, z + dz * 4];
      const left: Vec3 = [mid[0] - dz * 0.8, mid[1] - 0.15, mid[2] + dx * 0.8], right: Vec3 = [mid[0] + dz * 0.8, mid[1] - 0.15, mid[2] - dx * 0.8];
      g.triangle(root, left, mid, [0.15, 0.57, 0.32]); g.triangle(root, mid, right, [0.32, 0.73, 0.38]);
      g.triangle(mid, left, tip, [0.15, 0.57, 0.32]); g.triangle(mid, tip, right, [0.32, 0.73, 0.38]);
    }
  }
  const festivalColors: Color[] = [CORAL, TEAL, [1, 0.76, 0.24], [0.68, 0.43, 0.86], [0.4, 0.65, 1]];
  for (const fraction of [0.025, 0.28, 0.54, 0.83]) {
    const at = fraction * TRACK_LENGTH, pose = trackPose(at, -19);
    if (nearShortcut(pose.position, 27)) continue;
    for (let row = 0; row < 3; row++) {
      g.box(trackPose(at, -15 - row * 2.2, 0.4 + row * 0.6).position, [2.1, 0.8 + row * 1.2, 21], [0.28, 0.35, 0.43], pose.yaw);
      for (let person = 0; person < 12; person++) {
        const body = trackPose(at - 9.5 + person * 1.7, -15 - row * 2.2, 1.15 + row * 1.2).position;
        g.cylinder(body, 0.29, 0.65, festivalColors[(row * 3 + person) % 5], 6, 0.22);
        g.sphere([body[0], body[1] + 0.92, body[2]], 0.26, [0.99, 0.8, 0.59], 6, 4);
      }
    }
    for (const end of [-11, 11]) g.box(trackPose(at + end, -17, 4.5).position, [0.28, 9, 0.28], cream, pose.yaw);
    g.box(trackPose(at, -17, 9).position, [7.3, 0.3, 23], TEAL, pose.yaw);
    for (let stripe = -10; stripe < 11; stripe += 2) g.box(trackPose(at + stripe, -17, 9.18).position, [7.3, 0.06, 0.65], cream, pose.yaw);
  }
  for (const fraction of [0.11, 0.38, 0.66, 0.91]) {
    const at = fraction * TRACK_LENGTH, left = trackPose(at, -11.5, 8).position, right = trackPose(at, 11.5, 8).position;
    g.cylinder(trackPose(at, -11.5).position, 0.13, 8.5, cream, 6); g.cylinder(trackPose(at, 11.5).position, 0.13, 8.5, cream, 6);
    g.beam(left, right, 0.035, [0.37, 0.35, 0.34]);
    for (let flag = -10; flag < 11; flag += 1.5) {
      g.triangle(trackPose(at, flag, 7.9).position, trackPose(at, flag + 1, 7.9).position, trackPose(at, flag + 0.5, 6.6).position, festivalColors[Math.abs(Math.round(flag * 2)) % 5], true);
    }
  }
  for (let i = 0; i < 9; i++) {
    const angle = i / 9 * Math.PI * 2, x = Math.sin(angle) * 195, z = Math.cos(angle) * 180, height = 24 + random() * 32;
    const color = festivalColors[i % 5];
    g.sphere([x, height, z], 4.5, color, 12, 8);
    g.cylinder([x, height - 5.1, z], 1.2, 1.8, color, 10, 2.4);
    g.box([x, height - 7, z], [1.7, 1.2, 1.7], [0.58, 0.35, 0.21]);
    for (const side of [-1, 1]) g.beam([x + side * 0.7, height - 6.6, z], [x + side * 1.1, height - 4.7, z], 0.04, cream);
  }
  for (let i = 0; i < 11; i++) {
    const angle = i / 11 * Math.PI * 2;
    const x = Math.sin(angle) * 330, z = Math.cos(angle) * 330, y = 72 + random() * 30;
    for (let puff = -2; puff <= 2; puff++) g.sphere([x + puff * 8, y + (2 - Math.abs(puff)) * 3, z], 7 + (2 - Math.abs(puff)) * 1.5, [1, 0.92, 0.82], 8, 5, true);
  }
  return g;
}

const CHARCOAL: Color = [0.055, 0.08, 0.13], SILVER: Color = [0.7, 0.8, 0.85];
const CHARACTER_COLORS: Record<string, Color> = {
  fox: [1, 0.48, 0.19], robot: [0.63, 0.75, 0.84], frog: [0.4, 0.81, 0.29],
  cat: [0.67, 0.51, 0.87], alien: [0.32, 0.86, 0.72], bear: [0.68, 0.4, 0.23],
  bird: [1, 0.79, 0.22], blob: [0.99, 0.48, 0.69],
};
function characterId(id?: string): string { return id && Object.prototype.hasOwnProperty.call(CHARACTER_COLORS, id) ? id : 'fox'; }

/** A shared, original character model keeps each racer's identity in every pose. */
function characterHead(g: Geometry, character: string, center: Vec3, accent: Color) {
  const fur = CHARACTER_COLORS[character], [x, y, z] = center;
  const p = (dx: number, dy: number, dz: number): Vec3 => [x + dx, y + dy, z + dz];
  const eyes = (dx = 0.18, dy = 0.05, dz = 0.39) => {
    for (const side of [-1, 1]) {
      g.ellipsoid(p(side * dx, dy, dz), [0.12, 0.15, 0.055], CREAM, 8, 5);
      g.ellipsoid(p(side * dx, dy, dz + 0.05), [0.055, 0.085, 0.028], CHARCOAL, 7, 4);
      g.sphere(p(side * dx - 0.017, dy + 0.035, dz + 0.072), 0.025, [1, 1, 1], 5, 3, true);
    }
  };
  const pointedEars = () => {
    for (const side of [-1, 1]) {
      const a = p(side * 0.18, 0.28, 0.12), b = p(side * 0.52, 0.24, 0.09), tip = p(side * 0.38, 0.78, -0.015), back = p(side * 0.34, 0.24, -0.25);
      g.triangle(a, b, tip, fur); g.triangle(a, tip, back, fur); g.triangle(b, back, tip, fur);
      g.triangle(p(side * 0.25, 0.34, 0.124), p(side * 0.44, 0.32, 0.105), p(side * 0.37, 0.64, 0.025), CREAM);
    }
  };
  if (character === 'robot') {
    g.box(center, [0.94, 0.8, 0.78], fur);
    g.box(p(0, 0.01, 0.408), [0.75, 0.49, 0.06], CHARCOAL);
    for (const side of [-1, 1]) {
      g.box(p(side * 0.18, 0.09, 0.449), [0.13, 0.15, 0.024], TEAL);
      g.box(p(side * 0.52, -0.02, 0), [0.14, 0.3, 0.32], accent);
    }
    g.box(p(0, -0.13, 0.45), [0.27, 0.035, 0.028], CREAM);
    g.box(p(0, 0.02, -0.405), [0.62, 0.48, 0.035], accent);
    for (const dy of [-0.1, 0, 0.1]) g.box(p(0, dy, -0.43), [0.39, 0.035, 0.025], CREAM);
    g.beam(p(0, 0.4, 0), p(0.13, 0.72, 0), 0.035, SILVER);
    g.sphere(p(0.13, 0.74, 0), 0.13, CORAL, 8, 5);
  } else if (character === 'frog') {
    g.ellipsoid(center, [0.57, 0.35, 0.43], fur, 12, 6);
    for (const side of [-1, 1]) {
      g.sphere(p(side * 0.3, 0.3, 0.08), 0.25, fur, 9, 6);
      g.ellipsoid(p(side * 0.3, 0.33, 0.28), [0.17, 0.19, 0.07], CREAM, 8, 5);
      g.ellipsoid(p(side * 0.3, 0.34, 0.34), [0.07, 0.11, 0.03], CHARCOAL, 7, 4);
      g.sphere(p(side * 0.4, -0.08, 0.33), 0.09, [0.9, 0.6, 0.44], 7, 4);
    }
    g.box(p(0, -0.12, 0.412), [0.5, 0.035, 0.025], CHARCOAL);
    for (const dx of [-0.22, 0.17]) g.sphere(p(dx, 0.1, -0.39), 0.1, [0.2, 0.57, 0.24], 7, 4);
  } else if (character === 'alien') {
    g.ellipsoid(center, [0.52, 0.51, 0.43], fur, 12, 7);
    for (const side of [-1, 1]) {
      g.ellipsoid(p(side * 0.21, 0.05, 0.38), [0.16, 0.23, 0.07], CHARCOAL, 9, 6);
      g.sphere(p(side * 0.2 - 0.035, 0.12, 0.44), 0.04, CREAM, 6, 4, true);
      g.beam(p(side * 0.27, 0.39, -0.05), p(side * 0.47, 0.75, -0.06), 0.035, fur);
      g.sphere(p(side * 0.47, 0.75, -0.06), 0.12, accent, 8, 5);
    }
    g.box(p(0, -0.23, 0.39), [0.17, 0.035, 0.04], CHARCOAL);
  } else if (character === 'blob') {
    g.ellipsoid(center, [0.56, 0.48, 0.46], fur, 12, 7);
    for (let nub = -1; nub <= 1; nub++) g.sphere(p(nub * 0.24, 0.4 + (nub === 0 ? 0.11 : 0), -0.02), nub === 0 ? 0.22 : 0.15, fur, 8, 5);
    eyes(0.18, 0.025, 0.415);
    g.ellipsoid(p(0, -0.18, 0.426), [0.13, 0.09, 0.035], CHARCOAL, 8, 4);
    for (const side of [-1, 1]) g.sphere(p(side * 0.25, 0.06, -0.39), 0.13, CREAM, 7, 4);
  } else {
    g.ellipsoid(center, [0.49, 0.44, 0.43], fur, 12, 7);
    if (character === 'fox' || character === 'cat') pointedEars();
    if (character === 'bear') for (const side of [-1, 1]) {
      g.sphere(p(side * 0.39, 0.34, -0.025), 0.23, fur, 9, 6);
      g.ellipsoid(p(side * 0.39, 0.34, 0.16), [0.13, 0.14, 0.045], CREAM, 8, 4);
    }
    if (character === 'bird') {
      for (let feather = -1; feather <= 1; feather++) g.beam(p(feather * 0.12, 0.31, -0.05), p(feather * 0.18, 0.71 - Math.abs(feather) * 0.09, -0.13), 0.075, CORAL);
      const a = p(-0.23, -0.12, 0.35), b = p(0.23, -0.12, 0.35), c = p(0, 0.06, 0.38), tip = p(0, -0.08, 0.75);
      g.triangle(a, b, tip, CORAL); g.triangle(a, tip, c, [1, 0.62, 0.2]); g.triangle(b, c, tip, [1, 0.62, 0.2]);
    } else {
      g.ellipsoid(p(0, -0.12, 0.35), [character === 'fox' ? 0.31 : 0.27, 0.21, 0.2], CREAM, 10, 6);
      g.ellipsoid(p(0, -0.035, 0.54), [0.095, 0.07, 0.055], character === 'cat' ? CORAL : CHARCOAL, 7, 4);
      if (character === 'cat') for (const side of [-1, 1]) for (const dy of [-0.15, -0.055]) g.beam(p(side * 0.18, dy, 0.51), p(side * 0.47, dy + 0.035, 0.45), 0.012, CHARCOAL);
    }
    eyes(0.2, 0.09, 0.385);
  }
  // A bright scarf is visible from the chase camera on every character.
  g.box(p(0, -0.45, -0.01), [0.66, 0.12, 0.56], accent);
  g.box(p(0.24, -0.64, -0.28), [0.19, 0.42, 0.06], CREAM, -0.18);
}

function characterTail(g: Geometry, character: string, hip: Vec3) {
  const [x, y, z] = hip, fur = CHARACTER_COLORS[character];
  if (character === 'fox') {
    g.beam([x, y, z - 0.2], [x + 0.38, y + 0.32, z - 0.83], 0.2, fur);
    g.beam([x + 0.38, y + 0.32, z - 0.83], [x + 0.47, y + 0.64, z - 1.03], 0.18, CREAM);
  } else if (character === 'cat') {
    g.beam([x, y, z - 0.25], [x - 0.46, y + 0.25, z - 0.72], 0.09, fur);
    g.beam([x - 0.46, y + 0.25, z - 0.72], [x - 0.57, y + 0.74, z - 0.63], 0.09, fur);
  } else if (character === 'bird') {
    for (const side of [-1, 0, 1]) g.beam([x, y, z - 0.15], [x + side * 0.25, y + 0.3, z - 0.72], 0.1, side ? CORAL : fur);
  } else if (character === 'robot') {
    g.box([x, y + 0.25, z - 0.34], [0.54, 0.6, 0.22], SILVER);
    g.box([x, y + 0.26, z - 0.465], [0.25, 0.28, 0.03], TEAL);
  }
}

function seatedDriver(g: Geometry, color: Color, character: string, motorcycle: boolean) {
  const y = motorcycle ? 1.47 : 1.3, z = motorcycle ? -0.2 : -0.15;
  characterTail(g, character, [0, y - 0.2, z]);
  g.ellipsoid([0, y, z], [0.38, 0.45, 0.31], color, 10, 6);
  g.box([0, y + 0.04, z + 0.3], [0.14, 0.31, 0.05], CREAM);
  characterHead(g, character, [0, y + 0.68, z], color);
  for (const side of [-1, 1]) {
    const hand: Vec3 = [side * (motorcycle ? 0.48 : 0.39), motorcycle ? 1.48 : 1.23, motorcycle ? 0.59 : 0.57];
    g.beam([side * 0.3, y + 0.15, z], [side * 0.44, y - 0.03, z + 0.33], 0.11, color);
    g.beam([side * 0.44, y - 0.03, z + 0.33], hand, 0.11, color);
    g.sphere(hand, 0.14, CREAM, 7, 4);
    if (motorcycle) {
      g.beam([side * 0.23, y - 0.23, z], [side * 0.43, 0.86, 0.1], 0.13, CHARCOAL);
      g.box([side * 0.44, 0.71, 0.09], [0.27, 0.24, 0.42], CHARCOAL);
    }
  }
}

/** Four deliberately different silhouettes, all made from lightweight geometry. */
function vehicleGeometry(g: Geometry, color: Color, vehicle: string) {
  if (vehicle === 'motorcycle') {
    for (const z of [-0.97, 1.05]) g.wheel([0, 0.54, z], 0.53, 0.37, CHARCOAL, 14);
    g.beam([0, 0.6, -0.94], [0, 1.12, 0.15], 0.13, SILVER);
    g.beam([0, 0.62, 1.04], [0, 1.44, 0.55], 0.08, SILVER);
    g.beam([0, 0.6, -0.94], [0, 0.7, 0.44], 0.1, CHARCOAL);
    g.ellipsoid([0, 1.05, 0.24], [0.42, 0.36, 0.64], color, 10, 6);
    g.box([0, 1.15, -0.58], [0.7, 0.22, 0.86], CHARCOAL);
    g.box([0, 1.02, -1.02], [0.62, 0.25, 0.48], color);
    g.box([0, 1.04, -1.28], [0.3, 0.13, 0.06], CORAL);
    g.box([0, 1.43, 0.8], [0.64, 0.42, 0.26], color);
    g.box([0, 1.46, 0.95], [0.39, 0.22, 0.055], CREAM);
    g.box([0, 1.5, 0.57], [1.12, 0.11, 0.13], CHARCOAL);
    g.box([0, 1.38, 0.22], [0.12, 0.055, 0.54], CREAM);
    for (const side of [-1, 1]) {
      g.box([side * 0.46, 0.57, -0.65], [0.17, 0.2, 0.95], SILVER);
      g.box([side * 0.44, 0.68, 0], [0.25, 0.1, 0.36], CHARCOAL);
    }
    return;
  }
  const buggy = vehicle === 'buggy', roadster = vehicle === 'roadster';
  const wide = buggy ? 1.1 : 0.92, wheelRadius = buggy ? 0.56 : roadster ? 0.4 : 0.43;
  g.box([0, buggy ? 0.65 : 0.5, -0.05], [1.45, 0.32, roadster ? 2.65 : 2.2], CHARCOAL);
  g.box([0, buggy ? 0.87 : 0.7, 0.32], [roadster ? 1.68 : 1.43, 0.4, roadster ? 2.1 : 1.7], color);
  const nose = roadster ? 1.68 : 1.43, hood = buggy ? 1.07 : 0.93;
  g.quad([-0.71, hood, 0.43], [0.71, hood, 0.43], [0.55, 0.63, nose], [-0.55, 0.63, nose], color);
  g.quad([-0.11, hood + 0.01, 0.43], [0.11, hood + 0.01, 0.43], [0.11, 0.64, nose], [-0.11, 0.64, nose], CREAM);
  g.box([0, 0.48, nose + 0.07], [1.85, 0.18, 0.22], SILVER);
  g.box([0, 0.5, -1.45], [1.8, 0.2, 0.25], CHARCOAL);
  for (const side of [-1, 1]) {
    for (const z of [-0.93, roadster ? 1.08 : 0.92]) {
      g.wheel([side * wide, wheelRadius, z], wheelRadius, buggy ? 0.57 : 0.43, CHARCOAL);
      if (buggy) g.beam([side * 0.55, 0.81, z], [side * 1.04, 0.53, z], 0.07, SILVER);
      if (roadster) g.box([side * 0.91, 0.83, z], [0.39, 0.16, 0.95], color);
    }
    g.box([side * 0.5, 0.74, nose + 0.04], [roadster ? 0.32 : 0.25, 0.17, 0.055], CREAM);
    g.box([side * 0.57, 0.78, -1.22], [0.28, 0.15, 0.06], CORAL);
    g.box([side * 0.55, 0.47, -1.54], [0.2, 0.18, 0.3], SILVER);
    if (buggy) {
      g.beam([side * 0.65, 0.8, -0.99], [side * 0.65, 1.89, -0.75], 0.06, SILVER);
      g.beam([side * 0.65, 1.89, -0.75], [side * 0.65, 1.34, 0.45], 0.06, SILVER);
      g.sphere([side * 0.47, 1.95, -0.74], 0.14, CREAM, 7, 4);
    } else if (!roadster) g.box([side * 0.49, 1.03, -1.09], [0.13, 0.62, 0.15], CHARCOAL);
  }
  if (buggy) {
    g.beam([-0.65, 1.89, -0.75], [0.65, 1.89, -0.75], 0.06, SILVER);
    g.wheel([0, 1.12, -1.29], 0.43, 0.23, CHARCOAL);
  } else if (roadster) {
    g.box([0, 1.03, -1.13], [1.65, 0.22, 0.57], color);
    g.box([0, 1.22, 0.58], [1.12, 0.39, 0.09], [0.34, 0.72, 0.8]);
    g.box([0, 1.44, 0.58], [1.2, 0.06, 0.11], SILVER);
  } else {
    g.box([0, 1.4, -1.12], [2, 0.15, 0.47], color);
    for (const side of [-1, 1]) g.box([side * 0.95, 1.48, -1.12], [0.1, 0.24, 0.55], color);
  }
  g.box([0, 0.98, -0.28], [0.76, 0.6, 0.54], CHARCOAL);
  g.box([0, 1.2, 0.58], [0.7, 0.12, 0.15], CHARCOAL);
}

export function racerGeometry(color: Color, character = 'fox', vehicle = 'kart', driver = true): Geometry {
  const g = new Geometry();
  vehicleGeometry(g, color, vehicle);
  if (driver) seatedDriver(g, color, characterId(character), vehicle === 'motorcycle');
  return g;
}

/** Eight poses are uploaded once. All clients use the same host dance timer. */
export function dancerGeometry(color: Color, phase: number, character = 'fox'): Geometry {
  const g = new Geometry(), id = characterId(character);
  const sway = Math.sin(phase), bounce = Math.abs(Math.cos(phase)) * 0.18;
  const hip: Vec3 = [sway * 0.17, 1.05 + bounce, 0];
  const chest: Vec3 = [-sway * 0.16, 1.72 + bounce, 0];
  characterTail(g, id, hip);
  g.beam(hip, chest, 0.27, color);
  g.box([chest[0], 1.68 + bounce, 0.28], [0.14, 0.4, 0.04], CREAM);
  characterHead(g, id, [chest[0], 2.28 + bounce, 0], color);
  for (const side of [-1, 1]) {
    const hand: Vec3 = [side * (0.95 + 0.18 * Math.cos(phase)), 1.9 + bounce + 0.65 * Math.sin(phase + side * 1.3), 0.1 + side * sway * 0.24];
    g.beam([chest[0] + side * 0.22, 1.75 + bounce, 0], hand, 0.12, color);
    g.sphere(hand, 0.15, CREAM, 7, 4);
    const foot: Vec3 = [side * (0.34 + 0.22 * Math.sin(phase + side)), 0.16, side * 0.32 * Math.cos(phase)];
    g.beam([hip[0] + side * 0.17, hip[1], 0], foot, 0.14, CHARCOAL);
    g.box([foot[0], 0.14, foot[2] + 0.1], [0.32, 0.25, 0.52], CHARCOAL);
  }
  return g;
}

function shadowGeometry(): Geometry {
  const g = new Geometry();
  g.disc([0.18, 0, -0.15], 1.18, 1.72, [0.13, 0.18, 0.23]);
  g.disc([0.11, 0.001, -0.09], 0.92, 1.4, [0.105, 0.145, 0.19]);
  return g;
}
function particleGeometry(color: Color): Geometry {
  const g = new Geometry(); g.sphere([0, 0, 0], 0.2, color, 5, 3, true); return g;
}
function itemGeometry(): Geometry {
  const g = new Geometry(), color: Color = [0.35, 0.98, 0.92];
  const corners: Vec3[] = [];
  for (const x of [-0.68, 0.68]) for (const y of [-0.68, 0.68]) for (const z of [-0.68, 0.68]) corners.push([x, y, z]);
  for (let a = 0; a < corners.length; a++) for (let b = a + 1; b < corners.length; b++) {
    if (corners[a].filter((value, axis) => value !== corners[b][axis]).length === 1) g.beam(corners[a], corners[b], 0.055, color);
  }
  g.sphere([0, 0, 0], 0.43, [1, 0.82, 0.28], 10, 6, true);
  for (const corner of corners) g.sphere(corner, 0.11, [1, 0.95, 0.75], 6, 4, true);
  return g;
}
function slickGeometry(): Geometry {
  const g = new Geometry();
  g.disc([0, 0.075, 0], 1.75, 1.9, [0.56, 0.79, 0.15]);
  g.disc([0, 0.078, 0], 1.5, 1.6, [0.77, 0.96, 0.31]);
  g.disc([0.3, 0.081, 0.2], 0.9, 0.75, [1, 0.95, 0.62]);
  for (let i = 0; i < 3; i++) g.sphere([Math.cos(i * 2.2) * 0.9, 0.15, Math.sin(i * 2.2) * 0.9], 0.19, [1, 0.91, 0.37], 7, 4, true);
  return g;
}
function boltGeometry(): Geometry {
  const g = new Geometry();
  g.sphere([0, 0, 0], 0.55, [0.94, 0.45, 0.85], 12, 8, true);
  g.sphere([-0.17, 0.22, 0.32], 0.16, [0.89, 1, 1], 8, 6, true);
  g.sphere([0.12, -0.06, -0.28], 0.21, [0.62, 0.47, 1], 8, 6, true);
  return g;
}
function crownGeometry(): Geometry {
  const g = new Geometry();
  const gold: Color = [1, 0.72, 0.18];
  g.cylinder([0, -0.3, 0], 0.5, 0.35, gold, 8);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const x = Math.cos(a) * 0.43, z = Math.sin(a) * 0.43;
    g.beam([x, 0, z], [x * 1.3, 0.6, z * 1.3], 0.1, gold);
    g.sphere([x * 1.3, 0.6, z * 1.3], 0.1, [1, 0.36, 0.52], 5, 3, true);
  }
  return g;
}
function prismGeometry(): Geometry {
  const g = new Geometry();
  const colors: Color[] = [[1, 0.35, 0.5], [1, 0.8, 0.2], [0.35, 1, 0.8], [0.5, 0.5, 1]];
  for (let i = 0; i < colors.length; i++) {
    const a = i * Math.PI / 2;
    g.sphere([Math.cos(a) * 1.7, 0.9 + i * 0.35, Math.sin(a) * 1.7], 0.22, colors[i], 6, 4, true);
  }
  return g;
}
function shieldGeometry(): Geometry {
  const g = new Geometry(); g.sphere([0, 1.1, 0], 1.7, [0.29, 1, 0.79], 16, 10, true); return g;
}
function boostGeometry(): Geometry {
  const g = new Geometry();
  g.triangle([-0.5, 0.35, -1.4], [0.5, 0.35, -1.4], [0, 0.35, -4.3], [0.24, 0.96, 0.96], true);
  g.triangle([0, 0.2, -1.4], [0, 0.9, -1.4], [0, 0.4, -3.8], [0.3, 0.96, 1], true);
  g.triangle([-0.3, 0.55, -1.4], [0.3, 0.55, -1.4], [0, 0.55, -3.5], [0.9, 1, 0.65], true);
  return g;
}

export class RaceRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private skyProgram: WebGLProgram;
  private skyBuffer: WebGLBuffer;
  private skyPosition: number;
  private skyRight: WebGLUniformLocation;
  private skyUp: WebGLUniformLocation;
  private skyForward: WebGLUniformLocation;
  private skyLens: WebGLUniformLocation;
  private position: number;
  private color: number;
  private viewUniform: WebGLUniformLocation;
  private modelUniform: WebGLUniformLocation;
  private eyeUniform: WebGLUniformLocation;
  private opacityUniform: WebGLUniformLocation;
  private world: Mesh;
  private boost: Mesh;
  private shadow: Mesh;
  private dust: Mesh;
  private spark: Mesh;
  private item: Mesh;
  private slick: Mesh;
  private bolt: Mesh;
  private shield: Mesh;
  private crown: Mesh;
  private prism: Mesh;
  private karts: Mesh[];
  private emptyKarts: Mesh[];
  private dancers: Mesh[][];
  private cameras: Camera[];
  private columns: number;
  private rows: number;
  private width = 0;
  private height = 0;

  constructor(private canvas: HTMLCanvasElement, players: GamePlayer[], race: RaceState) {
    const gl = canvas.getContext('webgl', { antialias: players.length <= 4, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL is unavailable. Enable hardware acceleration in your browser, then reload the race.');
    this.gl = gl;
    const vertex = this.shader(gl.VERTEX_SHADER, `
      attribute vec3 a_position; attribute vec3 a_color;
      uniform mat4 u_view; uniform mat4 u_model; uniform vec3 u_eye;
      varying vec3 v_color; varying float v_distance; varying float v_height;
      void main() { vec4 world = u_model * vec4(a_position, 1.0); gl_Position = u_view * world; v_color = a_color; v_distance = distance(world.xyz, u_eye); v_height = world.y; }
    `);
    const fragment = this.shader(gl.FRAGMENT_SHADER, `
      precision mediump float; uniform float u_opacity; varying vec3 v_color; varying float v_distance; varying float v_height;
      void main() { float fog = smoothstep(145.0, 610.0, v_distance); vec3 haze = mix(vec3(0.94, 0.76, 0.62), vec3(0.56, 0.78, 0.87), clamp(v_height / 140.0, 0.0, 1.0)); gl_FragColor = vec4(mix(v_color, haze, fog), u_opacity); }
    `);
    const program = gl.createProgram();
    if (!program) throw new Error('Could not initialize the 3D race renderer.');
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); throw new Error('Your browser could not start the 3D race renderer.'); }
    this.program = program;
    this.position = gl.getAttribLocation(program, 'a_position'); this.color = gl.getAttribLocation(program, 'a_color');
    this.viewUniform = gl.getUniformLocation(program, 'u_view')!;
    this.modelUniform = gl.getUniformLocation(program, 'u_model')!;
    this.eyeUniform = gl.getUniformLocation(program, 'u_eye')!;
    this.opacityUniform = gl.getUniformLocation(program, 'u_opacity')!;
    const skyVertex = this.shader(gl.VERTEX_SHADER, `attribute vec2 a_position; varying vec2 v_uv; void main() { v_uv = a_position; gl_Position = vec4(a_position, 1.0, 1.0); }`);
    const skyFragment = this.shader(gl.FRAGMENT_SHADER, `
      precision mediump float; varying vec2 v_uv;
      uniform vec3 u_right; uniform vec3 u_up; uniform vec3 u_forward; uniform vec2 u_lens;
      void main() {
        vec3 ray = normalize(u_forward + u_right * v_uv.x * u_lens.x + u_up * v_uv.y * u_lens.y);
        float horizon = clamp(ray.y * 1.8, 0.0, 1.0);
        vec3 sky = mix(vec3(0.94, 0.76, 0.62), vec3(0.29, 0.64, 0.83), pow(horizon, 0.6));
        float sun = dot(ray, normalize(vec3(-0.6, 0.32, 0.65)));
        sky += vec3(0.14, 0.09, 0.03) * pow(max(0.0, sun), 25.0);
        sky = mix(sky, vec3(1.0, 0.95, 0.72), smoothstep(0.9974, 0.9982, sun));
        gl_FragColor = vec4(sky, 1.0);
      }`);
    const skyProgram = gl.createProgram(), skyBuffer = gl.createBuffer();
    if (!skyProgram || !skyBuffer) throw new Error('Not enough graphics memory to draw the sky.');
    gl.attachShader(skyProgram, skyVertex); gl.attachShader(skyProgram, skyFragment); gl.linkProgram(skyProgram);
    gl.deleteShader(skyVertex); gl.deleteShader(skyFragment);
    if (!gl.getProgramParameter(skyProgram, gl.LINK_STATUS)) { gl.deleteProgram(skyProgram); gl.deleteBuffer(skyBuffer); throw new Error('Your browser could not draw the race sky.'); }
    this.skyProgram = skyProgram; this.skyBuffer = skyBuffer;
    this.skyPosition = gl.getAttribLocation(skyProgram, 'a_position');
    this.skyRight = gl.getUniformLocation(skyProgram, 'u_right')!; this.skyUp = gl.getUniformLocation(skyProgram, 'u_up')!;
    this.skyForward = gl.getUniformLocation(skyProgram, 'u_forward')!; this.skyLens = gl.getUniformLocation(skyProgram, 'u_lens')!;
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.world = this.upload(worldGeometry()); this.boost = this.upload(boostGeometry());
    this.shadow = this.upload(shadowGeometry()); this.dust = this.upload(particleGeometry([0.92, 0.76, 0.52]));
    this.spark = this.upload(particleGeometry([1, 0.86, 0.28]));
    this.item = this.upload(itemGeometry()); this.slick = this.upload(slickGeometry());
    this.bolt = this.upload(boltGeometry()); this.shield = this.upload(shieldGeometry());
    this.crown = this.upload(crownGeometry()); this.prism = this.upload(prismGeometry());
    this.karts = players.map((player) => this.upload(racerGeometry(parseColor(player.color), player.character, player.vehicle)));
    this.emptyKarts = players.map((player) => this.upload(racerGeometry(parseColor(player.color), player.character, player.vehicle, false)));
    this.dancers = players.map((player) => Array.from({ length: 8 }, (_, frame) => this.upload(dancerGeometry(parseColor(player.color), frame * Math.PI / 4, player.character))));
    this.columns = players.length <= 1 ? 1 : players.length <= 4 ? 2 : players.length <= 6 ? 3 : 4;
    this.rows = Math.ceil(players.length / this.columns);
    this.cameras = race.karts.map((kart) => ({ eye: racePose(routeOffset(kart.distance, -10, kart.onShortcut), kart.lane * 0.6, 4.5, kart.onShortcut).position, target: racePose(routeOffset(kart.distance, 10, kart.onShortcut), kart.lane * 0.35, 0.9, kart.onShortcut).position }));
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.SCISSOR_TEST);
    gl.useProgram(program); gl.enableVertexAttribArray(this.position); gl.enableVertexAttribArray(this.color);
  }

  private shader(type: number, source: string): WebGLShader {
    const gl = this.gl, shader = gl.createShader(type);
    if (!shader) throw new Error('Could not initialize WebGL.');
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('Your browser does not support this 3D renderer.'); }
    return shader;
  }
  private upload(geometry: Geometry): Mesh {
    const gl = this.gl, buffer = gl.createBuffer();
    if (!buffer) throw new Error('Not enough graphics memory to start the race.');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.data), gl.STATIC_DRAW);
    return { buffer, count: geometry.data.length / 6 };
  }
  private draw(mesh: Mesh, transform: Float32Array = IDENTITY, opacity = 1) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.vertexAttribPointer(this.position, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(this.color, 3, gl.FLOAT, false, 24, 12);
    if (opacity < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
    gl.uniform1f(this.opacityUniform, opacity);
    gl.uniformMatrix4fv(this.modelUniform, false, transform); gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    if (opacity < 1) { gl.disable(gl.BLEND); gl.depthMask(true); }
  }
  private drawSky(camera: Camera, aspect: number, boost: boolean) {
    const gl = this.gl;
    const z = normalize(subtract(camera.eye, camera.target)), right = normalize(cross([0, 1, 0], z)), up = cross(z, right);
    const lens = Math.tan((boost ? 67 : 62) * Math.PI / 360);
    gl.useProgram(this.skyProgram); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.disableVertexAttribArray(this.color); gl.enableVertexAttribArray(this.skyPosition);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer); gl.vertexAttribPointer(this.skyPosition, 2, gl.FLOAT, false, 8, 0);
    gl.uniform3fv(this.skyRight, right); gl.uniform3fv(this.skyUp, up); gl.uniform3fv(this.skyForward, [-z[0], -z[1], -z[2]]);
    gl.uniform2f(this.skyLens, aspect * lens, lens); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.useProgram(this.program);
    gl.enableVertexAttribArray(this.position); gl.enableVertexAttribArray(this.color);
  }
  render(race: RaceState, dt: number) {
    const gl = this.gl;
    const rect = this.canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, race.karts.length > 6 ? 1 : race.karts.length > 4 ? 1.25 : 1.75, Math.sqrt(3400000 / Math.max(1, rect.width * rect.height)));
    const width = Math.max(1, Math.round(rect.width * pixelRatio)), height = Math.max(1, Math.round(rect.height * pixelRatio));
    if (width !== this.width || height !== this.height) {
      this.canvas.width = width; this.canvas.height = height; this.width = width; this.height = height;
    }
    gl.scissor(0, 0, width, height); gl.clearColor(0.07, 0.08, 0.12, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (let i = 0; i < race.karts.length; i++) {
      const kart = race.karts[i], camera = this.cameras[i];
      const position = racePose(kart.distance, kart.lane, 0, kart.onShortcut).position;
      const behind = racePose(routeOffset(kart.distance, -9 - kart.speed * 0.06, kart.onShortcut), kart.lane * 0.72, 4.5, kart.onShortcut).position;
      const target = racePose(routeOffset(kart.distance, 10 + kart.speed * 0.1, kart.onShortcut), kart.lane * 0.4, 0.9, kart.onShortcut).position;
      const smoothing = Math.min(1, dt * 8);
      for (let axis = 0; axis < 3; axis++) { camera.eye[axis] += (behind[axis] - camera.eye[axis]) * smoothing; camera.target[axis] += (target[axis] - camera.target[axis]) * smoothing; }
      // Keep the chased kart in view through the tightest bends.
      camera.target[0] = camera.target[0] * 0.98 + position[0] * 0.02;
      camera.target[2] = camera.target[2] * 0.98 + position[2] * 0.02;
      const column = i % this.columns, row = Math.floor(i / this.columns);
      const x = Math.round(column * width / this.columns) + 1, right = Math.round((column + 1) * width / this.columns) - 1;
      const top = Math.round(row * height / this.rows) + 1, bottom = Math.round((row + 1) * height / this.rows) - 1;
      const w = Math.max(1, right - x), h = Math.max(1, bottom - top), y = height - bottom;
      gl.viewport(x, y, w, h); gl.scissor(x, y, w, h); gl.clearColor(...SKY, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      this.drawSky(camera, w / h, kart.boost > 0);
      gl.uniformMatrix4fv(this.viewUniform, false, viewProjection(camera, w / h, kart.boost > 0));
      gl.uniform3fv(this.eyeUniform, camera.eye);
      this.draw(this.world);
      for (const box of race.powers.boxes) {
        if (box.cooldown > 0) continue;
        const point = trackPose(box.distance, box.lane, 1.65 + Math.sin(race.elapsed * 3 + box.id) * 0.2).position;
        this.draw(this.item, model(point, race.elapsed * 1.6 + box.id));
      }
      for (const hazard of race.powers.hazards) {
        const pose = (hazard.onShortcut ? shortcutPose : trackPose)(hazard.distance, hazard.lane);
        this.draw(this.slick, model(pose.position, pose.yaw, Math.min(1, hazard.life / 0.8)));
      }
      for (const projectile of race.powers.projectiles) {
        const point = (projectile.onShortcut ? shortcutPose : trackPose)(projectile.distance, projectile.lane, 0.85 + Math.abs(Math.sin(race.elapsed * 7 + projectile.id)) * 0.45).position;
        this.draw(projectile.kind === 'crown' ? this.crown : this.bolt, model(point, race.elapsed * 4));
        for (let tail = 1; tail <= 2; tail++) {
          const tailDistance = projectile.onShortcut ? Math.max(ACTIVE_SHORTCUT.start * TRACK_LENGTH, wrap(routeOffset(projectile.distance, -tail * 1.2, true))) : projectile.distance - tail * 1.2;
          this.draw(this.bolt, model((projectile.onShortcut ? shortcutPose : trackPose)(tailDistance, projectile.lane, 0.75).position, race.elapsed * 4, 0.45 / tail));
        }
      }
      for (let j = 0; j < race.karts.length; j++) {
        const other = race.karts[j];
        // Render every racer, including close followers between this kart and
        // its chase camera. The view frustum handles those behind the camera.
        const pose = racePose(other.distance, other.lane, 0.04, other.onShortcut);
        const yaw = pose.yaw + other.heading;
        const transform = model(pose.position, yaw);
        this.draw(this.shadow, model([pose.position[0], 0.095, pose.position[2]], yaw));
        const dancing = other.power.dance > 0;
        this.draw(dancing ? this.emptyKarts[j] : this.karts[j], transform);
        if (dancing) {
          const age = DANCE_SECONDS - other.power.dance;
          // Step out and return during the first and last third of a second.
          const exit = Math.max(0, Math.min(1, age / 0.35, other.power.dance / 0.35));
          const offset = 2.2 * exit;
          const dancerPosition: Vec3 = [pose.position[0] + Math.cos(yaw) * offset, pose.position[1], pose.position[2] - Math.sin(yaw) * offset];
          const frame = Math.floor(age * 12) % 8;
          this.draw(this.dancers[j][frame], model(dancerPosition, yaw + Math.sin(age * 3) * 0.25));
          for (let particle = 0; particle < 6; particle++) {
            const angle = particle * Math.PI / 3 + age * 4;
            this.draw(this.spark, model([dancerPosition[0] + Math.cos(angle) * 1.2, 0.8 + (particle % 3) * 0.6 + Math.sin(age * 8 + particle) * 0.2, dancerPosition[2] + Math.sin(angle) * 1.2], angle, 0.35));
          }
        }
        if (other.power.prism > 0) this.draw(this.prism, model(pose.position, race.elapsed * 2));
        if (other.power.jet > 0) this.draw(this.boost, model(pose.position, yaw, 1.5));
        if (other.power.flask > 0) this.draw(this.spark, model([pose.position[0], pose.position[1] + 2.5, pose.position[2]], race.elapsed, 1.2));
        if (other.drifting && other.driftCharge > 0.15) {
          for (const side of [-1, 1]) {
            const point = racePose(routeOffset(other.distance, -1, other.onShortcut), other.lane + side * 0.75, 0.22, other.onShortcut).position;
            this.draw(this.spark, model(point, race.elapsed * 5, 0.4 + Math.min(0.7, other.driftCharge / 2)));
          }
        }
        if (other.boost > 0) this.draw(this.boost, model(pose.position, yaw, 1 + Math.sin(race.elapsed * 43 + j) * 0.07));
        if (other.speed > 13 && (Math.abs(other.lane) > 6.5 || Math.abs(other.lateral) > 7)) {
          for (let particle = 0; particle < 5; particle++) {
            const life = ((race.elapsed * 2.8 + particle / 5) % 1);
            const point = racePose(routeOffset(other.distance, -1.4 - life * (3 + other.speed * 0.06), other.onShortcut), other.lane + (particle % 2 ? 0.8 : -0.8), 0.2 + life * 0.5, other.onShortcut).position;
            this.draw(this.dust, model(point, particle, (0.4 + life * 1.8) * (1 - life)));
          }
        }
        if (other.bump > 0 || other.power.flash > 0) {
          for (let particle = 0; particle < 5; particle++) {
            const angle = particle * 2.4 + race.elapsed * 5, radius = 1.2 + Math.max(0, 0.7 - Math.max(other.bump, other.power.flash)) * 2;
            this.draw(this.spark, model([pose.position[0] + Math.cos(angle) * radius, 0.55 + Math.abs(Math.sin(angle)) * 0.7, pose.position[2] + Math.sin(angle) * radius], angle, 0.65));
          }
        }
      }
      // Transparent shells are the final world pass, after all opaque karts.
      for (const other of race.karts) {
        if (other.power.shield <= 0) continue;
        const pose = racePose(other.distance, other.lane, 0.04, other.onShortcut);
        this.draw(this.shield, model(pose.position, pose.yaw), 0.16 + Math.sin(race.elapsed * 3) * 0.025);
      }
    }
  }
  dispose() {
    const gl = this.gl;
    for (const mesh of [this.world, this.boost, this.shadow, this.dust, this.spark, this.item, this.slick, this.bolt, this.shield, this.crown, this.prism, ...this.karts, ...this.emptyKarts, ...this.dancers.flat()]) gl.deleteBuffer(mesh.buffer);
    gl.deleteBuffer(this.skyBuffer); gl.deleteProgram(this.skyProgram);
    gl.deleteProgram(this.program);
  }
}
