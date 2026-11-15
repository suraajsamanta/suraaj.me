import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { buildCar, buildRival } from './car';
import { rideGeometry, rideHeadGeometry, type RideGeometry } from './ride-geometry';
import type { RideSelection } from './ride-selection';

export { rideGeometry, rideHeadGeometry } from './ride-geometry';

/** One draw for all original body panels and the selected head. Baked vertex
 * colors preserve windows, badges, tyres and signature lighting independently of paint. */
function upload(mesh: Mesh, geometry: RideGeometry) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], normals: number[] = [];
  for (let i = 0; i < geometry.data.length; i += 6) {
    positions.push(geometry.data[i], geometry.data[i + 1], geometry.data[i + 2]);
    colors.push(geometry.data[i + 3], geometry.data[i + 4], geometry.data[i + 5], 1);
    indices.push(i / 6);
  }
  VertexData.ComputeNormals(positions, indices, normals);
  const vertices = new VertexData();
  vertices.positions = positions; vertices.colors = colors; vertices.indices = indices; vertices.normals = normals;
  vertices.applyToMesh(mesh);
}

/** Hero and rivals share the exact chosen silhouette; no generic-car fallback.
 * Original garage wheels are baked; empty pivot arrays keep race animation safe. */
export function buildRide(scene: Scene, ride: RideSelection, paint: string, hero = true): TransformNode {
  const nightjar = ride.vehicle === 'nightjar';
  const root = nightjar ? hero ? buildCar(scene, true) : buildRival(scene, paint) : new TransformNode(`ride-${ride.vehicle}`, scene);
  root.name = `${hero ? 'player' : 'rival'}-${ride.vehicle}`;
  if (nightjar && hero) root.metadata.setPaint(paint);
  const mesh = new Mesh(`${ride.vehicle}-${nightjar ? 'driver-head' : 'coachwork-and-head'}`, scene);
  mesh.parent = root; mesh.isPickable = false;
  const material = new StandardMaterial(`${ride.vehicle}-vertex-finish`, scene);
  material.diffuseColor = Color3.White();
  // Restrained sheen keeps baked black tyres dark rather than chrome. The hero
  // receives a tighter highlight; rivals keep the same geometry in one draw.
  material.specularColor.set(hero ? .24 : .12, hero ? .27 : .14, hero ? .30 : .16);
  material.specularPower = hero ? 72 : 32;
  material.emissiveColor.set(.07, .07, .07);
  // Legacy hand-authored panels have mixed winding. Preserve both sides rather
  // than dropping a door or windshield when Babylon uses its left-handed camera.
  material.backFaceCulling = false;
  mesh.material = material;
  upload(mesh, nightjar ? rideHeadGeometry(ride, paint) : rideGeometry(ride, paint));
  const previous = root.metadata ?? {};
  root.metadata = {
    ...previous,
    ride: { ...ride }, forward: '+Z',
    wheels: previous.wheels ?? [], frontWheels: previous.frontWheels ?? [],
    wheelRadius: previous.wheelRadius ?? .34,
    materials: [...(previous.materials ?? []), material],
    setPaint(hex: string) {
      if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
      previous.setPaint?.(hex);
      upload(mesh, nightjar ? rideHeadGeometry(ride, hex) : rideGeometry(ride, hex));
    },
    setBraking: previous.setBraking ?? (() => {}),
    updateDetail: previous.updateDetail ?? (() => {}),
  };
  return root;
}
