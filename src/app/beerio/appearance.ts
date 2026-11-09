/** Original Beerio racers and rides. Appearance is cosmetic only. */
/** The supplied 6 × 4 animal portrait sheet, in reading order. */
export const ANIMAL_CHARACTERS = [
  { id: 'gorilla', name: 'Arjun', icon: '🦍', portrait: 0 },
  { id: 'tiger', name: 'Priya', icon: '🐯', portrait: 1 },
  { id: 'monkey', name: 'Rohan', icon: '🐵', portrait: 2 },
  { id: 'hippo', name: 'Meera', icon: '🦛', portrait: 3 },
  { id: 'flamingo', name: 'Ananya', icon: '🦩', portrait: 4 },
  { id: 'rabbit', name: 'Kabir', icon: '🐰', portrait: 5 },
  { id: 'panda', name: 'Kavya', icon: '🐼', portrait: 6 },
  { id: 'zebra', name: 'Ravi', icon: '🦓', portrait: 7 },
  { id: 'cow', name: 'Ishaan', icon: '🐮', portrait: 8 },
  { id: 'sheep', name: 'Anjali', icon: '🐑', portrait: 9 },
  { id: 'lion', name: 'Vikram', icon: '🦁', portrait: 10 },
  { id: 'buffalo', name: 'Raj', icon: '🐃', portrait: 11 },
  { id: 'orangutan', name: 'Neha', icon: '🦧', portrait: 12 },
  { id: 'elephant', name: 'Aarav', icon: '🐘', portrait: 13 },
  { id: 'goat', name: 'Dev', icon: '🐐', portrait: 14 },
  { id: 'crocodile', name: 'Karan', icon: '🐊', portrait: 15 },
  { id: 'antelope', name: 'Diya', icon: '🦌', portrait: 16 },
  { id: 'fish', name: 'Tara', icon: '🐟', portrait: 17 },
  { id: 'pig', name: 'Pooja', icon: '🐷', portrait: 18 },
  { id: 'ram', name: 'Sanjay', icon: '🐏', portrait: 19 },
  { id: 'donkey', name: 'Amit', icon: '🫏', portrait: 20 },
  { id: 'bear', name: 'Nikhil', icon: '🐻', portrait: 21 },
  { id: 'giraffe', name: 'Asha', icon: '🦒', portrait: 22 },
  { id: 'horse', name: 'Veer', icon: '🐴', portrait: 23 },
] as const;
export const PUBLIC_FIGURE_CHARACTERS = [
  { id: 'bezos', name: 'Bezos', icon: '🚀', title: 'The Orbital Titan', portraitPath: '/beerio/portraits/bezos.svg', portraitDescription: 'Bald, polished head, wide grin, white rolled sleeves and dark flight vest, with a gold-mounted glowing rocket.' },
  { id: 'trump', name: 'Trump', icon: '🎙️', title: 'The High-Velocity Showman', portraitPath: '/beerio/portraits/trump.svg', portraitDescription: 'Swept golden-orange hair, dramatic pout, broad blue suit and long red tie, with red and blue buttons and golden banners.' },
  { id: 'musk', name: 'Musk', icon: '🔧', title: 'The Cybernetic Maverick', portraitPath: '/beerio/portraits/musk.svg', portraitDescription: 'Windblown brown hair, playful smirk, bomber jacket and neon circuit shirt, with a wrench, blue holograms and sparking jet boots.' },
  { id: 'zuckerberg', name: 'Zuckerberg', icon: '🥽', title: 'The Synthetic Avatar', portraitPath: '/beerio/portraits/zuckerberg.svg', portraitDescription: 'Pale face, precise short brown hair and wide eyes, grey crewneck, with a VR headset above his forehead and blue holographic menus.' },
  { id: 'ye', name: 'Ye', icon: '🎵', title: 'The Avant-Garde Visionary', portraitPath: '/beerio/portraits/ye.svg', portraitDescription: 'Dark skin, close-cropped hair, metallic lower-face mask and dark futuristic sunglasses, oversized puffer coat and geometric boots, surrounded by violet soundwave bars.' },
  { id: 'huang', name: 'Huang', icon: '💻', title: 'The Silicon Maestro', portraitPath: '/beerio/portraits/huang.svg', portraitDescription: 'Jensen Huang with warm skin tone, short silver-streaked hair, rimless glasses and confident smile, wearing a black leather jacket and holding a silver chip beside green GPU lights.' },
] as const;
/** Stable reading order: the original 24 animals followed by six guest racers. */
export const SELECTABLE_CHARACTERS = [...ANIMAL_CHARACTERS, ...PUBLIC_FIGURE_CHARACTERS] as const;
export const CHARACTER_COLUMNS = 6;
export const CHARACTER_ROWS = Math.ceil(SELECTABLE_CHARACTERS.length / CHARACTER_COLUMNS);
export const CHARACTER_SELECTION_VERSION = 2;
export function selectionCharacters(version = CHARACTER_SELECTION_VERSION) {
  return version >= 2 ? SELECTABLE_CHARACTERS : ANIMAL_CHARACTERS;
}
export const CHARACTERS = [
  ...SELECTABLE_CHARACTERS,
  { id: 'fox', name: 'Aditya', icon: '🦊' },
  { id: 'robot', name: 'Riya', icon: '🤖' },
  { id: 'frog', name: 'Varun', icon: '🐸' },
  { id: 'cat', name: 'Sana', icon: '🐱' },
  { id: 'alien', name: 'Dhruv', icon: '👽' },
  { id: 'bird', name: 'Leela', icon: '🐦' },
  { id: 'blob', name: 'Maya', icon: '🫧' },
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
export const DEFAULT_APPEARANCE: Appearance = { character: 'gorilla', vehicle: 'kart', color: '#ffce58' };
export const PALETTE = ['#ffce58', '#4ce4f3', '#ff7479', '#bd9aff', '#66e6a2', '#ff9de2', '#ff9648', '#4b72ee'];
export function validAppearance(value: unknown): value is Appearance {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return CHARACTERS.some(item => item.id === candidate.character) && VEHICLES.some(item => item.id === candidate.vehicle) && typeof candidate.color === 'string' && /^#[a-f\d]{6}$/i.test(candidate.color);
}
