import { course, crossedForward, heading, locate, ROAD_WIDTH, roadTriangles } from './course';

export type DriveInput = { steer: number; throttle: boolean; brake: boolean; drift: boolean; reset: boolean };
export type CarState = {
  x: number; y: number; z: number; yaw: number; facing: number; pitch: number; steer: number;
  /** Metres per second, not the display's miles per hour. */
  speed: number;
  lap: number; seconds: number; best: number | null; boost: boolean;
  finished: boolean; finishTime: number | null;
  /** Continuous course-segment units: negative on the grid, 180 per completed lap. */
  progress: number;
};
export type Driver = { state: CarState };
export type DrivingWorldOptions = {
  /** Tests may bypass WASM. Return null when no road is hit; course height is the fallback. */
  sampleHeight?: (x: number, z: number) => number | null;
};
export type DrivingWorld = {
  spawn: (grid?: number) => Driver;
  step: (driver: Driver, input: DriveInput, dt: number, totalLaps?: number) => void;
  dispose: () => void;
};

type DriverData = {
  grid: number; gate: number; trackProgress: number; charge: number; boost: number;
  elapsed: number; started: boolean; resetHeld: boolean;
};
const UP = Math.PI / 2;
const FIXED_STEP = 1 / 60;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (t: number, a: number, b: number) => Math.min(b, Math.max(a, t));
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
let rapierReady: Promise<typeof import('@dimforge/rapier3d-compat')> | undefined;

/** One road collider shared by all drivers. No browser, renderer, or network dependencies. */
export async function createDrivingWorld(options: DrivingWorldOptions = {}): Promise<DrivingWorld> {
  let sampleHeight = options.sampleHeight;
  let free = () => {};
  if (!sampleHeight) {
    rapierReady ??= import('@dimforge/rapier3d-compat').then(async (R) => { await R.init(); return R; });
    const R = await rapierReady;
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    try {
      const { positions, indices } = roadTriangles();
      world.createCollider(R.ColliderDesc.trimesh(positions, indices));
      world.step();
      const ray = new R.Ray({ x: 0, y: 45, z: 0 }, { x: 0, y: -1, z: 0 });
      sampleHeight = (x, z) => {
        ray.origin.x = x; ray.origin.z = z;
        const hit = world.castRay(ray, 50, true);
        return hit ? 45 - hit.timeOfImpact : null;
      };
      free = () => world.free();
    } catch (error) {
      world.free();
      throw error;
    }
  }
  const heightAt = sampleHeight;
  const drivers = new WeakMap<Driver, DriverData>();
  let disposed = false;

  function reset(driver: Driver, data: DriverData) {
    // Follow the actual final straight backwards, rather than projecting all grid
    // rows off a single tangent. Two cars fit across the twelve-metre road.
    let distance = 3.4 + Math.floor(data.grid / 2) * 5.8;
    let segment = course.length - 1;
    while (segment > 0) {
      const a = course[segment], b = course[(segment + 1) % course.length];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      if (distance <= length) break;
      distance -= length;
      segment -= 1;
    }
    const a = course[segment], b = course[(segment + 1) % course.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const phase = clamp(1 - distance / length, 0, 1);
    const yaw = heading(segment), side = data.grid % 2 === 0 ? -2.0 : 2.0;
    const x = mix(a.x, b.x, phase) + Math.cos(yaw) * side;
    const z = mix(a.z, b.z, phase) - Math.sin(yaw) * side;
    const p = locate(x, z);
    const best = driver.state.best;
    Object.assign(driver.state, {
      x, y: heightAt(x, z) ?? p.y, z, yaw, facing: yaw, pitch: 0, steer: 0, speed: 0,
      lap: 1, seconds: 0, best, boost: false, finished: false, finishTime: null,
      progress: p.progress - course.length,
    });
    data.trackProgress = p.progress;
    data.gate = 1;
    data.charge = data.boost = data.elapsed = 0;
    data.started = false;
  }

  function spawn(grid = 0): Driver {
    if (disposed) throw new Error('Driving world has been disposed.');
    const driver: Driver = { state: { best: null } as CarState };
    const data: DriverData = {
      grid: Number.isFinite(grid) ? clamp(Math.floor(grid), 0, 31) : 0,
      gate: 1, trackProgress: 0, charge: 0, boost: 0, elapsed: 0, started: false, resetHeld: false,
    };
    reset(driver, data);
    drivers.set(driver, data);
    return driver;
  }

  function advance(driver: Driver, data: DriverData, input: DriveInput, dt: number, laps: number | undefined) {
    const s = driver.state;
    // Online races share the server's GO clock, including time spent stationary.
    if (laps !== undefined || input.throttle || s.speed > 0.25) data.started = true;
    if (data.started) { data.elapsed += dt; s.seconds += dt; }
    const drift = input.drift && s.speed > 9 && Math.abs(s.steer) > 0.22;
    s.steer = mix(s.steer, clamp(Number.isFinite(input.steer) ? input.steer : 0, -1, 1), 1 - Math.exp(-dt * 12));
    if (drift) data.charge = Math.min(1.25, data.charge + dt);
    else if (data.charge > 0) {
      if (data.charge >= 0.5) data.boost = data.charge * 0.95;
      data.charge = 0;
    }
    data.boost = Math.max(0, data.boost - dt);
    const limit = data.boost > 0 ? 37 : 29;
    const accel = input.brake ? -25 : input.throttle ? 13 + (data.boost > 0 ? 10 : 0) : -5;
    s.speed = clamp(s.speed + (accel - (drift ? 3.4 : 0)) * dt, 0, limit);
    if (s.speed > 0.12) s.yaw += s.steer * dt * (drift ? 2.15 : 1.51) * clamp(s.speed / 7, 0, 1);
    s.facing += turn(s.facing, s.yaw) * (1 - Math.exp(-(drift ? 3.3 : 12) * dt));
    s.x += Math.sin(s.facing) * s.speed * dt;
    s.z += Math.cos(s.facing) * s.speed * dt;
    const p = locate(s.x, s.z);
    const boundary = ROAD_WIDTH / 2 - 1;
    if (p.distance > boundary) {
      const nx = (s.x - p.x) / p.distance, nz = (s.z - p.z) / p.distance;
      const outward = Math.max(0, nx * Math.sin(s.facing) + nz * Math.cos(s.facing));
      s.x = p.x + nx * boundary; s.z = p.z + nz * boundary;
      s.speed *= Math.exp(-dt * (1.55 + 5.1 * outward));
      const along = heading(p.segment);
      const tangent = Math.abs(turn(s.facing, along)) <= UP ? along : along + Math.PI;
      s.facing += turn(s.facing, tangent) * Math.min(0.35, dt * 10 * outward);
      s.yaw += turn(s.yaw, s.facing) * dt * 5;
    }
    s.y = mix(s.y, heightAt(s.x, s.z) ?? p.y, Math.min(1, dt * 33));
    const a = course[p.segment], b = course[(p.segment + 1) % course.length];
    const slope = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
    const direction = Math.cos(turn(s.facing, heading(p.segment)));
    s.pitch = mix(s.pitch, -slope * direction, dt * 9);
    const delta = ((p.progress - data.trackProgress + course.length * 1.5) % course.length) - course.length * 0.5;
    s.progress += delta;
    if (data.gate < 4 && crossedForward(data.trackProgress, p.progress, data.gate * course.length / 4)) data.gate += 1;
    if (data.gate === 4 && crossedForward(data.trackProgress, p.progress, 0)) {
      if (s.best === null || s.seconds < s.best) s.best = s.seconds;
      if (laps !== undefined && s.lap >= laps) {
        s.finished = true; s.finishTime = data.elapsed;
        s.speed = 0; data.boost = data.charge = 0;
        s.progress = laps * course.length;
      } else {
        s.lap += 1; s.seconds = 0;
      }
      data.gate = 1;
    }
    data.trackProgress = p.progress;
    s.boost = data.boost > 0;
  }

  function step(driver: Driver, input: DriveInput, dt: number, totalLaps?: number) {
    if (disposed) throw new Error('Driving world has been disposed.');
    const data = drivers.get(driver);
    if (!data) throw new Error('Driver belongs to a different driving world.');
    const laps = totalLaps === undefined ? undefined : Math.max(1, Math.floor(Number.isFinite(totalLaps) ? totalLaps : 3));
    // A reset is a local time-trial convenience, never a ranked-race teleport.
    if (input.reset && !data.resetHeld && laps === undefined) reset(driver, data);
    data.resetHeld = Boolean(input.reset);
    if (driver.state.finished || !Number.isFinite(dt) || dt <= 0) return;
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-9 && !driver.state.finished) {
      const slice = Math.min(remaining, FIXED_STEP);
      advance(driver, data, input, slice, laps);
      remaining -= slice;
    }
  }

  return { spawn, step, dispose() { if (!disposed) { disposed = true; free(); } } };
}
