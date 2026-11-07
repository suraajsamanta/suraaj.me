import { circularDistance, clamp, ROAD_HALF_WIDTH, TRACK_LENGTH, wrap } from './track';

/** Original party-racing items. Only the host mutates these states. */
export type PowerUp = 'fizz' | 'guard' | 'slick' | 'bolt' | 'dance';
export const POWER_UPS: Record<PowerUp, { name: string; icon: string; color: string; description: string }> = {
  fizz: { name: 'Fizz Boost', icon: '↗', color: '#ffd364', description: 'A sparkling burst of speed. Clears a sticky slowdown.' },
  guard: { name: 'Foam Guard', icon: '◈', color: '#69eddd', description: 'A foamy shield that blocks the next item or obstacle hit.' },
  slick: { name: 'Citrus Slick', icon: '≈', color: '#b9ed72', description: 'Drop a slippery citrus puddle behind you.' },
  bolt: { name: 'Bubble Bolt', icon: '●', color: '#f8a6ef', description: 'Launch a bouncing bubble that chases the racer ahead.' },
  dance: { name: 'Dance Break', icon: '♪', color: '#ff8ddb', description: 'Hop out for a fabulous dance! You cannot drive for a few seconds.' },
};
export type KartPowerState = {
  item: PowerUp | null;
  shield: number;
  slow: number;
  flash: number;
  hitCooldown: number;
  /** Seconds left in the host-simulated self-inflicted dance break. */
  dance: number;
  /** High-water mark: repeated heartbeats and out-of-order packets never fire twice. */
  lastAction: number;
  collected: number;
  used: number;
};
export type ItemBox = { id: number; distance: number; lane: number; cooldown: number };
export type PowerHazard = { id: number; ownerId: string; distance: number; lane: number; life: number };
export type PowerProjectile = { id: number; ownerId: string; distance: number; lane: number; life: number };
export type PowerWorld = { boxes: ItemBox[]; hazards: PowerHazard[]; projectiles: PowerProjectile[]; nextId: number };

type PowerKart = {
  id: string; distance: number; lane: number; speed: number;
  boost: number; bump: number; finishTime: number | null; power: KartPowerState;
};
type PowerRace = { karts: PowerKart[]; powers: PowerWorld; countdown?: number; complete?: boolean };
type PowerPlayer = { id: string; input: { action?: number } };
export const ITEM_RESPAWN_SECONDS = 4.5;
export const DANCE_SECONDS = 3.5;
export const ITEM_BOX_FRACTIONS = [0.075, 0.31, 0.565, 0.86];
export const ITEM_BOX_LANES = [-4.2, 0, 4.2];

export function actionSequence(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
export function createPowerState(initialAction = 0): KartPowerState {
  return { item: null, shield: 0, slow: 0, flash: 0, hitCooldown: 0, dance: 0, lastAction: actionSequence(initialAction), collected: 0, used: 0 };
}
export function createPowerWorld(): PowerWorld {
  return {
    boxes: ITEM_BOX_FRACTIONS.flatMap((fraction, row) => ITEM_BOX_LANES.map((lane, column) => ({ id: row * 3 + column, distance: TRACK_LENGTH * fraction, lane, cooldown: 0 }))),
    hazards: [], projectiles: [], nextId: 1,
  };
}

/** A single shield charge also protects against the circuit's static obstacles. */
export function absorbPowerHit(kart: PowerKart): boolean {
  if (kart.power.shield <= 0) return false;
  kart.power.shield = 0;
  kart.power.flash = 0.55;
  kart.power.hitCooldown = 0.65;
  return true;
}
function hit(kart: PowerKart, strength: number): void {
  if (kart.finishTime !== null || kart.power.hitCooldown > 0 || absorbPowerHit(kart)) return;
  kart.speed *= strength;
  kart.boost = 0;
  kart.bump = Math.max(kart.bump, 0.35);
  kart.power.slow = Math.max(kart.power.slow, 1.7);
  kart.power.flash = 0.7;
  kart.power.hitCooldown = 0.85;
}
function activateItem(race: PowerRace, kart: PowerKart): void {
  const item = kart.power.item;
  if (!item || kart.finishTime !== null || kart.power.dance > 0) return;
  kart.power.item = null;
  kart.power.used++;
  kart.power.flash = 0.45;
  if (item === 'fizz') {
    kart.boost = Math.max(kart.boost, 2.6);
    kart.power.slow = 0;
    kart.speed = Math.min(58, kart.speed + 9);
  } else if (item === 'guard') {
    kart.power.shield = 8;
    kart.power.slow = 0;
  } else if (item === 'slick') {
    race.powers.hazards.push({ id: race.powers.nextId++, ownerId: kart.id, distance: wrap(kart.distance - 4), lane: clamp(kart.lane, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH), life: 9 });
  } else if (item === 'dance') {
    kart.power.dance = DANCE_SECONDS;
    kart.speed = 0;
    kart.boost = 0;
  } else {
    race.powers.projectiles.push({ id: race.powers.nextId++, ownerId: kart.id, distance: wrap(kart.distance + 3), lane: kart.lane, life: 4 });
  }
}

/** Run before driving physics. Movement inputs never activate an item. */
export function stepPowers(race: PowerRace, players: PowerPlayer[], dt: number): void {
  if (race.complete || (race.countdown ?? 0) > 0 || !Number.isFinite(dt) || dt <= 0) return;
  const step = Math.min(dt, 0.1);
  for (const box of race.powers.boxes) box.cooldown = Math.max(0, box.cooldown - step);
  for (const kart of race.karts) {
    kart.power.shield = Math.max(0, kart.power.shield - step);
    kart.power.slow = Math.max(0, kart.power.slow - step);
    kart.power.flash = Math.max(0, kart.power.flash - step);
    kart.power.hitCooldown = Math.max(0, kart.power.hitCooldown - step);
    kart.power.dance = Math.max(0, kart.power.dance - step);
    const sequence = actionSequence(players.find(player => player.id === kart.id)?.input.action);
    if (sequence > kart.power.lastAction) {
      // Consume empty presses too: a held/old packet must not auto-fire a later pickup.
      kart.power.lastAction = sequence;
      activateItem(race, kart);
    }
  }
  for (const hazard of race.powers.hazards) {
    hazard.life -= step;
    if (hazard.life <= 0) continue;
    for (const kart of race.karts) {
      if (kart.id !== hazard.ownerId && kart.finishTime === null && Math.abs(circularDistance(kart.distance, hazard.distance)) < 2.5 && Math.abs(kart.lane - hazard.lane) < 1.8) {
        hit(kart, 0.58);
        hazard.life = 0;
        break;
      }
    }
  }
  for (const projectile of race.powers.projectiles) {
    projectile.life -= step;
    if (projectile.life <= 0) continue;
    const ahead = race.karts.filter(kart => kart.id !== projectile.ownerId && kart.finishTime === null)
      .map(kart => ({ kart, gap: circularDistance(kart.distance, projectile.distance) }))
      .filter(({ gap }) => gap > -2 && gap < 65).sort((a, b) => a.gap - b.gap || a.kart.id.localeCompare(b.kart.id));
    // Slow homing is readable and dodgeable; steering still matters.
    if (ahead[0]) projectile.lane += clamp(ahead[0].kart.lane - projectile.lane, -4.5 * step, 4.5 * step);
    const travel = 72 * step;
    const target = ahead.find(({ kart, gap }) => gap <= travel + 1.8 && Math.abs(kart.lane - projectile.lane) < 1.65);
    projectile.distance = wrap(projectile.distance + travel);
    if (target) { hit(target.kart, 0.6); projectile.life = 0; }
  }
  race.powers.hazards = race.powers.hazards.filter(hazard => hazard.life > 0);
  race.powers.projectiles = race.powers.projectiles.filter(projectile => projectile.life > 0);
}

function itemFor(kart: PowerKart, box: ItemBox, karts: PowerKart[]): PowerUp {
  // Stable deterministic variety, with a small catch-up bias rather than a random winner.
  const rank = karts.filter(other => other.finishTime === null && other.distance > kart.distance).length;
  const choices: PowerUp[] = rank > 1 ? ['fizz', 'bolt', 'guard', 'fizz', 'slick', 'bolt', 'dance'] : ['fizz', 'guard', 'slick', 'bolt', 'dance'];
  let seed = box.id * 11 + kart.power.collected * 7;
  for (const char of kart.id) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return choices[seed % choices.length];
}
function crossesBox(from: number, to: number, box: ItemBox): boolean {
  const travel = to - from;
  return Math.abs(circularDistance(to, box.distance)) <= 2.2 ||
    (travel > 0 && wrap(box.distance - from) <= travel + 0.5);
}

/** Run after driving physics; swept collection also works across the lap boundary. */
export function collectPowerups(race: PowerRace, previousDistances: ReadonlyMap<string, number>): void {
  if (race.complete || (race.countdown ?? 0) > 0) return;
  for (const box of race.powers.boxes) {
    if (box.cooldown > 0) continue;
    const candidates = race.karts.filter(kart => kart.finishTime === null && kart.power.dance <= 0 && kart.power.item === null && Math.abs(kart.lane - box.lane) < 1.55 && crossesBox(previousDistances.get(kart.id) ?? kart.distance, kart.distance, box));
    // Resolve shared pickups by proximity, then stable ID, never roster iteration order.
    candidates.sort((a, b) => Math.abs(circularDistance(a.distance, box.distance)) - Math.abs(circularDistance(b.distance, box.distance)) || a.id.localeCompare(b.id));
    const kart = candidates[0];
    if (!kart) continue;
    kart.power.item = itemFor(kart, box, race.karts);
    kart.power.collected++;
    kart.power.flash = 0.55;
    box.cooldown = ITEM_RESPAWN_SECONDS;
  }
}
