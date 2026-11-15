import type { PartyAction } from './party-client';

export const HOST_REMOTE = 'madfun.host-remote.v1';
export type RemoteButton = Readonly<{ id: string; label: string; disabled?: boolean; confirm?: string }>;
export type RemoteAction = RemoteButton & Readonly<{ run: () => void }>;
export type RemoteBoard = { protocol: typeof HOST_REMOTE; game: string; revision: number; phase: string; buttons: RemoteButton[] };
const idPattern = /^[a-z0-9_-]{1,36}$/i;
const clean = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\p{Cc}\p{Cf}]/u.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const roomPattern = /^[A-HJ-NP-Z2-9]{6}$/;
export const invitePattern = /^[A-Za-z0-9_-]{32}$/;

export function remoteBoard(game: string, revision: number, phase: string, actions: readonly RemoteAction[]): RemoteBoard {
  return { protocol: HOST_REMOTE, game, revision, phase, buttons: actions.slice(0, 36).map(({ id, label, disabled, confirm }) => ({ id, label, disabled, confirm })) };
}

export function readRemoteBoard(value: unknown): RemoteBoard | null {
  if (!record(value) || value.protocol !== HOST_REMOTE || !clean(value.game, 80) || !clean(value.phase, 120) ||
    typeof value.revision !== 'number' || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
    !Array.isArray(value.buttons) || value.buttons.length > 36) return null;
  const seen = new Set<string>();
  for (const button of value.buttons) {
    if (!record(button) || typeof button.id !== 'string' || !idPattern.test(button.id) || seen.has(button.id) ||
      !clean(button.label, 90) || (button.disabled !== undefined && typeof button.disabled !== 'boolean') ||
      (button.confirm !== undefined && !clean(button.confirm, 160))) return null;
    seen.add(button.id);
  }
  return value as RemoteBoard;
}

export function validateRemoteCommand(event: PartyAction, revision: number, actions: readonly RemoteAction[]): RemoteAction | null {
  const value = event.payload;
  if (event.role !== 'judge' || !record(value) || value.protocol !== HOST_REMOTE || value.revision !== revision ||
      typeof value.id !== 'string' || !idPattern.test(value.id)) return null;
  return actions.find(action => action.id === value.id && !action.disabled && (!action.confirm || value.confirmed === true)) ?? null;
}
