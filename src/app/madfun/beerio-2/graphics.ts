import { Engine } from '@babylonjs/core/Engines/engine';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { createSoftwareView } from './software';
import type { TrackId } from './course';

export async function makeEngine(canvas: HTMLCanvasElement, trackId: TrackId, studio = false, compatibility = false) {
  if (!compatibility && 'gpu' in navigator && !new URLSearchParams(window.location.search).has('webgl')) {
    let gpu: AbstractEngine | undefined;
    try {
      const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine');
      if (await WebGPUEngine.IsSupportedAsync) {
        const engine = new WebGPUEngine(canvas, { antialias: studio, adaptToDeviceRatio: false });
        gpu = engine;
        await engine.initAsync();
        return { engine: gpu, renderer: 'WebGPU', software: undefined };
      }
    } catch {
      gpu?.dispose();
      // If a failed GPU startup locks the canvas, the explicit compatibility
      // reload below is the safe way to obtain a fresh canvas.
    }
  }
  const gl = compatibility ? null : canvas.getContext('webgl2', { antialias: studio, stencil: false, powerPreference: 'high-performance' });
  if (gl) {
    const engine = new Engine(gl, studio);
    return { engine, renderer: 'WebGL 2', software: undefined };
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Open WebGL compatibility mode to retry with a fresh canvas.');
  const { NullEngine } = await import('@babylonjs/core/Engines/nullEngine');
  return { engine: new NullEngine(), renderer: 'Compatibility', software: createSoftwareView(ctx, trackId, studio) };
}
