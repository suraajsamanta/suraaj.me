import { absorbPowerHit, collectPowerups, createPowerState, createPowerWorld, stepPowers, powerDrivingState, type KartPowerState, type PowerWorld } from './powerups';
import { ACTIVE_SHORTCUT, ACTIVE_TRACK, BARRIER_OFFSET, BOOST_FRACTIONS, BOOST_LANES, circularDistance, clamp, ROAD_HALF_WIDTH, SHORTCUT_LENGTH, shortcutPose, trackCurve, trackPose, TRACK_LENGTH, wrap } from './track';

export type DriverInput = { steer: number; accelerate: boolean; brake: boolean; drift?: boolean; action?: number };
export type GamePlayer = { id: string; name: string; color: string; character?: string; vehicle?: string; connected?: boolean; input: DriverInput };
export type RaceResult = { id: string; name: string; color: string; place: number; time: number | null; finished: boolean; itemsUsed: number };
export type KartState = {
  id: string; name: string; color: string; distance: number; lane: number; speed: number; lateral: number;
  /** World yaw relative to the local track tangent, also used by the renderer. */
  heading: number;
  driftCharge: number; drifting: boolean; onShortcut: boolean;
  boost: number; bump: number; finishTime: number | null; padCooldown: number; obstacleCooldown: number; power: KartPowerState;
};
export type RaceState = { elapsed: number; countdown: number; karts: KartState[]; complete: boolean; laps: number; firstFinish: number | null; powers: PowerWorld };
export const COUNTDOWN_SECONDS = 8;
export const MAX_SPEED = 43;
export const FINISH_GRACE_SECONDS = 25;

export function createRace(players: GamePlayer[], laps = 3): RaceState {
  return {
    elapsed: 0, countdown: COUNTDOWN_SECONDS, complete: false, laps, firstFinish: null, powers: createPowerWorld(),
    // Start behind the line, without awarding a lap on the initial crossing.
    karts: players.slice(0, 10).map((player, i) => ({
      id: player.id, name: player.name, color: player.color, distance: -6 - Math.floor(i / 2) * 4.5,
      lane: i % 2 === 0 ? -2.1 : 2.1, speed: 0, lateral: 0, heading: 0,
      driftCharge: 0, drifting: false, onShortcut: false, boost: 0, bump: 0, finishTime: null, padCooldown: 0, obstacleCooldown: 0, power: createPowerState(player.input.action),
    })),
  };
}

export function rankKarts(race: RaceState): KartState[] {
  return [...race.karts].sort((a, b) => {
    if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime || a.id.localeCompare(b.id);
    if (a.finishTime !== null) return -1;
    if (b.finishTime !== null) return 1;
    return b.distance - a.distance || a.id.localeCompare(b.id);
  });
}

export function raceResults(race: RaceState): RaceResult[] {
  // The starting roster belongs to the race, even if a controller disconnects.
  return rankKarts(race).map((kart, i) => ({
    id: kart.id, name: kart.name, color: kart.color, place: i + 1,
    time: kart.finishTime, finished: kart.finishTime !== null, itemsUsed: kart.power.used,
  }));
}

export function stepRace(race: RaceState, players: GamePlayer[], dt: number, autoSteer = true): void {
  if (race.complete) return;
  if (race.countdown > 0) {
    race.countdown = Math.max(0, race.countdown - dt);
    return;
  }
  race.elapsed += dt;
  stepPowers(race, players, dt);
  const previousDistances = new Map(race.karts.map((kart) => [kart.id, kart.distance]));
  const previousLanes = new Map(race.karts.map((kart) => [kart.id, kart.lane]));
  const previousRoutes = new Map(race.karts.map((kart) => [kart.id, kart.onShortcut]));
  for (const kart of race.karts) {
    const input = players.find((player) => player.id === kart.id)?.input;
    const finished = kart.finishTime !== null;
    const driving = powerDrivingState(kart);
    const steer = driving.autoDrive ? 0 : clamp(Number.isFinite(input?.steer) ? input!.steer : 0, -1, 1);
    const accelerating = !finished && (driving.autoDrive || input?.accelerate === true);
    const braking = !finished && !driving.autoDrive && input?.brake === true;
    const assisted = autoSteer || driving.autoDrive;
    const offRoad = Math.abs(kart.lane) > ROAD_HALF_WIDTH - 0.5;
    kart.boost = Math.max(0, kart.boost - dt);
    kart.bump = Math.max(0, kart.bump - dt);
    kart.padCooldown = Math.max(0, kart.padCooldown - dt);
    kart.obstacleCooldown = Math.max(0, kart.obstacleCooldown - dt);
    // A dancing racer is stationary even if they keep holding a driving control.
    if (kart.power.dance > 0) {
      kart.speed = 0; kart.lateral = 0; kart.boost = 0; kart.driftCharge = 0; kart.drifting = false;
      continue;
    }
    // Missing drift is a safety reset (disconnect/cancel), never a rewarded release.
    // Charge only while actually moving and steering; releasing awards a tiered burst.
    if (finished || input?.drift === undefined) {
      kart.driftCharge = 0; kart.drifting = false;
    } else if (input.drift) {
      kart.drifting = true;
      if (accelerating && kart.speed > 8 && Math.abs(steer) > 0.2) kart.driftCharge = Math.min(3, kart.driftCharge + dt);
    } else {
      if (kart.drifting && kart.driftCharge >= 0.6) kart.boost = Math.max(kart.boost, kart.driftCharge >= 2 ? 2 : kart.driftCharge >= 1.2 ? 1.4 : 0.8);
      kart.driftCharge = 0; kart.drifting = false;
    }
    const boost = kart.boost > 0;
    // The shoulder adds progressively more drag toward the rail. A gentle,
    // monotonic penalty avoids both the old grass speed cliff and a fast strip
    // at the wall where driving farther off-road would increase speed again.
    const shoulder = clamp((Math.abs(kart.lane) - (ROAD_HALF_WIDTH - 0.5)) / (BARRIER_OFFSET - 1.15 - (ROAD_HALF_WIDTH - 0.5)), 0, 1);
    const surfaceMaximum = driving.autoDrive ? driving.maximumSpeed! : offRoad ? MAX_SPEED * (1 - shoulder * 0.1) : Math.max(MAX_SPEED + 15, driving.maximumSpeed ?? 0);
    const maximum = finished ? 14 : Math.min(surfaceMaximum, kart.power.slow > 0 ? 24 : driving.maximumSpeed ?? (boost ? MAX_SPEED + 15 : MAX_SPEED));
    const engine = (finished ? 7 : accelerating ? driving.acceleration ?? (boost ? 23 : 13) : -5) * (kart.power.slow > 0 ? 0.55 : 1);
    kart.speed = clamp(kart.speed + (braking ? -30 : engine) * dt, 0, Math.max(MAX_SPEED + 17, maximum));
    if (kart.speed > maximum) kart.speed = Math.max(maximum, kart.speed - (offRoad ? 32 : 14) * dt);
    const previousDistance = kart.distance;
    const wasOnShortcut = kart.onShortcut;
    let forwardFraction = 1;
    if (assisted || finished) {
      // The track's positive lane axis points LEFT in a chase camera. Controller
      // input stays conventional (+1 right), so invert only at this boundary.
      const laneSteer = finished || driving.autoDrive ? clamp(-kart.lane * 0.2, -1, 1) : -steer;
      // Assisted driving follows the track, with a little outward drift on bends.
      const branchCurve = () => {
        const a = shortcutPose(kart.distance - 3).yaw, b = shortcutPose(kart.distance + 3).yaw;
        return Math.atan2(Math.sin(b - a), Math.cos(b - a)) / 6;
      };
      const drift = finished || driving.autoDrive ? 0 : -(kart.onShortcut ? branchCurve() : trackCurve(kart.distance)) * kart.speed * kart.speed * 0.045;
      const targetLateral = laneSteer * (2.4 + kart.speed * (kart.drifting ? 0.26 : 0.19)) + drift;
      kart.lateral += (targetLateral - kart.lateral) * Math.min(1, dt * 7);
      kart.lane += kart.lateral * dt * Math.min(1, kart.speed / 4);
      kart.heading = Math.atan2(kart.lateral, Math.max(8, kart.speed)) * 0.65;
    } else {
      // Manual mode steers a heading rather than a lane. Releasing the controls
      // keeps the kart pointed forward in the world instead of following bends.
      // Limit the angle for arcade handling: no reversing or spinning in place.
      const turnRate = (kart.drifting ? 1.25 : 1) * (1.4 + kart.speed * 0.025) * Math.min(1, kart.speed / 6);
      kart.heading = clamp(kart.heading - steer * turnRate * dt, -1.2, 1.2);
      kart.lateral = Math.sin(kart.heading) * kart.speed;
      kart.lane += kart.lateral * dt;
      forwardFraction = Math.cos(kart.heading);
    }
    if (Math.abs(kart.lane) > BARRIER_OFFSET - 1.15) {
      const side = Math.sign(kart.lane);
      kart.lane = side * (BARRIER_OFFSET - 1.15);
      // Remove only motion into the rail, preserving forward travel and any
      // steering away from it. Reflecting either value makes the kart bounce.
      if (kart.lateral * side > 0) kart.lateral = 0;
      if (kart.heading * side > 0) kart.heading = 0;
      forwardFraction = assisted || finished ? 1 : Math.cos(kart.heading);
      // A scrape adds mild continuous friction, not repeated 30% impact cuts.
      kart.speed = Math.max(0, kart.speed - 3 * dt);
      kart.bump = Math.max(kart.bump, 0.08);
    }
    // Entrance can only be crossed forward from the indicated side. On the
    // branch a metre travelled maps to its fair share of the bypassed segment;
    // no extra progress is awarded at either junction or by waiting there.
    let travel = kart.speed * forwardFraction * dt;
    const start = ACTIVE_SHORTCUT.start * TRACK_LENGTH, end = ACTIVE_SHORTCUT.end * TRACK_LENGTH;
    const ratio = (end - start) / SHORTCUT_LENGTH;
    if (!kart.onShortcut && !finished && !driving.autoDrive) {
      const entrance = (Math.floor((previousDistance - start) / TRACK_LENGTH) + 1) * TRACK_LENGTH + start;
      const toEntrance = entrance - previousDistance;
      if (travel >= toEntrance && kart.lane * ACTIVE_SHORTCUT.side >= 2) {
        kart.distance = entrance;
        travel -= toEntrance;
        kart.onShortcut = true;
      }
    }
    if (kart.onShortcut) {
      // Work from the current wrapped position instead of dividing by lap
      // length: division at a freshly crossed entrance can round below an
      // integer and incorrectly select the previous lap's exit.
      const remaining = end - wrap(kart.distance);
      const progressToExit = remaining >= -1e-7 ? Math.max(0, remaining) : remaining + TRACK_LENGTH;
      const exit = kart.distance + progressToExit;
      const physicalToExit = progressToExit / ratio;
      if (travel >= physicalToExit) {
        kart.distance = exit + travel - physicalToExit;
        kart.onShortcut = false;
      } else kart.distance += travel * ratio;
    } else kart.distance += travel;
    if (!assisted && !finished) {
      const before = wasOnShortcut ? shortcutPose(previousDistance) : trackPose(previousDistance);
      const after = kart.onShortcut ? shortcutPose(kart.distance) : trackPose(kart.distance);
      const turn = after.yaw - before.yaw;
      kart.heading = clamp(kart.heading - Math.atan2(Math.sin(turn), Math.cos(turn)), -1.2, 1.2);
    }
    if (!finished && !wasOnShortcut && !kart.onShortcut && kart.padCooldown <= 0) {
      BOOST_FRACTIONS.forEach((fraction, i) => {
        if (Math.abs(circularDistance(kart.distance, fraction * TRACK_LENGTH)) < 3 && Math.abs(kart.lane - BOOST_LANES[i]) < 1.8) {
          kart.boost = 1.8;
          kart.padCooldown = 2;
        }
      });
    }
    // Hazards live in track-relative coordinates so collisions match the visible props.
    // Check the whole segment travelled this step to avoid tunnelling at high speed.
    if (!finished && !wasOnShortcut && !kart.onShortcut && kart.obstacleCooldown <= 0 && kart.speed > 1) {
      const travel = kart.distance - previousDistance;
      for (const obstacle of ACTIVE_TRACK.obstacles) {
        const offset = circularDistance(obstacle.fraction * TRACK_LENGTH, previousDistance);
        const closest = clamp(offset, 0, travel);
        const longitudinal = Math.abs(offset - closest);
        const radius = obstacle.kind === 'barrel' ? 2 : 3;
        const laneRadius = obstacle.kind === 'barrel' ? 1.5 : 2.2;
        if (longitudinal < radius && Math.abs(kart.lane - obstacle.lane) < laneRadius) {
          const direction = kart.lane >= obstacle.lane ? 1 : -1;
          // A foam guard absorbs a hazard; brief hit immunity prevents stacked damage.
          if (kart.power.hitCooldown > 0 || absorbPowerHit(kart)) {
            kart.obstacleCooldown = 1;
            break;
          }
          if (obstacle.kind === 'barrel') {
            kart.speed *= 0.52;
            kart.lateral += direction * 4;
            kart.bump = 0.4;
          } else {
            kart.speed *= 0.8;
            kart.lateral += direction * 6;
            kart.heading = clamp(kart.heading + direction * 0.2, -1.2, 1.2);
            kart.bump = 0.25;
          }
          kart.obstacleCooldown = 1;
          break;
        }
      }
    }
    if (!finished && kart.distance >= TRACK_LENGTH * race.laps) {
      kart.finishTime = race.elapsed;
      if (race.firstFinish === null) race.firstFinish = race.elapsed;
    }
  }
  collectPowerups(race, previousDistances, new Set(players.filter(player => player.connected !== false).map(player => player.id)), previousRoutes, previousLanes);
  // Symmetric resolution: update each pair once, so player order has no advantage.
  for (let i = 0; i < race.karts.length; i++) {
    for (let j = i + 1; j < race.karts.length; j++) {
      const a = race.karts[i], b = race.karts[j];
      if (a.finishTime !== null || b.finishTime !== null || powerDrivingState(a).collisionImmune || powerDrivingState(b).collisionImmune) continue;
      // Branch progress is scaled, not physical metres. Compare both routes
      // in world coordinates so a close pair collides at joins and on the
      // branch, but distant roads with similar progress do not collide.
      let longitudinal = circularDistance(a.distance, b.distance);
      let lateral = a.lane - b.lane;
      let sideA = lateral > 0 ? 1 : lateral < 0 ? -1 : a.id < b.id ? 1 : -1;
      let sideB = -sideA;
      if (a.onShortcut || b.onShortcut) {
        const ap = (a.onShortcut ? shortcutPose : trackPose)(a.distance, a.lane);
        const bp = (b.onShortcut ? shortcutPose : trackPose)(b.distance, b.lane);
        // A bridge may pass directly above a branch: contact requires physical
        // vertical proximity as well as horizontal proximity.
        if (Math.abs(ap.position[1] - bp.position[1]) >= 2.7) continue;
        const dx = ap.position[0] - bp.position[0], dz = ap.position[2] - bp.position[2];
        // A shared frame makes the contact test independent of roster order.
        // Opposite tangents use a stable tie-breaker rather than an unstable sum.
        let fx = ap.forward[0] + bp.forward[0], fz = ap.forward[2] + bp.forward[2];
        const length = Math.hypot(fx, fz);
        if (length < 1e-6) {
          const canonical = a.id < b.id ? ap.forward : bp.forward;
          fx = canonical[0]; fz = canonical[2];
        } else { fx /= length; fz /= length; }
        longitudinal = dx * fx + dz * fz;
        lateral = dx * fz - dz * fx;
        // Choose one shared separating normal, then project the opposing
        // motions into each kart's lane axis. Independent center-vector signs
        // can point both karts toward the same rail on a curve.
        const tie = a.id < b.id ? 1 : -1;
        const direction = Math.abs(lateral) > 1e-9 ? Math.sign(lateral) : tie;
        sideA = direction * (fz * ap.right[0] - fx * ap.right[2]);
        sideB = -direction * (fz * bp.right[0] - fx * bp.right[2]);
      }
      if (Math.abs(longitudinal) < 2.7 && Math.abs(lateral) < 1.75) {
        const push = (1.75 - Math.abs(lateral)) * 0.5 + 0.025;
        const aDancing = a.power.dance > 0, bDancing = b.power.dance > 0;
        if (!aDancing) a.lane += sideA * push * (bDancing ? 2 : 1);
        if (!bDancing) b.lane += sideB * push * (aDancing ? 2 : 1);
        if (!aDancing) a.lane = clamp(a.lane, -BARRIER_OFFSET + 1.15, BARRIER_OFFSET - 1.15);
        if (!bDancing) b.lane = clamp(b.lane, -BARRIER_OFFSET + 1.15, BARRIER_OFFSET - 1.15);
        if (a.bump <= 0 && b.bump <= 0 && !(aDancing && bDancing)) {
          const average = (a.speed + b.speed) * 0.46;
          if (!aDancing) a.speed = average;
          if (!bDancing) b.speed = average;
          a.bump = 0.28; b.bump = 0.28;
        }
      }
    }
  }
  if (race.karts.every((kart) => kart.finishTime !== null) ||
      (race.firstFinish !== null && race.elapsed - race.firstFinish >= FINISH_GRACE_SECONDS)) race.complete = true;
}

export function currentLap(kart: KartState, laps: number): number {
  return clamp(Math.floor(Math.max(0, kart.distance) / TRACK_LENGTH) + 1, 1, laps);
}

export function lapProgress(kart: KartState): number {
  return kart.distance < 0 ? 0 : wrap(kart.distance) / TRACK_LENGTH;
}
