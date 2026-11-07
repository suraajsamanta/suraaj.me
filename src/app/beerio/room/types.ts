/** Shared browser-side contract. The relay never runs the race simulation. */
export type RoomInput = { steer: number; accelerate: boolean; brake: boolean };
export type RoomPlayer = {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  input: RoomInput;
};
export type RoomStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error" | "closed";
export type RoomRole = "host" | "player";
export type RoomSnapshot = {
  status: RoomStatus;
  role: RoomRole | null;
  code: string | null;
  playerId: string | null;
  players: RoomPlayer[];
  maxPlayers: number;
  locked: boolean;
  hostConnected: boolean;
  error: string | null;
  relayUrl: string;
};
export type CreateRoomOptions = { name?: string; maxPlayers?: number; relayUrl?: string };
export type JoinRoomOptions = { code: string; name: string; relayUrl?: string };
export const ZERO_INPUT: Readonly<RoomInput> = Object.freeze({ steer: 0, accelerate: false, brake: false });

export function normalizeInput(input: RoomInput): RoomInput {
  return {
    steer: Number.isFinite(input.steer) ? Math.max(-1, Math.min(1, input.steer)) : 0,
    accelerate: input.accelerate === true,
    brake: input.brake === true,
  };
}
