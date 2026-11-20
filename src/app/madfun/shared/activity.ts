// Host-observed game state, not page traffic. Wire payloads never contain a
// room code, transport identifier, player name, or answer.
export type ActivityGame = 'inside-ranks'|'codewords'|'jeopardy'|'simulator'|'boomerang'|'bump-club'|'floor-is-trouble';
export type ActivityEvent = {
  game: ActivityGame;
  kind: 'game_join'|'game_start'|'game_end'|'game_player_duration';
  matchId: string;
  roomId: string;
  outcome?: 'completed'|'abandoned';
  playerId?: string;
  durationMs?: number;
  estimated?: boolean;
};
type State = {
  host: boolean;
  room: string | null;
  online: boolean;
  phase: 'lobby'|'playing'|'finished';
  matchKey?: string | number;
  players: readonly string[];
  playingPlayers?: readonly string[];
};
type Seat = { id: string; elapsed: number; since: number | null };
type Match = { id: string; key: State['matchKey']; seats: Map<string, Seat>; startedAt: number; lastSeen: number };
const MAX_DURATION = 4 * 60 * 60 * 1000;
const MAX_PARTICIPANTS_PER_ROOM = 128;
const MAX_OBSERVED_PER_UPDATE = 32;

export function createActivityTracker(game: ActivityGame, makeId: () => string, emit: (event: ActivityEvent) => void) {
  let room: string | null = null;
  let roomId = '';
  let players = new Map<string, string>();
  let match: Match | null = null;
  let finishedKey: State['matchKey'] = undefined;
  let finished = false;
  let wasOnline = false;
  let ended = false;

  function pause(seat: Seat, now: number) {
    if (seat.since === null) return;
    seat.elapsed += Math.max(0, now - seat.since);
    seat.since = null;
  }
  function close(now: number, completed: boolean) {
    if (!match) return;
    const { id, seats, startedAt, lastSeen } = match;
    match = null;
    const outcome = completed ? 'completed' : 'abandoned';
    const stop = completed ? now : lastSeen;
    const durationMs = Math.min(MAX_DURATION, Math.round(Math.max(0, stop - startedAt)));
    emit({ game, kind: 'game_end', matchId: id, roomId, outcome, ...(durationMs ? { durationMs } : {}),
      ...(completed ? {} : { estimated: true }) });
    for (const seat of seats.values()) {
      // An absent/closed host has no evidence about play after its last observation.
      pause(seat, stop);
      const durationMs = Math.min(MAX_DURATION, Math.round(seat.elapsed));
      if (durationMs > 0) emit({ game, kind: 'game_player_duration', matchId: id, roomId, playerId: seat.id, durationMs, outcome, estimated: true });
    }
  }
  return {
    observe(s: State, now: number) {
      const nextRoom = s.host ? s.room : null;
      if (room !== nextRoom) {
        close(now, false);
        room = nextRoom;
        roomId = nextRoom ? makeId() : '';
        players = new Map();
        ended = false;
        finished = false;
        wasOnline = false;
      }
      if (!room || ended) return;
      if (!s.online) {
        if (wasOnline && match) for (const seat of match.seats.values()) pause(seat, match.lastSeen);
        wasOnline = false;
        return;
      }
      wasOnline = true;
      const connected = new Set(s.players.slice(0, MAX_OBSERVED_PER_UPDATE));
      for (const raw of connected) {
        if (!players.has(raw) && players.size < MAX_PARTICIPANTS_PER_ROOM) {
          const playerId = makeId();
          players.set(raw, playerId);
          // Join events are scoped to the room; start/end/durations to each match.
          emit({ game, kind: 'game_join', matchId: roomId, roomId, playerId });
        }
      }
      if (s.phase === 'lobby') {
        close(now, false);
        finished = false;
        return;
      }
      if (s.phase === 'finished') {
        close(now, true);
        finished = true;
        finishedKey = s.matchKey;
        return;
      }
      if (finished && s.matchKey !== undefined && s.matchKey === finishedKey) return;
      finished = false;
      if (match && match.key !== s.matchKey) close(now, false);
      if (!match) {
        match = { id: makeId(), key: s.matchKey, seats: new Map(), startedAt: now, lastSeen: now };
        emit({ game, kind: 'game_start', matchId: match.id, roomId });
      }
      match.lastSeen = now;
      const participants = s.playingPlayers ? new Set(s.playingPlayers.filter(id => connected.has(id))) : connected;
      for (const [raw, seat] of match.seats) if (!participants.has(raw)) pause(seat, now);
      for (const raw of participants) {
        const id = players.get(raw);
        if (!id) continue;
        const seat = match.seats.get(raw);
        if (!seat) match.seats.set(raw, { id, elapsed: 0, since: now });
        else if (seat.since === null) seat.since = now;
      }
    },
    heartbeat(now: number) { if (match && wasOnline) match.lastSeen = now; },
    abandon(now: number) { close(now, false); ended = true; },
  };
}
