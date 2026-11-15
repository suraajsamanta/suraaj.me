"use client";

import { PartyClient, type PartyAction, type PartySnapshot } from '../shared/party-client';
import type { CarState, DriveInput, createDrivingWorld } from './drive';

export const BEERIO2_PROTOCOL = 'madfun-beerio-2-v1';
export const INPUT_TTL_MS = 450;
export const TOTAL_LAPS = 3;
export const RACE_MAX_SECONDS = 600;
export const FINISH_GRACE_SECONDS = 60;
export type Beerio2Phase = 'lobby' | 'countdown' | 'race' | 'paused' | 'results';
export type Beerio2Player = { id: string; name: string; color: string; connected: boolean; ready: boolean };
export type Beerio2Result = { id: string; name: string; time: number | null };
export type Beerio2Frame = {
  protocol: typeof BEERIO2_PROTOCOL; raceId: number; tick: number; phase: Beerio2Phase;
  countdown: number; elapsed: number; totalLaps: 3; players: Beerio2Player[];
  cars: Record<string, CarState>; results: Beerio2Result[]; rejected: string[];
};
export type RaceView = { id: string; getFrame: () => Readonly<Beerio2Frame> | null; setInput: (input: DriveInput) => void };
export type Beerio2Snapshot = {
  status: PartySnapshot['status']; role: 'host' | 'player' | null; code: string | null;
  playerId: string | null; players: Beerio2Player[]; phase: Beerio2Phase; countdown: number;
  hostConnected: boolean; error: string | null; loading: boolean;
};
type DrivingWorld = Awaited<ReturnType<typeof createDrivingWorld>>;
type Driver = ReturnType<DrivingWorld['spawn']>;
type ReceivedInput = { input: DriveInput; received: number; seq: number; stream: string };
type Options = { url?: string; client?: PartyClient; now?: () => number; createWorld?: () => Promise<DrivingWorld>; autoTick?: boolean };
const colors = ['#38bdf8', '#f97316', '#a78bfa', '#22c55e', '#f472b6', '#facc15', '#2dd4bf', '#fb7185', '#c084fc', '#e2e8f0'];
const neutral = (): DriveInput => ({ steer: 0, throttle: false, brake: false, drift: false, reset: false });
const initial = (): Beerio2Snapshot => ({ status: 'idle', role: null, code: null, playerId: null, players: [], phase: 'lobby', countdown: 0, hostConnected: false, error: null, loading: false });
const object = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const validId = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x);
const phases = new Set(['lobby', 'countdown', 'race', 'paused', 'results']);
const streamId = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

/** Strict boundary: never trust a controller's positions, clock, lap, identity or input shape. */
export function validateInput(value: unknown): DriveInput | null {
  if (!object(value) || !finite(value.steer) || Math.abs(value.steer) > 1) return null;
  if (!['throttle', 'brake', 'drift', 'reset'].every(k => typeof value[k] === 'boolean')) return null;
  return { steer: value.steer, throttle: value.throttle as boolean, brake: value.brake as boolean, drift: value.drift as boolean, reset: value.reset as boolean };
}
function validCar(value: unknown): value is CarState {
  if (!object(value)) return false;
  if (!['x', 'y', 'z', 'yaw', 'facing', 'pitch', 'steer', 'speed', 'lap', 'seconds', 'progress'].every(k => finite(value[k]))) return false;
  return typeof value.boost === 'boolean' && typeof value.finished === 'boolean' &&
    (value.best === null || finite(value.best)) && (value.finishTime === null || finite(value.finishTime));
}
export function validateFrame(value: unknown): value is Beerio2Frame {
  if (!object(value) || value.protocol !== BEERIO2_PROTOCOL || value.totalLaps !== TOTAL_LAPS ||
    !Number.isSafeInteger(value.raceId) || (value.raceId as number) < 0 || !Number.isSafeInteger(value.tick) || (value.tick as number) < 0 ||
    typeof value.phase !== 'string' || !phases.has(value.phase) || !finite(value.elapsed) || value.elapsed < 0 ||
    !finite(value.countdown) || value.countdown < 0 || value.countdown > 3 || !object(value.cars) ||
    !Array.isArray(value.players) || value.players.length < 1 || value.players.length > 10 ||
    !Array.isArray(value.results) || value.results.length > 10 || !Array.isArray(value.rejected) || value.rejected.length > 10) return false;
  const ids = new Set<string>();
  for (const p of value.players) {
    if (!object(p) || !validId(p.id) || ids.has(p.id) || typeof p.name !== 'string' || p.name.length > 128 ||
      typeof p.color !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(p.color) || typeof p.connected !== 'boolean' || typeof p.ready !== 'boolean') return false;
    ids.add(p.id);
  }
  if (!ids.has('host') || Object.keys(value.cars).length > 10 || !Object.entries(value.cars).every(([id, c]) => ids.has(id) && validCar(c))) return false;
  return value.results.every(r => object(r) && ids.has(r.id as string) && typeof r.name === 'string' && (r.time === null || (finite(r.time) && r.time >= 0))) && value.rejected.every(validId);
}

/** One private Party room per instance. No legacy Beerio socket, storage key or protocol is used. */
export class Beerio2Session {
  private client: PartyClient;
  private now: () => number;
  private createWorld: () => Promise<DrivingWorld>;
  private snapshot = initial();
  private listeners = new Set<() => void>();
  private frame: Beerio2Frame | null = null;
  private world: DrivingWorld | null = null;
  private drivers = new Map<string, Driver>();
  private inputs = new Map<string, ReceivedInput>();
  private accepted = new Map<string, string>();
  private sequences = new Map<string, number>();
  private localInput = neutral();
  private inputAt = 0;
  private stream = '';
  private seq = 0;
  private raceId = 0;
  private tick = 0;
  private elapsed = 0;
  private countdownLeft = 0;
  private finishDeadline = RACE_MAX_SECONDS;
  private pausedPhase: 'countdown' | 'race' = 'race';
  private lastTick = 0;
  private accumulator = 0;
  private lastPublish = -Infinity;
  private lastInput = -Infinity;
  private lastHello = -Infinity;
  private lastFrame = 0;
  private verified = false;
  private connectedAt = 0;
  private hostName = 'Host';
  private generation = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribes: Array<() => void>;
  private autoTick: boolean;

  constructor(options: Options = {}) {
    this.client = options.client ?? new PartyClient(options.url); // Do not borrow Simulator's persisted seat.
    this.now = options.now ?? (() => performance.now());
    this.createWorld = options.createWorld ?? (async () => (await import('./drive')).createDrivingWorld());
    this.autoTick = options.autoTick !== false;
    this.unsubscribes = [this.client.subscribe(this.onRoom), this.client.onAction(this.onAction), this.client.onState(this.onState)];
  }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snapshot;
  getFrame = (): Readonly<Beerio2Frame> | null => this.frame;
  private update(patch: Partial<Beerio2Snapshot>) {
    const next = { ...this.snapshot, ...patch };
    if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
    this.snapshot = next;
    this.listeners.forEach(fn => fn());
  }
  private run() {
    this.lastTick = this.now();
    if (!this.timer && this.autoTick) this.timer = setInterval(this.advance, 1000 / 60);
  }
  create = (name = 'Host') => {
    this.leave();
    this.hostName = name.trim().slice(0, 64) || 'Host';
    this.update({ role: 'host', loading: true });
    this.run();
    this.client.create('simulator');
    const generation = this.generation;
    void this.createWorld().then(world => {
      if (generation !== this.generation) { world.dispose(); return; }
      this.world = world;
      this.update({ loading: false });
      this.syncDrivers();
      this.publish(true);
    }).catch(() => { if (generation === this.generation) this.fail('Could not start the driving physics. Please create a new room.'); });
  };
  join = (code: string, name: string) => {
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code.trim().toUpperCase()) || !name.trim() || Array.from(name.trim()).length > 64 || /[\p{Cc}\p{Cf}]/u.test(name)) {
      this.update({ error: 'Enter a name (up to 64 characters) and the six-character room code.' }); return;
    }
    this.leave();
    this.update({ role: 'player' });
    this.run();
    this.client.join(code, name.trim(), 'simulator');
  };
  private onRoom = () => {
    const room = this.client.getSnapshot();
    if (room.status === 'idle') return;
    const wasConnected = this.snapshot.status === 'connected';
    const host = room.role === 'host';
    if (room.status !== 'connected' || !room.hostConnected) {
      this.localInput = neutral(); this.inputs.clear();
      if (this.snapshot.phase === 'race' || this.snapshot.phase === 'countdown') {
        this.pausedPhase = this.snapshot.phase;
        this.update({ phase: 'paused', countdown: 0 });
        if (this.frame) this.frame = { ...this.frame, phase: 'paused', countdown: 0 };
      }
    }
    if (!wasConnected && room.status === 'connected') {
      this.connectedAt = this.now(); this.lastHello = -Infinity;
      this.stream = streamId(); this.seq = 0;
      if (!host && !this.frame) this.verified = false;
    }
    this.update({ status: room.status, role: host ? 'host' : room.role === 'player' ? 'player' : null,
      playerId: host ? 'host' : room.playerId, code: room.code, hostConnected: room.hostConnected, error: room.error });
    if (host) {
      const known = new Set(room.players.map(p => p.id));
      for (const id of this.accepted.keys()) if (!known.has(id)) this.accepted.delete(id);
      for (const p of room.players) if (!p.connected) this.inputs.delete(p.id);
      this.syncPlayers();
      this.syncDrivers();
      this.publish(true);
    }
  };
  private syncPlayers() {
    const room = this.client.getSnapshot();
    if (this.snapshot.phase !== 'lobby') {
      this.update({ players: this.snapshot.players.map(p => ({ ...p, connected: p.id === 'host' ? room.status === 'connected' : room.players.some(member => member.id === p.id && member.connected) })) });
      return;
    }
    const players: Beerio2Player[] = [{ id: 'host', name: this.hostName, color: colors[0], connected: room.status === 'connected', ready: true }];
    for (const p of room.players) {
      if (!this.accepted.has(p.id)) continue;
      players.push({ ...p, color: colors[players.length], ready: true });
    }
    this.update({ players });
  }
  private syncDrivers() {
    if (!this.world || this.snapshot.role !== 'host' || this.snapshot.phase !== 'lobby') return;
    const ids = new Set(this.snapshot.players.map(p => p.id));
    for (const id of this.drivers.keys()) if (!ids.has(id)) this.drivers.delete(id);
    for (const [index, player] of this.snapshot.players.entries()) if (!this.drivers.has(player.id)) this.drivers.set(player.id, this.world.spawn(index));
  }
  private onAction = (action: PartyAction) => {
    if (this.snapshot.role !== 'host' || action.role !== 'player') return;
    const sender = this.client.getSnapshot().players.find(p => p.id === action.playerId && p.connected);
    const p = action.payload;
    if (!sender || !object(p) || p.protocol !== BEERIO2_PROTOCOL) return;
    if (p.kind === 'hello' && validId(p.stream)) {
      if (!this.accepted.has(sender.id) && (this.snapshot.phase !== 'lobby' || this.accepted.size >= 9)) { this.publish(true); return; }
      if (this.accepted.get(sender.id) !== p.stream) { this.inputs.delete(sender.id); this.sequences.delete(sender.id); }
      this.accepted.set(sender.id, p.stream);
      this.syncPlayers(); this.syncDrivers(); this.publish(true);
      return;
    }
    if (p.kind !== 'input' || this.snapshot.phase !== 'race' || p.raceId !== this.raceId ||
      !Number.isSafeInteger(p.seq) || (p.seq as number) < 0 || !this.accepted.has(sender.id) || this.accepted.get(sender.id) !== p.stream) return;
    const input = validateInput(p.input);
    const previous = this.sequences.get(sender.id);
    if (!input || (previous !== undefined && (p.seq as number) <= previous)) return;
    this.sequences.set(sender.id, p.seq as number);
    this.inputs.set(sender.id, { input, received: this.now(), seq: p.seq as number, stream: p.stream as string });
  };
  private onState = (payload: unknown) => {
    if (this.snapshot.role !== 'player') return;
    if (!object(payload) || payload.protocol !== BEERIO2_PROTOCOL) {
      this.fail('That code belongs to another game. Use the code on the Beerio 2 host screen.'); return;
    }
    if (!validateFrame(payload)) { this.fail('This Beerio 2 room uses an incompatible version. Reload both screens.'); return; }
    if (this.frame && (payload.raceId < this.frame.raceId || (payload.raceId === this.frame.raceId && payload.tick <= this.frame.tick))) return;
    if (this.snapshot.playerId && payload.rejected.includes(this.snapshot.playerId)) { this.fail('This Beerio 2 room is full or the race has already started.'); return; }
    this.verified = true;
    this.lastFrame = this.now();
    this.frame = payload;
    this.update({ phase: payload.phase, countdown: payload.countdown, players: payload.players, error: null });
  };
  setInput = (input: DriveInput) => {
    const next = validateInput(input);
    // Preserve a one-frame reset tap until the 20Hz sender/60Hz host consumes it.
    if (next) next.reset ||= this.localInput.reset;
    this.localInput = next ?? neutral();
    this.inputAt = this.now();
  };
  start = () => {
    if (this.snapshot.role !== 'host' || this.snapshot.status !== 'connected' || !this.world || this.snapshot.phase !== 'lobby') return;
    if (this.snapshot.players.filter(p => p.connected && p.ready).length < 2) {
      this.update({ error: 'Invite at least one friend before starting the online race.' }); return;
    }
    this.raceId++; this.tick = 0; this.elapsed = 0; this.countdownLeft = 3; this.finishDeadline = RACE_MAX_SECONDS;
    this.inputs.clear(); this.localInput = neutral(); this.accumulator = 0; this.lastTick = this.now();
    this.drivers.clear(); this.syncDrivers();
    this.update({ phase: 'countdown', countdown: 3, error: null });
    this.client.setLocked(true);
    this.publish(true);
  };
  setPaused = (paused: boolean) => {
    this.localInput = neutral(); this.inputs.clear();
    if (this.snapshot.role !== 'host' || this.snapshot.status !== 'connected') return;
    if (paused && (this.snapshot.phase === 'race' || this.snapshot.phase === 'countdown')) {
      this.pausedPhase = this.snapshot.phase;
      this.update({ phase: 'paused', countdown: 0 });
    } else if (!paused && this.snapshot.phase === 'paused') {
      this.lastTick = this.now(); this.accumulator = 0;
      this.update({ phase: this.pausedPhase, countdown: this.pausedPhase === 'countdown' ? Math.ceil(this.countdownLeft) : 0 });
    }
    this.publish(true);
  };
  rematch = () => {
    if (this.snapshot.role !== 'host' || this.snapshot.status !== 'connected') return;
    this.raceId++; this.elapsed = 0; this.countdownLeft = 0; this.inputs.clear(); this.localInput = neutral();
    this.drivers.clear();
    this.update({ phase: 'lobby', countdown: 0 });
    this.syncPlayers(); this.syncDrivers(); this.client.setLocked(false); this.publish(true);
  };
  /** Fixed-step simulation; exposed for deterministic transport tests, normally timer-driven. */
  advance = () => {
    const now = this.now();
    const delta = Math.max(0, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (this.snapshot.status !== 'connected') return;
    if (this.snapshot.role === 'player') {
      if (!this.verified && now - this.connectedAt > 3500) { this.fail('No Beerio 2 host was found in that room. Check the game and code.'); return; }
      if (this.verified && now - this.lastFrame > 1200 && this.snapshot.phase !== 'paused') {
        this.localInput = neutral(); this.update({ phase: 'paused', countdown: 0 });
        if (this.frame) this.frame = { ...this.frame, phase: 'paused', countdown: 0 };
      }
      if (this.snapshot.hostConnected && now - this.lastHello >= 1000) {
        this.lastHello = now;
        this.client.sendAction({ protocol: BEERIO2_PROTOCOL, kind: 'hello', stream: this.stream });
      }
      if (this.verified && this.snapshot.hostConnected && now - this.lastInput >= 50) {
        this.lastInput = Number.isFinite(this.lastInput) ? this.lastInput + Math.floor((now - this.lastInput) / 50) * 50 : now;
        const active = this.snapshot.phase === 'race' && now - this.inputAt <= INPUT_TTL_MS;
        this.client.sendAction({ protocol: BEERIO2_PROTOCOL, kind: 'input', stream: this.stream, raceId: this.frame?.raceId,
          seq: ++this.seq, input: active ? this.localInput : neutral() });
        this.localInput = { ...this.localInput, reset: false };
      }
      return;
    }
    if (this.snapshot.role !== 'host') return;
    if (delta > .75 && (this.snapshot.phase === 'race' || this.snapshot.phase === 'countdown')) this.setPaused(true);
    this.accumulator += Math.min(delta, .1);
    while (this.accumulator + 1e-9 >= 1 / 60) {
      this.accumulator -= 1 / 60;
      if (this.snapshot.phase === 'countdown') {
        this.countdownLeft = Math.max(0, this.countdownLeft - 1 / 60);
        const countdown = Math.ceil(this.countdownLeft - 1e-8);
        if (countdown <= 0) { this.inputs.clear(); this.localInput = neutral(); this.update({ phase: 'race', countdown: 0 }); }
        else if (countdown !== this.snapshot.countdown) this.update({ countdown });
      } else if (this.snapshot.phase === 'race' && this.world) {
        this.elapsed += 1 / 60;
        for (const [id, driver] of this.drivers) {
          const entry = this.inputs.get(id);
          const connected = this.snapshot.players.some(p => p.id === id && p.connected);
          const input = id === 'host' ? (now - this.inputAt <= INPUT_TTL_MS ? this.localInput : neutral()) :
            (connected && entry && now - entry.received <= INPUT_TTL_MS ? entry.input : neutral());
          if (!driver.state.finished) this.world.step(driver, input, 1 / 60, TOTAL_LAPS);
          if (entry?.input.reset) entry.input = { ...entry.input, reset: false };
        }
        this.localInput = { ...this.localInput, reset: false };
        const active = [...this.drivers.entries()].filter(([id]) => this.snapshot.players.some(p => p.id === id && p.connected));
        if ([...this.drivers.values()].some(driver => driver.state.finished) && this.finishDeadline === RACE_MAX_SECONDS) {
          this.finishDeadline = Math.min(RACE_MAX_SECONDS, this.elapsed + FINISH_GRACE_SECONDS);
        }
        if ((active.length && active.every(([, driver]) => driver.state.finished)) || this.elapsed >= this.finishDeadline) this.update({ phase: 'results' });
      }
    }
    this.publish();
  };
  private publish(force = false) {
    if (this.snapshot.role !== 'host' || this.snapshot.status !== 'connected' || this.now() - this.lastPublish < (force ? 50 : 1000 / 15)) return;
    const interval = force ? 50 : 1000 / 15;
    const now = this.now();
    this.lastPublish = Number.isFinite(this.lastPublish) ? this.lastPublish + Math.floor((now - this.lastPublish) / interval) * interval : now;
    const players = this.snapshot.players;
    const cars: Record<string, CarState> = {};
    for (const [id, driver] of this.drivers) if (players.some(p => p.id === id)) cars[id] = { ...driver.state };
    const results = players.map(p => ({ id: p.id, name: p.name, time: cars[p.id]?.finishTime ?? null }))
      .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
    const rejected = this.client.getSnapshot().players.filter(p => !this.accepted.has(p.id) &&
      (this.accepted.size >= 9 || this.snapshot.phase !== 'lobby')).map(p => p.id);
    // Absolute, versioned frames replace the previous view; there is no event replay or local prediction.
    this.frame = { protocol: BEERIO2_PROTOCOL, raceId: this.raceId, tick: ++this.tick, phase: this.snapshot.phase,
      countdown: this.snapshot.countdown, elapsed: this.elapsed, totalLaps: TOTAL_LAPS, players, cars, results, rejected };
    this.client.publish(this.frame);
  }
  retry = () => { this.lastTick = this.now(); this.client.retry(); };
  private fail(error: string) { this.leave(); this.update({ status: 'error', error }); }
  leave = () => {
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.client.leave();
    this.world?.dispose(); this.world = null; this.drivers.clear(); this.inputs.clear(); this.accepted.clear(); this.sequences.clear();
    this.frame = null; this.localInput = neutral(); this.verified = false;
    this.raceId = 0; this.tick = 0; this.elapsed = 0; this.accumulator = 0;
    this.lastHello = this.lastInput = this.lastPublish = -Infinity;
    this.update(initial());
  };
  dispose = () => { this.leave(); this.unsubscribes.forEach(fn => fn()); this.unsubscribes = []; this.listeners.clear(); this.client.dispose(); };
}
