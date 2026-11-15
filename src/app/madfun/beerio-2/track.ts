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
export function buildTrack(scene: Scene, path: Vector3[], trackId: 'seattle' | 'orbit' = 'seattle'): void {
  if (path.length < 3) return;
  if (trackId === 'orbit') { buildOrbitalTrack(scene, path); return; }
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

/** Orbit is its own place, not Seattle recolored. All structures are actual 3D
 * geometry. No textures, particle systems, shadows, or frame observers are needed;
 * the entire orbital outpost is collapsed into one static mesh per material. */
function buildOrbitalTrack(scene: Scene, path: Vector3[]): void {
  const batches = new Map<StandardMaterial, Mesh[]>();
  const mat = (name: string, color: string, emission = 0) => {
    const material = new StandardMaterial(`orbit-${name}`, scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.emissiveColor = material.diffuseColor.scale(emission);
    material.specularColor = new Color3(.35, .4, .6);
    material.specularPower = 72;
    return material;
  };
  const road = mat('racing-surface', '#20263f', .16);
  const hull = mat('hull', '#343553', .12);
  const dark = mat('recess', '#0c1227', .14);
  const silver = mat('titanium', '#a9b2d0', .25);
  const cyan = mat('ion-cyan', '#46e9ff', 1);
  const violet = mat('plasma-violet', '#9a7bff', 1);
  const pink = mat('signal-pink', '#ff58ba', 1);
  const warm = mat('starlight', '#ffdaa4', .9);
  const planet = mat('planet-ocean', '#304d86', .42);
  const land = mat('planet-clouds', '#6f8daf', .58);
  const ringMaterial = mat('planet-rings', '#ac85b0', .6);
  const stars = mat('stars', '#c8dbff', 1);
  const batch = (mesh: Mesh, material: StandardMaterial) => {
    mesh.material = material;
    mesh.isPickable = false;
    const group = batches.get(material) ?? [];
    group.push(mesh);
    batches.set(material, group);
    return mesh;
  };
  const box = (name: string, position: Vector3, width: number, height: number, depth: number, material: StandardMaterial) => {
    const mesh = CreateBox(name, { width, height, depth }, scene);
    mesh.position.copyFrom(position);
    return batch(mesh, material);
  };
  const beam = (name: string, a: Vector3, b: Vector3, width: number, material: StandardMaterial) => {
    const delta = b.subtract(a);
    const mesh = box(name, a.add(b).scale(.5), width, delta.length(), width, material);
    mesh.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), delta.normalize(), new Quaternion());
    return mesh;
  };
  const sphere = (name: string, position: Vector3, diameter: number, material: StandardMaterial, segments = 16) => {
    const mesh = CreateSphere(name, { diameter, segments }, scene);
    mesh.position.copyFrom(position);
    return batch(mesh, material);
  };
  const ring = (name: string, position: Vector3, diameter: number, thickness: number, material: StandardMaterial, tessellation = 64) => {
    // Six tube sides are enough for sub-pixel cables. Babylon's stock torus
    // applies tessellation in both directions, wasting thousands of vertices.
    const positions: number[] = [], normals: number[] = [], indices: number[] = [], uvs: number[] = [];
    const tubeSides = 6;
    for (let i = 0; i <= tessellation; i++) {
      const u = i / tessellation * Math.PI * 2;
      for (let j = 0; j <= tubeSides; j++) {
        const v = j / tubeSides * Math.PI * 2, radius = diameter / 2 + Math.cos(v) * thickness / 2;
        positions.push(Math.cos(u) * radius, Math.sin(v) * thickness / 2, Math.sin(u) * radius);
        normals.push(Math.cos(u) * Math.cos(v), Math.sin(v), Math.sin(u) * Math.cos(v));
        uvs.push(i / tessellation, j / tubeSides);
        if (i < tessellation && j < tubeSides) {
          const a = i * (tubeSides + 1) + j, b = a + tubeSides + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const data = new VertexData();
    data.positions = positions; data.indices = indices; data.normals = normals; data.uvs = uvs;
    const mesh = new Mesh(name, scene);
    data.applyToMesh(mesh);
    mesh.position.copyFrom(position);
    return batch(mesh, material);
  };
  const normals = path.map((_, i) => {
    const tangent = path[(i + 1) % path.length].subtract(path[(i + path.length - 1) % path.length]);
    return new Vector3(-tangent.z, 0, tangent.x).normalize();
  });
  const ribbon = (name: string, offsets: number[], heights: number[], material: StandardMaterial) => {
    const positions: number[] = [], indices: number[] = [], ns: number[] = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i], n = normals[i];
      for (let side = 0; side < 2; side++) positions.push(p.x + n.x * offsets[side], p.y + heights[side], p.z + n.z * offsets[side]);
      const a = i * 2, b = ((i + 1) % path.length) * 2;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    VertexData.ComputeNormals(positions, indices, ns);
    const data = new VertexData();
    data.positions = positions; data.indices = indices; data.normals = ns;
    data.uvs = new Array(path.length * 4).fill(0);
    const mesh = new Mesh(name, scene);
    data.applyToMesh(mesh);
    material.backFaceCulling = false;
    return batch(mesh, material);
  };
  // A readable dark racing lane with bright, separated shoulders. The outer
  // structural sidewalls give the bridge volume when viewed across the void.
  ribbon('orbit-road', [-6, 6], [.025, .025], road);
  ribbon('orbit-deck', [-7.5, 7.5], [-.12, -.12], hull);
  ribbon('orbit-keel', [-6.7, 6.7], [-1.2, -1.2], dark);
  for (const side of [-1, 1]) {
    const light = side < 0 ? cyan : pink;
    ribbon('orbit-lane-edge', [side * 5.65, side * 5.76], [.045, .045], silver);
    ribbon('orbit-shoulder', [side * 6.1, side * 6.7], [.035, .035], dark);
    ribbon('orbit-light-trench', [side * 6.9, side * 7.18], [.065, .065], light);
    ribbon('orbit-deck-wall', [side * 7.5, side * 6.7], [-.12, -1.2], hull);
    ribbon('orbit-keel-light', [side * 6.64, side * 6.72], [-1.21, -1.21], violet);
  }

  let seed = 61726;
  const rand = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  let distance = 0, nextDash = 3, nextFin = 0, nextGate = 40, nextPanel = 0;
  path.forEach((p, i) => {
    const q = path[(i + 1) % path.length], tangent = q.subtract(p).normalize();
    const length = Vector3.Distance(p, q), normal = normals[i];
    const point = (at: number) => Vector3.Lerp(p, q, Math.min(1, Math.max(0, (at - distance) / length)));
    const roadBox = (name: string, at: Vector3, width: number, height: number, depth: number, material: StandardMaterial) => {
      const mesh = box(name, at, width, height, depth, material);
      mesh.rotation.y = Math.atan2(tangent.x, tangent.z);
      mesh.rotation.x = -Math.asin(tangent.y);
      return mesh;
    };
    while (nextDash < distance + length) {
      const r = point(nextDash);
      roadBox('orbit-center-marker', r.add(new Vector3(0, .052, 0)), .13, .012, 1.7, violet);
      nextDash += 8;
    }
    while (nextPanel < distance + length) {
      const r = point(nextPanel);
      roadBox('orbit-panel-joint', r.add(new Vector3(0, .039, 0)), 11.8, .008, .065, dark);
      // Twin inset ticks mark travel direction without obscuring the road.
      for (const side of [-1, 1]) {
        roadBox('orbit-shoulder-tick', r.add(normal.scale(side * 6.4)).add(new Vector3(0, .07, 0)), .5, .05, .8, nextPanel % 24 === 0 ? warm : silver);
      }
      nextPanel += 6;
    }
    while (nextFin < distance + length) {
      const r = point(nextFin);
      for (const side of [-1, 1]) {
        const outside = r.add(normal.scale(side * 7.8));
        roadBox('orbit-fin-foot', outside.add(new Vector3(0, -.6, 0)), 1.3, 1.4, 1.2, hull);
        const tip = r.add(normal.scale(side * 8.8)).add(new Vector3(0, 2.4, 0));
        beam('orbit-guard-fin', outside, tip, .22, silver);
        sphere('orbit-beacon', tip, .38, side < 0 ? cyan : pink, 4);
      }
      // Visible under-deck ribbing, not a flat ribbon in space.
      roadBox('orbit-deck-rib', r.add(new Vector3(0, -1, 0)), 15.7, .4, .75, hull);
      nextFin += 16;
    }
    while (nextGate < distance + length) {
      const r = point(nextGate);
      const gatePoint = (side: number, y: number) => r.add(normal.scale(side)).add(new Vector3(0, y, 0));
      const corners = [[-8.3, -.4], [-9.2, 5.8], [-6.4, 10.7], [6.4, 10.7], [9.2, 5.8], [8.3, -.4]];
      for (let k = 1; k < corners.length; k++) {
        const a = gatePoint(corners[k - 1][0], corners[k - 1][1]);
        const b = gatePoint(corners[k][0], corners[k][1]);
        beam('orbit-gate-frame', a, b, .68, hull);
        beam('orbit-gate-light', a.subtract(tangent.scale(.36)), b.subtract(tangent.scale(.36)), .15, k % 2 ? cyan : violet);
      }
      roadBox('orbit-gate-crown', gatePoint(0, 10.75), 3.5, .7, 1.0, dark);
      for (let tick = -1; tick <= 1; tick++) roadBox('orbit-gate-signal', gatePoint(tick * .65, 10.76).subtract(tangent.scale(.53)), .34, .3, .05, warm);
      nextGate += 94;
    }
    distance += length;
  });

  // A huge ringed blue planet, with layered physical cloud belts and a luminous
  // limb. It sits far outside the course, but close enough for mobile far planes.
  const planetCenter = new Vector3(-165, 99, 244);
  sphere('orbit-blue-planet', planetCenter, 151, planet, 40);
  for (const [height, radius, thickness] of [[-34, 133, 3.1], [-18, 147, 2.2], [11, 149, 3.7], [35, 132, 1.7]]) {
    const cloud = ring('orbit-cloud-belt', planetCenter.add(new Vector3(0, height, 0)), radius, thickness, land, 48);
    cloud.rotation.z = .1;
  }
  for (const [diameter, thickness] of [[200, 1.8], [211, 4.8], [224, 2.2], [235, .75]]) {
    const halo = ring('orbit-planet-ring', planetCenter, diameter, thickness, ringMaterial, 64);
    halo.rotation.z = -.35;
    halo.rotation.x = -.13;
  }
  const moon = new Vector3(195, 92, -205);
  sphere('orbit-distant-moon', moon, 44, land, 20);
  ring('orbit-moon-equator', moon, 45, .5, violet, 48).rotation.z = .4;

  // The outpost's vertical reactor creates a landmark distinct from the planet.
  // Its open rings frame the sky while a tiny core lights the interior.
  const reactor = new Vector3(0, 36, 5);
  sphere('orbit-reactor-core', reactor, 9, cyan, 12);
  for (let i = 0; i < 3; i++) {
    const halo = ring('orbit-reactor-orbit', reactor, 24 + i * 8, .48, i % 2 ? pink : violet, 48);
    halo.rotation.x = .38 + i * .75;
    halo.rotation.z = .6 + i * .5;
  }
  const mast = CreateCylinder('orbit-reactor-mast', { diameterTop: 1.6, diameterBottom: 4, height: 47, tessellation: 10 }, scene);
  mast.position.set(0, 5, 5); batch(mast, hull);
  ring('orbit-reactor-dock', new Vector3(0, 1, 5), 39, 2.2, hull, 48);
  ring('orbit-reactor-dock-edge', new Vector3(0, 2, 5), 40, .22, cyan, 48);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const edge = new Vector3(Math.cos(a) * 20, 1, 5 + Math.sin(a) * 20);
    beam('orbit-reactor-spoke', new Vector3(0, 1, 5), edge, 1, hull);
    beam('orbit-reactor-stay', edge, new Vector3(0, 24, 5), .13, silver);
  }

  // Sparse satellites and solar sails read as architecture instead of a field
  // of generic floating cubes. All remain well outside the driveable perimeter.
  for (let i = 0; i < 7; i++) {
    const angle = i / 7 * Math.PI * 2 + .2;
    const center = new Vector3(Math.cos(angle) * 195, -5 + i % 3 * 17, Math.sin(angle) * 190);
    sphere('orbit-satellite-body', center, 5.4, hull, 8);
    ring('orbit-satellite-collar', center, 5.8, .28, cyan, 24).rotation.z = Math.PI / 2;
    beam('orbit-solar-boom', center.add(new Vector3(-19, 0, 0)), center.add(new Vector3(19, 0, 0)), .35, silver);
    for (const side of [-1, 1]) {
      const sail = center.add(new Vector3(side * 13, 0, 0));
      box('orbit-solar-sail', sail, 16, .16, 9, dark);
      for (let stripe = -3; stripe <= 3; stripe++) box('orbit-sail-cell', sail.add(new Vector3(stripe * 2, .12, 0)), .08, .04, 8.7, violet);
      for (const z of [-4.4, 0, 4.4]) box('orbit-sail-rail', sail.add(new Vector3(0, .12, z)), 16, .05, .1, cyan);
    }
  }
  // Deterministic, batched low-poly stars. Nothing twinkles or allocates per frame.
  for (let i = 0; i < 160; i++) {
    const angle = rand() * Math.PI * 2, radius = 315 + rand() * 80;
    const position = new Vector3(Math.cos(angle) * radius, 35 + rand() * 245, Math.sin(angle) * radius);
    sphere('orbit-star', position, i % 9 === 0 ? .9 : .32 + rand() * .3, stars, 2);
  }
  for (const [material, meshes] of batches) {
    const merged = Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
    if (merged) {
      merged.name = `orbit-batch-${material.name}`;
      merged.material = material;
      merged.isPickable = false;
      merged.freezeWorldMatrix();
    }
  }
}
