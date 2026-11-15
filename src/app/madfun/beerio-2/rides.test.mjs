import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = mkdtempSync(join(root, '.beerio2-rides-tests-'));
after(() => rmSync(output, { recursive: true, force: true }));
const compiled = new Set();
function compile(file) {
  const target = join(output, relative(root, file)).replace(/\.ts$/, '.mjs');
  if (compiled.has(file)) return target;
  compiled.add(file);
  let source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  source = source.replace(/(from\s*['"])([^'"]+)(['"])/g, (match, prefix, spec, suffix) => {
    if (spec.startsWith('.')) { compile(resolve(dirname(file), `${spec}.ts`)); return `${prefix}${spec}.mjs${suffix}`; }
    if (spec.startsWith('@babylonjs/')) return `${prefix}${spec}.js${suffix}`;
    return match;
  });
  mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, source); return target;
}
const load = file => import(pathToFileURL(compile(resolve(root, file))).href);
const { buildRide } = await load('src/app/madfun/beerio-2/rides.ts');
const { rideGeometry, rideHeadGeometry, DRIVER_ANCHORS, DRIVER_HEAD_SCALE } = await load('src/app/madfun/beerio-2/ride-geometry.ts');
const { racerGeometry, characterHeadGeometry, parseColor } = await load('src/app/beerio/game/renderer.ts');
const { GARAGE_VEHICLES, CHARACTERS } = await load('src/app/beerio/appearance.ts');
const paint = '#fc8855';
const bounds = data => {
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  for (let i=0;i<data.length;i+=6) for(let a=0;a<3;a++){min[a]=Math.min(min[a],data[i+a]);max[a]=Math.max(max[a],data[i+a]);}
  return {min,max};
};
function fixture(run) {
  const engine = new NullEngine(); const scene = new Scene(engine);
  try { run(scene); } finally { scene.dispose(); engine.dispose(); }
}

test('all 13 garage bodies preserve every original coachwork vertex, paint and +Z orientation', () => {
  const silhouettes = new Set();
  for (const {id:vehicle} of GARAGE_VEHICLES) {
    const ride = { vehicle, character:'fox' }, original = racerGeometry(parseColor(paint),'fox',vehicle,false).data;
    const full = rideGeometry(ride,paint).data, head = rideHeadGeometry(ride,paint).data;
    assert.deepEqual(full.slice(0,original.length),original, `${vehicle} original body remains unchanged`);
    assert.deepEqual(full.slice(original.length),head, `${vehicle} has exactly one head and no seated body`);
    assert.equal(full.length%18,0); assert.ok(full.every(Number.isFinite));
    const {min,max} = bounds(original);
    assert.ok(min[1]>=-.06 && min[1]<.05, `${vehicle} tyres remain at ground`);
    assert.ok(max[2]-min[2] > 2.4 && max[2]-min[2]<5.1);
    assert.ok(max[0]-min[0] > .9 && max[0]-min[0]<2.5);
    silhouettes.add(JSON.stringify([min,max]));
  }
  assert.equal(silhouettes.size,13,'not thirteen recolors of one coupe');
});

test('every selectable head uses the same face-forward scale, with no neck/torso or V1 mutation', () => {
  for (const {id:character} of CHARACTERS) for (const vehicle of ['nightjar',...GARAGE_VEHICLES.map(v=>v.id)]) {
    const ride = { vehicle, character }, base = characterHeadGeometry(parseColor(paint),character).data;
    const head = rideHeadGeometry(ride,paint).data, anchor = DRIVER_ANCHORS[vehicle];
    assert.equal(head.length,base.length);
    for(let i=0;i<head.length;i+=6) {
      assert.equal(head[i],base[i]*DRIVER_HEAD_SCALE+anchor[0]);
      assert.equal(head[i+1],(base[i+1]-1)*DRIVER_HEAD_SCALE+anchor[1]);
      assert.equal(head[i+2],base[i+2]*DRIVER_HEAD_SCALE+anchor[2]);
    }
    const {min,max} = bounds(head);
    assert.ok(min[1]>.6 && max[1]<3.6, `${vehicle}/${character} head is at roof/saddle, not ground`);
    assert.ok(max[2]>anchor[2], 'face remains towards +Z');
  }
});

test('head anchors clear each actual roof with the face exposed and no tall SUV clipping', () => {
  const roofs = {'nightjar':1.398,'bmw-m2':1.255,'bmw-m3':1.275,'bmw-m4':1.215,'amg-gt':1.165,'amg-g63':1.835,lamborghini:1.06,mclaren:1.04,ferrari:1.027,bugatti:1.15,cybertruck:1.65,'tesla-roadster':1.10,ducati:1.055,'bmw-bike':1.055};
  for(const [vehicle,roof] of Object.entries(roofs)) {
    const anchor = DRIVER_ANCHORS[vehicle];
    assert.ok(anchor[1]-roof>=.23, `${vehicle} eyes and upper head visible above roof`);
    assert.ok(anchor[1]-roof<.40, `${vehicle} head cannot float high above roof/saddle`);
  }
  assert.deepEqual(rideGeometry({vehicle:'nightjar',character:'fox'},paint),rideHeadGeometry({vehicle:'nightjar',character:'fox'},paint));
});

test('garage GPU rides use one draw, finite normals and safe animation metadata', () => fixture(scene => {
  for(const {id:vehicle} of GARAGE_VEHICLES) {
    const car = buildRide(scene,{vehicle,character:'gorilla'},paint,true);
    const meshes = car.getChildMeshes();
    assert.equal(meshes.length,1); assert.equal(meshes[0].subMeshes.length,1);
    assert.ok(meshes[0].getVerticesData('normal').every(Number.isFinite));
    assert.equal(car.metadata.forward,'+Z'); assert.deepEqual(car.metadata.wheels,[]);
    const positions = [...meshes[0].getVerticesData('position')];
    const colors = [...meshes[0].getVerticesData('color')];
    car.metadata.setPaint('#33aaff'); car.metadata.setBraking(true); car.metadata.updateDetail(80,.016,20,.2);
    assert.deepEqual([...meshes[0].getVerticesData('position')],positions);
    assert.notDeepEqual([...meshes[0].getVerticesData('color')],colors);
    car.dispose(false,true);
  }
}));

test('Nightjar retains its original animated wheels and body with exactly one selected head', () => fixture(scene => {
  for(const hero of [true,false]) {
    const car=buildRide(scene,{vehicle:'nightjar',character:'fox'},paint,hero);
    assert.equal(car.metadata.wheels.length,4);
    assert.equal(car.getChildMeshes().filter(mesh=>mesh.name==='nightjar-driver-head').length,1);
    car.metadata.updateDetail(100,.016,20,.2);
    assert.ok(car.getChildMeshes().find(mesh=>mesh.name==='nightjar-driver-head').isEnabled());
    car.dispose(false,true);
  }
}));

test('disposing one batched ride cannot dispose another rider material', () => fixture(scene => {
  const before=scene.materials.length;
  const a=buildRide(scene,{vehicle:'ferrari',character:'fox'},paint),b=buildRide(scene,{vehicle:'amg-g63',character:'frog'},paint);
  a.dispose(false,true);
  assert.ok(b.getChildMeshes()[0].material);
  assert.ok(scene.materials.includes(b.getChildMeshes()[0].material));
  b.dispose(false,true);
  assert.ok(scene.materials.length<=before+1);
}));
