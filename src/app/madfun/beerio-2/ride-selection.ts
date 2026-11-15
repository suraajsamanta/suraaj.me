import { CHARACTERS, GARAGE_VEHICLES, type CharacterId, type GarageVehicleId } from '../../beerio/appearance';

export { CHARACTERS };
export type { CharacterId, GarageVehicleId };
export type RideSelection = { vehicle: GarageVehicleId | 'nightjar'; character: CharacterId };
export const DEFAULT_RIDE: RideSelection = { vehicle: 'nightjar', character: 'fox' };
export const RIDES = [
  { id: 'nightjar', name: 'Nightjar R', icon: '🏎️' },
  ...GARAGE_VEHICLES,
] as const;

const STORAGE_KEY = 'beerio2-ride';
let snapshot: RideSelection = DEFAULT_RIDE;

export function validRide(value: unknown): value is RideSelection {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return RIDES.some(ride => ride.id === candidate.vehicle)
    && CHARACTERS.some(character => character.id === candidate.character);
}

export function readRide(): RideSelection {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (validRide(value)) {
      // A stable snapshot is required by React's useSyncExternalStore.
      if (snapshot.vehicle !== value.vehicle || snapshot.character !== value.character) {
        snapshot = { vehicle: value.vehicle, character: value.character };
      }
      return snapshot;
    }
  } catch { /* Storage can be blocked or contain an older, invalid selection. */ }
  snapshot = DEFAULT_RIDE;
  return snapshot;
}

export function saveRide(ride: RideSelection): void {
  if (!validRide(ride)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ vehicle: ride.vehicle, character: ride.character }));
  } catch { /* Keep playing with the current selection when storage is unavailable. */ }
}
