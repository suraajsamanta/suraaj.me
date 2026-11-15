import { crossedForward, getTrack, heading, roadTriangles, type Point, type TrackId } from './course';
import { createSimdRoadQuery } from './road-simd';

export type DriveInput = { steer: number; throttle: boolean; brake: boolean; drift: boolean; reset: boolean };
export type CarState = {
  x: number; y: number; z: number; yaw: number; facing: number; pitch: number; steer: number;
  /** Signed metres per second: negative while backing up. */
  speed: number;
  lap: number; seconds: number; best: number | null; boost: boolean; driftCharge?: number;
  finished: boolean; finishTime: number | null;
  /** Continuous course-segment units, negative on the grid. */
  progress: number;
};
export type Driver = { state: CarState };
export type DrivingWorldOptions = {
  /** Tests may bypass WASM. Return null when no road is hit; course height is the fallback. */
  sampleHeight?: (x: number, z: number) => number | null;
  trackId?: TrackId;
};
export type DrivingWorld = {
  /** Runtime-selected road geometry kernel on the simulator. */
  roadKernel: "WASM SIMD" | "Scalar";
  spawn: (grid?: number) => Driver;
  step: (driver: Driver, input: DriveInput, dt: number, totalLaps?: number) => void;
  dispose: () => void;
};

type DriverData = {
  grid: number; gate: number; trackProgress: number; charge: number; boost: number;
  elapsed: number; started: boolean; resetHeld: boolean; stoppedBrake: number;
};
const UP = Math.PI / 2;
const FIXED_STEP = 1 / 60;
const REVERSE_HOLD = 0.25;
const REVERSE_LIMIT = 8;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (t: number, a: number, b: number) => Math.min(b, Math.max(a, t));
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
let rapierReady: Promise<typeof import('@dimforge/rapier3d-compat')> | undefined;

/** One road collider shared by all drivers. No browser, renderer, or network dependencies. */
export async function createDrivingWorld(options: DrivingWorldOptions = {}): Promise<DrivingWorld> {
  const track = getTrack(options.trackId ?? 'seattle');
  const course = track.points;
  const simd = await createSimdRoadQuery(course);
  const nearest = simd ?? indexRoad(course);
  const angleAt = (i: number) => heading(i, course);
  let sampleHeight = options.sampleHeight;
  let free = () => {};
  if (!sampleHeight) {
    rapierReady ??= import('@dimforge/rapier3d-compat').then(async (R) => { await R.init(); return R; });
    const R = await rapierReady;
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    try {
      const { positions, indices } = roadTriangles(course, track.roadWidth);
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
    const yaw = angleAt(segment), side = data.grid % 2 === 0 ? -2.0 : 2.0;
    const x = mix(a.x, b.x, phase) + Math.cos(yaw) * side;
    const z = mix(a.z, b.z, phase) - Math.sin(yaw) * side;
    const p = nearest(x, z);
    const best = driver.state.best;
    Object.assign(driver.state, {
      x, y: heightAt(x, z) ?? p.y, z, yaw, facing: yaw, pitch: 0, steer: 0, speed: 0,
      lap: 1, seconds: 0, best, boost: false, driftCharge: 0, finished: false, finishTime: null,
      progress: p.progress - course.length,
    });
    data.trackProgress = p.progress;
    data.gate = 1;
    data.charge = data.boost = data.elapsed = 0;
    data.started = false;
    data.stoppedBrake = 0;
  }

  function spawn(grid = 0): Driver {
    if (disposed) throw new Error('Driving world has been disposed.');
    const driver: Driver = { state: { best: null } as CarState };
    const data: DriverData = {
      grid: Number.isFinite(grid) ? clamp(Math.floor(grid), 0, 31) : 0,
      gate: 1, trackProgress: 0, charge: 0, boost: 0, elapsed: 0, started: false, resetHeld: false, stoppedBrake: 0,
    };
    reset(driver, data);
    drivers.set(driver, data);
    return driver;
  }

  function advance(driver: Driver, data: DriverData, input: DriveInput, dt: number, laps: number | undefined) {
    const s = driver.state;
    // Online races share the server's GO clock, including time spent stationary.
    if (laps !== undefined || input.throttle || Math.abs(s.speed) > 0.25) data.started = true;
    if (data.started) { data.elapsed += dt; s.seconds += dt; }
    const drift = input.drift && !input.brake && s.speed > 9 && Math.abs(s.steer) > 0.22;
    s.steer = mix(s.steer, clamp(Number.isFinite(input.steer) ? input.steer : 0, -1, 1), 1 - Math.exp(-dt * 12));
    if (drift) data.charge = Math.min(1.25, data.charge + dt);
    else if (data.charge > 0) {
      if (data.charge >= 0.5) data.boost = data.charge * 0.95;
      data.charge = 0;
    }
    data.boost = Math.max(0, data.boost - dt);
    const limit = data.boost > 0 ? 37 : 29;
    if (input.brake && !input.throttle) {
      if (s.speed > 0) {
        s.speed = Math.max(0, s.speed - 25 * dt);
        data.stoppedBrake = 0;
      } else {
        data.stoppedBrake += dt;
        if (s.speed < 0 || data.stoppedBrake + 1e-9 >= REVERSE_HOLD) {
          s.speed = Math.max(-REVERSE_LIMIT, s.speed - 9 * dt);
          data.boost = data.charge = 0;
        }
      }
    } else {
      data.stoppedBrake = 0;
      if (input.brake) { // Both pedals stop the car without engaging reverse.
        s.speed = Math.sign(s.speed) * Math.max(0, Math.abs(s.speed) - 25 * dt);
      } else if (s.speed < 0) {
        // Opposing throttle first slows the backward roll before driving forward.
        s.speed = Math.min(0, s.speed + (input.throttle ? 25 : 7) * dt);
      } else {
        const accel = input.throttle ? 13 + (data.boost > 0 ? 10 : 0) : -5;
        s.speed = clamp(s.speed + (accel - (drift ? 3.4 : 0)) * dt, 0, limit);
      }
    }
    if (Math.abs(s.speed) > 0.12) s.yaw += s.steer * dt * (drift ? 2.15 : 1.51) * clamp(s.speed / 7, -1, 1);
    s.facing += turn(s.facing, s.yaw) * (1 - Math.exp(-(drift ? 3.3 : 12) * dt));
    s.x += Math.sin(s.facing) * s.speed * dt;
    s.z += Math.cos(s.facing) * s.speed * dt;
    const p = nearest(s.x, s.z);
    const boundary = track.roadWidth / 2 - 1;
    if (p.distance > boundary) {
      const nx = (s.x - p.x) / p.distance, nz = (s.z - p.z) / p.distance;
      const outward = Math.max(0, Math.sign(s.speed) * (nx * Math.sin(s.facing) + nz * Math.cos(s.facing)));
      s.x = p.x + nx * boundary; s.z = p.z + nz * boundary;
      s.speed *= Math.exp(-dt * (1.55 + 5.1 * outward));
      const along = angleAt(p.segment);
      const tangent = Math.abs(turn(s.facing, along)) <= UP ? along : along + Math.PI;
      s.facing += turn(s.facing, tangent) * Math.min(0.35, dt * 10 * outward);
      s.yaw += turn(s.yaw, s.facing) * dt * 5;
    }
    s.y = mix(s.y, heightAt(s.x, s.z) ?? p.y, Math.min(1, dt * 33));
    const a = course[p.segment], b = course[(p.segment + 1) % course.length];
    const slope = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
    const direction = Math.cos(turn(s.facing, angleAt(p.segment)));
    s.pitch = mix(s.pitch, -slope * direction, dt * 9);
    const delta = ((p.progress - data.trackProgress + course.length * 1.5) % course.length) - course.length * 0.5;
    s.progress += delta;
    if (s.speed >= 0 && data.gate < 4 && crossedForward(data.trackProgress, p.progress, data.gate * course.length / 4, course.length)) data.gate += 1;
    if (s.speed >= 0 && data.gate === 4 && crossedForward(data.trackProgress, p.progress, 0, course.length)) {
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
    s.driftCharge = Math.min(1, data.charge / .5);
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

  return { roadKernel: simd ? "WASM SIMD" : "Scalar", spawn, step, dispose() { if (!disposed) { disposed = true; free(); } } };
}


/** An exact projected nearest-segment lookup. Expanded cells include every
 * segment that could be within 12 m of the query. Rare off-road queries
 * fall back to the full track, with stable tie-breaking at each seam. */
export function indexRoad(path: readonly Point[]) {
  const cell = 16, reach = 12;
  const segments = path.map((a, index) => {
    const b = path[(index + 1) % path.length], dx = b.x - a.x, dz = b.z - a.z;
    return { index, a, dx, dz, dy: b.y - a.y, inv: 1 / (dx * dx + dz * dz) };
  });
  const buckets = new Map<number, Map<number, typeof segments>>();
  for (const seg of segments) {
    const { a, dx, dz } = seg;
    for (let ix = Math.floor((a.x + Math.min(0, dx) - reach) / cell); ix <= Math.floor((a.x + Math.max(0, dx) + reach) / cell); ix++) {
      let column = buckets.get(ix);
      if (!column) { column = new Map(); buckets.set(ix, column); }
      for (let iz = Math.floor((a.z + Math.min(0, dz) - reach) / cell); iz <= Math.floor((a.z + Math.max(0, dz) + reach) / cell); iz++) {
        const list = column.get(iz);
        if (list) list.push(seg); else column.set(iz, [seg]);
      }
    }
  }
  return (x: number, z: number) => {
    let d2 = Infinity, sx = 0, sy = 0, sz = 0, segment = 0, phase = 0;
    function search(candidates: typeof segments) {
      for (const { index, a, dx, dy, dz, inv } of candidates) {
        const t = clamp(((x - a.x) * dx + (z - a.z) * dz) * inv, 0, 1);
        const px = a.x + dx * t, pz = a.z + dz * t;
        const dd = (x - px) ** 2 + (z - pz) ** 2;
        if (dd < d2 || (dd === d2 && index < segment)) {
          d2 = dd; sx = px; sy = a.y + dy * t; sz = pz; segment = index; phase = t;
        }
      }
    }
    const local = buckets.get(Math.floor(x / cell))?.get(Math.floor(z / cell));
    if (local) search(local);
    if (d2 >= reach * reach) search(segments);
    return { x: sx, y: sy, z: sz, distance: Math.sqrt(d2), segment, progress: (segment + phase) % path.length };
  };
}

const SOLO_LAPS = 3;
const SOLO_RIVALS = [
  { id: 'rook', color: '#ff7659', lane: -1.55, pace: 20.5 },
  { id: 'vex', color: '#f8d873', lane: 1.55, pace: 22.5 },
  { id: 'nova', color: '#a48bff', lane: -0.45, pace: 24.5 },
] as const;
export function createSoloRace(world: DrivingWorld, trackId: TrackId = 'seattle') {
  const path = getTrack(trackId).points;
  const driver = world.spawn(1);
  const rivals = SOLO_RIVALS.map((rival, i) => ({ ...rival, driver: world.spawn(i === 0 ? 0 : i + 1) }));
  let countdown = 3;
  function step(input: DriveInput, dt: number) {
    if (!Number.isFinite(dt) || dt <= 0 || driver.state.finished) return;
    if (countdown > 0) { countdown = Math.max(0, countdown - dt); return; }
    world.step(driver, input, dt, SOLO_LAPS);
    for (const rival of rivals) {
      const s = rival.driver.state;
      if (s.finished) continue;
      const idx = Math.floor(s.progress), initial = ((idx % path.length) + path.length) % path.length;
      let j = initial;
      let remaining = 6 + s.speed * 0.32;
      for (let i = 0; i < path.length && remaining > 0; i++) {
        const a = path[j], next = (j + 1) % path.length, b = path[next];
        remaining -= Math.hypot(a.x - b.x, a.z - b.z); j = next;
      }
      const p = path[j], lineHeading = heading(j, path);
      const targetHeading = Math.atan2(p.x + Math.cos(lineHeading) * rival.lane - s.x, p.z - Math.sin(lineHeading) * rival.lane - s.z);
      const steer = clamp(turn(s.facing, targetHeading) * 1.85, -1, 1);
      const bend = Math.abs(turn(heading(initial, path), lineHeading));
      const desiredSpeed = rival.pace - Math.min(8, 6 * bend);
      world.step(rival.driver, { steer, throttle: s.speed < desiredSpeed, brake: s.speed > desiredSpeed + 2.5, drift: false, reset: false }, dt, SOLO_LAPS);
    }
  }
  function status() {
    const placedAhead = rivals.filter(({ driver: { state } }) => state.finished
      ? driver.state.finishTime === null || (state.finishTime ?? Infinity) < driver.state.finishTime
      : !driver.state.finished && state.progress > driver.state.progress).length;
    return { countdown, place: 1 + placedAhead, total: 1 + rivals.length, finished: driver.state.finished };
  }
  return { driver, rivals, step, status };
}
