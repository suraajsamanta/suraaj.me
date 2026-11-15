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
import { getTrack, heading, type TrackId } from './course';
import { createRaceSound } from './race-audio';
import { createRaceEffects } from './race-effects';
import { createDrivingWorld, createSoloRace, type CarState, type DriveInput } from './drive';
import type { RaceView } from './online';

export type OnlineRaceView = RaceView;

export type RaceInput = DriveInput;
export type RaceSettings = { muted?: boolean; reducedMotion?: boolean; trackId?: TrackId; mode?: 'race' | 'time-trial' };
export type RaceHud = {
  speed: number; lap: number; seconds: number; best: number | null; boost: boolean; renderer: string;
  drifting?: boolean; driftCharge?: number; boostPower?: number; gear?: number; audioReady?: boolean; muted?: boolean; fps?: number;
  soloRace?: ReturnType<ReturnType<typeof createSoloRace>['status']>;
  map?: { id: string; x: number; z: number; color?: string; own?: boolean }[];
};

const UP = Math.PI / 2;
const K = 1 / 60;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (t: number, a: number, b: number) => Math.min(b, Math.max(a, t));
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

async function makeEngine(canvas: HTMLCanvasElement, trackId: TrackId) {
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
  return { engine: new NullEngine(), renderer: 'Compatibility', software: createSoftwareView(ctx, trackId) };
}

type GraphicalCar = TransformNode & { metadata: { wheels?: TransformNode[]; frontWheels?: TransformNode[]; wheelRadius?: number; setPaint?: (hex: string) => void; updateDetail?: (distance: number, dt: number, speed: number, steer?: number) => void } };
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

export async function startRace(canvas: HTMLCanvasElement, input: RaceInput, onHud: (hud: RaceHud) => void, online?: OnlineRaceView, settings: RaceSettings = {}): Promise<() => void> {
  const sound = createRaceSound();
  let graphics: Awaited<ReturnType<typeof makeEngine>>;
  try { graphics = await makeEngine(canvas, settings.trackId ?? 'seattle'); } catch (error) { sound.dispose(); throw error; }
  const { engine, renderer, software } = graphics;
  const selected = getTrack(settings.trackId ?? 'seattle');
  const course = selected.points;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => settings.reducedMotion ?? motionPreference.matches;
  let world: Awaited<ReturnType<typeof createDrivingWorld>> | undefined;
  let scene: Scene | undefined;
  let observer: ResizeObserver | undefined;
  let visibility: (() => void) | undefined;
  let disposed = false;
  function cleanup() {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    sound.dispose();
    if (visibility) document.removeEventListener('visibilitychange', visibility);
    engine.stopRenderLoop();
    try { scene?.dispose(); }
    finally { engine.dispose(); world?.dispose(); }
  }
  try {
    if (!online) world = await createDrivingWorld({ trackId: selected.id });
    const soloRace = world && settings.mode === 'race' ? createSoloRace(world, selected.id) : undefined;
    const solo = soloRace?.driver ?? world?.spawn();
    const scene3d = new Scene(engine);
    scene = scene3d;
    scene3d.clearColor = new Color4(0.041, 0.044, 0.098, 1);
    scene3d.ambientColor = new Color3(0.45, 0.50, 0.69);
    scene3d.fogMode = Scene.FOGMODE_EXP2;
    scene3d.fogColor = new Color3(0.081, 0.089, 0.174);
    scene3d.fogDensity = selected.id === 'orbit' ? 0.0009 : 0.0034;
    if (selected.id === 'orbit') {
      scene3d.clearColor = Color4.FromHexString('#050717ff');
      scene3d.fogColor = Color3.FromHexString('#07091b');
      scene3d.ambientColor = new Color3(.36, .39, .65);
    }
    scene3d.skipPointerMovePicking = true;
    const hemi = new HemisphericLight('blue-hour', new Vector3(-0.2, 1, -0.25), scene3d);
    hemi.intensity = 1.04;
    hemi.diffuse = new Color3(0.74, 0.82, 1);
    hemi.groundColor = new Color3(0.24, 0.15, 0.31);
    const key = new DirectionalLight('city-rim', new Vector3(0.35, -0.84, 0.42), scene3d);
    key.intensity = 1.05;
    key.diffuse = new Color3(1, 0.76, 0.68);
    key.specular = new Color3(0.8, 0.88, 1);
    if (!software) buildTrack(scene3d, course.map(({ x, y, z }) => new Vector3(x, y, z)), selected.id);
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
    const effects = software ? undefined : createRaceEffects(scene3d, camera);

    const anchor: CarState = {
      ...course[0], yaw: heading(0, course), facing: heading(0, course), pitch: 0, steer: 0, speed: 0,
      lap: 1, seconds: 0, best: null, boost: false, finished: false, finishTime: null, progress: 0,
    };
    let own: VisualState | undefined;
    let cameraYaw = anchor.yaw, cameraPitch = 0, accumulator = 0, hudTick = 0;
    let lastRaceId: number | undefined;
    let ownColor: string | undefined;
    const rivals = new Map<string, { model: GraphicalCar | null; pose: VisualState; color: string }>();
    let driftCharge = 0, wasBoost = false, boostPower = 0, previousSpeed = 0, impactCooldown = 0;
    let previousLap = 1, wasFinished = false, countdownNote = -1, previousPhase = '', chargeCue = false;
    let lean = 0, accelerationPitch = 0, fovBase = .76, fps = 60, quality = 1, qualityTime = 0;
    let fpsElapsed = 0, fpsFrames = 0;
    const desired = Vector3.Zero();
    const look = Vector3.Zero();
    const hud = (state: CarState) => onHud({
      speed: Math.round(state.speed * 2.236936), lap: state.lap, seconds: state.seconds, best: state.best, boost: state.boost, renderer,
      drifting: driftCharge > 0, driftCharge: clamp(driftCharge / .5, 0, 1), boostPower, gear: Math.min(6, 1 + Math.floor(state.speed / 7)),
      audioReady: sound.ready, muted: !!settings.muted, fps: Math.round(fps), soloRace: soloRace?.status(),
      map: [{ id: online?.id ?? 'you', x: state.x, z: state.z, color: ownColor ?? '#38bdf8', own: true },
        ...[...rivals].map(([id, rival]) => ({ id, x: rival.pose.x, z: rival.pose.z, color: rival.color }))],
    });
    const resize = () => {
      const pixelBudget = canvas.clientWidth * canvas.clientHeight > 1100 * 750 ? 1 : 1.3;
      const scale = Math.min(window.devicePixelRatio || 1, pixelBudget) * quality;
      if (software) {
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      } else {
        engine.setHardwareScalingLevel(1 / scale);
        engine.resize();
      }
      fovBase = canvas.clientWidth < canvas.clientHeight ? 0.93 : 0.76;
      camera.fov = fovBase;
    };
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    visibility = () => {
      accumulator = 0; fpsElapsed = fpsFrames = qualityTime = 0;
      sound.setVisible(!document.hidden);
      if (document.hidden && online) online.setInput({ steer: 0, throttle: false, brake: false, drift: false, reset: false });
    };
    document.addEventListener('visibilitychange', visibility);
    hud(solo?.state ?? anchor);

    engine.runRenderLoop(() => {
      if (document.hidden) return;
      const realtime = Math.min(0.25, Math.max(0, engine.getDeltaTime() / 1000));
      const dt = Math.min(0.08, realtime);
      fpsElapsed += realtime; fpsFrames += 1; qualityTime += realtime;
      if (fpsElapsed >= 1) { fps = fpsFrames / fpsElapsed; fpsElapsed = fpsFrames = 0; }
      if (qualityTime >= 4) {
        qualityTime = 0;
        const nextQuality = fps < 43 ? Math.max(.65, quality - .1) : fps > 57 ? Math.min(1, quality + .05) : quality;
        if (nextQuality !== quality) { quality = nextQuality; resize(); }
      }
      const frame = online?.getRenderFrame?.() ?? online?.getFrame();
      if (online) {
        online.setInput(input);
        input.reset = false;
      } else if (solo && world) {
        accumulator += dt;
        while (accumulator >= K) {
          if (soloRace) soloRace.step(input, K);
          else world.step(solo, input, K);
          input.reset = false;
          accumulator -= K;
        }
      }
      const source = solo?.state ?? (online && frame?.cars[online.id]) ?? anchor;
      const jump = !own || frame?.raceId !== lastRaceId || Math.hypot(own.x - source.x, own.z - source.z) > 15;
      lastRaceId = frame?.raceId;
      const t = online && online.id !== 'host' ? 1 - Math.exp(-dt * 38) : 1;
      own = interpolate(own, source, jump ? 1 : t);
      const { x, y, z, yaw, facing, pitch, steer, speed, boost } = own;
      const raceStatus = soloRace?.status();
      const phase = frame?.phase ?? (raceStatus ? raceStatus.countdown > 0 ? 'countdown' : raceStatus.finished ? 'results' : 'race' : 'race');
      const countdown = Math.ceil(frame?.countdown ?? raceStatus?.countdown ?? 0);
      const active = phase === 'race' || phase === 'countdown' || phase === 'lobby';
      const drifting = active && input.drift && speed > 9 && Math.abs(steer) > .22;
      driftCharge = typeof source.driftCharge === 'number' && Number.isFinite(source.driftCharge)
        ? clamp(source.driftCharge, 0, 1) * .5
        : drifting ? Math.min(1.25, driftCharge + dt) : 0;
      if (jump) { driftCharge = 0; previousSpeed = speed; effects?.clear(); }
      sound.update({ speed, throttle: input.throttle, drift: drifting ? .45 + Math.abs(steer) * .55 : 0, boost, active, muted: !!settings.muted });
      if (phase === 'countdown' && countdown > 0 && countdown !== countdownNote) { sound.cue('countdown'); countdownNote = countdown; }
      if (phase === 'race' && previousPhase === 'countdown') sound.cue('go');
      if (phase !== 'countdown') countdownNote = -1;
      if (boost && !wasBoost) sound.cue('boost');
      if (driftCharge >= .5 && !chargeCue) { sound.cue('charge'); chargeCue = true; }
      if (driftCharge < .49) chargeCue = false;
      if (source.lap > previousLap) sound.cue('lap');
      if (source.finished && !wasFinished) sound.cue('finish');
      impactCooldown -= dt;
      if (!jump && !input.brake && !source.finished && previousSpeed - speed > 1.5 && impactCooldown <= 0) { sound.cue('impact'); impactCooldown = .5; }
      boostPower = mix(boostPower, boost ? 1 : 0, 1 - Math.exp(-dt * (boost ? 10 : 5)));
      previousPhase = phase; wasBoost = boost; previousLap = source.lap; wasFinished = source.finished;
      const acceleration = dt > 0 ? clamp((speed - previousSpeed) / dt, -25, 20) : 0;
      accelerationPitch = mix(accelerationPitch, acceleration * .0012, 1 - Math.exp(-dt * 7));
      previousSpeed = speed;
      lean = mix(lean, steer * (drifting ? -.075 : -.035) * clamp(speed / 14, 0, 1), 1 - Math.exp(-dt * 9));
      const paint = frame?.players.find(player => player.id === online?.id)?.color;
      if (paint && paint !== ownColor) {
        ownColor = paint;
        car?.metadata.setPaint?.(paint);
      }
      if (car) {
        car.position.set(x, y + 0.045, z);
        car.rotation.set(pitch + accelerationPitch, yaw, lean);
        const { wheels, frontWheels, wheelRadius } = car.metadata;
        for (const wheel of wheels ?? []) wheel.rotation.x += speed * dt / (wheelRadius ?? .4);
        for (const front of frontWheels ?? []) front.rotation.y = 0.35 * steer;
      }
      if (shadow) {
        shadow.rotation.set(UP + pitch, yaw, 0);
        shadow.position.set(x, y + 0.035, z);
      }
      const current = frame?.cars ?? Object.fromEntries((soloRace?.rivals ?? []).map(rival => [rival.id, rival.driver.state]));
      for (const [id, rival] of rivals) {
        if (!Object.hasOwn(current, id)) { rival.model?.dispose(false, true); rivals.delete(id); }
      }
      for (const [id, state] of Object.entries(current)) {
        if (id === online?.id) continue;
        let rival = rivals.get(id);
        if (!rival) {
          const color = frame?.players.find(player => player.id === id)?.color ?? soloRace?.rivals.find(rival => rival.id === id)?.color ?? rivalColor(id);
          rival = { model: software ? null : buildRival(scene3d, color) as GraphicalCar, pose: state, color };
          rivals.set(id, rival);
        }
        rival.pose = interpolate(rival.pose, state, jump || online?.getRenderFrame ? 1 : t);
        if (rival.model) {
          const { x, y, z, yaw, pitch } = rival.pose;
          rival.model.position.set(x, y + 0.045, z);
          rival.model.rotation.set(pitch, yaw, 0);
          rival.model.metadata.updateDetail?.(Math.hypot(x - own.x, z - own.z), dt, rival.pose.speed, rival.pose.steer);
        }
      }
      if (jump) {
        cameraYaw = facing;
        cameraPitch = pitch;
        camera.position.set(x - Math.sin(yaw) * 7.8, y + 3.1, z - Math.cos(yaw) * 7.8);
      }
      cameraYaw += turn(cameraYaw, facing) * (1 - Math.exp(-dt * 5.5));
      cameraPitch = mix(cameraPitch, pitch, 1 - Math.exp(-dt * 4));
      const motion = reducedMotion() ? 0 : 1;
      const chase = 7.8 + speed * 0.032 + boostPower * .8 * motion;
      desired.set(x - Math.sin(cameraYaw) * chase, y + 3.0 + Math.sin(cameraPitch) * chase, z - Math.cos(cameraYaw) * chase);
      Vector3.LerpToRef(camera.position, desired, 1 - Math.exp(-dt * 13), camera.position);
      look.set(x + Math.sin(cameraYaw) * 8.6, y + 1.55 - Math.sin(cameraPitch) * 8.6, z + Math.cos(cameraYaw) * 8.6);
      camera.setTarget(look);
      camera.rotation.z = -lean * .23 * motion;
      camera.fov = mix(camera.fov, fovBase + (clamp(speed / 37, 0, 1) * .09 + boostPower * .095) * motion, 1 - Math.exp(-dt * 4));
      effects?.update({ x, y, z, yaw, pitch, speed, steer, boost, drift: driftCharge, reducedMotion: !motion }, dt);
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
