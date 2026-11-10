import { RAINBOW_COLORS } from './rainbowCourse';
import type { Vec3 } from './track';

export type RainbowGeometry = {
  triangle(a: Vec3, b: Vec3, c: Vec3, color: Vec3, glow?: boolean): void;
  beam(a: Vec3, b: Vec3, width: number, color: Vec3): void;
  sphere(center: Vec3, radius: number, color: Vec3, slices?: number, rings?: number): void;
};

/** Lightweight, deterministic celestial sculptures, entirely outside the driving volume. */
export function addRainbowScenery(g: RainbowGeometry): void {
  let seed = 991;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 120; i++) {
    const angle = random() * Math.PI * 2, radius = 390 + random() * 230;
    const center: Vec3 = [Math.cos(angle) * radius, -80 + random() * 410, Math.sin(angle) * radius];
    g.sphere(center, 0.65 + random() * 1.5, i % 4 ? [0.83, 0.89, 1] : RAINBOW_COLORS[i % 7], 6, 4);
  }
  // Two low, luminous orbital loops remain well below the lowest road point.
  for (let ring = 0; ring < 2; ring++) {
    const radius = 210 + ring * 72;
    for (let i = 0; i < 96; i++) {
      const a = i / 96 * Math.PI * 2, b = (i + 1) / 96 * Math.PI * 2;
      g.beam([Math.cos(a) * radius, -40 - ring * 24, Math.sin(a) * radius], [Math.cos(b) * radius, -40 - ring * 24, Math.sin(b) * radius], 0.8, RAINBOW_COLORS[Math.floor(i / 14) % 7]);
    }
  }
  for (const [x, y, z, size] of [[355, 125, 75, 36], [-365, 155, -110, 27], [30, 165, -350, 22]]) {
    const top: Vec3 = [x, y + size, z], bottom: Vec3 = [x, y - size, z];
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2, b = (i + 1) / 7 * Math.PI * 2;
      const left: Vec3 = [x + Math.cos(a) * size * 0.6, y, z + Math.sin(a) * size * 0.6];
      const right: Vec3 = [x + Math.cos(b) * size * 0.6, y, z + Math.sin(b) * size * 0.6];
      g.triangle(top, left, right, RAINBOW_COLORS[i], true);
      g.triangle(bottom, right, left, RAINBOW_COLORS[(i + 2) % 7]);
    }
  }
}
