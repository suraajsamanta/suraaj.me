// The relay assigns transient socket IDs. An opted-in game can keep a logical
// player after that relay seat expires without reserving a socket forever.
export type RecoverySeat = { id: string; name: string; transportId: string };
export type RememberedPlayer = { code: string; name: string };
export const isSeatCredential = (key: unknown): key is string =>
  typeof key === 'string' && /^[a-f0-9]{48}$/.test(key);

export class PartySeatRegistry {
  private seats = new Map<string, RecoverySeat>();
  private credentials = new Map<string, string>();
  private bindings = new Map<string, string>();
  constructor(private capacity = 100) {}

  bind(transportId: string, name: string, credential?: string): RecoverySeat | null {
    const already = this.bindings.get(transportId);
    if (already) return this.seats.get(already) ?? null;
    const knownId = credential && this.credentials.get(credential);
    const known = knownId ? this.seats.get(knownId) : null;
    if (!known && this.seats.size >= this.capacity) return null;
    const seat = known ? { ...known, transportId } : { id: transportId, name, transportId };
    if (known) this.bindings.delete(known.transportId);
    this.seats.set(seat.id, seat);
    this.bindings.set(transportId, seat.id);
    if (!known && credential) this.credentials.set(credential, seat.id);
    return seat;
  }

  owner(transportId: string) {
    const id = this.bindings.get(transportId);
    return id ? this.seats.get(id) : null;
  }

  entries() { return [...this.seats.values()]; }
  clear() { this.seats.clear(); this.bindings.clear(); this.credentials.clear(); }
}

const validRoomCode = /^[A-HJ-NP-Z2-9]{6}$/;
const activeKey = (namespace: string) => namespace + '.active';
export function rememberActivePlayer(namespace: string, player: RememberedPlayer) {
  try { sessionStorage.setItem(activeKey(namespace), JSON.stringify(player)); } catch { /* optional */ }
}
export function forgetActivePlayer(namespace: string) {
  try { sessionStorage.removeItem(activeKey(namespace)); } catch { /* optional */ }
}
export function readActivePlayer(namespace: string, code?: string): RememberedPlayer | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(activeKey(namespace)) ?? 'null') as RememberedPlayer | null;
    if (saved && typeof saved.code === 'string' && validRoomCode.test(saved.code) &&
      (code === undefined || code.trim().toUpperCase() === saved.code) &&
      typeof saved.name === 'string' && saved.name.trim() && Array.from(saved.name).length <= 40) {
      return { code: saved.code, name: saved.name };
    }
  } catch { /* optional */ }
  return null;
}
export function browserSeatCredential(namespace: string, code: string, name: string): string {
  const key = namespace + '.key.' + code + '.' + name.trim().normalize('NFKC').toLowerCase();
  try {
    const saved = localStorage.getItem(key);
    if (isSeatCredential(saved)) return saved;
  } catch { /* temporary in-memory seat still works when storage is disabled */ }
  const generated = Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem(key, generated); } catch { /* optional */ }
  return generated;
}
