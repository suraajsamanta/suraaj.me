// Host-side observations only. Raw room codes and driver IDs stay in this
// instance; generated IDs are scoped to this host's visit to a room.
type RacingGame = "beerio" | "beerio-2";
type Driver = { id: string; connected: boolean };
type Event = {
  kind: "game_join" | "game_start" | "game_end" | "game_player_duration";
  game: RacingGame;
  roomId: string;
  matchId: string;
  playerId?: string;
  durationMs?: number;
  estimated?: boolean;
  outcome?: "completed" | "abandoned" | "unknown";
};
type Match = {
  id: string;
  last: number;
  elapsed: number;
  running: boolean;
  entrants: Map<string, { connected: boolean; duration: number }>;
};
type Room = { code: string; id: string; players: Map<string, string> };
const MAX_MS = 4 * 60 * 60 * 1000;
const boundedMs = (ms: number) => Math.max(0, Math.min(MAX_MS, Math.round(ms)));
type PrivacyNavigator = Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };

function send(event: Event) {
  if (typeof window === "undefined") return;
  const nav = window.navigator as PrivacyNavigator;
  if (nav.globalPrivacyControl || nav.doNotTrack === "1" || nav.msDoNotTrack === "1") return;
  void fetch("/api/analytics/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => { /* Analytics must not interrupt a race. */ });
}

export class RaceAnalytics {
  private room: Room | null = null;
  private match: Match | null = null;

  constructor(
    private readonly game: RacingGame,
    private readonly emit = send,
    private readonly now = () => performance.now(),
    private readonly uuid = () => typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : "",
  ) {}

  observeRoom(code: string | null, players: readonly Driver[], authorized: boolean, running: boolean) {
    if (code !== this.room?.code) {
      this.closeRoom();
      if (!code || !authorized) return;
      const id = this.uuid();
      if (!id) return;
      this.room = { code, id, players: new Map() };
    }
    if (!this.room) return;
    this.sample(running, players);
    if (!authorized) return;
    for (const player of players) {
      if (!player.connected || this.room.players.has(player.id)) continue;
      const id = this.uuid();
      if (!id) continue;
      this.room.players.set(player.id, id);
      this.record({ kind: "game_join", matchId: this.room.id, playerId: id });
    }
  }

  start(players: readonly Driver[], running = true) {
    if (!this.room || this.match) return;
    const id = this.uuid();
    if (!id) return;
    const entrants = new Map(players.filter(p => this.room!.players.has(p.id)).map(p => [p.id, { connected: p.connected, duration: 0 }]));
    if (!entrants.size) return;
    this.match = { id, last: this.now(), elapsed: 0, running, entrants };
    this.record({ kind: "game_start", matchId: id });
  }

  sample(running: boolean, players?: readonly Driver[]) {
    if (!this.match) return;
    const now = this.now();
    if (this.match.running) {
      const delta = Math.max(0, now - this.match.last);
      this.match.elapsed += delta;
      for (const p of this.match.entrants.values()) if (p.connected) p.duration += delta;
    }
    this.match.last = now;
    this.match.running = running;
    if (players) {
      const connected = new Set(players.filter(p => p.connected).map(p => p.id));
      for (const [id, p] of this.match.entrants) p.connected = connected.has(id);
    }
  }

  finish(elapsedSeconds?: number, finishTimes: readonly { id: string; time: number | null }[] = []) {
    const match = this.match;
    if (!match || !this.room) return;
    this.sample(false);
    this.match = null;
    const measured = typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0;
    const durationMs = boundedMs(measured ? elapsedSeconds * 1000 : match.elapsed);
    this.record({ kind: "game_end", matchId: match.id, durationMs, estimated: !measured, outcome: measured ? "completed" : "abandoned" });
    const times = new Map(finishTimes.map(result => [result.id, result.time]));
    for (const [id, entrant] of match.entrants) {
      const playerId = this.room.players.get(id);
      if (!playerId) continue;
      const time = times.get(id);
      const timed = typeof time === "number" && Number.isFinite(time) && time >= 0;
      this.record({
        kind: "game_player_duration", matchId: match.id, playerId,
        durationMs: boundedMs(Math.min(durationMs, timed ? time * 1000 : entrant.duration)),
        estimated: !timed, outcome: timed ? "completed" : measured ? "unknown" : "abandoned",
      });
    }
  }

  closeRoom() {
    this.finish();
    this.room = null;
  }

  private record(event: Omit<Event, "roomId" | "game">) {
    if (this.room) this.emit({ ...event, roomId: this.room.id, game: this.game });
  }
}
