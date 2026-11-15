import { characterHeadGeometry, parseColor, racerGeometry } from '../../beerio/game/renderer';
import type { RideSelection } from './ride-selection';

/** Shared CPU/GPU triangle stream: xyz, rgb per vertex; +Z nose, Y up, ground origin.
 * The garage body is imported read-only, not remodeled as a generic coupe. */
export type RideGeometry = { data: number[] };

/** Centers sit just above the individual roof/saddle, not at one generic car height.
 * The smaller head leaves grilles, windshields, rooflines and motorcycle fairings legible. */
export const DRIVER_ANCHORS = {
  nightjar: [0, 1.68, -.26],
  'bmw-m2': [0, 1.50, -.26], 'bmw-m3': [0, 1.52, -.26], 'bmw-m4': [0, 1.46, -.26],
  'amg-gt': [0, 1.41, -.52], 'amg-g63': [0, 2.08, -.26],
  lamborghini: [0, 1.30, -.26], mclaren: [0, 1.29, -.26], ferrari: [0, 1.29, -.26],
  bugatti: [0, 1.40, -.26], ducati: [0, 1.42, -.47], 'bmw-bike': [0, 1.42, -.47],
  cybertruck: [0, 1.93, -.12], 'tesla-roadster': [0, 1.37, -.15],
} as const satisfies Record<RideSelection['vehicle'], readonly [number, number, number]>;
export const DRIVER_HEAD_SCALE = .82;

/** Only a face/head: no torso, limbs, scarf, mascot or extra vehicle. */
export function rideHeadGeometry(ride: RideSelection, paint: string): RideGeometry {
  const geometry = characterHeadGeometry(parseColor(paint), ride.character);
  const anchor = DRIVER_ANCHORS[ride.vehicle];
  for (let i = 0; i < geometry.data.length; i += 6) {
    geometry.data[i] = geometry.data[i] * DRIVER_HEAD_SCALE + anchor[0];
    geometry.data[i + 1] = (geometry.data[i + 1] - 1) * DRIVER_HEAD_SCALE + anchor[1];
    geometry.data[i + 2] = geometry.data[i + 2] * DRIVER_HEAD_SCALE + anchor[2];
  }
  return geometry;
}

/** Nightjar deliberately returns ONLY its head. Its existing coachwork remains
 * buildCar (GPU) / the compatibility renderer's original Nightjar body (CPU). */
export function rideGeometry(ride: RideSelection, paint: string): RideGeometry {
  const head = rideHeadGeometry(ride, paint);
  if (ride.vehicle === 'nightjar') return head;
  const body = racerGeometry(parseColor(paint), ride.character, ride.vehicle, false);
  body.data = body.data.concat(head.data);
  return body;
}
