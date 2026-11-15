import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

type Point = [number, number, number];

/** Original low-poly coupe. Ground origin; +Z nose; wheel pivots in metadata.wheels. */
export function buildCar(scene: Scene): TransformNode {
  const car = new TransformNode('player-car', scene);
  const material = (name: string, hex: string, shine = 32, glow?: string) => {
    const m = new StandardMaterial(`car-${name}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.65, 0.76, 0.84);
    m.specularPower = shine;
    if (glow) m.emissiveColor = Color3.FromHexString(glow);
    return m;
  };
  const paint = material('glacier-paint', '#89d9e7', 110);
  const roofPaint = material('roof-paint', '#51a7bc', 100);
  const carbon = material('carbon', '#111b26', 65);
  const rubber = material('rubber', '#080c12', 8);
  rubber.specularColor.set(0.05, 0.06, 0.07);
  const glass = material('smoked-glass', '#092332', 180, '#04121b');
  const metal = material('brushed-alloy', '#b3c3cf', 95);
  const darkMetal = material('wheel-barrel', '#25323e', 60);
  const brake = material('brake-caliper', '#ff5d42', 40);
  const rearLight = material('tail-light', '#ff304e', 60, '#ff163f');
  const frontLight = material('head-light', '#e1ffff', 50, '#b0f6ff');
  const amber = material('amber', '#ffb849', 50, '#e97519');

  const surface = (name: string, points: Point[], indices: number[], mat: StandardMaterial, parent: TransformNode = car) => {
    const mesh = new Mesh(`car-${name}`, scene);
    const positions = points.flat();
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    const data = new VertexData();
    data.positions = positions; data.indices = indices; data.normals = normals;
    data.uvs = points.flatMap(([x, , z]) => [x * .5 + .5, z / 4.5 + .5]);
    data.applyToMesh(mesh);
    mesh.material = mat; mesh.parent = parent;
    mesh.isPickable = false;
    // Small original body panels are double-sided so grazing chase-camera angles
    // cannot expose a missing face at a seam. No transparent material sorting.
    mat.backFaceCulling = false;
    return mesh;
  };
  const quad = (name: string, points: Point[], mat: StandardMaterial) => surface(name, points, [0, 1, 2, 0, 2, 3], mat);
  const box = (name: string, width: number, height: number, depth: number, x: number, y: number, z: number, mat: StandardMaterial, parent: TransformNode = car) => {
    const m = MeshBuilder.CreateBox(`car-${name}`, { width, height, depth }, scene);
    m.position.set(x, y, z); m.material = mat; m.parent = parent; m.isPickable = false;
    return m;
  };

  // A continuous seven-sided coachwork section: tapered nose, broad haunches,
  // arched lower flanks over the wheels, and crisp shoulder reflections.
  const stations = [
    [-2.25, 0.80, 0.82], [-2.09, 0.95, 0.98], [-1.73, 1.00, 1.04],
    [-1.49, 1.02, 1.06], [-1.28, 1.02, 1.07], [-1.04, 1.01, 1.08],
    [-0.83, 0.97, 1.07], [-0.60, 0.94, 1.05], [0.60, 0.94, 1.02],
    [0.85, 0.98, 1.00], [1.07, 1.00, 0.98], [1.30, 1.00, 0.96],
    [1.53, 0.99, 0.94], [1.76, 0.95, 0.89], [2.10, 0.85, 0.76], [2.25, 0.75, 0.66],
  ];
  const bodyPoints: Point[] = [];
  for (const [z, w, top] of stations) {
    const wheelDistance = Math.min(Math.abs(z + 1.30), Math.abs(z - 1.30));
    const arch = wheelDistance < 0.49 ? Math.min(top - 0.08, 0.42 + Math.sqrt(Math.max(0, 0.49 ** 2 - wheelDistance ** 2))) : 0.40;
    bodyPoints.push([-w * 0.92, arch, z], [-w, top - 0.06, z], [-w * 0.81, top, z],
      [0, top + 0.025, z], [w * 0.81, top, z], [w, top - 0.06, z], [w * 0.92, arch, z]);
  }
  const bodyIndices: number[] = [];
  for (let r = 0; r < stations.length - 1; r++) for (let j = 0; j < 6; j++) {
    const a = r * 7 + j, b = a + 7;
    bodyIndices.push(a, b, b + 1, a, b + 1, a + 1);
  }
  for (const row of [0, stations.length - 1]) for (let j = 1; j < 6; j++) bodyIndices.push(row * 7, row * 7 + j, row * 7 + j + 1);
  surface('sculpted-body', bodyPoints, bodyIndices, paint);
  box('underbody', 1.58, 0.15, 3.75, 0, 0.38, 0, carbon);

  // Four opaque panes and a painted canopy, not a box planted on the hood.
  quad('windshield', [[-.76,1.055,.87],[.76,1.055,.87],[.61,1.56,.21],[-.61,1.56,.21]], glass);
  quad('rear-window', [[.77,1.09,-1.04],[-.77,1.09,-1.04],[-.61,1.53,-.56],[.61,1.53,-.56]], glass);
  surface('roof', [[-.61,1.56,.21],[.61,1.56,.21],[.61,1.53,-.56],[-.61,1.53,-.56],[-.55,1.60,.14],[.55,1.60,.14],[.55,1.57,-.48],[-.55,1.57,-.48]],
    [4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7], roofPaint);
  for (const side of [-1, 1]) {
    quad(`side-glass-${side}`, [[side*.79,1.075,-.98],[side*.79,1.055,.81],[side*.63,1.535,.18],[side*.63,1.51,-.53]], glass);
    quad(`a-pillar-${side}`, [[side*.79,1.055,.87],[side*.74,1.06,.87],[side*.585,1.565,.21],[side*.645,1.565,.21]], paint);
    quad(`rear-pillar-${side}`, [[side*.85,1.07,-1.08],[side*.74,1.09,-1.01],[side*.58,1.545,-.55],[side*.66,1.545,-.55]], paint);
    quad(`window-divider-${side}`, [[side*.8,1.06,-.31],[side*.8,1.06,-.36],[side*.635,1.53,-.36],[side*.635,1.53,-.31]], carbon);
    box(`rocker-${side}`, .12, .10, 1.53, side*.95, .40, 0, carbon);
    box(`rocker-accent-${side}`, .025, .025, 1.48, side*1.015, .45, 0, roofPaint);
    box(`door-handle-${side}`, .025, .035, .19, side*.955, .91, -.37, darkMetal);
    const mirror = box(`mirror-${side}`, .22, .10, .25, side*1.02, 1.12, .57, carbon);
    mirror.rotation.y = side * .12;
    // Vented rear-quarter intakes, visible past the cabin in chase view.
    quad(`side-intake-${side}`, [[side*.972,.59,-.69],[side*.985,.88,-.75],[side*.97,.9,-.46],[side*.955,.63,-.40]], carbon);
    for (let j = 0; j < 3; j++) box(`intake-fin-${side}-${j}`, .025, .025, .20, side*.982, .66+j*.075, -.58, darkMetal);
    // Small dark bonnet vents offset from the central body crease.
    const vent = box(`hood-vent-${side}`, .24, .012, .44, side*.56, .979, 1.15, carbon);
    vent.rotation.x = .09;
  }

  // Deep, wide rear fascia, illuminated thin lenses and exposed diffuser.
  box('rear-fascia', 1.67, .25, .06, 0, .66, -2.225, carbon);
  box('rear-light-bar', 1.57, .042, .035, 0, .86, -2.238, rearLight);
  for (const side of [-1, 1]) {
    box(`rear-lamp-${side}`, .48, .071, .05, side*.56, .78, -2.254, rearLight);
    box(`rear-lamp-end-${side}`, .045, .15, .06, side*.802, .815, -2.23, rearLight);
    box(`spoiler-upright-${side}`, .055, .19, .13, side*.58, 1.10, -1.96, carbon);
    box(`front-lamp-${side}`, .47, .065, .065, side*.57, .73, 2.109, frontLight);
    box(`front-corner-marker-${side}`, .025, .055, .17, side*.862, .73, 1.99, amber);
    const pipe = MeshBuilder.CreateCylinder(`car-exhaust-${side}`, {height:.15,diameter:.15,tessellation:10}, scene);
    pipe.rotation.x = Math.PI / 2; pipe.position.set(side*.65,.46,-2.25); pipe.parent=car; pipe.material=metal; pipe.isPickable=false;
    const hole = MeshBuilder.CreateCylinder(`car-exhaust-dark-${side}`, {height:.012,diameter:.105,tessellation:10}, scene);
    hole.rotation.x=Math.PI/2; hole.position.set(side*.65,.46,-2.333); hole.parent=car; hole.material=carbon; hole.isPickable=false;
  }
  const wing = box('floating-rear-wing', 1.95, .065, .29, 0, 1.205, -1.99, carbon);
  wing.rotation.x = -.07;
  box('rear-wing-highlight', 1.84, .014, .026, 0, 1.242, -2.13, paint);
  box('front-splitter', 1.73, .065, .32, 0, .36, 2.08, carbon);
  box('front-grille', 1.19, .16, .05, 0, .53, 2.244, carbon);
  for(let i=-2;i<=2;i++) box(`diffuser-fin-${i}`, .035, .19, .40, i*.25, .365, -2.02, carbon);

  const wheels: TransformNode[] = [];
  const frontWheels: TransformNode[] = [];
  for (const z of [-1.30, 1.30]) for (const side of [-1, 1]) {
    const steering = new TransformNode(`car-${z>0?'front':'rear'}-${side<0?'left':'right'}-steer`, scene);
    steering.parent = car; steering.position.set(side*.93,.425,z);
    const spin = new TransformNode(`car-wheel-spin-${z}-${side}`, scene); spin.parent=steering;
    wheels.push(spin); if(z>0) frontWheels.push(steering);
    const cylinder = (name:string, diameter:number, height:number, mat:StandardMaterial, x=0) => {
      const mesh = MeshBuilder.CreateCylinder(`car-${name}-${z}-${side}`, {diameter,height,tessellation:16}, scene);
      mesh.rotation.z = Math.PI/2; mesh.position.x=x; mesh.parent=spin; mesh.material=mat; mesh.isPickable=false;
      return mesh;
    };
    cylinder('tire', .81, .26, rubber);
    cylinder('alloy-rim', .59, .275, metal);
    cylinder('rim-recess', .49, .285, darkMetal);
    cylinder('brake-disc', .35, .29, metal);
    for (let spoke=0; spoke<5; spoke++) {
      const angle = spoke * Math.PI * 2 / 5;
      const blade = box(`wheel-spoke-${z}-${side}-${spoke}`, .035, .24, .058, side*.153, Math.cos(angle)*.145, Math.sin(angle)*.145, metal, spin);
      blade.rotation.x = angle;
    }
    cylinder('wheel-hub', .135, .32, darkMetal);
    // Calipers stay stationary while the wheel spins.
    box(`caliper-${z}-${side}`, .034, .18, .09, side*.15, .015, -.15, brake, steering);
  }

  // Localized opaque pools, instead of costly per-car dynamic lights/shadows.
  const shadowMat = material('contact-shadow', '#03070c', 1);
  shadowMat.disableLighting = true; shadowMat.emissiveColor.set(.006,.009,.015);
  const contact = MeshBuilder.CreateDisc('car-contact-shadow', {radius:1,tessellation:24}, scene);
  contact.rotation.x=Math.PI/2; contact.scaling=new Vector3(1.08,2.18,1); contact.position.y=.012;
  contact.parent=car; contact.material=shadowMat; contact.isPickable=false;
  // Batch stationary coachwork by material. Wheels retain their separate pivots
  // for suspension/steering/spin, while the detailed body is only a few draws.
  const batches = new Map<StandardMaterial, Mesh[]>();
  for (const node of car.getChildMeshes(true)) {
    if (!(node instanceof Mesh) || node === contact || !(node.material instanceof StandardMaterial)) continue;
    const batch = batches.get(node.material) ?? [];
    batch.push(node); batches.set(node.material, batch);
  }
  for (const [mat, batch] of batches) {
    if (batch.length < 2) continue;
    const merged = Mesh.MergeMeshes(batch, true, true);
    if (merged) { merged.name = `car-body-${mat.name}`; merged.parent = car; merged.isPickable = false; }
  }
  car.metadata = {
    wheels, frontWheels, wheelRadius: .405, length: 4.5, forward: '+Z',
    setPaint(hex: string) {
      if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
      const color = Color3.FromHexString(hex);
      paint.diffuseColor.copyFrom(color);
      roofPaint.diffuseColor.copyFrom(color.scale(.72));
    },
  };
  return car;
}

/** Lower-draw-call version of the same coupe for the other racers. */
export function buildRival(scene: Scene, hex: string): TransformNode {
  const car = new TransformNode('rival-coupe', scene);
  const material = (name: string, color: string, emissive = false) => {
    const m = new StandardMaterial('rival-' + name, scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularPower = 72;
    if (emissive) m.emissiveColor = m.diffuseColor.scale(.8);
    return m;
  };
  const paint = material('paint', /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#89d9e7');
  const glass = material('glass', '#15334c');
  const trim = material('trim', '#101722');
  const lamps = material('lamps', '#ff416b', true);
  const box = (name: string, width: number, height: number, depth: number, x: number, y: number, z: number, mat: StandardMaterial) => {
    const m = MeshBuilder.CreateBox('rival-' + name, { width, height, depth }, scene);
    m.position.set(x, y, z); m.material = mat; m.parent = car; m.isPickable = false;
    return m;
  };
  const sides = [
    [-2.18,.45, .88],[-1.6,.53, 1.02],[.9,.48, .97],[1.78,.40, .81],[2.23,.36,.64],
  ];
  const positions = sides.flatMap(([z,y,x]) => [-x,.28,z,-x,y+.48,z,x,y+.48,z,x,.28,z]);
  const indices: number[] = [0,1,2,0,2,3,16,18,17,16,19,18];
  for (let k=0;k<sides.length-1;k++) for(let f=0;f<3;f++) {
    const a=k*4+f, b=a+4;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  const shell = new Mesh('rival-body', scene), body = new VertexData(), normals:number[]=[];
  VertexData.ComputeNormals(positions,indices,normals);
  body.positions=positions;body.indices=indices;body.normals=normals;body.applyToMesh(shell);
  paint.backFaceCulling=false;shell.material=paint;shell.parent=car;shell.isPickable=false;
  box('canopy',1.38,.41,1.45,0,1.13,.10,glass);
  box('roof',1.12,.095,1.18,0,1.36,.16,paint);
  box('wing',2.14,.09,.43,0,1.14,-1.84,trim);
  box('taillights',1.71,.12,.06,0,.74,-2.18,lamps);
  for(const x of [-.97,.97])for(const z of [-1.30,1.27]){
    const tire=MeshBuilder.CreateCylinder('rival-tire',{height:.25,diameter:.80,tessellation:12},scene);
    tire.rotation.z=Math.PI/2;tire.position.set(x,.40,z);tire.parent=car;tire.material=trim;tire.isPickable=false;
  }
  car.metadata={materials:[paint,glass,trim,lamps]};
  return car;
}
