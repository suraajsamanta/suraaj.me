import type { Scene } from '@babylonjs/core/scene';
import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export type EffectsFrame = { x: number; y: number; z: number; yaw: number; pitch: number; speed: number; steer: number; boost: boolean; drift: number; reducedMotion: boolean };
/** Fixed-size pools: no allocations or mesh creation in the driving loop. */
export function createRaceEffects(scene: Scene, camera: FreeCamera) {
  const material = (name: string, color: string, alpha = 1) => {
    const result = new StandardMaterial(name, scene);
    result.disableLighting = true; result.emissiveColor = Color3.FromHexString(color);
    result.diffuseColor = Color3.Black(); result.alpha = alpha;
    return result;
  };
  const gold = material('drift-spark-gold', '#ffd06a'), cyan = material('drift-spark-ready', '#63f8ff');
  const flame = material('boost-plume', '#7ceeff', .85), core = material('boost-core', '#f3ffff');
  const streakMaterial = material('velocity-lines', '#d5f5ff', .22);
  const sparks = Array.from({ length: 28 }, (_, i) => {
    const mesh = CreateSphere(`tire-spark-${i}`, { diameter: .09, segments: 2 }, scene);
    mesh.isPickable = false; mesh.material = gold; mesh.setEnabled(false);
    return { mesh, life: 0, velocity: Vector3.Zero() };
  });
  const flames = [-.6, .6].flatMap((side, i) => [false, true].map(inner => {
    const mesh = CreateCylinder(`exhaust-${i}-${inner}`, { diameterTop: inner ? .12 : .24, diameterBottom: 0, height: 1, tessellation: 6 }, scene);
    mesh.isPickable = false; mesh.material = inner ? core : flame; mesh.setEnabled(false);
    return { mesh, side, inner };
  }));
  const streaks = Array.from({ length: 18 }, (_, i) => {
    const mesh = CreateBox(`velocity-streak-${i}`, { width: .012, height: .012, depth: 1 }, scene);
    mesh.material = streakMaterial; mesh.isPickable = false; mesh.parent = camera;
    mesh.position.set((i % 2 ? -1 : 1) * (2.6 + (i % 3) * 1.6), ((i * 7) % 9 - 4) * .55, 3 + (i * 1.67) % 11);
    mesh.setEnabled(false);
    return mesh;
  });
  let nextSpark = 0, emission = 0, time = 0;
  function clear() { for (const spark of sparks) { spark.life = 0; spark.mesh.setEnabled(false); } }
  return {
    clear,
    update(frame: EffectsFrame, dt: number) {
      time += dt;
      const { x, y, z, yaw, pitch, speed, boost, drift, reducedMotion } = frame;
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const showLines = !reducedMotion && (boost || speed > 25);
      streakMaterial.alpha = boost ? .31 : Math.max(0, (speed - 25) / 12) * .15;
      for (const streak of streaks) {
        streak.setEnabled(showLines);
        if (!showLines) continue;
        streak.position.z -= dt * (18 + speed * 1.7);
        if (streak.position.z < 1.3) streak.position.z += 13;
        streak.scaling.z = boost ? 1.6 : .6;
      }
      for (const { mesh, side, inner } of flames) {
        mesh.setEnabled(boost);
        if (!boost) continue;
        const length = (inner ? .48 : .9) * (1 + Math.sin(time * 43 + side) * .16);
        mesh.scaling.y = length;
        mesh.rotation.set(Math.PI / 2 + pitch, yaw, 0);
        const back = 1.95 + length / 2;
        mesh.position.set(x - sin * back + cos * side, y + .36 + Math.sin(pitch) * back, z - cos * back - sin * side);
      }
      if (drift > 0 && speed > 8) {
        emission += dt * (drift >= .5 ? 44 : 28);
        while (emission >= 1) {
          emission -= 1;
          const spark = sparks[nextSpark++ % sparks.length], side = nextSpark % 2 ? -.88 : .88;
          spark.life = .25 + Math.random() * .2; spark.mesh.setEnabled(true);
          spark.mesh.material = drift >= .5 ? cyan : gold;
          spark.mesh.position.set(x - sin * 1.48 + cos * side, y + .15, z - cos * 1.48 - sin * side);
          spark.velocity.set(-sin * (3 + speed * .12) + cos * side * 2, .5 + Math.random() * 1.2, -cos * (3 + speed * .12) - sin * side * 2);
        }
      } else emission = 0;
      for (const spark of sparks) {
        if (spark.life <= 0) continue;
        spark.life -= dt;
        if (spark.life <= 0) { spark.mesh.setEnabled(false); continue; }
        spark.mesh.position.addInPlaceFromFloats(spark.velocity.x * dt, spark.velocity.y * dt, spark.velocity.z * dt);
        spark.velocity.y -= dt * 5;
        spark.mesh.scaling.setAll(Math.min(1.2, spark.life * 5));
      }
    },
  };
}
