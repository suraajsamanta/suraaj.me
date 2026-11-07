import type { Appearance } from "../appearance";
/** Shared browser-side contract. The relay never runs the race simulation. */
/** action is an optional, monotonically increasing item-press sequence. */
export type RoomInput = { steer: number; accelerate: boolean; brake: boolean; action?: number };
export type RoomPlayer = {
  id: string;
  name: string;
  color: string;
  character?: Appearance["character"];
  vehicle?: Appearance["vehicle"];
  connected: boolean;
  input: RoomInput;
  /** Retained across safety resets and reconnects, without replaying an action. */
  actionSequence?: number;
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
  /** A restored race waits for its original controllers, unless the host explicitly resumes. */
  recovering: boolean;
  recoveryWaitingFor: string[];
  hostConnected: boolean;
  error: string | null;
  relayUrl: string;
  /** A failed connection can be retried without discarding the current race. */
  canRetryConnection: boolean;
};
export type CreateRoomOptions = { name?: string; maxPlayers?: number; relayUrl?: string };
export type JoinRoomOptions = { code: string; name: string; relayUrl?: string; appearance?: Appearance };
export const ZERO_INPUT: Readonly<RoomInput> = Object.freeze({ steer: 0, accelerate: false, brake: false });

export function normalizeInput(input: RoomInput): RoomInput {
  return {
    steer: Number.isFinite(input.steer) ? Math.max(-1, Math.min(1, input.steer)) : 0,
    accelerate: input.accelerate === true,
    brake: input.brake === true,
    ...(Number.isSafeInteger(input.action) && input.action! > 0 ? { action: input.action } : {}),
  };
}
