import type { Scene } from '@babylonjs/core/scene';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

/** Procedural Seattle at blue hour. No assets, real-time shadows, or extra lights.
 * The centerline is an implicitly closed loop. Its elevation is preserved.
 * Static geometry is merged by material, rather than leaving hundreds of draws.
 */
export function buildTrack(scene: Scene, path: Vector3[]): void {
  if (path.length < 3) return;
  const batches = new Map<StandardMaterial, Mesh[]>();
  const mat = (name: string, hex: string, glow = 0, alpha = 1) => {
    const m = new StandardMaterial(`seattle-${name}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.emissiveColor = m.diffuseColor.scale(glow);
    m.specularColor = new Color3(.12, .19, .25);
    m.alpha = alpha;
    return m;
  };
  const asphalt = mat('wet-asphalt', '#152336');
  asphalt.specularColor = new Color3(.65, .8, 1);
  asphalt.specularPower = 96;
  const concrete = mat('concrete', '#293c52');
  const steel = mat('steel', '#394f65');
  const pale = mat('needle-ivory', '#b9d2db', .15);
  const blue = mat('electric-blue', '#49cbff', .9);
  const mint = mat('mint', '#64ffce', .8);
  const pink = mat('magenta', '#f961af', .8);
  const amber = mat('warm-lights', '#ffd89a', .85);
  const white = mat('lane-paint', '#bddce4', .25);
  const yellow = mat('yellow-paint', '#f1bd56', .32);
  const dark = mat('dark-metal', '#101b2c');
  const glass = mat('glass', '#173d52', .12);
  const sphereGlass = mat('conservatory-glass', '#195b58', .24);
  sphereGlass.specularColor = new Color3(.55, .95, .85);
  sphereGlass.specularPower = 80;
  const lawn = mat('garden', '#143c3b');
  const water = mat('water', '#0b3048', .15);
  water.specularColor = new Color3(.4, .7, 1);
  water.specularPower = 100;
  const reflections = mat('puddle-glints', '#366a85', .12);
  const batch = (mesh: Mesh, material: StandardMaterial) => {
    mesh.material = material;
    mesh.isPickable = false;
    const group = batches.get(material) || [];
    group.push(mesh);
    batches.set(material, group);
    return mesh;
  };
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: StandardMaterial, yaw = 0) => {
    const mesh = CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    return batch(mesh, material);
  };
  const cylinder = (name: string, x: number, y: number, z: number, top: number, bottom: number, height: number, material: StandardMaterial, tessellation = 16) => {
    const mesh = CreateCylinder(name, { diameterTop: top, diameterBottom: bottom, height, tessellation }, scene);
    mesh.position.set(x, y, z);
    return batch(mesh, material);
  };
  const beam = (name: string, a: Vector3, b: Vector3, width: number, material: StandardMaterial) => {
    const delta = b.subtract(a);
    const mesh = box(name, 0, 0, 0, width, delta.length(), width, material);
    mesh.position.copyFrom(a.add(b).scale(.5));
    mesh.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), delta.normalize(), new Quaternion());
    return mesh;
  };
  let seed = 1209;
  const rand = () => ((seed = Math.imul(1664525, seed) + 1013904223 | 0) >>> 0) / 4294967296;
  const normalAt = (i: number) => {
    const t = path[(i + 1) % path.length].subtract(path[(i - 1 + path.length) % path.length]);
    return new Vector3(-t.z, 0, t.x).normalize();
  };
  const normals = path.map((_, i) => normalAt(i));
  const strip = (name: string, from: number, to: number, lift: number, material: StandardMaterial) => {
    const positions: number[] = [], indices: number[] = [], ns: number[] = [];
    path.forEach((p, i) => {
      for (const offset of [from, to]) {
        positions.push(p.x + normals[i].x * offset, p.y + lift, p.z + normals[i].z * offset);
      }
      const a = i * 2, b = ((i + 1) % path.length) * 2;
      // Babylon's left-handed winding must face the sky for road lighting.
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    });
    VertexData.ComputeNormals(positions, indices, ns);
    const data = new VertexData();
    data.positions = positions; data.indices = indices; data.normals = ns;
    data.uvs = new Array(path.length * 4).fill(0);
    const mesh = new Mesh(name, scene);
    data.applyToMesh(mesh);
    // The road also remains visible from below on the elevated section.
    material.backFaceCulling = false;
    return batch(mesh, material);
  };
  box('city-foundation', 0, -.6, 0, 950, 1, 950, mat('city-ground', '#101e30'));
  box('elliott-bay', 0, -.04, 260, 900, .04, 240, water);
  for (let i = 0; i < 35; i++) {
    box('bay-glimmer', -240 + rand() * 480, -.008, 148 + rand() * 180, 3 + rand() * 14, .015, .12, reflections);
  }
  strip('viaduct-deck', -7.35, 7.35, -.09, concrete);
  strip('twelve-metre-road', -6, 6, .025, asphalt);
  // Recessed dark shoulders separate the wet racing surface from the neon edge.
  strip('left-drainage', -6.42, -6.1, .029, dark);
  strip('right-drainage', 6.1, 6.42, .029, dark);
  strip('left-edge', -5.75, -5.62, .043, white);
  strip('right-edge', 5.62, 5.75, .043, white);
  strip('left-neon-guide', -6.95, -6.86, .055, blue);
  strip('right-neon-guide', 6.86, 6.95, .055, mint);

  // Distance-based furniture stays consistent regardless of spline density.
  let distance = 0, nextDash = 0, nextLamp = 0, nextSupport = 0, nextPuddle = 4, nextCurb = 0, nextJoint = 0;
  path.forEach((p, i) => {
    const q = path[(i + 1) % path.length];
    const length = Vector3.Distance(p, q);
    const tangent = q.subtract(p).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z);
    const n = normals[i];
    const point = (at: number) => Vector3.Lerp(p, q, Math.min(1, Math.max(0, (at - distance) / length)));
    while (nextDash < distance + length) {
      const r = point(nextDash);
      const dash = box('center-dash', r.x, r.y + .052, r.z, .16, .018, 3.0, yellow, yaw);
      dash.rotation.x = -Math.asin(tangent.y);
      nextDash += 7.5;
    }
    while (nextPuddle < distance + length) {
      const r = point(nextPuddle), side = (rand() - .5) * 8;
      const glint = box('wet-road-glint', r.x + n.x * side, r.y + .047, r.z + n.z * side, .3 + rand() * .5, .008, 1.8 + rand() * 3, reflections, yaw);
      glint.rotation.x = -Math.asin(tangent.y);
      nextPuddle += 8;
    }
    while (nextCurb < distance + length) {
      const r = point(nextCurb);
      for (const sign of [-1, 1]) {
        const curb = box('roadside-curb', r.x + n.x * sign * 6.6, r.y + .11,
          r.z + n.z * sign * 6.6, .32, .16, 2.0,
          Math.round(nextCurb / 2.8) % 3 ? concrete : white, yaw);
        curb.rotation.x = -Math.asin(tangent.y);
      }
      nextCurb += 2.8;
    }
    while (nextJoint < distance + length) {
      const r = point(nextJoint);
      if (r.y > 3) {
        const joint = box('viaduct-expansion-joint', r.x, r.y + .037, r.z, 12, .008, .075, steel, yaw);
        joint.rotation.x = -Math.asin(tangent.y);
      }
      nextJoint += 17;
    }
    while (nextLamp < distance + length) {
      const r = point(nextLamp), side = (Math.round(nextLamp / 24) % 2 ? -1 : 1), lateral = side * 8.4;
      const x = r.x + n.x * lateral, z = r.z + n.z * lateral;
      cylinder('lamp-foot', x, r.y + .2, z, .6, .75, .4, concrete, 8);
      cylinder('lamp-post', x, r.y + 3.5, z, .13, .2, 7, steel, 6);
      beam('lamp-arm', new Vector3(x, r.y + 7, z), new Vector3(x - n.x * side * 2.4, r.y + 7.25, z - n.z * side * 2.4), .14, steel);
      box('lamp-light', x - n.x * side * 2.1, r.y + 7.18, z - n.z * side * 2.1, 1.15, .12, .45, amber, yaw);
      nextLamp += 24;
    }
    while (nextSupport < distance + length) {
      const r = point(nextSupport);
      if (r.y > 3) {
        box('viaduct-crossbeam', r.x, r.y - .8, r.z, 15, .8, 1.7, concrete, yaw);
        for (const sign of [-1, 1]) {
          box('viaduct-column', r.x + n.x * sign * 4.2, r.y / 2 - .3, r.z + n.z * sign * 4.2, 1.3, r.y, 1.7, concrete, yaw);
        }
      }
      nextSupport += 17;
    }
    if (p.y > 3 && i % 2 === 0) {
      const end = path[(i + 2) % path.length];
      for (const sign of [-1, 1]) {
        const a = p.add(n.scale(sign * 7.15)); a.y += .85;
        const b = end.add(normals[(i + 2) % path.length].scale(sign * 7.15)); b.y += .85;
        beam('bridge-guardrail', a, b, .18, steel);
        beam('bridge-post', a.subtract(new Vector3(0, .85, 0)), a, .12, steel);
      }
    }
    distance += length;
  });

  // Space Needle: splayed legs, hourglass waist, flying-saucer observation deck.
  const sx = 15, sz = 5;
  cylinder('needle-plaza', sx, .03, sz, 25, 25, .12, concrete, 40);
  cylinder('needle-plaza-ring', sx, .11, sz, 18, 18, .06, dark, 40);
  cylinder('needle-core', sx, 24, sz, 1.7, 3.2, 48, pale, 12);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    const foot = new Vector3(sx + Math.cos(angle) * 7, .2, sz + Math.sin(angle) * 7);
    const waist = new Vector3(sx + Math.cos(angle) * 1.8, 29, sz + Math.sin(angle) * 1.8);
    const top = new Vector3(sx + Math.cos(angle) * 4.7, 49, sz + Math.sin(angle) * 4.7);
    beam('needle-lower-leg', foot, waist, .8, pale);
    beam('needle-upper-leg', waist, top, .7, pale);
    beam('needle-leg-uplight', foot.add(new Vector3(.12, 0, .12)), waist.add(new Vector3(.12, 0, .12)), .13, mint);
  }
  cylinder('needle-bowl', sx, 48.8, sz, 16, 5, 3.5, pale, 40);
  cylinder('needle-window-band', sx, 51, sz, 16, 16, 1.4, glass, 40);
  cylinder('needle-lower-halo', sx, 49.5, sz, 15.4, 15.4, .16, amber, 40);
  // Exterior observation rail makes the saucer read clearly at track distance.
  const needleRail = CreateTorus('needle-observation-rail', { diameter: 16.8, thickness: .12, tessellation: 48 }, scene);
  needleRail.position.set(sx, 51.35, sz); batch(needleRail, pale);
  cylinder('needle-lit-deck', sx, 51.8, sz, 17.1, 17.1, .25, amber, 40);
  cylinder('needle-roof', sx, 53, sz, 4, 18.5, 2.2, pale, 40);
  cylinder('needle-roof-cap', sx, 54.4, sz, 1.2, 5, .8, pale, 24);
  cylinder('needle-spire', sx, 60, sz, .12, .65, 11.5, pale, 8);
  cylinder('needle-beacon', sx, 65.8, sz, .48, .48, .55, pink, 8);
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12;
    box('needle-mullion', sx + Math.cos(angle) * 8, 51, sz + Math.sin(angle) * 8, .1, 1.5, .13, pale, -angle);
  }

  // The three intersecting glass conservatories are distinct from office glazing.
  // A staggered triangular diagrid reads as architecture, not glowing beach balls.
  box('spheres-garden', -28, .06, -26, 34, .2, 26, lawn);
  box('spheres-walk', -28, .08, -36, 38, .14, 3.5, concrete);
  for (const [x, z, size] of [[-38, -25, 12], [-26, -24, 16], [-15, -26, 11]]) {
    const center = new Vector3(x, size * .33, z);
    const sphere = CreateSphere('seattle-sphere', { diameter: size, segments: 16 }, scene);
    sphere.position.copyFrom(center);
    batch(sphere, sphereGlass);
    const rows = 8, columns = 16, radius = size * .503;
    const gridPoint = (row: number, column: number) => {
      // Keep the frame above the plaza; the real Spheres are partially buried.
      const latitude = -.70 + row / rows * (Math.PI / 2 + .70);
      const longitude = (column + (row % 2) * .5) / columns * Math.PI * 2;
      return center.add(new Vector3(Math.cos(longitude) * Math.cos(latitude) * radius,
        Math.sin(latitude) * radius, Math.sin(longitude) * Math.cos(latitude) * radius));
    };
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const a = gridPoint(row, column), b = gridPoint(row, column + 1);
        beam('sphere-horizontal-frame', a, b, .085, pale);
        beam('sphere-diagrid', a, gridPoint(row + 1, column), .085, pale);
        if (row < rows - 1) beam('sphere-diagrid', a, gridPoint(row + 1, column + (row % 2 ? 1 : -1)), .085, pale);
      }
    }
    cylinder('sphere-base', x, .25, z, size * .75, size * .78, .5, steel, 24);
    cylinder('sphere-base-light', x, .54, z, size * .76, size * .76, .12, mint, 24);
  }
  // Warm entrance, exterior planted terraces, and restrained garden lighting.
  box('spheres-entry', -26, 1.6, -32.4, 4, 3, .3, glass);
  for (const x of [-39, -32, -20, -13]) {
    box('sphere-planter', x, .4, -37, 3, .8, 1.2, steel);
    box('sphere-planter-foliage', x, 1, -37, 2.7, .7, 1, lawn);
    box('sphere-path-light', x, .3, -34.7, .5, .25, .5, amber);
  }

  const buildingMaterials = ['#182c46', '#203850', '#21314a', '#172d3e'].map((c, i) => mat(`building-${i}`, c));
  function building(x: number, z: number, w: number, d: number, h: number, index: number) {
    const material = buildingMaterials[index % buildingMaterials.length];
    box('skyline-building', x, h / 2, z, w, h, d, material);
    box('rooftop', x, h + .35, z, w + .3, .7, d + .3, steel);
    if (h > 35) box('roof-crown', x, h + 2, z, w * .55, 3, d * .6, material);
    // Broad window strips are deliberately sparse and batched.
    for (let y = 3; y < h - 1; y += 3.5) {
      for (let column = -w / 2 + 1; column < w / 2 - .5; column += 2.5) {
        if (rand() < .3) continue;
        const light = rand() < .72 ? amber : blue;
        box('south-windows', x + column, y, z - d / 2 - .02, 1.1, .7, .035, light);
        box('north-windows', x + column, y, z + d / 2 + .02, 1.1, .7, .035, light);
      }
      if (Math.round(y) % 3) {
        box('east-window-band', x + w / 2 + .02, y, z, .035, .6, d * .7, blue);
        box('west-window-band', x - w / 2 - .02, y, z, .035, .6, d * .7, amber);
      }
    }
    if (index % 3 === 0) box('roof-neon', x, h + .75, z - d / 2, w, .12, .16, index % 2 ? blue : pink);
  }
  // Kept clear of both the elevated road and the low western approach.
  [[-26, 36, 13, 13, 37], [-8, 43, 11, 14, 56], [7, 47, 11, 12, 42],
    [-38, 48, 9, 14, 24], [23, 43, 10, 11, 30], [-13, 62, 12, 10, 28],
    [-43, 20, 9, 10, 19], [32, -29, 13, 14, 23], [12, -42, 14, 10, 16],
    [-12, -52, 12, 9, 12]].forEach(([x, z, w, d, h], i) => building(x, z, w, d, h, i));
  for (let i = 0; i < 22; i++) {
    const angle = i / 22 * Math.PI * 2;
    const x = Math.cos(angle) * (135 + rand() * 35);
    const z = Math.sin(angle) * (137 + rand() * 20);
    if (z > 120) continue;
    building(x, z, 11 + rand() * 14, 10 + rand() * 12, 18 + rand() * 50, i);
  }

  // Seattle skyline cues: Columbia Center's three stepped masses and Smith
  // Tower's pale pyramid. Both sit beyond the racing line, never on its surface.
  const cx = 106, cz = 50;
  for (const [dx, dz, width, height] of [[-6, -3, 9, 71], [0, 0, 10, 82], [6, 3, 8, 91]]) {
    box('columbia-stepped-tower', cx + dx, height / 2, cz + dz, width, height, 15, dark);
    for (let y = 5; y < height - 2; y += 4) {
      box('columbia-window-ribbon', cx + dx - width / 2 - .025, y, cz + dz, .04, .5, 13, blue);
      box('columbia-window-ribbon', cx + dx, y, cz + dz - 7.53, width - 1, .45, .04, amber);
    }
    box('columbia-crown', cx + dx, height + .1, cz + dz, width, .16, 15, steel);
  }
  building(-104, 33, 11, 11, 37, 0);
  cylinder('smith-pyramid-roof', -104, 43, 33, 0, 14.6, 12, pale, 4).rotation.y = Math.PI / 4;
  cylinder('smith-lantern', -104, 49.5, 33, .8, 1.2, 1.6, amber, 8);

  // Evergreen pocket parks and tiny street-level neon shopfronts.
  for (const [x, z] of [[-46, -44], [-45, -5], [36, 13], [36, 26], [-40, 64], [-20, -6], [3, -24]]) {
    cylinder('tree-trunk', x, 1.2, z, .4, .55, 2.4, steel, 6);
    cylinder('fir-lower', x, 3.0, z, 0, 4.5, 4.8, lawn, 7);
    cylinder('fir-upper', x, 5, z, 0, 3.4, 4.1, lawn, 7);
  }
  for (let i = 0; i < 5; i++) {
    const x = -47 + i * 7.3;
    box('pike-shop', x, 2.4, -65, 6.7, 4.8, 7, buildingMaterials[i % 4]);
    box('shop-window', x, 2, -68.53, 5.4, 2.5, .05, glass);
    box('shop-awning', x, 3.6, -69, 6.9, .32, 1.7, i % 2 ? pink : mint);
    box('shop-neon', x, 4.4, -68.6, 3.3, .25, .12, i % 2 ? amber : pink);
  }

  // Boardwalk and stylized waterfront wheel, visible off the northern bend.
  box('waterfront-boardwalk', -25, .2, 130, 145, .6, 9, concrete);
  const wx = -20, wz = 139, wy = 19;
  const wheel = CreateTorus('great-wheel', { diameter: 32, thickness: .45, tessellation: 40 }, scene);
  wheel.position.set(wx, wy, wz); wheel.rotation.x = Math.PI / 2; batch(wheel, blue);
  beam('wheel-leg-left', new Vector3(wx - 8, 0, wz), new Vector3(wx, wy, wz), .75, pale);
  beam('wheel-leg-right', new Vector3(wx + 8, 0, wz), new Vector3(wx, wy, wz), .75, pale);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const end = new Vector3(wx + Math.cos(angle) * 16, wy + Math.sin(angle) * 16, wz);
    beam('wheel-spoke', new Vector3(wx, wy, wz), end, .09, pale);
    box('wheel-gondola', end.x, end.y - .7, wz, 1.6, 1.5, 1.6, i % 2 ? mint : pink);
  }

  // One static mesh per material. No per-frame work is registered by the set.
  for (const [material, meshes] of batches) {
    if (!meshes.length) continue;
    const combined = Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
    if (combined) {
      combined.name = `seattle-batch-${material.name}`;
      combined.material = material;
      combined.isPickable = false;
      combined.freezeWorldMatrix();
    }
  }
}
