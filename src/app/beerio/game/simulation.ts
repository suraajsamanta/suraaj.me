import { BARRIER_OFFSET, BOOST_FRACTIONS, BOOST_LANES, circularDistance, clamp, ROAD_HALF_WIDTH, trackCurve, trackPose, TRACK_LENGTH, wrap } from './track';

export type DriverInput = { steer: number; accelerate: boolean; brake: boolean };
export type GamePlayer = { id: string; name: string; color: string; input: DriverInput };
export type RaceResult = { id: string; name: string; color: string; place: number; time: number | null; finished: boolean };
export type KartState = {
  id: string; distance: number; lane: number; speed: number; lateral: number;
  /** World yaw relative to the local track tangent, also used by the renderer. */
  heading: number;
  boost: number; bump: number; finishTime: number | null; padCooldown: number;
};
export type RaceState = { elapsed: number; countdown: number; karts: KartState[]; complete: boolean; laps: number; firstFinish: number | null };
export const COUNTDOWN_SECONDS = 3;
export const MAX_SPEED = 43;
export const FINISH_GRACE_SECONDS = 25;

export function createRace(players: GamePlayer[], laps = 3): RaceState {
  return {
    elapsed: 0, countdown: COUNTDOWN_SECONDS, complete: false, laps, firstFinish: null,
    // Start behind the line, without awarding a lap on the initial crossing.
    karts: players.slice(0, 6).map((player, i) => ({
      id: player.id, distance: -6 - Math.floor(i / 2) * 4.5,
      lane: i % 2 === 0 ? -2.1 : 2.1, speed: 0, lateral: 0, heading: 0,
      boost: 0, bump: 0, finishTime: null, padCooldown: 0,
    })),
  };
}

export function rankKarts(race: RaceState): KartState[] {
  return [...race.karts].sort((a, b) => {
    if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime;
    if (a.finishTime !== null) return -1;
    if (b.finishTime !== null) return 1;
    return b.distance - a.distance;
  });
}

export function raceResults(race: RaceState, players: GamePlayer[]): RaceResult[] {
  return rankKarts(race).map((kart, i) => {
    const player = players.find((p) => p.id === kart.id);
    return { id: kart.id, name: player?.name || 'Racer', color: player?.color || '#f5b654', place: i + 1, time: kart.finishTime, finished: kart.finishTime !== null };
  });
}

export function stepRace(race: RaceState, players: GamePlayer[], dt: number, autoSteer = true): void {
  if (race.complete) return;
  if (race.countdown > 0) {
    race.countdown = Math.max(0, race.countdown - dt);
    return;
  }
  race.elapsed += dt;
  for (const kart of race.karts) {
    const input = players.find((player) => player.id === kart.id)?.input;
    const finished = kart.finishTime !== null;
    const steer = clamp(Number.isFinite(input?.steer) ? input!.steer : 0, -1, 1);
    const accelerating = !finished && input?.accelerate === true;
    const braking = !finished && input?.brake === true;
    const offRoad = Math.abs(kart.lane) > ROAD_HALF_WIDTH - 0.5;
    kart.boost = Math.max(0, kart.boost - dt);
    kart.bump = Math.max(0, kart.bump - dt);
    kart.padCooldown = Math.max(0, kart.padCooldown - dt);
    const boost = kart.boost > 0;
    const maximum = finished ? 14 : offRoad ? 19 : boost ? MAX_SPEED + 15 : MAX_SPEED;
    const engine = finished ? 7 : accelerating ? boost ? 23 : 13 : -5;
    kart.speed = clamp(kart.speed + (braking ? -30 : engine) * dt, 0, MAX_SPEED + 17);
    if (kart.speed > maximum) kart.speed = Math.max(maximum, kart.speed - (offRoad ? 32 : 14) * dt);
    const previousDistance = kart.distance;
    let forwardFraction = 1;
    if (autoSteer || finished) {
      // The track's positive lane axis points LEFT in a chase camera. Controller
      // input stays conventional (+1 right), so invert only at this boundary.
      const laneSteer = finished ? clamp(-kart.lane * 0.2, -1, 1) : -steer;
      // Assisted driving follows the track, with a little outward drift on bends.
      const drift = finished ? 0 : -trackCurve(kart.distance) * kart.speed * kart.speed * 0.045;
      const targetLateral = laneSteer * (2.4 + kart.speed * 0.19) + drift;
      kart.lateral += (targetLateral - kart.lateral) * Math.min(1, dt * 7);
      kart.lane += kart.lateral * dt * Math.min(1, kart.speed / 4);
      kart.heading = Math.atan2(kart.lateral, Math.max(8, kart.speed)) * 0.65;
    } else {
      // Manual mode steers a heading rather than a lane. Releasing the controls
      // keeps the kart pointed forward in the world instead of following bends.
      // Limit the angle for arcade handling: no reversing or spinning in place.
      const turnRate = (1.4 + kart.speed * 0.025) * Math.min(1, kart.speed / 6);
      kart.heading = clamp(kart.heading - steer * turnRate * dt, -1.2, 1.2);
      kart.lateral = Math.sin(kart.heading) * kart.speed;
      kart.lane += kart.lateral * dt;
      forwardFraction = Math.cos(kart.heading);
    }
    if (Math.abs(kart.lane) > BARRIER_OFFSET - 1.15) {
      kart.lane = Math.sign(kart.lane) * (BARRIER_OFFSET - 1.15);
      kart.lateral *= -0.45;
      kart.heading *= -0.45;
      if (kart.bump <= 0) { kart.speed *= 0.7; kart.bump = 0.35; }
    }
    kart.distance += kart.speed * forwardFraction * dt;
    if (!autoSteer && !finished) {
      const turn = trackPose(kart.distance).yaw - trackPose(previousDistance).yaw;
      kart.heading = clamp(kart.heading - Math.atan2(Math.sin(turn), Math.cos(turn)), -1.2, 1.2);
    }
    if (!finished && kart.padCooldown <= 0) {
      BOOST_FRACTIONS.forEach((fraction, i) => {
        if (Math.abs(circularDistance(kart.distance, fraction * TRACK_LENGTH)) < 3 && Math.abs(kart.lane - BOOST_LANES[i]) < 1.8) {
          kart.boost = 1.8;
          kart.padCooldown = 2;
        }
      });
    }
    if (!finished && kart.distance >= TRACK_LENGTH * race.laps) {
      kart.finishTime = race.elapsed;
      if (race.firstFinish === null) race.firstFinish = race.elapsed;
    }
  }
  // Symmetric resolution: update each pair once, so player order has no advantage.
  for (let i = 0; i < race.karts.length; i++) {
    for (let j = i + 1; j < race.karts.length; j++) {
      const a = race.karts[i], b = race.karts[j];
      if (a.finishTime !== null || b.finishTime !== null) continue;
      const longitudinal = circularDistance(a.distance, b.distance);
      const lateral = a.lane - b.lane;
      if (Math.abs(longitudinal) < 2.7 && Math.abs(lateral) < 1.75) {
        const push = (1.75 - Math.abs(lateral)) * 0.5 + 0.025;
        const direction = lateral >= 0 ? 1 : -1;
        a.lane += direction * push; b.lane -= direction * push;
        a.lane = clamp(a.lane, -BARRIER_OFFSET + 1.15, BARRIER_OFFSET - 1.15);
        b.lane = clamp(b.lane, -BARRIER_OFFSET + 1.15, BARRIER_OFFSET - 1.15);
        if (a.bump <= 0 && b.bump <= 0) {
          const average = (a.speed + b.speed) * 0.46;
          a.speed = average; b.speed = average;
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
