/** Original Beerio racers and rides. Appearance is cosmetic only. */
export const CHARACTERS = [
  { id: 'fox', name: 'Flick the Fox', icon: '🦊' },
  { id: 'robot', name: 'Bleep the Robot', icon: '🤖' },
  { id: 'frog', name: 'Hops the Frog', icon: '🐸' },
  { id: 'cat', name: 'Ziggy the Cat', icon: '🐱' },
  { id: 'alien', name: 'Orbit the Alien', icon: '👽' },
  { id: 'bear', name: 'Bramble the Bear', icon: '🐻' },
  { id: 'bird', name: 'Pip the Bird', icon: '🐦' },
  { id: 'blob', name: 'Bubbles the Blob', icon: '🫧' },
] as const;
export const VEHICLES = [
  { id: 'kart', name: 'Classic Kart', icon: '🏎️' },
  { id: 'buggy', name: 'Dune Buggy', icon: '🚙' },
  { id: 'roadster', name: 'Roadster', icon: '🚘' },
  { id: 'motorcycle', name: 'Motorcycle', icon: '🏍️' },
] as const;
export type CharacterId = typeof CHARACTERS[number]['id'];
export type VehicleId = typeof VEHICLES[number]['id'];
export type Appearance = { character: CharacterId; vehicle: VehicleId; color: string };
export const DEFAULT_APPEARANCE: Appearance = { character: 'fox', vehicle: 'kart', color: '#ffce58' };
export const PALETTE = ['#ffce58', '#4ce4f3', '#ff7479', '#bd9aff', '#66e6a2', '#ff9de2', '#ff9648', '#4b72ee'];
export function validAppearance(value: unknown): value is Appearance {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return CHARACTERS.some(item => item.id === candidate.character) && VEHICLES.some(item => item.id === candidate.vehicle) && typeof candidate.color === 'string' && /^#[a-f\d]{6}$/i.test(candidate.color);
}
