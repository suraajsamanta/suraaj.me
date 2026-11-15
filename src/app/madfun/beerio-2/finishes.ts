export const FINISHES = [
  { id: 'ion', name: 'Ion Blue', hex: '#2499ee' },
  { id: 'magma', name: 'Magma Red', hex: '#ed4435' },
  { id: 'acid', name: 'Acid Lime', hex: '#99ed4a' },
  { id: 'ultraviolet', name: 'Ultraviolet', hex: '#a676fc' },
] as const;
export type CarFinish = (typeof FINISHES)[number];

export function readFinish(): CarFinish {
  try {
    const id = localStorage.getItem('beerio2-car-finish');
    return FINISHES.find(finish => finish.id === id) ?? FINISHES[0];
  } catch {
    return FINISHES[0];
  }
}
