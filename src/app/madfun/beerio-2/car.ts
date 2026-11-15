import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';

type Point = [number, number, number];

/** Original NIGHTJAR prototype hypercar. Ground origin; +Z nose; wheel pivots in metadata.wheels. */
export function buildCar(scene: Scene, coated = false): TransformNode {
  const car = new TransformNode('player-car', scene);
  const material = (name: string, hex: string, shine = 32, glow?: string) => {
    const m = new StandardMaterial(`car-${name}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.65, 0.76, 0.84);
    m.specularPower = shine;
    if (glow) m.emissiveColor = Color3.FromHexString(glow);
    return m;
  };
  const paint = material('glacier-paint', '#89e9ed', 160);
  paint.specularColor.set(.95, .98, 1);
  const roofPaint = material('roof-paint', '#51a7bc', 100);
  const carbon = material('carbon', '#111b26', 65);
  const rubber = material('rubber', '#080c12', 8);
  rubber.specularColor.set(0.05, 0.06, 0.07);
  const glass = material('smoked-glass', '#071522', 220, '#03101a');
  // View-dependent cool edge reflection without downloads, environment maps or
  // transparency sorting. The canopy reads as polished glass even on mobile.
  glass.emissiveFresnelParameters = new FresnelParameters();
  glass.emissiveFresnelParameters.leftColor = Color3.FromHexString('#427a92');
  glass.emissiveFresnelParameters.rightColor = Color3.FromHexString('#020710');
  glass.emissiveFresnelParameters.power = 3;
  const metal = material('brushed-alloy', '#b3c3cf', 95);
  const darkMetal = material('wheel-barrel', '#25323e', 60);
  const brake = material('brake-caliper', '#ff5d42', 40);
  const rearLight = material('tail-light', '#ff304e', 60, '#ff163f');
  const frontLight = material('head-light', '#e1ffff', 50, '#b0f6ff');
  const livery = material('ivory-livery', '#eff8ef', 90);
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
    [-2.25, 0.94, 0.80], [-2.09, 1.06, 0.96], [-1.73, 1.12, 1.04],
    [-1.49, 1.13, 1.08], [-1.28, 1.13, 1.09], [-1.04, 1.09, 1.06],
    [-0.83, 1.03, 1.01], [-0.60, 0.96, 0.97], [0.60, 0.96, 0.96],
    [0.85, 1.03, 0.99], [1.07, 1.08, 1.02], [1.30, 1.09, 1.03],
    [1.53, 1.08, 1.00], [1.76, 1.04, 0.91], [2.10, 0.98, 0.72], [2.25, 0.88, 0.60],
  ];
  const bodyPoints: Point[] = [];
  for (const [z, w, top] of stations) {
    const wheelDistance = Math.min(Math.abs(z + 1.30), Math.abs(z - 1.30));
    const arch = wheelDistance < 0.49 ? Math.min(top - 0.08, 0.42 + Math.sqrt(Math.max(0, 0.49 ** 2 - wheelDistance ** 2))) : 0.40;
    bodyPoints.push([-w * 0.92, arch, z], [-w, top - 0.06, z], [-w * 0.81, top, z],
      [0, top - 0.075, z], [w * 0.81, top, z], [w, top - 0.06, z], [w * 0.92, arch, z]);
  }
  const bodyIndices: number[] = [];
  for (let r = 0; r < stations.length - 1; r++) for (let j = 0; j < 6; j++) {
    const a = r * 7 + j, b = a + 7;
    bodyIndices.push(a, b, b + 1, a, b + 1, a + 1);
  }
  for (const row of [0, stations.length - 1]) for (let j = 1; j < 6; j++) bodyIndices.push(row * 7, row * 7 + j, row * 7 + j + 1);
  surface('sculpted-body', bodyPoints, bodyIndices, paint);
  box('underbody', 1.58, 0.15, 3.75, 0, 0.38, 0, carbon);

  // Fighter-canopy cockpit: a single swept dark volume between flying
  // buttresses. Its low roof and wide exposed shoulders define the silhouette.
  quad('windshield', [[-.71,.99,.93],[.71,.99,.93],[.53,1.39,.12],[-.53,1.39,.12]], glass);
  quad('rear-window', [[.68,1.02,-1.10],[-.68,1.02,-1.10],[-.52,1.35,-.63],[.52,1.35,-.63]], glass);
  quad('canopy-roof', [[-.53,1.39,.12],[.53,1.39,.12],[.52,1.35,-.63],[-.52,1.35,-.63]], carbon);
  quad('roof-spine', [[-.065,1.398,.12],[.065,1.398,.12],[.065,1.358,-.63],[-.065,1.358,-.63]], paint);
  for (const side of [-1, 1]) {
    quad(`side-glass-${side}`, [[side*.73,1.025,-1.02],[side*.73,.99,.87],[side*.54,1.38,.12],[side*.54,1.345,-.63]], glass);
    quad(`a-pillar-${side}`, [[side*.75,.99,.93],[side*.70,.99,.93],[side*.505,1.40,.12],[side*.555,1.40,.12]], paint);
    quad(`flying-buttress-${side}`, [[side*.96,1.015,-1.57],[side*.77,1.02,-1.55],[side*.50,1.365,-.61],[side*.61,1.365,-.61]], paint);
    quad(`buttress-inset-${side}`, [[side*.91,1.025,-1.50],[side*.80,1.03,-1.48],[side*.54,1.365,-.69],[side*.59,1.365,-.69]], carbon);
    // Recessed side tunnel, blade sill and forward canard read at track speed.
    quad(`side-tunnel-${side}`, [[side*.985,.46,-.79],[side*1.06,.91,-.94],[side*.975,.87,-.38],[side*.965,.52,.63]], carbon);
    quad(`intake-leading-edge-${side}`, [[side*1.075,.46,-.83],[side*1.095,.93,-.96],[side*1.035,.92,-.85],[side*1.01,.48,-.66]], roofPaint);
    box(`rocker-${side}`, .17, .07, 1.78, side*.995, .34, 0, carbon);
    box(`rocker-accent-${side}`, .025, .025, 1.68, side*1.085, .382, -.03, paint);
    quad(`side-blade-${side}`, [[side*1.10,.39,-.78],[side*1.04,.46,.71],[side*.96,.49,.67],[side*1.00,.43,-.76]], roofPaint);
    const mirror = box(`mirror-${side}`, .22, .075, .20, side*1.05, 1.045, .60, carbon);
    mirror.rotation.y = side * .23;
    box(`mirror-stalk-${side}`, .15, .025, .035, side*.91, 1.02, .58, darkMetal);
    // Carbon channels sink into each front fender, beside the sculpted nose.
    quad(`hood-vent-${side}`, [[side*.48,.983,.90],[side*.77,1.004,1.10],[side*.77,.925,1.70],[side*.48,.900,1.69]], carbon);
    for (let j = 0; j < 3; j++) {
      const fin = box(`hood-louver-${side}-${j}`, .24, .018, .035, side*.625, .977-j*.025, 1.15+j*.17, darkMetal);
      fin.rotation.x = .10;
    }
    quad(`front-canard-${side}`, [[side*1.09,.43,1.66],[side*1.10,.40,2.02],[side*.87,.40,2.14],[side*.94,.47,1.70]], carbon);
    // Front lamps are inlaid swept laser blades, with a short outer fang.
    quad(`front-lamp-${side}`, [[side*.43,.695,2.115],[side*.94,.745,2.06],[side*.94,.780,2.015],[side*.43,.73,2.075]], frontLight);
    box(`front-lamp-fang-${side}`, .035, .15, .035, side*.925, .67, 2.075, frontLight);
    box(`front-corner-marker-${side}`, .025, .035, .13, side*1.015, .72, 1.89, amber);
    // Broad shadow pocket behind the rear light's broken boomerang signature.
    box(`rear-lamp-pocket-${side}`, .83, .19, .075, side*.555, .77, -2.235, carbon);
    box(`rear-lamp-${side}`, .76, .035, .035, side*.56, .845, -2.281, rearLight);
    const slash = box(`rear-lamp-slash-${side}`, .23, .035, .04, side*.885, .79, -2.284, rearLight);
    slash.rotation.z = side*.52;
    box(`rear-lamp-return-${side}`, .43, .022, .04, side*.70, .735, -2.284, rearLight);
    // Raised swan-neck wing mounts and solid vertical endplates.
    const mount = box(`swan-neck-${side}`, .055, .38, .10, side*.64, 1.18, -1.93, carbon);
    mount.rotation.x = -.30;
    quad(`wing-endplate-${side}`, [[side*1.13,1.29,-2.28],[side*1.13,1.53,-2.23],[side*1.13,1.50,-1.79],[side*1.13,1.31,-1.82]], roofPaint);
    box(`endplate-signature-${side}`, .012, .028, .25, side*1.138, 1.47, -2.04, livery);
    // Titanium exhausts live high in the rear fascia, leaving the diffuser open.
    const pipe = MeshBuilder.CreateCylinder(`car-exhaust-${side}`, {height:.19,diameter:.18,tessellation:8}, scene);
    pipe.rotation.x = Math.PI / 2; pipe.position.set(side*.22,.64,-2.28); pipe.parent=car; pipe.material=metal; pipe.isPickable=false;
    const hole = MeshBuilder.CreateCylinder(`car-exhaust-dark-${side}`, {height:.014,diameter:.13,tessellation:8}, scene);
    hole.rotation.x=Math.PI/2; hole.position.set(side*.22,.64,-2.382); hole.parent=car; hole.material=carbon; hole.isPickable=false;
  }
  // The rear deck is a black heat-extraction panel, not a blank painted shelf.
  quad('engine-deck', [[-.40,1.045,-1.15],[.40,1.045,-1.15],[.48,.91,-2.08],[-.48,.91,-2.08]], carbon);
  for (let j=0; j<6; j++) {
    const slat=box(`engine-deck-louver-${j}`, .75, .025, .038, 0, 1.025-j*.021, -1.28-j*.13, darkMetal);
    slat.rotation.x=-.16;
  }
  quad('engine-spine', [[-.045,1.055,-1.14],[.045,1.055,-1.14],[.045,.925,-2.09],[-.045,.925,-2.09]], paint);
  // Fine asymmetric graphics sit on the actual angled center coachwork.
  for (const [left, right] of [[.12, .22], [.26, .29]]) {
    const rows=stations.filter(([z])=>z>=.85 && z<=2.10);
    const point=([z,w,top]:number[],x:number):Point=>[x,top-.075+.075*x/(w*.81)+.009,z];
    for(let i=1;i<rows.length;i++) quad(`nose-stripe-${left}-${i}`, [point(rows[i-1],left),point(rows[i-1],right),point(rows[i],right),point(rows[i],left)], livery);
  }
  // Swept wing planform with a cambered upper surface and crisp trailing edge.
  surface('floating-rear-wing', [[-1.12,1.365,-2.23],[1.12,1.365,-2.23],[1.08,1.40,-1.83],[.60,1.42,-1.89],[-.60,1.42,-1.89],[-1.08,1.40,-1.83],[-1.12,1.33,-2.23],[1.12,1.33,-2.23]],
    [0,1,3,1,2,3,0,3,4,0,4,5,0,6,7,0,7,1], carbon);
  box('rear-wing-highlight', 2.16, .018, .025, 0, 1.375, -2.235, paint);
  box('rear-fascia', 1.84, .25, .065, 0, .61, -2.23, carbon);
  box('rear-emblem', .105, .04, .018, 0, .845, -2.281, livery);
  box('rear-rain-light', .07, .075, .025, 0, .42, -2.31, rearLight);
  box('front-splitter', 1.98, .045, .34, 0, .31, 2.10, carbon);
  box('front-grille', 1.60, .15, .05, 0, .49, 2.244, carbon);
  box('front-keel', .12, .20, .10, 0, .48, 2.28, paint);
  quad('diffuser-ramp', [[-.96,.26,-1.75],[.96,.26,-1.75],[.96,.46,-2.30],[-.96,.46,-2.30]], darkMetal);
  for(let i=-3;i<=3;i++) {
    quad(`diffuser-fin-${i}`, [[i*.25,.25,-1.79],[i*.25,.28,-2.33],[i*.25,.51,-2.33],[i*.25,.39,-1.79]], carbon);
  }

  const wheels: TransformNode[] = [];
  const frontWheels: TransformNode[] = [];
  for (const z of [-1.30, 1.30]) for (const side of [-1, 1]) {
    const steering = new TransformNode(`car-${z>0?'front':'rear'}-${side<0?'left':'right'}-steer`, scene);
    steering.parent = car; steering.position.set(side*1.015,.425,z);
    const spin = new TransformNode(`car-wheel-spin-${z}-${side}`, scene); spin.parent=steering;
    wheels.push(spin); if(z>0) frontWheels.push(steering);
    const cylinder = (name:string, diameter:number, height:number, mat:StandardMaterial, x=0) => {
      const mesh = MeshBuilder.CreateCylinder(`car-${name}-${z}-${side}`, {diameter,height,tessellation:16}, scene);
      mesh.rotation.z = Math.PI/2; mesh.position.x=x; mesh.parent=spin; mesh.material=mat; mesh.isPickable=false;
      return mesh;
    };
    cylinder('tire', .81, .29, rubber);
    cylinder('alloy-rim', .63, .305, metal);
    cylinder('rim-recess', .55, .315, darkMetal);
    cylinder('brake-disc', .35, .29, metal);
    for (let spoke=0; spoke<5; spoke++) {
      const angle = spoke * Math.PI * 2 / 5;
      const blade = box(`wheel-spoke-${z}-${side}-${spoke}`, .035, .24, .058, side*.171, Math.cos(angle)*.155, Math.sin(angle)*.155, metal, spin);
      blade.rotation.x = angle;
    }
    cylinder('wheel-hub', .135, .355, darkMetal);
    // Calipers stay stationary while the wheel spins.
    box(`caliper-${z}-${side}`, .034, .18, .09, side*.167, .015, -.15, brake, steering);
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
  // Merge within each spinning pivot, never across pivots. The original
  // individual five spokes and stacked cylinders cost 40 draws on their own.
  for (const spin of wheels) {
    const byMaterial = new Map<StandardMaterial, Mesh[]>();
    for (const mesh of spin.getChildMeshes(true)) {
      if (!(mesh instanceof Mesh) || !(mesh.material instanceof StandardMaterial)) continue;
      const group = byMaterial.get(mesh.material) ?? [];
      group.push(mesh); byMaterial.set(mesh.material, group);
    }
    // MergeMeshes bakes world transforms; detach at the origin first so the
    // resulting local geometry does not receive the wheel offset twice.
    const parent = spin.parent; spin.parent = null;
    for (const group of byMaterial.values()) {
      if (group.length < 2) continue;
      const merged = Mesh.MergeMeshes(group, true, true);
      if (merged) { merged.parent = spin; merged.isPickable = false; }
    }
    spin.parent = parent;
  }
  // Only the hero paint receives the higher-cost two-lobe clear-coat
  // shader. Rivals retain their existing baked, single-material LOD.
  const coat = coated ? new PBRMaterial('car-clear-coated-body', scene) : null;
  const roofCoat = coated ? new PBRMaterial('car-clear-coated-roof', scene) : null;
  if (coat && roofCoat) {
    for (const [from, to, roughness] of [[paint, coat, .32], [roofPaint, roofCoat, .37]] as const) {
      to.albedoColor = from.diffuseColor.toLinearSpace();
      to.emissiveColor = to.albedoColor.scale(.032);
      to.metallic = .18; to.roughness = roughness;
      to.clearCoat.isEnabled = true;
      to.clearCoat.intensity = .74; to.clearCoat.roughness = .19;
      to.backFaceCulling = false;
      for (const mesh of car.getChildMeshes()) if (mesh.material === from) mesh.material = to;
      from.dispose();
    }
  }
  let rearActive = false;
  car.metadata = {
    wheels, frontWheels, wheelRadius: .405, length: 4.5, forward: '+Z', design: 'NIGHTJAR / 01',
    setPaint(hex: string) {
      if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
      const color = Color3.FromHexString(hex);
      paint.diffuseColor.copyFrom(color);
      roofPaint.diffuseColor.copyFrom(color.scale(.72));
      if (coat && roofCoat) {
        coat.albedoColor = color.toLinearSpace();
        roofCoat.albedoColor = color.scale(.72).toLinearSpace();
        coat.emissiveColor = coat.albedoColor.scale(.032);
        roofCoat.emissiveColor = roofCoat.albedoColor.scale(.032);
      }
    },
    setBraking(active: boolean) {
      if (active === rearActive) return;
      rearActive = active;
      rearLight.emissiveColor.set(active ? 1.45 : 1, active ? .24 : .086, active ? .40 : .247);
    },
  };
  return car;
}

/** Lower-draw-call version of the same coupe for the other racers. */
function buildFarRival(scene: Scene, hex: string): TransformNode {
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
    [-2.18,.40, .98],[-1.6,.53, 1.13],[.9,.48, 1.04],[1.78,.40, 1.04],[2.23,.30,.88],
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
  // Keep the raked screen and low roofline at distance, not a box canopy.
  const canopy = new Mesh('rival-raked-canopy', scene);
  const canopyData = new VertexData();
  const canopyPositions = [-.77,1.07,-1.04,.77,1.07,-1.04,.77,1.05,.87,-.77,1.05,.87,
    -.52,1.35,-.63,.52,1.35,-.63,.53,1.39,.12,-.53,1.39,.12];
  const canopyIndices = [0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
  const canopyNormals: number[] = [];
  VertexData.ComputeNormals(canopyPositions, canopyIndices, canopyNormals);
  canopyData.positions = canopyPositions; canopyData.indices = canopyIndices; canopyData.normals = canopyNormals;
  canopyData.applyToMesh(canopy); canopy.material = glass; canopy.parent = car; canopy.isPickable = false;
  glass.backFaceCulling = false;
  box('roof',1.06,.035,.75,0,1.39,-.255,trim);
  box('wing',2.24,.065,.40,0,1.38,-2.03,trim);
  box('taillights',1.71,.12,.06,0,.74,-2.18,lamps);
  for(const x of [-1.015,1.015])for(const z of [-1.30,1.27]){
    const tire=MeshBuilder.CreateCylinder('rival-tire',{height:.25,diameter:.80,tessellation:12},scene);
    tire.rotation.z=Math.PI/2;tire.position.set(x,.40,z);tire.parent=car;tire.material=trim;tire.isPickable=false;
  }
  car.metadata={materials:[paint,glass,trim,lamps]};
  return car;
}

/** Bake fixed material colors into vertices, keeping a single draw per pivot.
 * Only used by rivals; the hero retains its separate paint/glass/metal response.
 */
function bakeRivalBatch(meshes: Mesh[], parent: TransformNode, material: StandardMaterial, name: string) {
  if (!meshes.length) return;
  for (const mesh of meshes) {
    const color = (mesh.material as StandardMaterial).diffuseColor;
    const colors: number[] = [];
    for (let i = 0; i < mesh.getTotalVertices(); i++) colors.push(color.r, color.g, color.b, 1);
    mesh.setVerticesData(VertexBuffer.ColorKind, colors);
    if (!mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
      mesh.setVerticesData(VertexBuffer.UVKind, new Array(mesh.getTotalVertices() * 2).fill(0));
    }
    mesh.material = material;
    mesh.computeWorldMatrix(true);
  }
  const merged = Mesh.MergeMeshes(meshes, true, true);
  if (merged) { merged.name = name; merged.parent = parent; merged.isPickable = false; }
}

/** Same sculpted coupe nearby; a one-draw silhouette beyond the racing action.
 * Distance is in world metres. Hysteresis prevents flicker at the LOD boundary.
 */
export function buildRival(scene: Scene, hex: string): TransformNode {
  const root = new TransformNode('rival-coupe', scene);
  const near = buildCar(scene);
  near.name = 'rival-detail';
  near.metadata.setPaint(hex);
  const wheels = near.metadata.wheels as TransformNode[];
  const frontWheels = near.metadata.frontWheels as TransformNode[];
  const oldMaterials = new Set(near.getChildMeshes().map(mesh => mesh.material));
  const matte = new StandardMaterial('rival-vertex-finish', scene);
  matte.diffuseColor = Color3.White();
  matte.specularColor.set(.22, .27, .32);
  matte.specularPower = 64;
  matte.backFaceCulling = false;
  const lamps = new StandardMaterial('rival-vertex-lamps', scene);
  lamps.diffuseColor = Color3.White();
  lamps.emissiveColor = Color3.White();
  lamps.disableLighting = true;
  // Fixed calipers join the shell; spinning wheels retain their own pivots.
  const wheelMeshes = new Set(wheels.flatMap(wheel => wheel.getChildMeshes()));
  const staticMeshes = near.getChildMeshes().filter(mesh => !wheelMeshes.has(mesh)) as Mesh[];
  const lit = staticMeshes.filter(mesh => /tail-light|head-light|amber/.test(mesh.material?.name ?? ''));
  bakeRivalBatch(staticMeshes.filter(mesh => !lit.includes(mesh)), near, matte, 'rival-coachwork');
  bakeRivalBatch(lit, near, lamps, 'rival-lights');
  for (const wheel of wheels) {
    const parent = wheel.parent; wheel.parent = null;
    bakeRivalBatch(wheel.getChildMeshes() as Mesh[], wheel, matte, 'rival-spinning-wheel');
    wheel.parent = parent;
  }
  for (const material of oldMaterials) material?.dispose();
  const far = buildFarRival(scene, hex);
  const farMaterials = new Set(far.getChildMeshes().map(mesh => mesh.material));
  bakeRivalBatch(far.getChildMeshes() as Mesh[], far, matte, 'rival-distant-silhouette');
  for (const material of farMaterials) material?.dispose();
  near.parent = root; far.parent = root;
  far.setEnabled(false);
  let detailed = true;
  root.metadata = {
    materials: [matte, lamps], wheels, frontWheels, wheelRadius: .405,
    updateDetail(distance: number, dt = 0, speed = 0, steer = 0) {
      const next = detailed ? distance < 65 : distance < 50;
      if (next !== detailed) {
        detailed = next; near.setEnabled(next); far.setEnabled(!next);
      }
      if (!detailed) return;
      for (const wheel of wheels) wheel.rotation.x += speed * Math.min(.1, Math.max(0, dt)) / .405;
      for (const wheel of frontWheels) wheel.rotation.y = Math.max(-.45, Math.min(.45, steer));
    },
  };
  return root;
}
