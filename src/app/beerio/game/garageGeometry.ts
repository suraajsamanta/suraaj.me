import type { Vec3 } from './track';

export type GarageColor = [number, number, number];
export interface GarageGeometry {
  triangle(a: Vec3, b: Vec3, c: Vec3, color: GarageColor, glow?: boolean): void;
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: GarageColor, glow?: boolean): void;
  beam(a: Vec3, b: Vec3, width: number, color: GarageColor): void;
  box(center: Vec3, size: Vec3, color: GarageColor, angle?: number): void;
  ellipsoid(center: Vec3, radius: Vec3, color: GarageColor, slices?: number, rings?: number): void;
  wheel(center: Vec3, radius: number, width: number, color: GarageColor, sides?: number): void;
}
