export const ARENA_AUTO_START_MS = 12_000;

type Lobby = {
  status: string;
  locked: boolean;
  players: readonly { id: string; connected: boolean; ready: boolean }[];
};

/** Key changes only when meaningful start conditions do, not for input traffic. */
export function arenaStartKey(room: Lobby, bots: number): string | null {
  if (room.locked || room.status !== "connected") return null;
  const ready = room.players.filter(player => player.connected);
  if (ready.length === 0 || ready.length + bots < 2 || ready.some(player => !player.ready)) return null;
  return JSON.stringify([bots, ...ready.map(player => player.id).sort()]);
}
