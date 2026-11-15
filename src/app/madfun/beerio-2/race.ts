import { Engine } from '@babylonjs/core/Engines/engine';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { buildTrack } from './track';
import { buildCar, buildRival } from './car';
import { createSoftwareView } from './software';
import { course, heading } from './course';
import { createDrivingWorld, type CarState, type DriveInput } from './drive';
import type { RaceView } from './online';

export type OnlineRaceView = RaceView;

export type RaceInput = DriveInput;
export type RaceHud = { speed: number; lap: number; seconds: number; best: number | null; boost: boolean; renderer: string };

const UP = Math.PI / 2;
const K = 1 / 60;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (t: number, a: number, b: number) => Math.min(b, Math.max(a, t));
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

async function makeEngine(canvas: HTMLCanvasElement) {
  if ('gpu' in navigator && !new URLSearchParams(window.location.search).has('webgl')) {
    let gpu: AbstractEngine | undefined;
    try {
      const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine');
      if (await WebGPUEngine.IsSupportedAsync) {
        const engine = new WebGPUEngine(canvas, { antialias: false, adaptToDeviceRatio: false });
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
  const gl = canvas.getContext('webgl2', { antialias: false, stencil: false, powerPreference: 'high-performance' });
  if (gl) {
    const engine = new Engine(gl, false);
    return { engine, renderer: 'WebGL 2', software: undefined };
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Open WebGL compatibility mode to retry with a fresh canvas.');
  const { NullEngine } = await import('@babylonjs/core/Engines/nullEngine');
  return { engine: new NullEngine(), renderer: 'Compatibility', software: createSoftwareView(ctx) };
}

type GraphicalCar = TransformNode & { metadata: { wheels?: TransformNode[]; frontWheels?: TransformNode[]; wheelRadius?: number; setPaint?: (hex: string) => void } };
type VisualState = Pick<CarState, 'x' | 'y' | 'z' | 'yaw' | 'facing' | 'pitch' | 'steer' | 'speed' | 'boost'>;
function interpolate(old: VisualState | undefined, next: VisualState, amount: number): VisualState {
  if (!old || Math.hypot(old.x - next.x, old.z - next.z) > 15) return { ...next };
  return {
    x: mix(old.x, next.x, amount), y: mix(old.y, next.y, amount), z: mix(old.z, next.z, amount),
    yaw: old.yaw + turn(old.yaw, next.yaw) * amount,
    facing: old.facing + turn(old.facing, next.facing) * amount,
    pitch: mix(old.pitch, next.pitch, amount), steer: mix(old.steer, next.steer, amount),
    speed: mix(old.speed, next.speed, amount), boost: next.boost,
  };
}

const rivalsPalette = ['#ff799e','#ffd16a','#9af5b4','#b5a4ff','#ff9f73','#91bbff','#fbdfab','#5be9e0','#f3a2ee'];
function rivalColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) >>> 0;
  return rivalsPalette[hash % rivalsPalette.length];
}

export async function startRace(canvas: HTMLCanvasElement, input: RaceInput, onHud: (hud: RaceHud) => void, online?: OnlineRaceView): Promise<() => void> {
  const { engine, renderer, software } = await makeEngine(canvas);
  let world: Awaited<ReturnType<typeof createDrivingWorld>> | undefined;
  let scene: Scene | undefined;
  let observer: ResizeObserver | undefined;
  let visibility: (() => void) | undefined;
  let disposed = false;
  function cleanup() {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    if (visibility) document.removeEventListener('visibilitychange', visibility);
    engine.stopRenderLoop();
    try { scene?.dispose(); }
    finally { engine.dispose(); world?.dispose(); }
  }
  try {
    if (!online) world = await createDrivingWorld();
    const solo = world?.spawn();
    const scene3d = new Scene(engine);
    scene = scene3d;
    scene3d.clearColor = new Color4(0.041, 0.044, 0.098, 1);
    scene3d.ambientColor = new Color3(0.45, 0.50, 0.69);
    scene3d.fogMode = Scene.FOGMODE_EXP2;
    scene3d.fogColor = new Color3(0.081, 0.089, 0.174);
    scene3d.fogDensity = 0.0034;
    scene3d.skipPointerMovePicking = true;
    const hemi = new HemisphericLight('blue-hour', new Vector3(-0.2, 1, -0.25), scene3d);
    hemi.intensity = 1.04;
    hemi.diffuse = new Color3(0.74, 0.82, 1);
    hemi.groundColor = new Color3(0.24, 0.15, 0.31);
    const key = new DirectionalLight('city-rim', new Vector3(0.35, -0.84, 0.42), scene3d);
    key.intensity = 1.05;
    key.diffuse = new Color3(1, 0.76, 0.68);
    key.specular = new Color3(0.8, 0.88, 1);
    if (!software) buildTrack(scene3d, course.map(({ x, y, z }) => new Vector3(x, y, z)));
    const car = software ? null : buildCar(scene3d) as GraphicalCar;
    const shadow = software ? null : CreateDisc('contact-shadow', { radius: 1, tessellation: 28 }, scene3d);
    if (shadow) {
      shadow.rotation.x = UP;
      shadow.scaling.set(1.22, 2.42, 1);
      const sm = new StandardMaterial('contact-shadow-material', scene3d);
      sm.diffuseColor = Color3.Black();
      sm.emissiveColor = Color3.Black();
      sm.disableLighting = true;
      sm.backFaceCulling = false;
      sm.alpha = 0.58;
      shadow.material = sm;
    }
    const camera = new FreeCamera('chase', Vector3.Zero(), scene3d);
    camera.minZ = 0.45;
    camera.maxZ = 700;
    scene3d.activeCamera = camera;

    const anchor: CarState = {
      ...course[0], yaw: heading(0), facing: heading(0), pitch: 0, steer: 0, speed: 0,
      lap: 1, seconds: 0, best: null, boost: false, finished: false, finishTime: null, progress: 0,
    };
    let own: VisualState | undefined;
    let cameraYaw = anchor.yaw, cameraPitch = 0, accumulator = 0, hudTick = 0;
    let lastRaceId: number | undefined;
    let ownColor: string | undefined;
    const rivals = new Map<string, { model: TransformNode | null; pose: VisualState; color: string }>();
    const desired = Vector3.Zero();
    const look = Vector3.Zero();
    const hud = (state: CarState) => onHud({ speed: Math.round(state.speed * 2.236936), lap: state.lap, seconds: state.seconds, best: state.best, boost: state.boost, renderer });
    const resize = () => {
      const pixelBudget = canvas.clientWidth * canvas.clientHeight > 1100 * 750 ? 1 : 1.3;
      const scale = Math.min(window.devicePixelRatio || 1, pixelBudget);
      if (software) {
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      } else {
        engine.setHardwareScalingLevel(1 / scale);
        engine.resize();
      }
      camera.fov = canvas.clientWidth < canvas.clientHeight ? 0.93 : 0.76;
    };
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    visibility = () => {
      accumulator = 0;
      if (document.hidden && online) online.setInput({ steer: 0, throttle: false, brake: false, drift: false, reset: false });
    };
    document.addEventListener('visibilitychange', visibility);
    hud(solo?.state ?? anchor);

    engine.runRenderLoop(() => {
      if (document.hidden) return;
      const dt = Math.min(0.08, engine.getDeltaTime() / 1000);
      const frame = online?.getFrame();
      if (online) {
        online.setInput(input);
        input.reset = false;
      } else if (solo && world) {
        accumulator += dt;
        while (accumulator >= K) {
          world.step(solo, input, K);
          input.reset = false;
          accumulator -= K;
        }
      }
      const source = solo?.state ?? (online && frame?.cars[online.id]) ?? anchor;
      const jump = !own || frame?.raceId !== lastRaceId || Math.hypot(own.x - source.x, own.z - source.z) > 15;
      lastRaceId = frame?.raceId;
      const t = online ? 1 - Math.exp(-dt * 20) : 1;
      own = interpolate(own, source, jump ? 1 : t);
      const { x, y, z, yaw, facing, pitch, steer, speed, boost } = own;
      const paint = frame?.players.find(player => player.id === online?.id)?.color;
      if (paint && paint !== ownColor) {
        ownColor = paint;
        car?.metadata.setPaint?.(paint);
      }
      if (car) {
        car.position.set(x, y + 0.045, z);
        car.rotation.set(pitch, yaw, steer * (input.drift ? -0.07 : -0.033) * clamp(speed / 14, 0, 1));
        const { wheels, frontWheels, wheelRadius } = car.metadata;
        for (const wheel of wheels ?? []) wheel.rotation.x += speed * dt / (wheelRadius ?? .4);
        for (const front of frontWheels ?? []) front.rotation.y = 0.35 * steer;
      }
      if (shadow) {
        shadow.rotation.set(UP + pitch, yaw, 0);
        shadow.position.set(x, y + 0.035, z);
      }
      const current = frame?.cars ?? {};
      for (const [id, rival] of rivals) {
        if (!Object.hasOwn(current, id)) { rival.model?.dispose(false, true); rivals.delete(id); }
      }
      for (const [id, state] of Object.entries(current)) {
        if (id === online?.id) continue;
        let rival = rivals.get(id);
        if (!rival) {
          const color = frame?.players.find(player => player.id === id)?.color ?? rivalColor(id);
          rival = { model: software ? null : buildRival(scene3d, color), pose: state, color };
          rivals.set(id, rival);
        }
        rival.pose = interpolate(rival.pose, state, jump ? 1 : t);
        if (rival.model) {
          const { x, y, z, yaw, pitch } = rival.pose;
          rival.model.position.set(x, y + 0.045, z);
          rival.model.rotation.set(pitch, yaw, 0);
        }
      }
      if (jump) {
        cameraYaw = facing;
        cameraPitch = pitch;
        camera.position.set(x - Math.sin(yaw) * 7.8, y + 3.1, z - Math.cos(yaw) * 7.8);
      }
      cameraYaw += turn(cameraYaw, facing) * (1 - Math.exp(-dt * 5.5));
      cameraPitch = mix(cameraPitch, pitch, 1 - Math.exp(-dt * 4));
      const chase = 7.8 + speed * 0.045 + (boost ? 0.5 : 0);
      desired.set(x - Math.sin(cameraYaw) * chase, y + 3.0 + Math.sin(cameraPitch) * chase, z - Math.cos(cameraYaw) * chase);
      Vector3.LerpToRef(camera.position, desired, 1 - Math.exp(-dt * 13), camera.position);
      look.set(x + Math.sin(cameraYaw) * 8.6, y + 1.55 - Math.sin(cameraPitch) * 8.6, z + Math.cos(cameraYaw) * 8.6);
      camera.setTarget(look);
      if (software) software({ x, y, z, yaw, camera: camera.position, look, boost, color: ownColor, rivals: [...rivals.values()].map(rival => ({...rival.pose, color:rival.color})) });
      else scene3d.render();
      hudTick += dt;
      if (hudTick >= 0.096) { hudTick = 0; hud(source); }
    });
    return cleanup;
  } catch (err) {
    cleanup();
    throw err;
  }
}
