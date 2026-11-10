import { ACTIVE_SHORTCUT, circularDistance, clamp, ROAD_HALF_WIDTH, SHORTCUT_LENGTH, TRACK_LENGTH, wrap } from './track';

/** Original party-racing items. Only the host mutates these states. */
export type PowerUp = 'fizz' | 'guard' | 'slick' | 'bolt' | 'dance' | 'flask' | 'prism' | 'splat' | 'jet' | 'crown' | 'lightning' | 'twerk' | 'diddy';
export const POWER_UPS: Record<PowerUp, { name: string; icon: string; color: string; description: string }> = {
  fizz: { name: 'Fizz Boost', icon: '↗', color: '#ffd364', description: 'A sparkling burst of speed. Clears a sticky slowdown.' },
  guard: { name: 'Foam Guard', icon: '◈', color: '#69eddd', description: 'A foamy shield that blocks the next item or obstacle hit.' },
  slick: { name: 'Citrus Slick', icon: '≈', color: '#b9ed72', description: 'Drop a slippery citrus puddle behind you.' },
  bolt: { name: 'Bubble Bolt', icon: '●', color: '#f8a6ef', description: 'Launch a bouncing bubble that chases the racer ahead.' },
  dance: { name: 'Dance Break', icon: '♪', color: '#ff8ddb', description: 'Make the racer immediately ahead in race order hop out and dance. A guard can block it.' },
  flask: { name: 'Fizz Flask', icon: '↟', color: '#ffb84d', description: 'Open a seven-second flask. Tap USE again for fresh bursts until it empties.' },
  prism: { name: 'Prism Party', icon: '✧', color: '#9ceaff', description: 'Six seconds of colorful speed and protection. You still steer.' },
  splat: { name: 'Berry Blot', icon: '✹', color: '#b77aff', description: 'Splash rivals’ views with berry foam. Fades in a few seconds.' },
  jet: { name: 'Jet Keg', icon: '➤', color: '#ff835d', description: 'A rear-pack rescue: protected automatic driving for up to five seconds. BRAKE cancels.' },
  crown: { name: 'Crown Comet', icon: '♜', color: '#7ebdff', description: 'Warn the leader, then send a comet after them. A guard can block it.' },
  lightning: { name: 'Storm Spark', icon: 'ϟ', color: '#a8dfff', description: 'Strike every other racer with lightning and slow them for 2.5 seconds. Guards and protection block it.' },
  diddy: { name: 'Diddy Mode', icon: '💧', color: '#ffe4a0', description: 'Splash every rival’s view with glossy baby oil for four seconds. Guards and protection block it.' },
  twerk: { name: 'Twerk Trap', icon: '♫', color: '#f7a7d8', description: 'Make the racer immediately behind in race order hop out and twerk. A guard can block it.' },
};
export type ItemNotice = { kind: 'pickup' | 'activate' | 'full'; item: PowerUp; remaining: number };
export type KartPowerState = {
  /** A readable item confirmation, independent of short collision flashes. */
  notice: ItemNotice | null;
  item: PowerUp | null;
  shield: number;
  slow: number;
  flash: number;
  hitCooldown: number;
  /** Seconds left in a host-simulated dance or twerk inflicted by a rival. */
  dance: number;
  danceStyle: 'dance' | 'twerk';
  /** A finite lightning slowdown, also used for the victim's visual effect. */
  lightning: number;
  /** Caster-owned event counter: audio plays once, including blocked strikes. */
  lightningStrikes: number;
  /** The reusable flask owns its inventory slot until this fixed window expires. */
  flask: number;
  flaskCooldown: number;
  prism: number;
  splatter: number;
  /** Host-owned visibility effect. Never changes driving inputs or covers the HUD. */
  oil: number;
  jet: number;
  leaderWarning: number;
  /** Short feedback shown only while flash is positive. */
  hitLabel: string;
  /** High-water mark: repeated heartbeats and out-of-order packets never fire twice. */
  lastAction: number;
  collected: number;
  used: number;
};
export type ItemBox = { id: number; distance: number; lane: number; cooldown: number };
export type PowerHazard = { id: number; ownerId: string; distance: number; lane: number; life: number; onShortcut?: boolean };
export type PowerProjectile = {
  id: number; ownerId: string; distance: number; lane: number; life: number;
  /** Omitted on older Bubble Bolts. Targeted comets never hit a bystander. */
  kind?: 'bolt' | 'crown'; targetId?: string; warning?: number;
  /** World route, retained independently of the owner's later route changes. */
  onShortcut?: boolean;
};
export type PowerWorld = { boxes: ItemBox[]; hazards: PowerHazard[]; projectiles: PowerProjectile[]; nextId: number };

type PowerKart = {
  id: string; distance: number; lane: number; speed: number; onShortcut?: boolean;
  fall?: { elapsed: number } | null; respawnGrace?: number;
  boost: number; bump: number; finishTime: number | null; power: KartPowerState;
};
type PowerRace = { karts: PowerKart[]; powers: PowerWorld; countdown?: number; complete?: boolean; laps?: number };
type PowerPlayer = { id: string; connected?: boolean; input: { action?: number; brake?: boolean } };
export const ITEM_RESPAWN_SECONDS = 4.5;
export const ITEM_NOTICE_SECONDS = 2;
export const ITEM_BURST_SECONDS = 0.5;
// Combined kart/rotating-box footprint. Adjacent lanes remain separate at 4.2m.
export const ITEM_PICKUP_HALF_WIDTH = 1.95;
export const ITEM_PICKUP_HALF_LENGTH = 2.2;
export const DANCE_SECONDS = 3.5;
export const LIGHTNING_SECONDS = 2.5;
export const FLASK_SECONDS = 7;
export const FLASK_PULSE_SECONDS = 1;
export const FLASK_COOLDOWN_SECONDS = 0.35;
export const PRISM_SECONDS = 6;
export const SPLATTER_SECONDS = 3.5;
export const OIL_SECONDS = 4;
export const JET_SECONDS = 5;
export const JET_MAX_SPEED = 64;
export const CROWN_WARNING_SECONDS = 1.25;
export const ITEM_BOX_FRACTIONS = [0.075, 0.31, 0.565, 0.86];
export const ITEM_BOX_LANES = [-4.2, 0, 4.2];

export function actionSequence(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
export function createPowerState(initialAction = 0): KartPowerState {
  return {
    notice: null, item: null, shield: 0, slow: 0, flash: 0, hitCooldown: 0, dance: 0, danceStyle: 'dance', lightning: 0, lightningStrikes: 0,
    flask: 0, flaskCooldown: 0, prism: 0, splatter: 0, oil: 0, jet: 0, leaderWarning: 0, hitLabel: '',
    lastAction: actionSequence(initialAction), collected: 0, used: 0,
  };
}
export function createPowerWorld(): PowerWorld {
  return {
    boxes: ITEM_BOX_FRACTIONS.flatMap((fraction, row) => ITEM_BOX_LANES.map((lane, column) => ({ id: row * 3 + column, distance: TRACK_LENGTH * fraction, lane, cooldown: 0 }))),
    hazards: [], projectiles: [], nextId: 1,
  };
}

export function itemNoticeText(notice: ItemNotice): string {
  return notice.kind === 'full' ? 'Use your held item first' : `${POWER_UPS[notice.item].name} ${notice.kind === 'pickup' ? 'collected!' : 'activated!'}`;
}
function itemNotice(kart: PowerKart, item: PowerUp, kind: ItemNotice['kind']): void {
  // Using an item at a box may collect the next one in the very same tick.
  // Keep the fresh activation readable; inventory and the box burst show pickup.
  if (kind === 'pickup' && kart.power.notice?.kind === 'activate' && kart.power.notice.remaining > ITEM_NOTICE_SECONDS - 0.35) return;
  kart.power.notice = { kind, item, remaining: ITEM_NOTICE_SECONDS };
}

/** Driving code consumes these host-owned effects without inventing a second timer. */
export function powerDrivingState(kart: PowerKart): { autoDrive: boolean; maximumSpeed: number | null; acceleration: number | null; collisionImmune: boolean } {
  const jet = kart.power.jet > 0 && kart.finishTime === null && kart.power.dance <= 0;
  const prism = kart.power.prism > 0 && kart.finishTime === null;
  return { autoDrive: jet, maximumSpeed: jet ? JET_MAX_SPEED : prism ? 58 : null, acceleration: jet ? 28 : prism ? 23 : null, collisionImmune: jet || prism };
}
function feedback(kart: PowerKart, label: string, seconds = 0.7): void {
  kart.power.hitLabel = label;
  kart.power.flash = Math.max(kart.power.flash, seconds);
}
/** Prism/jet protection persists; a foam guard absorbs one hit. Also used by track obstacles. */
export function absorbPowerHit(kart: PowerKart): boolean {
  if (powerDrivingState(kart).collisionImmune) {
    feedback(kart, 'Protected', 0.35);
    return true;
  }
  if (kart.power.shield <= 0) return false;
  kart.power.shield = 0;
  feedback(kart, 'Guard blocked it', 0.55);
  kart.power.hitCooldown = 0.65;
  return true;
}
export const canInteract = (kart: Pick<PowerKart, 'fall' | 'respawnGrace'>) => !kart.fall && !(kart.respawnGrace && kart.respawnGrace > 0);

function hit(kart: PowerKart, strength: number, label: string): void {
  if (!canInteract(kart) || kart.finishTime !== null || kart.power.hitCooldown > 0 || absorbPowerHit(kart)) return;
  kart.speed *= strength;
  kart.boost = 0;
  kart.bump = Math.max(kart.bump, 0.35);
  kart.power.slow = Math.max(kart.power.slow, 1.7);
  feedback(kart, label);
  kart.power.hitCooldown = 0.85;
}
type RankedKart = { id: string; distance: number; finishTime: number | null };
function runningByProgress<T extends RankedKart>(karts: T[]): T[] {
  // Absolute progress, not wrapped visual position: being lapped cannot look like leading.
  return karts.filter(kart => kart.finishTime === null)
    .sort((a, b) => b.distance - a.distance || a.id.localeCompare(b.id));
}
/** Race order includes lap progress and fair shortcut progress, not wrapped proximity. */
function adjacentRacer<T extends RankedKart>(kart: T, karts: T[], direction: -1 | 1, activeIds?: ReadonlySet<string>): T | undefined {
  const ranked = runningByProgress(activeIds ? karts.filter(other => activeIds.has(other.id)) : karts);
  const index = ranked.findIndex(other => other.id === kart.id);
  return index < 0 ? undefined : ranked[index + direction];
}
export function racerAhead<T extends RankedKart>(kart: T, karts: T[], activeIds?: ReadonlySet<string>): T | undefined {
  return adjacentRacer(kart, karts, -1, activeIds);
}
export function racerBehind<T extends RankedKart>(kart: T, karts: T[], activeIds?: ReadonlySet<string>): T | undefined {
  return adjacentRacer(kart, karts, 1, activeIds);
}
function forceDance(target: PowerKart, style: 'dance' | 'twerk'): void {
  if (!canInteract(target) || target.power.hitCooldown > 0 || absorbPowerHit(target)) return;
  target.power.dance = DANCE_SECONDS;
  target.power.danceStyle = style;
  target.speed = 0;
  target.boost = 0;
  // The whole animation plus a brief return-to-driving grace prevents stun chains.
  target.power.hitCooldown = DANCE_SECONDS + 0.5;
  feedback(target, style === 'twerk' ? 'Twerk Trap!' : 'Dance Break!', DANCE_SECONDS);
}
function lightningHit(target: PowerKart): void {
  if (!canInteract(target) || target.power.hitCooldown > 0 || absorbPowerHit(target)) return;
  target.speed *= 0.5;
  target.boost = 0;
  target.bump = Math.max(target.bump, 0.35);
  target.power.lightning = LIGHTNING_SECONDS;
  target.power.slow = Math.max(target.power.slow, LIGHTNING_SECONDS);
  target.power.hitCooldown = LIGHTNING_SECONDS + 0.5;
  feedback(target, 'Storm Spark!', 0.85);
}
function rearPack(kart: PowerKart, karts: PowerKart[]): boolean {
  const ranked = runningByProgress(karts);
  return ranked.length > 1 && ranked.findIndex(other => other.id === kart.id) >= Math.ceil(ranked.length / 2);
}
function endJet(kart: PowerKart, label = 'Take the wheel'): void {
  kart.power.jet = 0;
  kart.speed = Math.min(kart.speed, 43);
  feedback(kart, label, 0.6);
}
function flaskPulse(kart: PowerKart): void {
  if (kart.power.flaskCooldown > 0) return;
  kart.boost = Math.max(kart.boost, Math.min(FLASK_PULSE_SECONDS, kart.power.flask));
  kart.power.flaskCooldown = FLASK_COOLDOWN_SECONDS;
  kart.power.slow = 0;
  kart.power.lightning = 0;
  kart.speed = Math.min(58, kart.speed + 6);
  feedback(kart, 'Fizz Flask boost', 0.35);
}
type PowerSegment = { distance: number; travel: number; onShortcut: boolean };
const routeScale = (onShortcut?: boolean) => onShortcut ? TRACK_LENGTH * (ACTIVE_SHORTCUT.end - ACTIVE_SHORTCUT.start) / SHORTCUT_LENGTH : 1;
const sameRoute = (a: { onShortcut?: boolean }, b: { onShortcut?: boolean }) => Boolean(a.onShortcut) === Boolean(b.onShortcut);

/** Travel real metres, splitting the sweep at the branch's physical merge. */
function advanceProjectile(projectile: Pick<PowerProjectile, 'distance' | 'onShortcut'>, metres: number): PowerSegment[] {
  const segments: PowerSegment[] = [];
  if (projectile.onShortcut) {
    const scale = routeScale(true);
    const exit = ACTIVE_SHORTCUT.end * TRACK_LENGTH;
    const toExit = Math.max(0, exit - wrap(projectile.distance)) / scale;
    const branchTravel = Math.min(metres, toExit);
    if (branchTravel > 0) segments.push({ distance: projectile.distance, travel: branchTravel, onShortcut: true });
    projectile.distance = wrap(projectile.distance + branchTravel * scale);
    metres -= branchTravel;
    if (branchTravel >= toExit) { projectile.onShortcut = false; projectile.distance = exit; }
  }
  if (!projectile.onShortcut && metres > 0) {
    segments.push({ distance: projectile.distance, travel: metres, onShortcut: false });
    projectile.distance = wrap(projectile.distance + metres);
  }
  return segments;
}
function spawnProjectile(race: PowerRace, kart: PowerKart, kind: 'bolt' | 'crown', targetId?: string): void {
  const projectile: PowerProjectile = {
    id: race.powers.nextId++, ownerId: kart.id, distance: wrap(kart.distance), lane: kart.lane,
    life: kind === 'crown' ? 12 + CROWN_WARNING_SECONDS : 4, kind, onShortcut: kart.onShortcut === true,
    ...(kind === 'crown' ? { targetId, warning: CROWN_WARNING_SECONDS } : {}),
  };
  advanceProjectile(projectile, 3);
  race.powers.projectiles.push(projectile);
}

function activateItem(race: PowerRace, kart: PowerKart, activeIds: ReadonlySet<string>, braking: boolean): void {
  let item = kart.power.item;
  if (!item || !canInteract(kart) || kart.finishTime !== null) return;
  if (item === 'flask' && kart.power.flask > 0) { flaskPulse(kart); return; }
  const activeKarts = race.karts.filter(other => activeIds.has(other.id) && canInteract(other));
  const danceTarget = item === 'dance' ? racerAhead(kart, activeKarts) : item === 'twerk' ? racerBehind(kart, activeKarts) : undefined;
  if ((item === 'dance' || item === 'twerk') && !danceTarget) {
    feedback(kart, item === 'dance' ? 'No racer ahead' : 'No racer behind');
    return; // Keep the item, but the input sequence is already consumed.
  }
  if ((item === 'lightning' || item === 'diddy') && !activeKarts.some(other => other.id !== kart.id && other.finishTime === null)) {
    feedback(kart, item === 'diddy' ? 'No rivals to oil' : 'No rivals to strike');
    return;
  }
  // A saved rear-pack item never becomes a free autopilot for a leader. Keep the
  // pickup useful as an ordinary boost if the pack changes before it is used.
  if (item === 'jet' && (braking || !rearPack(kart, activeKarts) || kart.distance >= TRACK_LENGTH * (race.laps ?? 3) - 24)) item = 'fizz';
  const leader = runningByProgress(activeKarts)[0];
  if (item === 'crown' && (!leader || leader.id === kart.id)) item = 'guard';
  kart.power.item = item === 'flask' ? 'flask' : null;
  kart.power.used++;
  itemNotice(kart, item, 'activate');
  if (item === 'fizz') {
    kart.boost = Math.max(kart.boost, 2.6);
    kart.power.slow = 0;
    kart.power.lightning = 0;
    kart.speed = Math.min(58, kart.speed + 9);
  } else if (item === 'guard') {
    kart.power.shield = 8;
    kart.power.slow = 0;
    kart.power.lightning = 0;
  } else if (item === 'slick') {
    const behind = wrap(kart.distance) - 4 * routeScale(kart.onShortcut);
    race.powers.hazards.push({ id: race.powers.nextId++, ownerId: kart.id, distance: kart.onShortcut ? Math.max(ACTIVE_SHORTCUT.start * TRACK_LENGTH, behind) : wrap(behind), lane: clamp(kart.lane, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH), life: 9, onShortcut: kart.onShortcut === true });
  } else if ((item === 'dance' || item === 'twerk') && danceTarget) {
    forceDance(danceTarget, item);
  } else if (item === 'lightning') {
    kart.power.lightningStrikes = (kart.power.lightningStrikes ?? 0) + 1;
    for (const rival of runningByProgress(activeKarts)) {
      if (rival.id !== kart.id) lightningHit(rival);
    }
  } else if (item === 'flask') {
    kart.power.flask = FLASK_SECONDS;
    kart.power.flaskCooldown = 0;
    flaskPulse(kart);
  } else if (item === 'prism') {
    kart.power.prism = PRISM_SECONDS;
    kart.power.slow = 0;
    kart.power.lightning = 0;
    kart.power.splatter = 0;
    kart.power.oil = 0;
    kart.boost = Math.max(kart.boost, 0.2);
  } else if (item === 'splat') {
    for (const rival of runningByProgress(activeKarts)) {
      if (rival.id === kart.id || absorbPowerHit(rival)) continue;
      rival.power.splatter = SPLATTER_SECONDS;
      feedback(rival, 'Berry Blot!', 0.65);
    }
  } else if (item === 'diddy') {
    for (const rival of runningByProgress(activeKarts)) {
      if (rival.id === kart.id || absorbPowerHit(rival)) continue;
      rival.power.oil = OIL_SECONDS;
      feedback(rival, 'Diddy Mode! Baby oil!', 0.85);
    }
  } else if (item === 'jet') {
    kart.power.jet = JET_SECONDS;
    kart.power.slow = 0;
    kart.power.lightning = 0;
    kart.power.splatter = 0;
    kart.power.oil = 0;
    kart.boost = 0;
  } else if (item === 'crown' && leader) {
    spawnProjectile(race, kart, 'crown', leader.id);
    leader.power.leaderWarning = CROWN_WARNING_SECONDS;
    feedback(leader, 'Crown Comet incoming', 0.8);
  } else {
    spawnProjectile(race, kart, 'bolt');
  }
}

/** Run before driving physics. Movement inputs never activate an item. */
export function stepPowers(race: PowerRace, players: PowerPlayer[], dt: number): void {
  if (race.complete || (race.countdown ?? 0) > 0 || !Number.isFinite(dt) || dt <= 0) return;
  const step = Math.min(dt, 0.1);
  const activePlayers = new Map(players.filter(player => player.connected !== false).map(player => [player.id, player]));
  const activeIds = new Set(activePlayers.keys());
  const activeKarts = race.karts.filter(kart => activeIds.has(kart.id) && canInteract(kart));
  const pending: { kart: PowerKart; player: PowerPlayer }[] = [];
  for (const box of race.powers.boxes) box.cooldown = Math.max(0, box.cooldown - step);
  for (const kart of race.karts) {
    if (kart.power.notice) {
      kart.power.notice.remaining = Math.max(0, kart.power.notice.remaining - step);
      if (kart.power.notice.remaining === 0) kart.power.notice = null;
    }
    kart.power.shield = Math.max(0, kart.power.shield - step);
    kart.power.slow = Math.max(0, kart.power.slow - step);
    kart.power.flash = Math.max(0, kart.power.flash - step);
    kart.power.hitCooldown = Math.max(0, kart.power.hitCooldown - step);
    kart.power.dance = Math.max(0, kart.power.dance - step);
    kart.power.lightning = Math.max(0, (kart.power.lightning ?? 0) - step);
    const hadFlask = kart.power.flask > 0;
    kart.power.flask = Math.max(0, kart.power.flask - step);
    kart.power.flaskCooldown = Math.max(0, kart.power.flaskCooldown - step);
    kart.power.prism = Math.max(0, kart.power.prism - step);
    kart.power.splatter = Math.max(0, kart.power.splatter - step);
    kart.power.oil = Math.max(0, (kart.power.oil ?? 0) - step);
    kart.power.leaderWarning = Math.max(0, kart.power.leaderWarning - step);
    if (hadFlask && kart.power.flask <= 0 && kart.power.item === 'flask') kart.power.item = null;
    const player = activePlayers.get(kart.id);
    if (kart.power.jet > 0) {
      kart.power.jet = Math.max(0, kart.power.jet - step);
      const leading = runningByProgress(activeKarts)[0]?.id === kart.id;
      const nearFinish = kart.distance >= TRACK_LENGTH * (race.laps ?? 3) - 24;
      if (kart.power.jet <= 0 || !player || player.input.brake || kart.finishTime !== null || kart.power.dance > 0 || leading || nearFinish) endJet(kart);
    }
    if (kart.power.prism > 0 && kart.finishTime === null) kart.boost = Math.max(kart.boost, 0.2);
    const sequence = actionSequence(players.find(other => other.id === kart.id)?.input.action);
    if (sequence > kart.power.lastAction) {
      // Consume empty/blocked presses too. Neither a stale heartbeat nor a press
      // during an automatic transformation may activate a later pickup.
      kart.power.lastAction = sequence;
      // Capture eligibility before resolving this tick's attacks. Simultaneous
      // fresh presses cannot be cancelled solely by the attacker's ID ordering.
      if (player && kart.power.item && !canInteract(kart)) feedback(kart, 'Wait until back on track', 0.8);
      if (player && canInteract(kart) && kart.finishTime === null && kart.power.dance <= 0 && kart.power.jet <= 0) pending.push({ kart, player });
    }
  }
  // Simultaneous defenses resolve before attacks, then stable IDs break ties.
  // Reordering a room roster must not decide who gets protected from a splash.
  const priority = (kart: PowerKart) => ['guard', 'prism', 'jet'].includes(kart.power.item ?? '') ? 0 : ['splat', 'diddy', 'dance', 'twerk', 'lightning'].includes(kart.power.item ?? '') ? 2 : 1;
  pending.sort((a, b) => priority(a.kart) - priority(b.kart) || a.kart.id.localeCompare(b.kart.id));
  for (const { kart, player } of pending) activateItem(race, kart, activeIds, player.input.brake === true);
  for (const hazard of race.powers.hazards) {
    hazard.life -= step;
    if (hazard.life <= 0) continue;
    const targets = race.karts.filter(kart => kart.id !== hazard.ownerId && canInteract(kart) && kart.finishTime === null && sameRoute(kart, hazard) && Math.abs(circularDistance(kart.distance, hazard.distance)) / routeScale(hazard.onShortcut) < 2.5 && Math.abs(kart.lane - hazard.lane) < 1.8)
      .sort((a, b) => Math.abs(circularDistance(a.distance, hazard.distance)) - Math.abs(circularDistance(b.distance, hazard.distance)) || a.id.localeCompare(b.id));
    if (targets[0]) { hit(targets[0], 0.58, 'Citrus Slick!'); hazard.life = 0; }
  }
  for (const projectile of race.powers.projectiles) {
    projectile.life -= step;
    if (projectile.life <= 0) continue;
    if (projectile.kind === 'crown') {
      const target = race.karts.find(kart => kart.id === projectile.targetId && canInteract(kart) && kart.finishTime === null && activeIds.has(kart.id));
      if (!target) { projectile.life = 0; continue; }
      target.power.leaderWarning = Math.max(target.power.leaderWarning, 0.2);
      if ((projectile.warning ?? 0) > 0) {
        projectile.warning = Math.max(0, (projectile.warning ?? 0) - step);
        continue;
      }
      if (sameRoute(target, projectile)) projectile.lane += clamp(target.lane - projectile.lane, -14 * step, 14 * step);
      const segments = advanceProjectile(projectile, 102 * step);
      if (segments.some(segment => sameRoute(target, segment) && wrap(target.distance - segment.distance) / routeScale(segment.onShortcut) <= segment.travel + 2 && Math.abs(target.lane - projectile.lane) < 1.9)) {
        hit(target, 0.5, 'Crown Comet hit!');
        projectile.life = 0;
      }
      continue;
    }
    const candidates = race.karts.filter(kart => kart.id !== projectile.ownerId && canInteract(kart) && kart.finishTime === null);
    const ahead = candidates.filter(kart => sameRoute(kart, projectile))
      .map(kart => ({ kart, gap: circularDistance(kart.distance, projectile.distance) / routeScale(projectile.onShortcut) }))
      .filter(({ gap }) => gap > -2 && gap < 65).sort((a, b) => a.gap - b.gap || a.kart.id.localeCompare(b.kart.id));
    // Slow homing is readable and dodgeable; steering still matters. A racer on
    // another road never attracts or collides with the visible projectile.
    if (ahead[0]) projectile.lane += clamp(ahead[0].kart.lane - projectile.lane, -4.5 * step, 4.5 * step);
    for (const segment of advanceProjectile(projectile, 72 * step)) {
      const target = candidates.filter(kart => sameRoute(kart, segment))
        .map(kart => ({ kart, gap: circularDistance(kart.distance, segment.distance) / routeScale(segment.onShortcut) }))
        .filter(({ kart, gap }) => gap > -2 && gap <= segment.travel + 1.8 && Math.abs(kart.lane - projectile.lane) < 1.65)
        .sort((a, b) => a.gap - b.gap || a.kart.id.localeCompare(b.kart.id))[0];
      if (target) { hit(target.kart, 0.6, 'Bubble Bolt hit!'); projectile.life = 0; break; }
    }
  }
  race.powers.hazards = race.powers.hazards.filter(hazard => hazard.life > 0);
  race.powers.projectiles = race.powers.projectiles.filter(projectile => projectile.life > 0);
}

function itemFor(kart: PowerKart, box: ItemBox, karts: PowerKart[]): PowerUp {
  // Stable deterministic variety. Powerful catch-up items are rear-pack only;
  // all rank decisions use total multi-lap distance, not physical proximity.
  const ranked = runningByProgress(karts);
  const rank = ranked.findIndex(other => other.id === kart.id);
  // Solo practice (or the sole remaining active racer) must never receive an
  // attack that needs a rival. Otherwise no-target retention locks inventory.
  const choices: PowerUp[] = ranked.length < 2 ? ['fizz', 'guard', 'flask', 'prism'] : rearPack(kart, karts)
    ? ['fizz', 'guard', 'bolt', 'flask', 'flask', 'prism', 'splat', 'jet', 'crown', 'dance', 'slick', 'lightning', 'twerk', 'diddy']
    : rank > 0 ? ['fizz', 'guard', 'slick', 'bolt', 'dance', 'flask', 'prism', 'splat', 'crown', 'twerk', 'diddy']
      : ['fizz', 'guard', 'slick', 'bolt', 'dance', 'flask', 'prism', 'splat', 'twerk', 'diddy'];
  let seed = box.id * 11 + kart.power.collected * 7;
  for (const char of kart.id) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  // Mix before reducing: correlated box rows and pickup counts must not lock
  // a driver into a tiny subset when an item pool has an even size.
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0;
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0;
  seed = (seed ^ (seed >>> 16)) >>> 0;
  return choices[seed % choices.length];
}
/** Contact time for the entire 2D driving segment, not just the final lane.
 * Intersect both axis intervals so a diagonal near-miss cannot collect remotely.
 */
function boxContact(from: number, to: number, fromLane: number, toLane: number, box: ItemBox): number | null {
  const target = circularDistance(box.distance, from);
  let enter = 0, exit = 1;
  for (const [offset, travel, radius] of [[target, to - from, ITEM_PICKUP_HALF_LENGTH], [box.lane - fromLane, toLane - fromLane, ITEM_PICKUP_HALF_WIDTH]]) {
    if (Math.abs(travel) < 1e-9) {
      if (Math.abs(offset) > radius) return null;
      continue;
    }
    const a = (offset - radius) / travel, b = (offset + radius) / travel;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return null;
  }
  return enter;
}

/** Run after driving physics; swept collection also works across the lap boundary. */
export function collectPowerups(race: PowerRace, previousDistances: ReadonlyMap<string, number>, activeIds?: ReadonlySet<string>, previousRoutes?: ReadonlyMap<string, boolean>, previousLanes?: ReadonlyMap<string, number>): void {
  if (race.complete || (race.countdown ?? 0) > 0) return;
  const activeKarts = activeIds ? race.karts.filter(kart => activeIds.has(kart.id) && canInteract(kart)) : race.karts;
  for (const box of race.powers.boxes) {
    if (box.cooldown > 0) continue;
    const contacts = activeKarts.filter(kart => canInteract(kart) && !kart.onShortcut && !previousRoutes?.get(kart.id) && kart.finishTime === null && kart.power.dance <= 0 && kart.power.jet <= 0)
      .map(kart => ({ kart, contact: boxContact(previousDistances.get(kart.id) ?? kart.distance, kart.distance, previousLanes?.get(kart.id) ?? kart.lane, kart.lane, box) }))
      .filter((entry): entry is { kart: PowerKart; contact: number } => entry.contact !== null);
    for (const { kart, contact } of contacts) {
      // A full slot never replaces an item or consumes another driver's box.
      // Explain a new crossing, without renewing a notice while parked inside it.
      if (kart.power.item && contact > 0 && !kart.power.notice) itemNotice(kart, kart.power.item, 'full');
    }
    const candidates = contacts.filter(({ kart }) => kart.power.item === null);
    // Earliest actual contact wins; proximity and stable ID break simultaneous ties.
    candidates.sort((a, b) => a.contact - b.contact || Math.abs(circularDistance(a.kart.distance, box.distance)) - Math.abs(circularDistance(b.kart.distance, box.distance)) || a.kart.id.localeCompare(b.kart.id));
    const kart = candidates[0]?.kart;
    if (!kart) continue;
    kart.power.item = itemFor(kart, box, activeKarts);
    kart.power.collected++;
    itemNotice(kart, kart.power.item, 'pickup');
    box.cooldown = ITEM_RESPAWN_SECONDS;
  }
}
