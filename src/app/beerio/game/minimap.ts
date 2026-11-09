import { sampleShortcut, sampleTrack, type TrackDefinition, type TrackPoint } from './track';

/** A shallow elevated plan view. Road samples and kart poses share this exact
 * projection, so climbing roads and shortcut bridges cannot lose their dots. */
export function mapPoint(point: { x: number; y: number; z: number }): { x: number; y: number } {
  return { x: point.x, y: point.z - point.y * 0.65 };
}

export function createCircuitMap(track: TrackDefinition) {
  const road = sampleTrack(track), shortcut = sampleShortcut(track);
  const points = [...road, ...shortcut].map(mapPoint);
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y)), maxY = Math.max(...points.map(point => point.y));
  const span = Math.max(maxX - minX, maxY - minY);
  const padding = Math.max(24, span * 0.055);
  const path = (samples: TrackPoint[]) => samples.map((point, index) => {
    const projected = mapPoint(point);
    return `${index ? 'L' : 'M'} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`;
  }).join(' ');
  return {
    path: `${path(road)} Z`, branch: path(shortcut),
    start: mapPoint(road[0]),
    // Scale dots with the course extent so they remain legible on large tracks.
    markerRadius: span * 0.028,
    viewBox: `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`,
  };
}
