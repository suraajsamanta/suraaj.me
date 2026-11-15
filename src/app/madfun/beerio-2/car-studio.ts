import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { buildRide } from './rides';
import type { RideSelection } from './ride-selection';
import { makeEngine } from './graphics';

const mixAngle = (from: number, to: number) => Math.atan2(Math.sin(to-from), Math.cos(to-from));
export async function startStudio(canvas: HTMLCanvasElement, state: { angle: number; paint: string; reduced: boolean; ride: RideSelection }, compatibility: boolean) {
  const { engine, renderer, software } = await makeEngine(canvas, 'seattle', true, compatibility);
  let scene: Scene | undefined;
  let resizeObserver: ResizeObserver | undefined;
  function dispose() { resizeObserver?.disconnect(); engine.stopRenderLoop(); try { scene?.dispose(); } finally { engine.dispose(); } }
  try {
    const cameraPosition = Vector3.Zero();
    const look = new Vector3(0, .72, 0);
    const stage = software ? undefined : new Scene(engine);
    scene = stage;
    const camera = stage ? new FreeCamera('studio', cameraPosition.clone(), stage) : undefined;
    let car = stage ? buildRide(stage, state.ride, state.paint, true) : undefined;
    if (stage && camera) {
      stage.clearColor = Color4.FromHexString('#111824ff');
      stage.ambientColor = new Color3(.65,.69,.82);
      stage.skipPointerMovePicking = true;
      camera.minZ = .16; camera.maxZ = 48;
      stage.activeCamera = camera;
      const fill = new HemisphericLight('headroom', new Vector3(0,1,.1), stage);
      fill.intensity = .93; fill.diffuse = new Color3(.89,.95,1); fill.groundColor = new Color3(.20,.28,.45);
      for (const [name, direction, color, strength] of [
        ['softbox', new Vector3(.47,-.8,-.31), new Color3(.88,.94,1), 1.55],
        ['amber-edge', new Vector3(-.85,-.38,.33), new Color3(1,.68,.47), .9],
        ['blue-kicker', new Vector3(.2,-.5,1), new Color3(.45,.72,1), .82],
      ] as const) {
        const light = new DirectionalLight(name,direction,stage);
        light.diffuse = color; light.specular = color; light.intensity = strength;
      }
      const base = CreateCylinder('platform', { height: .24, diameter: 7.6, tessellation: 72 }, stage);
      base.position.y = -.174;
      const baseMat = new StandardMaterial('anodized', stage);
      baseMat.diffuseColor = Color3.FromHexString('#273141'); baseMat.specularColor = new Color3(.20,.28,.4);
      base.material = baseMat;
      const ring = CreateTorus('studio-floor-ring', { diameter: 7.02, thickness: .031, tessellation: 80 }, stage);
      ring.position.y = -.04;
      const ringMat = new StandardMaterial('ring-light', stage);
      ringMat.disableLighting = true; ringMat.emissiveColor = Color3.FromHexString('#5dc8cf');
      ring.material = ringMat;
      const shadow = CreateDisc('studio-contact', { radius: 1, tessellation: 28 }, stage);
      shadow.rotation.x = Math.PI / 2;
      shadow.position.y = -.046; shadow.scaling.set(1.1,2.37,1);
      const shadowMat = new StandardMaterial('studio-contact-material',stage);
      shadowMat.disableLighting = true; shadowMat.emissiveColor = Color3.Black();
      shadowMat.alpha = .57; shadow.material = shadowMat;
    }
    let changed = true, shown = state.angle * Math.PI / 180, color = '';
    let rideKey = JSON.stringify(state.ride);
    const resize = () => {
      const scale = Math.min(1.65, window.devicePixelRatio || 1);
      if (software) {
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      } else { engine.setHardwareScalingLevel(1/scale); engine.resize(); }
      changed = true;
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas); resize();
    engine.runRenderLoop(() => {
      if (document.hidden) return;
      const nextRideKey = JSON.stringify(state.ride);
      if (rideKey !== nextRideKey) {
        rideKey = nextRideKey;
        car?.dispose(false, true);
        car = stage ? buildRide(stage, state.ride, state.paint, true) : undefined;
        changed = true;
      }
      const diff = mixAngle(shown, state.angle * Math.PI / 180);
      if (!changed && color === state.paint && Math.abs(diff) < .0014) return;
      shown += Math.abs(diff) < .004 || state.reduced ? diff : diff * .16;
      changed = false;
      if (color !== state.paint) {
        color = state.paint;
        car?.metadata.setPaint?.(color);
      }
      // The front of the race model faces +Z; the default shot shows its rear ¾.
      const portrait = canvas.clientWidth < canvas.clientHeight;
      const radius = portrait ? 9.6 : 7.2;
      cameraPosition.set(Math.sin(shown)*radius,portrait ? 2.95 : 3.15,-Math.cos(shown)*radius);
      if (camera) { camera.position.copyFrom(cameraPosition); camera.fov = portrait ? .86 : .68; camera.setTarget(look); }
      if (software) software({ x:0, y:0, z:0, yaw:0, boost:false, color, ride:state.ride, camera:cameraPosition, look, speed:0, reducedMotion:true });
      else stage?.render();
    });
    return { renderer, dispose };
  } catch (error) { dispose(); throw error; }
}
