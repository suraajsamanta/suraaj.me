import { buildExoticGarageRide } from './exoticGarage';
import { buildBikeEv } from './garageBikeEv';
import { buildGermanRide } from './garageGerman';
import { addSpaceScenery } from './spaceScenery';
import { SPACE_THEME } from './spaceCourse';
import { addSeattleScenery } from './seattleScenery';
import { addFoundryScenery } from './foundryScenery';
import { FOUNDRY_THEME } from './foundryCourse';
import { rainbowPanel } from './rainbowCourse';
import { addRainbowScenery } from './rainbowScenery';
import { ACTIVE_SHORTCUT, ACTIVE_TRACK, BARRIER_OFFSET, BOOST_FRACTIONS, BOOST_LANES, ROAD_HALF_WIDTH, SHORTCUT_LENGTH, SHORTCUT_POINTS, TRACK_LENGTH, TRACK_POINTS, shortcutPose, trackPose, wrap, type Vec3 } from './track';
import { kartWorldPose, type GamePlayer, type KartState, type RaceState } from './simulation';
import { DANCE_SECONDS, LIGHTNING_SECONDS, ITEM_RESPAWN_SECONDS, ITEM_BURST_SECONDS, ITEM_NOTICE_SECONDS } from './powerups';

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
  /** A rail follows both the curve and elevation of the road at its ends. */
  railStrip(from: number, to: number, lane: number, width: number, bottom: number, top: number, color: Color) {
    const p = (at: number, offset: number, height: number) => trackPose(at, lane + offset * width / 2, height).position;
    const a = p(from,-1,bottom), b = p(from,1,bottom), c = p(to,1,bottom), d = p(to,-1,bottom);
    const e = p(from,-1,top), f = p(from,1,top), h = p(to,1,top), i = p(to,-1,top);
    this.quad(a,b,f,e,color); this.quad(b,c,h,f,color); this.quad(c,d,i,h,color);
    this.quad(d,a,e,i,color); this.quad(e,f,h,i,color);
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
/** Keep the falling kart visible against the edge it left, with no below-road chase clipping. */
export function kartCameraTargets(kart: KartState): Camera {
  if (kart.fall) {
    const pose = kartWorldPose(kart);
    return {
      eye: [pose.position[0] - pose.forward[0] * 11, kart.fall.origin[1] + 6, pose.position[2] - pose.forward[2] * 11],
      target: [pose.position[0], pose.position[1] + 0.8, pose.position[2]],
    };
  }
  return {
    eye: racePose(routeOffset(kart.distance, -9 - kart.speed * 0.06, kart.onShortcut), kart.lane * 0.72, 4.5, kart.onShortcut).position,
    target: racePose(routeOffset(kart.distance, 10 + kart.speed * 0.1, kart.onShortcut), kart.lane * 0.4, 0.9, kart.onShortcut).position,
  };
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
/** Keep a rail out of a different section of the same drivable road. */
export function barrierIntersectsOtherRoad(from: number, to: number, side: number): boolean {
  const mid = (from + to) / 2, pose = trackPose(mid, side * 10.6);
  const halfLength = (to - from + .2) / 2;
  return TRACK_POINTS.some(point => {
    const delta = Math.abs(wrap(point.distance - mid));
    if (Math.min(delta, TRACK_LENGTH - delta) < halfLength + 10) return false;
    const dx = point.x - pose.position[0], dz = point.z - pose.position[2];
    const along = dx * pose.forward[0] + dz * pose.forward[2];
    const across = dx * pose.right[0] + dz * pose.right[2];
    return Math.hypot(Math.max(0, Math.abs(along) - halfLength), Math.max(0, Math.abs(across) - .325)) < ROAD_HALF_WIDTH + 1;
  });
}
function worldGeometry(): Geometry {
  const g = new Geometry();
  if (ACTIVE_TRACK.id === 'seattle' || ACTIVE_TRACK.id === 'foundry') {
    // Short tiles give the interpolated fog meaningful local distances.
    for (let x = -1200; x < 1200; x += 100) for (let z = -1200; z < 1200; z += 100)
      g.quad([x,-.15,z], [x,-.15,z+100], [x+100,-.15,z+100], [x+100,-.15,z], ACTIVE_TRACK.id === 'foundry' ? FOUNDRY_THEME.ground : [0.38,0.55,0.46]);
  } else if (ACTIVE_TRACK.id !== 'space' && ACTIVE_TRACK.id !== 'rainbow') g.quad([-1500, -0.15, -1500], [-1500, -0.15, 1500], [1500, -0.15, 1500], [1500, -0.15, -1500], [0.9, 0.7, 0.46]);
  const space = ACTIVE_TRACK.id === 'space', foundry = ACTIVE_TRACK.id === 'foundry', rainbow = ACTIVE_TRACK.id === 'rainbow';
  const theme = space ? SPACE_THEME : foundry ? FOUNDRY_THEME : null;
  const dark: Color = theme?.road ?? [0.2, 0.25, 0.32], cream: Color = theme?.stripe ?? CREAM, orange: Color = theme?.curb ?? CORAL;
  for (let i = 0; i < TRACK_POINTS.length - 1; i++) {
    const a = TRACK_POINTS[i].distance, b = TRACK_POINTS[i + 1].distance;
    if (rainbow) {
      for (let lane = 0; lane < 7; lane++) g.roadStrip(a, b, -7 + lane * 2, -5 + lane * 2, rainbowPanel(lane, i), 0.035, true);
      for (const side of [-1, 1]) {
        g.roadStrip(a, b, side < 0 ? -7 : 6.82, side < 0 ? -6.82 : 7, [0.91, 0.96, 1], 0.055, true);
        g.quad(trackPose(a, side * 7, 0.035).position, trackPose(b, side * 7, 0.035).position, trackPose(b, side * 7, -0.5).position, trackPose(a, side * 7, -0.5).position, [0.24, 0.21, 0.46], true);
      }
      continue;
    }
    const shoulder: Color = theme?.shoulder ?? [0.51, 0.68, 0.42];
    // Separate side bands avoid depth-fighting the sloped, curved road mesh.
    g.roadStrip(a, b, -11.2, -ROAD_HALF_WIDTH, shoulder, 0);
    g.roadStrip(a, b, ROAD_HALF_WIDTH, 11.2, shoulder, 0);
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
        if ((side === ACTIVE_SHORTCUT.side && Math.min(Math.abs(mid - ACTIVE_SHORTCUT.start * TRACK_LENGTH), Math.abs(mid - ACTIVE_SHORTCUT.end * TRACK_LENGTH)) < 35) || barrierIntersectsShortcut(a, next, side) || barrierIntersectsOtherRoad(a, next, side)) continue;
        g.railStrip(a, next, side * 10.6, .55, .025, 1.075, i % 12 === 0 ? orange : cream);
        g.railStrip(a, next, side * 10.6, .65, 1.045, 1.195, theme?.rail ?? TEAL);
      }
    }
  }
  // Physical shortcut road, following the same sampled curve as the physics.
  const branchStart = ACTIVE_SHORTCUT.start * TRACK_LENGTH, branchSpan = (ACTIVE_SHORTCUT.end - ACTIVE_SHORTCUT.start) * TRACK_LENGTH;
  const branchAt = (index: number) => branchStart + SHORTCUT_POINTS[index].distance / SHORTCUT_LENGTH * branchSpan;
  for (let i = 0; i < SHORTCUT_POINTS.length - 1; i++) {
    const a = branchAt(i), b = branchAt(i + 1);
    const strip = (left: number, right: number, color: Color, height: number) => g.quad(shortcutPose(a, left, height).position, shortcutPose(b, left, height).position, shortcutPose(b, right, height).position, shortcutPose(a, right, height).position, color, true);
    if (rainbow) {
      for (let lane = 0; lane < 7; lane++) strip(-7 + lane * 2, -5 + lane * 2, rainbowPanel(lane, i), 0.08);
      strip(-7, -6.82, [0.91, 0.96, 1], 0.095); strip(6.82, 7, [0.91, 0.96, 1], 0.095);
      for (const side of [-1, 1]) g.quad(shortcutPose(a, side * 7, 0.08).position, shortcutPose(b, side * 7, 0.08).position, shortcutPose(b, side * 7, -0.5).position, shortcutPose(a, side * 7, -0.5).position, [0.24, 0.21, 0.46], true);
      continue;
    }
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
    const [x, y, z] = pose.position;
    if (obstacle.kind === 'barrel') {
      g.disc([x + 0.2, y + 0.07, z + 0.25], 1, 0.85, [0.11, 0.16, 0.22]);
      g.cylinder([x, y + 0.08, z], 0.72, 1.35, [0.92, 0.4, 0.17], 12, 0.72);
      for (const height of [0.22, 1.05]) g.cylinder([x, y + height, z], 0.75, 0.18, [1, 0.91, 0.58], 12);
      g.cylinder([x, y + 1.44, z], 0.69, 0.07, [0.55, 0.25, 0.12], 12);
      g.cylinder([x, y + 1.52, z], 0.16, 0.08, [0.23, 0.22, 0.24], 8);
    } else {
      g.disc([x, y + 0.075, z], 2.05, 2.25, [0.075, 0.07, 0.14]);
      g.disc([x - 0.4, y + 0.078, z], 1.25, 1.6, [0.2, 0.14, 0.31]);
      g.disc([x + 0.4, y + 0.08, z + 0.2], 1, 1.25, [0.1, 0.29, 0.35]);
      g.disc([x + 0.75, y + 0.083, z + 0.1], 0.5, 0.6, [0.24, 0.4, 0.44]);
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

  // Course-specific scenery is batched once into the shared world mesh.
  if (ACTIVE_TRACK.id === 'seattle') { addSeattleScenery(g); return g; }
  if (rainbow) { addRainbowScenery(g); return g; }
  if (space) { addSpaceScenery(g); return g; }
  if (foundry) { addFoundryScenery(g); return g; }

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
  gorilla: [0.19, 0.23, 0.29], tiger: [1, 0.61, 0.12], monkey: [0.62, 0.39, 0.19],
  hippo: [0.51, 0.56, 0.45], flamingo: [1, 0.58, 0.72], rabbit: [0.9, 0.92, 0.94],
  panda: [0.94, 0.94, 0.87], zebra: [0.9, 0.88, 0.86], cow: [0.3, 0.22, 0.18],
  sheep: [0.92, 0.9, 0.85], lion: [1, 0.75, 0.16], buffalo: [0.43, 0.26, 0.15],
  orangutan: [0.84, 0.4, 0.1], elephant: [0.57, 0.66, 0.75], goat: [0.83, 0.81, 0.51],
  crocodile: [0.18, 0.72, 0.18], antelope: [0.67, 0.4, 0.16], fish: [0.94, 0.1, 0.12],
  pig: [1, 0.63, 0.68], ram: [0.83, 0.78, 0.65], donkey: [0.48, 0.45, 0.38],
  giraffe: [0.98, 0.76, 0.35], horse: [0.63, 0.27, 0.13],
  bezos: [.914, .725, .58], trump: [.925, .702, .525], musk: [.933, .761, .663],
  zuckerberg: [.937, .804, .733], ye: [.529, .318, .231], huang: [.863, .729, .596],
};
/** Stylized likenesses use each person's actual hair, complexion and signature
 * outfit. Cosmetic props never change a driver's collision shape or abilities. */
const FIGURE_SKIN: Record<string, Color> = {
  bezos: [.914, .725, .58], trump: [.925, .702, .525], musk: [.933, .761, .663],
  zuckerberg: [.937, .804, .733], ye: [.529, .318, .231], huang: [.863, .729, .596],
};
const FIGURE_OUTFIT: Record<string, Color> = {
  bezos: [.08, .13, .19], trump: [.07, .19, .42], musk: [.17, .2, .19],
  zuckerberg: [.43, .46, .49], ye: [.085, .075, .12], huang: [.045, .055, .07],
};
const GOLD: Color = [1, .72, .19], HOLO_BLUE: Color = [.28, .79, 1], GPU_GREEN: Color = [.45, 1, .18];
const isFigure = (id: string) => Object.prototype.hasOwnProperty.call(FIGURE_SKIN, id);

function figureHead(g: Geometry, id: string, center: Vec3) {
  const [x, y, z] = center, skin = FIGURE_SKIN[id], hair: Color = [.2, .15, .12];
  const p = (dx: number, dy: number, dz: number): Vec3 => [x + dx, y + dy, z + dz];
  const wide = id === 'trump' ? .49 : id === 'huang' ? .45 : .41;
  g.ellipsoid(center, [wide, id === 'zuckerberg' ? .53 : .48, .38], skin, id === 'bezos' ? 16 : 12, id === 'bezos' ? 8 : 7);
  for (const side of [-1, 1]) g.ellipsoid(p(side * wide, -.01, -.02), [.085, .14, .07], skin, 7, 4);
  // Huang's short salt-and-pepper cut and glasses are his identity cues, not
  // flags or exaggerated ethnic shorthand. All faces retain normal proportions.
  if (id === 'bezos') {
    g.ellipsoid(p(-.1, .32, .12), [.19, .07, .13], [.98, .92, .82], 8, 4);
    g.ellipsoid(p(.12, .4, -.04), [.1, .025, .12], [1, .98, .94], 7, 4);
  } else if (id === 'trump') {
    const orange: Color = [1, .62, .15];
    g.ellipsoid(p(0, .32, -.08), [.49, .19, .34], orange, 12, 6);
    // A solid, asymmetric swept quiff, not stacked horizontal hair discs.
    const sweep = [[-.51, .3, .3, .045, .065], [-.34, .4, .28, .11, .15], [-.07, .53, .19, .15, .23], [.23, .48, .08, .14, .24], [.46, .35, -.025, .075, .16]];
    const point = (section: number, corner: number): Vec3 => {
      const [dx, dy, dz, ry, rz] = sweep[section], angle = corner * Math.PI / 4;
      return p(dx, dy + Math.cos(angle) * ry, dz + Math.sin(angle) * rz);
    };
    for (let section = 0; section < sweep.length - 1; section++) for (let corner = 0; corner < 8; corner++) {
      g.quad(point(section, corner), point(section + 1, corner), point(section + 1, corner + 1), point(section, corner + 1), corner < 3 ? [1, .75, .23] : orange);
    }
    for (const section of [0, sweep.length - 1]) for (let corner = 0; corner < 8; corner++) {
      g.triangle(p(sweep[section][0], sweep[section][1], sweep[section][2]), point(section, corner), point(section, corner + 1), orange);
    }
  } else if (id === 'musk') {
    g.ellipsoid(p(0, .34, -.1), [.43, .22, .33], hair, 9, 5);
    for (let i = 0; i < 5; i++) {
      const dx = -.34 + i * .16;
      g.triangle(p(dx - .1, .34, .16), p(dx + .1, .35, .19), p(dx - .11, .62 + (i % 2) * .07, -.24), hair);
      g.triangle(p(dx + .1, .35, .19), p(dx + .11, .31, -.29), p(dx - .11, .62 + (i % 2) * .07, -.24), [.28, .2, .14]);
    }
  } else if (id === 'zuckerberg') {
    g.ellipsoid(p(0, .38, -.08), [.42, .16, .33], [.39, .27, .19], 10, 5);
    g.box(p(0, .32, .25), [.7, .09, .05], [.39, .27, .19]);
    // Raised VR headset, with a strap that remains visible in the chase view.
    g.box(p(0, .33, .36), [.69, .24, .17], CHARCOAL);
    for (const side of [-1, 1]) {
      g.box(p(side * .17, .33, .46), [.23, .11, .025], HOLO_BLUE);
      g.box(p(side * .43, .29, -.03), [.05, .1, .66], CHARCOAL);
    }
    g.box(p(0, .29, -.37), [.83, .1, .055], CHARCOAL);
  } else if (id === 'huang') {
    g.ellipsoid(p(0, .34, -.09), [.46, .21, .34], [.17, .18, .19], 10, 5);
    for (const side of [-1, 1]) {
      g.ellipsoid(p(side * .35, .2, -.04), [.105, .27, .27], [.69, .72, .73], 7, 4);
      for (let i = 0; i < 3; i++) g.beam(p(side * (.12 + i * .09), .48 - i * .035, -.23), p(side * (.08 + i * .09), .49 - i * .035, .12), .018, [.8, .82, .83]);
    }
  } else if (id === 'ye') {
    g.ellipsoid(p(0, .07, -.17), [.53, .56, .37], [.14, .145, .18], 10, 6);
    g.ellipsoid(p(0, -.015, .16), [.41, .44, .27], [.49, .51, .56], 10, 6);
    for (const side of [-1, 1]) g.ellipsoid(p(side * .17, .1, .405), [.18, .095, .035], [.025, .025, .04], 8, 4);
    g.box(p(0, .1, .415), [.13, .055, .04], CHARCOAL);
    for (let i = -2; i <= 2; i++) g.box(p(i * .055, -.17, .419), [.018, .12, .02], [.17, .19, .23]);
    return;
  }
  const eyeY = id === 'zuckerberg' ? -.015 : .035;
  for (const side of [-1, 1]) {
    const eyeHeight = id === 'zuckerberg' ? .1 : id === 'huang' ? .052 : .062;
    g.ellipsoid(p(side * .17, eyeY, .342), [.1, eyeHeight, .035], [1, .98, .93], 7, 4);
    g.ellipsoid(p(side * .17, eyeY, .373), [.037, eyeHeight * .72, .018], id === 'musk' || id === 'zuckerberg' ? [.13, .3, .42] : [.17, .13, .1], 6, 4);
    g.beam(p(side * .08, eyeY + .13, .346), p(side * .27, eyeY + .13 + (id === 'trump' ? -.055 : .015), .31), .025, id === 'trump' ? GOLD : hair);
  }
  g.ellipsoid(p(0, -.08, .37), [id === 'huang' ? .09 : .075, .13, .1], skin, 7, 4);
  if (id === 'bezos') {
    g.ellipsoid(p(0, -.24, .32), [.25, .095, .05], [.39, .16, .12], 8, 4);
    g.box(p(0, -.22, .37), [.38, .075, .025], [1, .99, .94]);
    for (let tooth = -2; tooth <= 2; tooth++) g.box(p(tooth * .06, -.22, .385), [.009, .065, .008], [.72, .68, .6]);
  } else if (id === 'trump') {
    g.ellipsoid(p(0, -.25, .35), [.12, .068, .055], [.8, .38, .29], 8, 4);
    g.box(p(0, -.25, .401), [.11, .013, .012], [.42, .2, .18]);
  } else if (id === 'huang') {
    g.beam(p(-.15, -.215, .335), p(0, -.265, .36), .016, [.44, .25, .21]);
    g.beam(p(0, -.265, .36), p(.15, -.215, .335), .016, [.44, .25, .21]);
  } else {
    g.beam(p(-.13, -.24, .335), p(.13, id === 'musk' ? -.19 : -.235, .335), .017, [.44, .25, .21]);
  }
  if (id === 'huang') {
    // Open rectangular wire rims rather than opaque sunglasses.
    for (const side of [-1, 1]) {
      const left = side * .17 - .135, right = side * .17 + .135;
      for (const yy of [-.045, .13]) g.beam(p(left, yy, .392), p(right, yy, .392), .009, SILVER);
      for (const xx of [left, right]) g.beam(p(xx, -.045, .392), p(xx, .13, .392), .009, SILVER);
      g.beam(p(side * .31, .1, .38), p(side * .43, .1, -.02), .012, SILVER);
    }
    g.beam(p(-.035, .07, .399), p(.035, .07, .399), .012, SILVER);
  }
}

function figureTorso(g: Geometry, id: string, center: Vec3, accent: Color) {
  const [x, y, z] = center, coat: Color = id === 'ye' ? [.16, .16, .205] : FIGURE_OUTFIT[id];
  const p = (dx: number, dy: number, dz: number): Vec3 => [x + dx, y + dy, z + dz];
  const width = id === 'trump' ? .52 : id === 'ye' ? .59 : id === 'musk' ? .46 : .39;
  if (id === 'ye') {
    // Overlapping padded bands already enclose the torso. A second inner
    // ellipsoid would be entirely hidden but duplicated in all sixteen poses.
    for (let band = 0; band < 4; band++) g.ellipsoid(p(0, -.3 + band * .21, 0), [width, .17, .39], [coat[0] + band * .008, coat[1] + band * .008, coat[2] + band * .008], 10, 4);
    g.box(p(0, -.03, .392), [.035, .82, .035], SILVER);
  } else {
    g.ellipsoid(center, [width, id === 'bezos' ? .52 : .46, .32], coat, 10, 6);
    if (id === 'bezos') {
      g.box(p(0, .08, .31), [.23, .69, .05], [1, .97, .9]);
      for (const side of [-1, 1]) {
        g.box(p(side * .21, -.05, .31), [.17, .62, .09], coat);
        g.box(p(side * .23, -.13, .37), [.13, .16, .025], [.16, .22, .28]);
      }
    } else if (id === 'trump') {
      g.box(p(0, .05, .32), [.24, .63, .045], [1, .97, .92]);
      for (const side of [-1, 1]) g.triangle(p(side * .32, .36, .29), p(side * .07, .04, .37), p(side * .09, -.13, .35), [.12, .27, .52]);
      g.box(p(0, -.19, .37), [.115, 1, .045], [.94, .05, .07]);
      g.triangle(p(-.058, -.69, .396), p(.058, -.69, .396), p(0, -.82, .396), [.94, .05, .07]);
    } else if (id === 'musk') {
      g.box(p(0, .02, .323), [.35, .6, .04], CHARCOAL);
      for (let line = 0; line < 3; line++) {
        g.beam(p(-.12, -.15 + line * .13, .35), p(.12, -.15 + line * .13, .35), .013, HOLO_BLUE);
        g.beam(p(-.1 + line * .1, -.19, .35), p(-.1 + line * .1, .19, .35), .01, GPU_GREEN);
      }
      g.box(p(0, -.38, -.02), [.82, .08, .56], [.25, .28, .25]);
    } else if (id === 'huang') {
      g.box(p(0, 0, .323), [.018, .68, .025], SILVER);
      for (const side of [-1, 1]) {
        g.triangle(p(side * .29, .33, .25), p(side * .06, .08, .36), p(side * .16, -.08, .34), [.14, .16, .18]);
        g.beam(p(side * .16, -.16, .32), p(side * .31, -.04, .26), .012, SILVER);
      }
    }
  }
  // Tiny rear racing stripe preserves the driver's chosen color without
  // recoloring the requested suit, puffer, leather jacket or grey shirt.
  g.box(p(0, -.12, -.325), [.3, .09, .025], accent);
}

/** The waist bridges the moving hips to the jacket even in a bent-over pose. */
function figureWaist(g: Geometry, id: string, hip: Vec3, chest: Vec3) {
  const wide = id === 'trump' ? .35 : id === 'ye' ? .36 : .28;
  const top: Vec3 = [chest[0], chest[1] - .29, chest[2]];
  g.beam(hip, top, wide * .8, id === 'ye' ? [.12, .12, .16] : FIGURE_OUTFIT[id]);
  g.ellipsoid([hip[0], hip[1] + .035, hip[2]], [wide, .23, .27], CHARCOAL, 8, 4);
}

function figureSleeve(g: Geometry, id: string, from: Vec3, to: Vec3, forearm = false) {
  const fabric: Color = id === 'ye' ? [.17, .17, .215] : id === 'bezos' ? forearm ? FIGURE_SKIN[id] : [1, .97, .91] : FIGURE_OUTFIT[id];
  const width = id === 'ye' ? .19 : id === 'musk' ? .14 : forearm ? .11 : .13;
  g.beam(from, to, width, fabric);
  if (id === 'ye') for (const at of [.25, .75]) {
    const center = from.map((value, axis) => value + (to[axis] - value) * at) as Vec3;
    g.ellipsoid(center, [.235, .21, .23], fabric, 6, 3);
  }
  if (id === 'bezos' && !forearm) g.ellipsoid(to, [.145, .11, .135], [1, .97, .91], 8, 4);
}

function figureHand(g: Geometry, id: string, center: Vec3, gesture = false) {
  g.sphere(center, .12, FIGURE_SKIN[id], 7, 4);
  if (gesture && id === 'trump') g.beam([center[0] - .07, center[1], center[2]], [center[0] - .09, center[1] + .23, center[2]], .052, FIGURE_SKIN[id]);
}
function figureProp(g: Geometry, id: string, hand: Vec3) {
  const p = (dx: number, dy: number, dz: number): Vec3 => [hand[0] + dx, hand[1] + dy, hand[2] + dz];
  if (id === 'bezos') {
    const base: Vec3 = p(0, .14, 0);
    g.box(base, [.28, .13, .27], GOLD);
    g.cylinder([base[0], base[1] + .07, base[2]], .08, .38, SILVER, 8, .075);
    g.cylinder([base[0], base[1] + .45, base[2]], .075, .16, [1, .94, .72], 8, 0);
    for (const side of [-1, 1]) g.triangle([base[0] + side * .075, base[1] + .13, base[2]], [base[0] + side * .19, base[1] + .07, base[2]], [base[0] + side * .075, base[1] + .3, base[2]], GOLD);
    g.sphere([base[0], base[1] + .29, base[2] + .075], .045, HOLO_BLUE, 6, 4, true);
    g.beam([base[0] + .08, base[1] + .3, base[2] + .08], [base[0] + .43, base[1] + .3, base[2] + .08], .009, GOLD);
  } else if (id === 'musk') {
    g.beam(p(0, -.18, 0), p(0, .47, 0), .055, SILVER);
    g.beam(p(-.12, .49, 0), p(.12, .49, 0), .055, SILVER);
    for (const side of [-1, 1]) g.beam(p(side * .12, .49, 0), p(side * .12, .68, 0), .055, SILVER);
  } else if (id === 'huang') {
    g.box(p(.01, .18, .02), [.21, .2, .05], [.8, .85, .87]);
    g.box(p(.01, .18, .052), [.12, .11, .016], GPU_GREEN);
    for (const side of [-1, 1]) for (let pin = -1; pin <= 1; pin++) g.box(p(.01 + side * .13, .18 + pin * .06, .02), [.06, .018, .022], GOLD);
    // Two fingers visibly pinch the relic rather than hiding it in a fist.
    g.beam(p(-.06, .02, 0), p(-.075, .16, .02), .027, FIGURE_SKIN[id]);
    g.beam(p(.07, .02, 0), p(.09, .14, .02), .027, FIGURE_SKIN[id]);
  }
}
function figureBoot(g: Geometry, id: string, foot: Vec3) {
  g.box([foot[0], foot[1], foot[2] + .1], [id === 'ye' ? .43 : .32, .24, id === 'ye' ? .65 : .5], id === 'musk' ? SILVER : id === 'ye' ? [.13, .13, .17] : CHARCOAL);
  if (id === 'musk') {
    g.cylinder([foot[0], foot[1] - .13, foot[2]], .09, .08, [.14, .25, .34], 7);
    g.cylinder([foot[0], foot[1] - .32, foot[2]], .012, .19, HOLO_BLUE, 7, .075);
  } else if (id === 'ye') {
    g.box([foot[0], foot[1] - .105, foot[2] + .1], [.44, .035, .66], [.7, .38, 1]);
  }
}

function figureSeated(g: Geometry, color: Color, id: string, motorcycle: boolean) {
  const y = (motorcycle ? 1.47 : 1.3) + (id === 'bezos' ? .08 : 0), z = motorcycle ? -.2 : -.15;
  const chest: Vec3 = [0, y, z]; figureTorso(g, id, chest, color);
  figureHead(g, id, [0, y + (id === 'bezos' ? .78 : .71), z]);
  for (const side of [-1, 1]) {
    const special = side === 1 && ['bezos', 'trump', 'musk', 'huang'].includes(id);
    const hand: Vec3 = special ? [id === 'trump' ? .8 : .68, y + (id === 'bezos' ? .02 : .28), z + .35] : [side * (motorcycle ? .48 : .39), motorcycle ? 1.48 : 1.23, motorcycle ? .59 : .57];
    const elbow: Vec3 = [side * .5, y - .06, z + .18];
    figureSleeve(g, id, [side * .32, y + .2, z], elbow);
    figureSleeve(g, id, elbow, hand, true);
    figureHand(g, id, hand, special);
    if (side === 1) figureProp(g, id, hand);
    if (motorcycle || id === 'musk' || id === 'ye') {
      g.beam([side * .23, y - .3, z], [side * .42, .88, .1], .13, CHARCOAL);
      figureBoot(g, id, [side * .44, .73, .1]);
    }
  }
}

function figurePose(color: Color, phase: number, id: string, twerk: boolean): Geometry {
  const g = new Geometry(), sway = Math.sin(phase);
  const stiff = id === 'zuckerberg', theatrical = id === 'ye';
  const hover = id === 'musk' ? .22 + .06 * Math.sin(phase * 2) : 0;
  const bounce = (twerk ? Math.cos(phase) * .12 : Math.abs(Math.cos(phase)) * (stiff ? .06 : .18)) + hover;
  const crouch = theatrical && !twerk ? (1 + Math.sin(phase)) * .19 : 0;
  const hip: Vec3 = [sway * (stiff ? .07 : twerk ? .25 : .17), 1.04 + bounce - crouch, twerk ? -.25 - Math.cos(phase * 2) * .12 : 0];
  const chest: Vec3 = [-sway * (stiff ? .04 : .15), hip[1] + (twerk ? .5 : .65), twerk ? .43 : 0];
  figureWaist(g, id, hip, chest);
  figureTorso(g, id, chest, color);
  figureHead(g, id, [chest[0], chest[1] + (id === 'bezos' ? .77 : .69), chest[2] + (twerk ? .13 : 0)]);
  for (const side of [-1, 1]) {
    const foot: Vec3 = [side * (twerk ? .52 : theatrical ? .54 : .34 + .17 * Math.sin(phase + side)), .15 + hover, twerk ? 0 : side * .25 * Math.cos(phase)];
    const knee: Vec3 = [side * .49, hip[1] * .53 + hover * .4, twerk ? .3 : .08];
    g.beam([hip[0] + side * .18, hip[1], hip[2]], knee, .14, CHARCOAL);
    g.beam(knee, foot, .13, CHARCOAL); figureBoot(g, id, foot);
    let hand: Vec3;
    if (twerk) hand = [knee[0], knee[1] + .2, knee[2] + .16];
    else if (theatrical) hand = [side * (1.25 - crouch * 1.3), chest[1] + .25 - crouch * 2.8, .15 + crouch * .65];
    else if (stiff) hand = [side * .74, chest[1] + (Math.sin(phase + side) > 0 ? .43 : -.1), .2];
    else hand = [side * (theatrical ? 1.16 : .94 + .18 * Math.cos(phase)), chest[1] + .15 + Math.sin(phase + side * 1.3) * (theatrical ? .8 : .6), .1 + side * sway * .2];
    const elbow: Vec3 = [(chest[0] + hand[0]) * .52, chest[1] - .13, chest[2] + .1];
    figureSleeve(g, id, [chest[0] + side * .29, chest[1] + .16, chest[2]], elbow);
    figureSleeve(g, id, elbow, hand, true);
    figureHand(g, id, hand, !twerk);
    if (side === 1) figureProp(g, id, hand);
  }
  return g;
}

/** Full-body selection pose uses the same outfit, hands, feet and auras as racing. */
function figureShowroomGeometry(color: Color, id: string): Geometry {
  const g = new Geometry(), hover = id === 'musk' ? .26 : 0;
  const hip: Vec3 = [0, .99 + hover, 0];
  const chest: Vec3 = [0, 1.38 + hover + (id === 'bezos' ? .08 : 0), 0];
  figureWaist(g, id, hip, chest);
  figureTorso(g, id, chest, color);
  figureHead(g, id, [0, chest[1] + (id === 'bezos' ? .77 : .72), 0]);
  for (const side of [-1, 1]) {
    const foot: Vec3 = [side * (id === 'ye' ? .36 : .27), .15 + hover, .03];
    const knee: Vec3 = [side * .26, .58 + hover, -.02];
    g.beam([side * .2, hip[1], 0], knee, .14, CHARCOAL);
    g.beam(knee, foot, .13, CHARCOAL); figureBoot(g, id, foot);
    const special = side === 1 && ['bezos', 'trump', 'musk', 'huang'].includes(id);
    const hand: Vec3 = id === 'ye' ? [side * .96, 1.42, .17] : [side * (special ? .67 : .59), (special ? 1.52 : 1.02) + hover, .17];
    const elbow: Vec3 = [side * (id === 'ye' ? .64 : .53), 1.24 + hover, -.01];
    figureSleeve(g, id, [side * .3, chest[1] + .19, 0], elbow);
    figureSleeve(g, id, elbow, hand, true);
    figureHand(g, id, hand, special);
    if (special) figureProp(g, id, hand);
  }
  const aura = figureAuraGeometry(id, true).data;
  if (id === 'trump') {
    // Keep orbiting buttons beside the face in the fixed selection camera.
    const turn = .64, c = Math.cos(turn), s = Math.sin(turn);
    for (let i = 0; i < aura.length; i += 6) {
      const x = aura[i], z = aura[i + 2]; aura[i] = x * c + z * s; aura[i + 2] = z * c - x * s;
    }
  }
  g.data.push(...aura);
  return g;
}

/** One tiny static mesh per figure is transformed during frames. These are
 * cosmetic only: no hitboxes, projectiles or automatic power-up activation. */
export function figureAuraGeometry(character: string, showroom = false): Geometry {
  const g = new Geometry();
  const panel = (center: Vec3, color: Color, menu = true) => {
    const [x, y, z] = center;
    g.box(center, [.55, .36, .025], [.07, .18, .25]);
    for (const side of [-1, 1]) {
      g.beam([x + side * .275, y - .18, z + .018], [x + side * .275, y + .18, z + .018], .012, color);
      g.beam([x - .275, y + side * .18, z + .018], [x + .275, y + side * .18, z + .018], .012, color);
    }
    if (menu) for (let line = 0; line < 3; line++) g.box([x - .02, y - .1 + line * .1, z + .022], [.35 - line * .07, .018, .008], color);
  };
  if (character === 'bezos') {
    for (const [x, y, z] of [[-.7, 1.9, -.2], [.95, 2.26, -.18], [-.5, 2.55, -.25]]) g.sphere([x, y, z], .035, [1, .95, .6], 6, 4, true);
  } else if (character === 'trump') {
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const x = Math.cos(angle) * 1.02, z = Math.sin(angle) * .85;
      g.sphere([x, 1.9 + (i % 2) * .2, z], .12, i % 2 ? [.12, .35, 1] : [1, .13, .16], 6, 4, true);
      g.box([x, 1.91 + (i % 2) * .2, z + .12], [.1, .035, .018], [1, 1, 1]);
    }
    for (const side of [-1, 1]) {
      g.beam([side * .89, 1.6, -.55], [side * .89, 2.4, -.55], .018, GOLD);
      g.box([side * .76, 2.24, -.55], [.27, .24, .025], GOLD);
    }
  } else if (character === 'musk') {
    panel([.91, 2.12, -.38], HOLO_BLUE, false);
    const car: Vec3[] = [[.68, 2.02, -.35], [.69, 2.1, -.35], [.77, 2.1, -.35], [.81, 2.2, -.35], [1.01, 2.2, -.35], [1.08, 2.1, -.35], [1.14, 2.07, -.35], [1.14, 2.02, -.35], [.68, 2.02, -.35]];
    for (let index = 1; index < car.length; index++) g.beam(car[index - 1], car[index], .01, HOLO_BLUE);
    // Wireframe electric-car blueprint and a tiny solar-panel satellite.
    g.box([-.92, 2.15, -.2], [.2, .15, .18], SILVER);
    for (const side of [-1, 1]) g.box([-.92 + side * .23, 2.15, -.2], [.22, .24, .025], HOLO_BLUE);
    for (const side of [-1, 1]) g.sphere([.91 + side * .15, 1.94, -.35], .047, HOLO_BLUE, 5, 3, true);
    if (!showroom) for (const side of [-1, 1]) g.triangle([side * .44 - .06, .55, .1], [side * .44 + .06, .55, .1], [side * .44, .22, .1], HOLO_BLUE, true);
  } else if (character === 'zuckerberg') {
    panel([.88, 2.04, -.39], HOLO_BLUE);
    for (const side of [-1, 1]) {
      g.box([side * .9, 1.75, .35], [.18, .2, .055], HOLO_BLUE);
      g.box([side * .9 - .065, 1.89, .35], [.07, .2, .055], HOLO_BLUE);
      g.box([side * .9 + .12, 1.7, .35], [.07, .15, .055], [.1, .35, .65]);
    }
  } else if (character === 'ye') {
    const sonic: Color = [.7, .4, 1];
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const x = Math.cos(angle) * 1.05, z = Math.sin(angle) * 1.05;
      g.box([x, 1.35 + (i % 3) * .09, z], [.055, .19 + (i % 3) * .13, .055], sonic);
      const next = angle + Math.PI / 4;
      g.beam([x, .12, z], [Math.cos(next) * 1.05, .12, Math.sin(next) * 1.05], .012, sonic);
    }
    for (const side of [-1, 1]) g.box([side * .42, .07, -.2], [.32, .025, .5], sonic);
  } else if (character === 'huang') {
    for (const side of [-1, 1]) {
      g.box([side * .9, 1.98, -.2], [.37, .21, .08], [.08, .2, .1]);
      g.box([side * .9, 1.98, -.145], [.17, .12, .025], GPU_GREEN);
      for (let pin = -2; pin <= 2; pin++) g.box([side * .9 + pin * .06, 1.84, -.2], [.022, .08, .025], SILVER);
      for (let trail = 0; trail < 4; trail++) g.sphere([side * (.84 - trail * .11), 2 + trail * .055, -.34 - trail * .12], .035 - trail * .005, GPU_GREEN, 5, 3, true);
    }
  }
  return g;
}

function characterId(id?: string): string { return id && Object.prototype.hasOwnProperty.call(CHARACTER_COLORS, id) ? id : 'fox'; }

/** Species proportions are shared by selection, seated driving and item poses.
 * Animals retain fur, paws/hooves/fins and their own body silhouette; the chosen
 * player color is a scarf and racing belt rather than an identical human suit. */
const ANIMAL_PROPORTIONS: Record<string, readonly [number, number, number, number, number, number, number]> = {
  // standing hip height, chest rise, torso width/depth, arm/leg thickness, reach
  gorilla: [.72, .66, .58, .35, .2, .16, .93], tiger: [.91, .61, .43, .3, .13, .14, .72],
  monkey: [.85, .59, .3, .23, .1, .11, .79], hippo: [.6, .61, .58, .44, .18, .19, .74],
  flamingo: [1.21, .35, .29, .29, .1, .045, .62], rabbit: [.72, .55, .36, .31, .105, .15, .58],
  panda: [.67, .62, .53, .39, .18, .18, .74], zebra: [1, .57, .35, .29, .095, .105, .66],
  cow: [.85, .58, .47, .37, .14, .14, .71], sheep: [.73, .49, .46, .34, .095, .085, .64],
  lion: [.89, .64, .47, .33, .15, .15, .74], buffalo: [.78, .69, .57, .4, .18, .16, .79],
  orangutan: [.65, .68, .41, .3, .16, .1, 1.04], elephant: [.72, .65, .57, .43, .21, .22, .8],
  goat: [.96, .48, .31, .25, .085, .085, .62], crocodile: [.64, .62, .45, .36, .16, .17, .76],
  antelope: [1.08, .5, .3, .24, .075, .08, .64], fish: [.74, .47, .39, .34, .06, .06, .91],
  pig: [.58, .54, .49, .39, .13, .135, .64], ram: [.75, .55, .51, .36, .12, .12, .7],
  donkey: [.9, .55, .38, .31, .12, .12, .66], bear: [.67, .68, .55, .39, .19, .18, .78],
  giraffe: [1.17, .55, .31, .25, .08, .085, .65], horse: [.98, .63, .43, .32, .13, .125, .72],
};
const isAnimal = (id: string) => Object.prototype.hasOwnProperty.call(ANIMAL_PROPORTIONS, id);
type AnimalPose = 'showroom' | 'seated' | 'motorcycle' | 'dance' | 'twerk';
function appendOriented(target: Geometry, source: Geometry, center: Vec3, up: Vec3) {
  const vertical = normalize(up), right = normalize(cross(vertical, [0, 0, 1])), forward = cross(right, vertical);
  for (let at = 0; at < source.data.length; at += 6) {
    const [x, y, z] = source.data.slice(at, at + 3);
    target.data.push(center[0] + right[0] * x + vertical[0] * y + forward[0] * z,
      center[1] + right[1] * x + vertical[1] * y + forward[1] * z,
      center[2] + right[2] * x + vertical[2] * y + forward[2] * z,
      ...source.data.slice(at + 3, at + 6));
  }
}
function animalSegment(g: Geometry, a: Vec3, b: Vec3, radius: number, color: Color) {
  const delta = subtract(b, a), center = a.map((v, i) => (v + b[i]) / 2) as Vec3;
  const shape = new Geometry(); shape.ellipsoid([0, 0, 0], [radius, Math.hypot(...delta) / 2 + radius * .35, radius], color, 6, 3);
  appendOriented(g, shape, center, delta);
}
function animalTail(g: Geometry, id: string, hip: Vec3) {
  const fur = CHARACTER_COLORS[id], p = (x: number, y: number, z: number): Vec3 => [hip[0] + x, hip[1] + y, hip[2] + z];
  if (['gorilla', 'orangutan'].includes(id)) return; // Apes do not have tails.
  if (id === 'pig') {
    for (let n = 0; n < 9; n++) {
      const a = n / 8 * Math.PI * 2, b = (n + 1) / 8 * Math.PI * 2;
      g.beam(p(.29 + Math.cos(a) * .12, .05 + Math.sin(a) * .12, -.42 - n * .018), p(.29 + Math.cos(b) * .12, .05 + Math.sin(b) * .12, -.44 - n * .018), .032, fur);
    }
  } else if (id === 'crocodile') {
    const points: Vec3[] = [p(0, -.03, -.25), p(-.34, -.04, -.75), p(-.73, .06, -1.08), p(-.91, .25, -1.18)];
    for (let n = 1; n < points.length; n++) animalSegment(g, points[n - 1], points[n], .2 / n, fur);
    for (let n = 0; n < 5; n++) g.triangle(p(-n * .15 - .1, .05, -.4 - n * .14), p(-n * .15 - .1, .3 - n * .025, -.44 - n * .14), p(-n * .15 - .27, .06, -.6 - n * .14), [.1, .4, .12]);
  } else if (id === 'fish') {
    const base = p(0, .12, -.3), tip = p(0, .13, -1.02);
    g.ellipsoid(base, [.2, .24, .3], fur, 7, 4);
    for (const side of [-1, 1]) {
      g.triangle(base, [tip[0] + side * .04, tip[1] + .53, tip[2]], [tip[0] + side * .04, tip[1] - .39, tip[2]], [1, .37, .27]);
      g.triangle(base, [tip[0] + side * .04, tip[1] - .39, tip[2]], p(0, -.04, -.48), fur);
    }
  } else if (['rabbit', 'panda', 'bear', 'sheep', 'ram', 'goat', 'hippo'].includes(id)) {
    g.ellipsoid(p(0, .04, -.34), [id === 'rabbit' ? .19 : .11, .14, .15], id === 'panda' ? CHARCOAL : id === 'rabbit' || id === 'sheep' ? CREAM : fur, 7, 4);
  } else if (id === 'flamingo') {
    for (const side of [-1, 0, 1]) animalSegment(g, p(0, .04, -.15), p(side * .14, .23, -.63), .075, side ? [.95, .35, .5] : fur);
  } else {
    const thick = id === 'horse' ? .14 : id === 'monkey' ? .065 : .08;
    const end = p(-.48, id === 'monkey' ? .56 : .19, -.75);
    animalSegment(g, p(0, .03, -.23), p(-.22, .02, -.65), thick, fur);
    animalSegment(g, p(-.22, .02, -.65), end, thick, fur);
    if (id === 'monkey') animalSegment(g, end, p(-.65, .6, -.64), thick, fur);
    else if (['lion', 'cow', 'buffalo', 'giraffe', 'horse', 'zebra', 'donkey', 'antelope'].includes(id)) g.ellipsoid(end, [.13, .19, .13], id === 'lion' ? [.51, .25, .08] : CHARCOAL, 7, 4);
    if (id === 'tiger' || id === 'zebra') for (let n = 0; n < 3; n++) g.ellipsoid(p(-.13 - n * .11, .04 + n * .035, -.52 - n * .08), [.09, .04, .09], CHARCOAL, 6, 3);
  }
}

/** Exposed for silhouette regression tests: the entire animal below its head. */
export function animalBodyGeometry(color: Color, id: string, pose: AnimalPose = 'showroom', phase = 0): Geometry {
  return animalGeometry(color, id, pose, phase, false);
}
function animalGeometry(color: Color, id: string, pose: AnimalPose, phase = 0, head = true): Geometry {
  const g = new Geometry(); if (!isAnimal(id)) return g;
  const spec = ANIMAL_PROPORTIONS[id];
  const [height, rise, width, depth, arm, leg, reach] = spec, fur = CHARACTER_COLORS[id];
  const seated = pose === 'seated' || pose === 'motorcycle', bike = pose === 'motorcycle', dance = pose === 'dance', twerk = pose === 'twerk';
  const sway = Math.sin(phase), bounce = dance ? Math.abs(Math.cos(phase)) * .13 : twerk ? Math.cos(phase) * .09 : 0;
  const hip: Vec3 = seated ? [0, bike ? 1.11 : .97, bike ? -.2 : -.15] : [twerk ? sway * .2 : dance ? sway * .13 : 0, height + bounce - (twerk ? .15 : 0), twerk ? -.24 : 0];
  const chest: Vec3 = [dance ? -sway * .12 : twerk ? -sway * .06 : 0, hip[1] + (seated ? .34 : rise), seated ? hip[2] : twerk ? .36 : 0];
  const mid = hip.map((v, i) => (v + chest[i]) / 2) as Vec3, body = new Geometry();
  const torsoHeight = seated ? .4 : rise * .65 + .13;
  body.ellipsoid([0, 0, 0], [width, torsoHeight, depth], fur, 9, 5);
  const pale: Color = id === 'gorilla' ? [.4, .43, .47] : id === 'crocodile' ? [.8, .87, .38] : id === 'bear' ? [.85, .63, .4] : id === 'pig' ? [1, .77, .79] : CREAM;
  if (!['flamingo', 'fish', 'elephant', 'buffalo', 'sheep', 'ram'].includes(id)) body.ellipsoid([0, -.02, depth * .88], [width * .68, torsoHeight * .77, .075], pale, 8, 4);
  if (id === 'panda') body.ellipsoid([0, torsoHeight * .57, 0], [width * 1.02, .16, depth * 1.01], CHARCOAL, 8, 4);
  if (id === 'gorilla' || id === 'buffalo') body.ellipsoid([0, torsoHeight * .55, -.045], [width * 1.12, .23, depth], fur, 8, 4);
  if (id === 'sheep' || id === 'ram') for (let n = 0; n < 9; n++) {
    const a = n * Math.PI * 2 / 9;
    body.ellipsoid([Math.sin(a) * width * .78, Math.cos(a) * torsoHeight * .73, .02], [.2, .2, depth * .95], id === 'ram' ? [.88, .83, .69] : CREAM, 6, 4);
  }
  if (id === 'tiger' || id === 'zebra') for (const side of [-1, 1]) for (let n = 0; n < 3; n++) {
    body.beam([side * width * .83, -.22 + n * .2, -.12], [side * width * .83, -.18 + n * .2, .19], .035, CHARCOAL);
    body.beam([side * width * .7, -.22 + n * .2, depth * .76], [side * width * .35, -.15 + n * .2, depth * .97], .035, CHARCOAL);
  }
  if (id === 'giraffe' || id === 'cow') for (let n = 0; n < 5; n++) {
    const side = n % 2 ? -1 : 1;
    body.ellipsoid([side * width * .6, -.23 + n * .11, depth * .85], [.09 + (n % 2) * .035, .1, .035], id === 'giraffe' ? [.49, .27, .08] : CREAM, 6, 3);
    body.ellipsoid([side * width * .52, -.22 + n * .11, -depth * .85], [.11, .1, .035], id === 'giraffe' ? [.49, .27, .08] : CREAM, 6, 3);
  }
  if (id === 'crocodile') {
    for (let n = 0; n < 4; n++) body.beam([-width * .53, -.26 + n * .16, depth * .93], [width * .53, -.26 + n * .16, depth * .93], .025, [.43, .6, .2]);
    for (let n = 0; n < 5; n++) body.triangle([-.11, -.35 + n * .17, -depth * .8], [0, -.28 + n * .17, -depth - .2], [.11, -.24 + n * .17, -depth * .8], [.1, .4, .12]);
  }
  if (id === 'horse' || id === 'donkey' || id === 'zebra') body.ellipsoid([0, torsoHeight * .66, -.14], [.08, .26, .2], CHARCOAL, 6, 4);
  // A narrow racing belt and back marker keep the selected color visible.
  body.ellipsoid([0, -torsoHeight * .45, 0], [width * 1.015, .07, depth * 1.015], color, 9, 3);
  body.box([0, torsoHeight * .1, -depth * 1.01], [.18, .25, .025], color);
  appendOriented(g, body, mid, subtract(chest, hip));
  animalTail(g, id, hip);
  const headAt: Vec3 = [chest[0], chest[1] + (id === 'fish' ? .39 : id === 'flamingo' ? .57 : .56), chest[2] + (twerk ? .12 : 0)];
  if (head) characterHead(g, id, headAt, color);
  const hoof = ['cow', 'sheep', 'ram', 'goat', 'antelope', 'giraffe', 'horse', 'zebra', 'donkey', 'pig', 'buffalo'].includes(id);
  for (const side of [-1, 1]) {
    const shoulder: Vec3 = [chest[0] + side * width * .85, chest[1] - .03, chest[2]];
    const hand: Vec3 = seated ? [side * (bike ? .48 : .4), bike ? 1.48 : 1.23, bike ? .59 : .57]
      : twerk ? [side * .52, height * .47 + .3 + bounce, .36]
      : dance ? [side * (reach + .16 * Math.cos(phase)), chest[1] + .15 + .48 * Math.sin(phase + side * 1.3), .12 + side * sway * .2]
      : [side * reach, hip[1] + (id === 'gorilla' || id === 'orangutan' ? -.07 : .17), .12];
    const elbow: Vec3 = [(shoulder[0] + hand[0]) / 2 + side * .06, (shoulder[1] + hand[1]) / 2 - .07, (shoulder[2] + hand[2]) / 2 - .03];
    if (id === 'fish' || id === 'flamingo') {
      // Actual fin/wing volumes follow the same shoulder and hand joints.
      const base: Vec3 = [shoulder[0], shoulder[1] - .12, shoulder[2]];
      const low: Vec3 = [hand[0], hand[1] - .19, hand[2] - .12];
      g.triangle(base, hand, low, id === 'fish' ? [1, .36, .25] : fur);
      g.triangle([base[0], base[1], base[2] - .08], low, hand, id === 'fish' ? fur : [.94, .35, .53]);
      g.triangle(base, low, [base[0], base[1], base[2] - .08], fur);
      for (let n = 0; n < 3; n++) animalSegment(g, base, [hand[0] - side * n * .065, hand[1] - n * .065, hand[2] - .07], .025, id === 'fish' ? [1, .64, .34] : [.95, .4, .57]);
    } else {
      const limb = id === 'panda' || id === 'sheep' ? CHARCOAL : fur;
      animalSegment(g, shoulder, elbow, arm, limb); animalSegment(g, elbow, hand, arm * .88, limb);
      if (hoof) {
        g.box(hand, [arm * 2.3, .2, arm * 2.3], CHARCOAL);
        g.box([hand[0], hand[1] - .04, hand[2] + arm * 1.18], [.018, .13, .018], CREAM);
      } else {
        g.ellipsoid(hand, [arm * 1.22, arm * 1.12, arm * 1.22], id === 'gorilla' ? [.26, .28, .32] : limb, 7, 4);
        if (['tiger', 'lion', 'bear', 'crocodile'].includes(id)) for (let n = -1; n <= 1; n++) g.beam([hand[0] + n * .065, hand[1] - .04, hand[2] + arm], [hand[0] + n * .065, hand[1] - .075, hand[2] + arm + .07], .022, CREAM);
      }
      g.ellipsoid([hand[0], hand[1] + .035, hand[2]], [arm * 1.08, .035, arm * 1.08], color, 7, 3);
    }
    // The kart chassis fully occludes knees/feet. Keep those vertices in the
    // complete standing, motorcycle and animation rigs, not every race view.
    if (id === 'fish' || (seated && !bike)) continue;
    const spread = width * .6 + (id === 'flamingo' ? -.07 : .02);
    const foot: Vec3 = seated ? [side * (bike ? .44 : .33), bike ? .73 : .69, bike ? .09 : .47]
      : [side * (spread + (twerk ? .2 : dance ? .1 * Math.sin(phase + side) : 0)), .14, dance ? side * .2 * Math.cos(phase) : .08];
    const knee: Vec3 = [side * (spread + (twerk ? .16 : 0)), seated ? .9 : hip[1] * .52, twerk ? .28 : seated ? .3 : -.045];
    const legColor: Color = id === 'panda' || id === 'sheep' || id === 'ram' ? CHARCOAL : id === 'flamingo' ? [.91, .38, .48] : fur;
    animalSegment(g, [hip[0] + side * width * .49, hip[1], hip[2]], knee, leg, legColor);
    animalSegment(g, knee, foot, leg * .87, legColor);
    if (id === 'flamingo') {
      for (let toe = -1; toe <= 1; toe++) g.beam(foot, [foot[0] + toe * .09, .04, foot[2] + .26], .032, legColor);
    } else if (hoof) {
      g.box([foot[0], foot[1] -.015, foot[2] + .07], [leg * 2.35, .2, leg * 2.4 + .1], CHARCOAL);
      g.box([foot[0], foot[1] -.02, foot[2] + leg * 1.2 + .125], [.02, .15, .016], CREAM);
    } else {
      const rabbit = id === 'rabbit';
      g.ellipsoid([foot[0], foot[1], foot[2] + (rabbit ? .18 : .07)], [leg * 1.45, .14, rabbit ? .38 : leg * 1.6], legColor, 7, 4);
      if (id === 'elephant' || id === 'bear' || id === 'tiger' || id === 'lion' || id === 'crocodile') for (let n = -1; n <= 1; n++) g.ellipsoid([foot[0] + n * leg * .7, foot[1] -.035, foot[2] + leg * 1.6], [.035, .045, .06], CREAM, 5, 3);
    }
    if (id === 'tiger' || id === 'zebra') for (let n = 0; n < 2; n++) g.ellipsoid([knee[0], knee[1] - n * .14, knee[2]], [leg * 1.05, .027, leg * 1.05], CHARCOAL, 7, 3);
    if (id === 'giraffe') g.ellipsoid([knee[0], knee[1], knee[2] + leg * .87], [.06, .1, .022], [.49, .27, .08], 6, 3);
  }
  return g;
}

/** A shared, original character model keeps each racer's identity in every pose. */
function characterHead(g: Geometry, character: string, center: Vec3, accent: Color, includeScarf = true) {
  const fur = CHARACTER_COLORS[character];
  // Long-necked animals keep their defining silhouette in the kart and every
  // animation, not just in the selection artwork.
  const neck = includeScarf ? character === 'giraffe' ? .3 : character === 'flamingo' ? .2 : 0 : 0;
  if (neck) g.ellipsoid([center[0], center[1] - .4 + neck / 2, center[2]], [.17, .28 + neck / 2, .17], fur, 8, 5);
  const [x, y, z] = [center[0], center[1] + neck, center[2]];
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
  } else if (!['fox', 'cat', 'bird', 'bear'].includes(character)) {
    // Animal silhouettes match the supplied roster in all seated/dancing poses.
    const pink: Color = [1, 0.58, 0.65];
    const longFace = ['horse', 'donkey', 'zebra', 'goat', 'giraffe', 'antelope'].includes(character);
    if (character === 'lion') for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      g.sphere(p(Math.cos(angle) * .43, Math.sin(angle) * .43, -.09), .25, [0.77, .4, .08], 7, 4);
    }
    const headWidth = character === 'hippo' || character === 'gorilla' ? .58 : character === 'flamingo' ? .37 : .47;
    g.ellipsoid(p(0, 0, 0), [headWidth, longFace ? .53 : .44, .43], fur, 11, 7);
    if (['sheep', 'ram'].includes(character)) for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      g.sphere(p(Math.cos(angle) * .39, .16 + Math.sin(angle) * .33, -.05), .19, CREAM, 6, 3);
    }
    for (const side of [-1, 1]) {
      if (character === 'elephant') {
        g.ellipsoid(p(side * .57, .02, -.04), [.35, .48, .13], fur, 9, 6);
        g.ellipsoid(p(side * .59, .02, .075), [.25, .35, .035], pink, 8, 5);
      } else if (['rabbit', 'donkey', 'horse', 'zebra'].includes(character)) {
        const ear = character === 'rabbit' ? .52 : character === 'donkey' ? .38 : .24;
        g.ellipsoid(p(side * .25, .37 + ear * .7, -.035), [.13, ear, .12], fur, 8, 5);
        g.ellipsoid(p(side * .25, .4 + ear * .7, .07), [.065, ear * .65, .025], pink, 7, 4);
      } else if (['goat', 'sheep', 'antelope', 'giraffe', 'cow'].includes(character)) {
        g.ellipsoid(p(side * .53, .15, -.035), [.3, .12, .15], fur, 8, 5);
        g.ellipsoid(p(side * .55, .17, .085), [.21, .07, .035], pink, 7, 4);
      } else if (!['fish', 'flamingo', 'crocodile'].includes(character)) {
        const ears = ['panda', 'cow'].includes(character) ? CHARCOAL : fur;
        g.sphere(p(side * .42, .3, -.035), ['monkey', 'orangutan'].includes(character) ? .24 : .19, ears, 8, 5);
      }
      if (['buffalo', 'antelope', 'cow', 'goat', 'giraffe'].includes(character)) {
        const width = character === 'buffalo' ? .78 : character === 'antelope' ? .57 : .36;
        const tip = character === 'cow' ? .61 : character === 'giraffe' ? .73 : .88;
        g.beam(p(side * .28, .31, -.13), p(side * width, .5, -.12), .075, CREAM);
        g.beam(p(side * width, .5, -.12), p(side * (width + .03), tip, -.16), .055, CREAM);
        if (character === 'giraffe') g.sphere(p(side * .39, tip, -.16), .09, [0.44, .23, .12], 7, 4);
      }
      if (character === 'ram') {
        for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; g.sphere(p(side * (.49 + Math.cos(angle) * .17), .12 + Math.sin(angle) * .22, .02), .11, [0.57, .38, .2], 6, 3); }
      }
      if (character === 'panda') g.ellipsoid(p(side * .19, .08, .38), [.2, .22, .055], CHARCOAL, 8, 5);
    }
    if (['monkey', 'orangutan', 'gorilla'].includes(character)) {
      const face: Color = character === 'gorilla' ? [.49, .51, .54] : [1, .81, .6];
      g.ellipsoid(p(0, -.07, .34), [.37, .33, .17], face, 10, 6);
      for (const side of [-1, 1]) g.ellipsoid(p(side * .19, .12, .345), [.22, .24, .13], face, 8, 5);
      // Original reference-inspired brow, crest and cheerful cheek shapes.
      g.beam(p(-.24, .3, .35), p(.24, .3, .35), .05, fur);
      for (let tuft = -1; tuft <= 1; tuft++) g.ellipsoid(p(tuft * .12, .43 + (tuft === 0 ? .07 : 0), -.1), [.12, .17, .13], fur, 6, 4);
    }
    if (character === 'sheep') g.ellipsoid(p(0, -.08, .29), [.34, .39, .19], [.29, .27, .25], 10, 6);
    if (character === 'cow') for (const side of [-1, 1]) g.ellipsoid(p(side * .25, .25, .22), [.16, .2, .13], CREAM, 7, 4);
    if (['tiger', 'zebra', 'giraffe'].includes(character)) for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      if (character === 'giraffe') g.sphere(p(side * .39, -.2 + i * .2, -.16), .105, [0.54, .3, .1], 6, 4);
      else {
        g.beam(p(side * .34, -.22 + i * .21, -.28), p(side * .43, -.13 + i * .21, .12), .045, CHARCOAL);
        g.beam(p(side * .4, -.14 + i * .19, .21), p(side * .3, -.08 + i * .19, .34), .035, CHARCOAL);
      }
    }
    if (['horse', 'zebra', 'donkey'].includes(character)) for (let i = 0; i < 5; i++) g.sphere(p(0, .45 - i * .15, -.35), .15, CHARCOAL, 7, 4);
    if (character === 'giraffe') for (const side of [-1, 1]) {
      g.ellipsoid(p(side * .28, .32, .23), [.1, .105, .055], [.54, .3, .1], 6, 4);
      g.ellipsoid(p(side * .34, -.22, .29), [.08, .12, .04], [.54, .3, .1], 6, 4);
    }
    if (character === 'elephant') {
      g.beam(p(0, -.1, .38), p(0, -.62, .55), .14, fur);
      g.beam(p(0, -.62, .55), p(0, -.66, .8), .12, fur);
      for (const side of [-1, 1]) g.beam(p(side * .22, -.25, .37), p(side * .24, -.48, .63), .065, CREAM);
    } else if (character === 'flamingo') {
      g.ellipsoid(p(0, -.12, .53), [.23, .17, .34], [1, .8, .16], 9, 5);
      g.ellipsoid(p(0, -.18, .78), [.16, .12, .12], CHARCOAL, 8, 4);
    } else if (character === 'fish') {
      g.ellipsoid(p(0, -.15, .41), [.18, .14, .12], pink, 8, 5);
      g.ellipsoid(p(0, -.15, .505), [.1, .075, .03], CHARCOAL, 7, 4);
      g.triangle(p(0, .3, -.25), p(0, .87, -.22), p(0, .12, .2), fur);
      for (const side of [-1, 1]) g.triangle(p(side * .35, 0, 0), p(side * .78, -.23, -.23), p(side * .32, -.27, .19), pink);
    } else {
      const snout = character === 'crocodile' ? [.4, .18, .48] : character === 'hippo' ? [.5, .28, .33] : longFace ? [.27, .3, .27] : [.28, .19, .18];
      const muzzle: Color = ['pig', 'cow', 'buffalo'].includes(character) ? pink : character === 'crocodile' || character === 'hippo' ? fur : character === 'gorilla' ? [.49, .51, .54] : character === 'sheep' ? [.32, .3, .28] : CREAM;
      g.ellipsoid(p(0, -.17, character === 'crocodile' ? .52 : .37), snout as Vec3, muzzle, 10, 5);
      if (character === 'pig') for (const side of [-1, 1]) g.sphere(p(side * .09, -.15, .56), .05, [0.65, .28, .36], 6, 4);
      else g.ellipsoid(p(0, -.1, longFace ? .63 : .55), [.09, .06, .04], CHARCOAL, 7, 4);
      if (character === 'crocodile') for (let i = 0; i < 5; i++) g.sphere(p((i - 2) * .13, -.25, .88), .05, CREAM, 5, 3);
      if (['tiger', 'lion', 'monkey', 'orangutan', 'gorilla', 'rabbit'].includes(character)) {
        g.ellipsoid(p(0, -.26, .5), [.17, .075, .035], CHARCOAL, 8, 4);
        g.ellipsoid(p(0, -.24, .53), [.12, .025, .014], CREAM, 7, 3);
      }
      if (character === 'hippo') for (const side of [-1, 1]) {
        g.sphere(p(side * .19, -.06, .65), .052, [.27, .33, .25], 6, 4);
        g.box(p(side * .2, -.35, .58), [.11, .16, .09], CREAM);
      }
      if (character === 'goat') g.cylinder(p(0, -.69, .27), .035, .26, CREAM, 7, .13);
    }
    eyes(.19, .12, ['monkey', 'orangutan', 'gorilla'].includes(character) ? .51 : character === 'sheep' ? .46 : .4);
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
  if (includeScarf) {
    g.box(p(0, -0.45, -0.01), [0.66, 0.12, 0.56], accent);
    g.box(p(0.24, -0.64, -0.28), [0.19, 0.42, 0.06], CREAM, -0.18);
  }
}

function characterTail(g: Geometry, character: string, hip: Vec3) {
  const [x, y, z] = hip, fur = CHARACTER_COLORS[character];
  if (character === 'fox') {
    g.beam([x, y, z - 0.2], [x + 0.38, y + 0.32, z - 0.83], 0.2, fur);
    g.beam([x + 0.38, y + 0.32, z - 0.83], [x + 0.47, y + 0.64, z - 1.03], 0.18, CREAM);
  } else if (['cat', 'monkey', 'orangutan', 'tiger', 'lion', 'giraffe', 'horse', 'zebra', 'donkey'].includes(character)) {
    g.beam([x, y, z - 0.25], [x - 0.46, y + 0.25, z - 0.72], 0.09, fur);
    g.beam([x - 0.46, y + 0.25, z - 0.72], [x - 0.57, y + 0.74, z - 0.63], 0.09, fur);
  } else if (character === 'crocodile') {
    g.beam([x, y, z - .2], [x + .3, y + .2, z - 1.1], .18, fur);
  } else if (character === 'bird' || character === 'flamingo') {
    for (const side of [-1, 0, 1]) g.beam([x, y, z - 0.15], [x + side * 0.25, y + 0.3, z - 0.72], 0.1, side ? CORAL : fur);
  } else if (character === 'robot') {
    g.box([x, y + 0.25, z - 0.34], [0.54, 0.6, 0.22], SILVER);
    g.box([x, y + 0.26, z - 0.465], [0.25, 0.28, 0.03], TEAL);
  }
}

function seatedDriver(g: Geometry, color: Color, character: string, motorcycle: boolean) {
  if (isFigure(character)) { figureSeated(g, color, character, motorcycle); return; }
  if (isAnimal(character)) { g.data.push(...animalGeometry(color, character, motorcycle ? 'motorcycle' : 'seated').data); return; }
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

const GARAGE_DRIVER_HEIGHT: Readonly<Record<string, number>> = {
  'bmw-m2': 1.55, 'bmw-m3': 1.58, 'bmw-m4': 1.52,
  'amg-gt': 1.47, 'amg-g63': 2.10,
  lamborghini: 1.37, mclaren: 1.36, ferrari: 1.36, bugatti: 1.45,
  ducati: 1.51, 'bmw-bike': 1.51, cybertruck: 1.93, 'tesla-roadster': 1.42,
};
const GARAGE_DRIVER_LONGITUDINAL: Readonly<Record<string, number>> = {
  'amg-gt': -.52, ducati: -.47, 'bmw-bike': -.47, 'tesla-roadster': -.15,
};

export function racerGeometry(color: Color, character = 'fox', vehicle = 'kart', driver = true): Geometry {
  const g = new Geometry();
  if (buildGermanRide(g, color, vehicle) || buildExoticGarageRide(g, color, vehicle) || buildBikeEv(g, color, vehicle)) {
    if (driver) addCharacterHead(g,color,character,[0,GARAGE_DRIVER_HEIGHT[vehicle],GARAGE_DRIVER_LONGITUDINAL[vehicle] ?? -.26]);
    return g;
  }
  vehicleGeometry(g, color, vehicle);
  if (driver) seatedDriver(g, color, characterId(character), vehicle === 'motorcycle');
  return g;
}

function addCharacterHead(g: Geometry, color: Color, character: string, center: Vec3) {
  const id = characterId(character);
  if (isFigure(id)) figureHead(g, id, center);
  else characterHead(g, id, center, color, false);
}

export function characterHeadGeometry(color: Color, character = 'fox'): Geometry {
  const g = new Geometry();
  addCharacterHead(g, color, character, [0, 1, 0]);
  return g;
}

/** Selection art is rendered from these real meshes. Heads, outfits, tails and
 * held props are shared with the race and both item animations. No image plane
 * or reference-sheet crop is part of a character model. */
export function characterShowroomGeometry(color: Color, character = 'fox'): Geometry {
  if (isAnimal(character)) return animalGeometry(color, character, 'showroom');
  const g = new Geometry(), id = characterId(character);
  if (isFigure(id)) return figureShowroomGeometry(color, id);
  const figure = isFigure(id), chest: Vec3 = [0, 1.38, 0];
  if (figure) {
    figureTorso(g, id, chest, color);
    figureHead(g, id, [0, 2.1, 0]);
  } else {
    characterTail(g, id, [0, .95, 0]);
    g.ellipsoid(chest, [.38, .45, .31], color, 10, 6);
    g.box([0, 1.4, .3], [.14, .31, .05], CREAM);
    characterHead(g, id, [0, 2.06, 0], color);
  }
  for (const side of [-1, 1]) {
    const foot: Vec3 = [side * .27, .15, .03];
    const knee: Vec3 = [side * .24, .58, -.02];
    g.beam([side * .2, 1.08, 0], knee, .14, CHARCOAL);
    g.beam(knee, foot, .13, CHARCOAL);
    if (figure) figureBoot(g, id, foot);
    else {
      g.box([foot[0], .15, .12], [.31, .25, .5], CHARCOAL);
      g.box([foot[0], .1, .37], [.3, .08, .04], CREAM);
      g.box([foot[0], .24, .18], [.18, .035, .22], color);
    }
    const special = figure && side === 1;
    const hand: Vec3 = [side * (special ? .67 : .59), special ? 1.52 : 1.02, .17];
    const elbow: Vec3 = [side * .53, 1.24, -.01];
    const sleeve = figure ? id === 'bezos' ? [1, .97, .91] as Color : FIGURE_OUTFIT[id] : color;
    g.beam([side * .3, 1.57, 0], elbow, id === 'ye' ? .19 : .12, sleeve);
    g.beam(elbow, hand, id === 'ye' ? .18 : .11, id === 'bezos' ? FIGURE_SKIN[id] : sleeve);
    if (figure) { figureHand(g, id, hand, special); if (special) figureProp(g, id, hand); }
    else {
      g.ellipsoid(hand, [.15, .16, .14], CREAM, 7, 4);
      g.box([hand[0], hand[1] + .1, hand[2]], [.23, .1, .2], color);
    }
  }
  return g;
}

/** Eight poses are uploaded once. All clients use the same host dance timer. */
export function dancerGeometry(color: Color, phase: number, character = 'fox'): Geometry {
  if (isAnimal(character)) return animalGeometry(color, character, 'dance', phase);
  if (isFigure(character)) return figurePose(color, phase, character, false);
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

/** A separate cartoon squat/hip-wiggle, with the same chosen outfit and identity. */
export function twerkGeometry(color: Color, phase: number, character = 'fox'): Geometry {
  if (isAnimal(character)) return animalGeometry(color, character, 'twerk', phase);
  if (isFigure(character)) return figurePose(color, phase, character, true);
  const g = new Geometry(), id = characterId(character);
  const wiggle = Math.sin(phase), dip = Math.cos(phase) * 0.12;
  const hip: Vec3 = [wiggle * 0.25, 1.01 + dip, -0.24 - Math.cos(phase * 2) * 0.13];
  const chest: Vec3 = [-wiggle * 0.08, 1.54 + dip * 0.6, 0.43];
  characterTail(g, id, hip);
  g.beam(hip, chest, 0.27, color);
  g.box([chest[0], chest[1], chest[2] + 0.27], [0.14, 0.34, 0.04], CREAM);
  characterHead(g, id, [chest[0], 2.02 + dip * 0.6, 0.62], color);
  for (const side of [-1, 1]) {
    const knee: Vec3 = [side * 0.54, 0.57 + dip * 0.4, 0.3];
    const foot: Vec3 = [side * 0.52, 0.15, 0];
    g.beam([hip[0] + side * 0.17, hip[1], hip[2]], knee, 0.15, CHARCOAL);
    g.beam(knee, foot, 0.13, CHARCOAL);
    g.box([foot[0], 0.14, foot[2] + 0.1], [0.34, 0.25, 0.54], CHARCOAL);
    const elbow: Vec3 = [side * 0.65, 1.2 + dip * 0.4, 0.58];
    const hand: Vec3 = [knee[0], knee[1] + 0.19, knee[2] + 0.16];
    g.beam([chest[0] + side * 0.22, chest[1], chest[2]], elbow, 0.12, color);
    g.beam(elbow, hand, 0.11, color);
    g.sphere(hand, 0.14, CREAM, 7, 4);
  }
  return g;
}

/** One small prebuilt lightning ribbon, never generated/uploaded during a frame. */
export function lightningGeometry(): Geometry {
  const g = new Geometry();
  const points: Vec3[] = [[0, 7.5, 0], [-0.45, 5.6, 0.05], [0.4, 4.4, -0.1], [-0.32, 2.8, 0.04], [0.2, 1.8, 0], [0, 0.35, 0]];
  for (let index = 1; index < points.length; index++) {
    g.beam(points[index - 1], points[index], 0.07, [0.45, 0.82, 1]);
    g.beam(points[index - 1], points[index], 0.025, [0.95, 1, 1]);
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
  private lightning: Mesh;
  private karts: Mesh[];
  private emptyKarts: Mesh[];
  private dancers: Mesh[][];
  private twerkers: Mesh[][];
  private figureAuras: (Mesh | null)[];
  private figures: (string | null)[];
  private cameras: Camera[];
  private fallingCameras: boolean[];
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
    const isRainbow = ACTIVE_TRACK.id === 'rainbow';
    const isSpace = ACTIVE_TRACK.id === 'space', isSeattle = ACTIVE_TRACK.id === 'seattle', isFoundry = ACTIVE_TRACK.id === 'foundry';
    const fragment = this.shader(gl.FRAGMENT_SHADER, `
      precision mediump float; uniform float u_opacity; varying vec3 v_color; varying float v_distance; varying float v_height;
      void main() { float fog = ${isSpace || isRainbow ? '0.0' : 'smoothstep(145.0, 610.0, v_distance)'}; vec3 haze = ${isFoundry ? 'vec3(0.37, 0.30, 0.33)' : isSeattle ? 'vec3(0.61, 0.73, 0.75)' : 'mix(vec3(0.94, 0.76, 0.62), vec3(0.56, 0.78, 0.87), clamp(v_height / 140.0, 0.0, 1.0))'}; gl_FragColor = vec4(mix(v_color, haze, fog), u_opacity); }
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
        vec3 sky = ${isRainbow ? 'mix(vec3(0.075, 0.025, 0.17), vec3(0.013, 0.025, 0.085), pow(horizon, 0.6))' : isSpace ? 'vec3(0.018, 0.024, 0.065)' : isFoundry ? 'mix(vec3(0.37, 0.30, 0.33), vec3(0.10, 0.17, 0.28), pow(horizon, 0.6))' : isSeattle ? 'mix(vec3(0.61, 0.73, 0.75), vec3(0.32, 0.56, 0.68), pow(horizon, 0.6))' : 'mix(vec3(0.94, 0.76, 0.62), vec3(0.29, 0.64, 0.83), pow(horizon, 0.6))'};
        float sun = dot(ray, normalize(vec3(-0.6, 0.32, 0.65)));
        ${isRainbow || isSpace || isSeattle || isFoundry ? '' : 'sky += vec3(0.14, 0.09, 0.03) * pow(max(0.0, sun), 25.0); sky = mix(sky, vec3(1.0, 0.95, 0.72), smoothstep(0.9974, 0.9982, sun));'}
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
    this.lightning = this.upload(lightningGeometry());
    this.karts = players.map((player) => this.upload(racerGeometry(parseColor(player.color), player.character, player.vehicle)));
    this.emptyKarts = players.map((player) => this.upload(racerGeometry(parseColor(player.color), player.character, player.vehicle, false)));
    this.dancers = players.map((player) => Array.from({ length: 8 }, (_, frame) => this.upload(dancerGeometry(parseColor(player.color), frame * Math.PI / 4, player.character))));
    this.twerkers = players.map((player) => Array.from({ length: 8 }, (_, frame) => this.upload(twerkGeometry(parseColor(player.color), frame * Math.PI / 4, player.character))));
    this.figures = players.map(player => isFigure(player.character ?? '') ? player.character! : null);
    this.figureAuras = this.figures.map(id => id ? this.upload(figureAuraGeometry(id)) : null);
    this.columns = players.length <= 1 ? 1 : players.length <= 4 ? 2 : players.length <= 6 ? 3 : 4;
    this.rows = Math.ceil(players.length / this.columns);
    this.cameras = race.karts.map(kartCameraTargets);
    this.fallingCameras = race.karts.map(kart => Boolean(kart.fall));
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
      const position = kartWorldPose(kart).position;
      const { eye: behind, target } = kartCameraTargets(kart);
      // A respawn is a teleport, not a camera flight back through the void.
      if (!kart.fall && this.fallingCameras[i]) { camera.eye = [...behind]; camera.target = [...target]; }
      this.fallingCameras[i] = Boolean(kart.fall);
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
        const point = trackPose(box.distance, box.lane, 1.65 + Math.sin(race.elapsed * 3 + box.id) * 0.2).position;
        if (box.cooldown > 0) {
          // The box disappears on the authoritative pickup frame. A short
          // outward sparkle makes that disappearance unmistakable in every view.
          const age = ITEM_RESPAWN_SECONDS - box.cooldown;
          if (age >= 0 && age < ITEM_BURST_SECONDS) {
            const life = age / ITEM_BURST_SECONDS;
            for (let particle = 0; particle < 6; particle++) {
              const angle = particle * Math.PI / 3 + box.id, radius = 0.7 + life * 2.4;
              this.draw(this.spark, model([point[0] + Math.cos(angle) * radius, point[1] + life * 1.5, point[2] + Math.sin(angle) * radius], angle, (1 - life) * 0.9));
            }
          }
          continue;
        }
        // A held item keeps its slot. Ghosted boxes communicate that they are
        // available to other racers, but cannot replace this driver's item.
        this.draw(this.item, model(point, race.elapsed * 1.6 + box.id), kart.power.item || kart.power.jet > 0 || kart.power.dance > 0 || kart.finishTime !== null ? 0.25 : 1);
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
        const pose = kartWorldPose(other, 0.04);
        const yaw = pose.yaw + (other.fall ? other.fall.elapsed * 0.7 : other.heading);
        const transform = model(pose.position, yaw);
        if (!other.fall) this.draw(this.shadow, model([pose.position[0], pose.position[1] + 0.055, pose.position[2]], yaw));
        const dancing = other.power.dance > 0;
        let figurePosition = pose.position, figureYaw = yaw;
        this.draw(dancing ? this.emptyKarts[j] : this.karts[j], transform);
        if (other.fall) continue;
        if (dancing) {
          const age = DANCE_SECONDS - other.power.dance;
          // Step out and return during the first and last third of a second.
          const exit = Math.max(0, Math.min(1, age / 0.35, other.power.dance / 0.35));
          const offset = 2.2 * exit;
          const dancerPosition: Vec3 = [pose.position[0] + Math.cos(yaw) * offset, pose.position[1], pose.position[2] - Math.sin(yaw) * offset];
          figurePosition = dancerPosition; figureYaw = yaw + Math.sin(age * 3) * .15;
          const frame = Math.floor(age * 12) % 8;
          const twerking = other.power.danceStyle === 'twerk';
          this.draw((twerking ? this.twerkers : this.dancers)[j][frame], model(dancerPosition, yaw + Math.sin(age * 3) * (twerking ? 0.1 : 0.25)));
          for (let particle = 0; particle < 6; particle++) {
            const angle = particle * Math.PI / 3 + age * 4;
            this.draw(this.spark, model([dancerPosition[0] + Math.cos(angle) * 1.2, dancerPosition[1] + 0.8 + (particle % 3) * 0.6 + Math.sin(age * 8 + particle) * 0.2, dancerPosition[2] + Math.sin(angle) * 1.2], angle, 0.35));
          }
        }
        const aura = this.figureAuras[j], figure = this.figures[j];
        if (aura) {
          const orbit = figure === 'trump' || figure === 'huang';
          const pulse = figure === 'ye' ? 1 + Math.sin(race.elapsed * 4) * .065 : 1;
          const lift = figure === 'musk' ? Math.sin(race.elapsed * 3) * .055 : 0;
          this.draw(aura, model([figurePosition[0], figurePosition[1] + lift, figurePosition[2]], figureYaw + (orbit ? race.elapsed * .65 : 0), pulse));
        }
        if (other.power.lightning > 0) {
          const age = LIGHTNING_SECONDS - other.power.lightning;
          // A single sky-to-kart strike fades into two low arcs. Avoid full-screen
          // flashing or strobing, especially across ten simultaneous viewports.
          const fade = Math.min(1, other.power.lightning / 0.45);
          if (age < 0.65) this.draw(this.lightning, model(pose.position, yaw), Math.max(0.05, 1 - age / 0.65) * fade);
          for (const side of [-1, 1]) {
            const point: Vec3 = [pose.position[0] + Math.cos(yaw) * side * 0.85, pose.position[1] + 0.15, pose.position[2] - Math.sin(yaw) * side * 0.85];
            this.draw(this.lightning, model(point, yaw + Math.sin(age * 3 + side) * 0.2, 0.22), 0.7 * fade);
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
        if (other.power.notice?.kind === 'activate') {
          const age = ITEM_NOTICE_SECONDS - other.power.notice.remaining;
          if (age < ITEM_BURST_SECONDS) {
            const life = age / ITEM_BURST_SECONDS;
            for (let particle = 0; particle < 6; particle++) {
              const angle = particle * Math.PI / 3 + race.elapsed * 3;
              this.draw(this.spark, model([pose.position[0] + Math.cos(angle) * (1.3 + life * 2), pose.position[1] + 1 + life, pose.position[2] + Math.sin(angle) * (1.3 + life * 2)], angle, (1 - life) * 0.85));
            }
          }
        }
        if (other.bump > 0 || other.power.flash > 0) {
          for (let particle = 0; particle < 5; particle++) {
            const angle = particle * 2.4 + race.elapsed * 5, radius = 1.2 + Math.max(0, 0.7 - Math.max(other.bump, other.power.flash)) * 2;
            this.draw(this.spark, model([pose.position[0] + Math.cos(angle) * radius, pose.position[1] + 0.55 + Math.abs(Math.sin(angle)) * 0.7, pose.position[2] + Math.sin(angle) * radius], angle, 0.65));
          }
        }
      }
      // Transparent shells are the final world pass, after all opaque karts.
      for (const other of race.karts) {
        if (other.fall || (other.power.shield <= 0 && !(other.respawnGrace > 0))) continue;
        const pose = racePose(other.distance, other.lane, 0.04, other.onShortcut);
        this.draw(this.shield, model(pose.position, pose.yaw), 0.16 + Math.sin(race.elapsed * 3) * 0.025);
      }
    }
  }
  dispose() {
    const gl = this.gl;
    for (const mesh of [this.world, this.boost, this.shadow, this.dust, this.spark, this.item, this.slick, this.bolt, this.shield, this.crown, this.prism, this.lightning, ...this.karts, ...this.emptyKarts, ...this.dancers.flat(), ...this.twerkers.flat(), ...this.figureAuras.filter((mesh): mesh is Mesh => mesh !== null)]) gl.deleteBuffer(mesh.buffer);
    gl.deleteBuffer(this.skyBuffer); gl.deleteProgram(this.skyProgram);
    gl.deleteProgram(this.program);
  }
}

/** On-demand garage preview: one canvas and one static mesh. */
export function createGaragePreview(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, 'attribute vec3 a_position; attribute vec3 a_color; uniform mat4 u_matrix; varying vec3 v_color; void main(){gl_Position=u_matrix*vec4(a_position,1.0);v_color=a_color;}');
  const fragment = compile(gl.FRAGMENT_SHADER, 'precision mediump float; varying vec3 v_color; void main(){gl_FragColor=vec4(v_color,1.0);}');
  const program = gl.createProgram(), buffer = gl.createBuffer();
  if (program && vertex && fragment) { gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); }
  if (vertex) gl.deleteShader(vertex);
  if (fragment) gl.deleteShader(fragment);
  if (!program || !buffer || !vertex || !fragment || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (program) gl.deleteProgram(program);
    if (buffer) gl.deleteBuffer(buffer);
    return null;
  }
  const position = gl.getAttribLocation(program, 'a_position'), color = gl.getAttribLocation(program, 'a_color');
  const matrix = gl.getUniformLocation(program, 'u_matrix');
  gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(position); gl.enableVertexAttribArray(color);
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(color, 3, gl.FLOAT, false, 24, 12);
  gl.enable(gl.DEPTH_TEST);
  let count = 0, radius = 2.1, center: Vec3 = [0, .65, 0];
  return {
    setRide(id: string, paint: string) {
      const data = racerGeometry(parseColor(paint), 'fox', id, false).data;
      let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      radius = 1;
      for (let i = 0; i < data.length; i += 6) {
        minY = Math.min(minY, data[i + 1]); maxY = Math.max(maxY, data[i + 1]);
        minZ = Math.min(minZ, data[i + 2]); maxZ = Math.max(maxZ, data[i + 2]);
        radius = Math.max(radius, Math.hypot(data[i], data[i + 2]));
      }
      center = [0, (minY + maxY) / 2, (minZ + maxZ) / 2];
      count = data.length / 6;
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    },
    draw(angle: number) {
      const dpr = Math.min(1.75, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const aspect = width / height, distance = Math.max(3.1, radius * (1.9 + Math.max(0, 1 - aspect) * .8));
      const eye: Vec3 = [Math.sin(angle) * distance, center[1] + distance * .43, center[2] + Math.cos(angle) * distance];
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(matrix, false, viewProjection({ eye, target: center }, aspect, false));
      gl.drawArrays(gl.TRIANGLES, 0, count);
    },
    dispose() { gl.deleteBuffer(buffer); gl.deleteProgram(program); },
  };
}
