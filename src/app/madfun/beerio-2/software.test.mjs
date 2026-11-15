import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

// Compile the shared original garage geometry as well as the CPU renderer.
const loaded = new Map();
function load(path) {
  if (loaded.has(path)) return loaded.get(path).exports;
  const module = { exports: {} }; loaded.set(path, module);
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', 'module', compiled)(specifier => load(resolve(dirname(path), `${specifier}.ts`)), module.exports, module);
  return module.exports;
}
const { createSoftwareView } = load(fileURLToPath(new URL('./software.ts', import.meta.url)));
const { RIDES } = load(fileURLToPath(new URL('./ride-selection.ts', import.meta.url)));
function canvas() {
  const fills = [], strokes = []; let path = [];
  const gradient = () => ({ addColorStop() {} });
  const ctx = {
    canvas: { width: 1200, height: 760 }, fills, strokes,
    setTransform() {}, createLinearGradient: gradient, createRadialGradient: gradient,
    fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {},
    beginPath() { path = []; }, moveTo(x,y) { path.push([x,y]); }, lineTo(x,y) { path.push([x,y]); },
    closePath() {}, arc() {}, ellipse() {},
    fill() { fills.push({ color: this.fillStyle, points: path }); },
    stroke() { strokes.push(path); },
  };
  return ctx;
}
const pose = { x: 0, y: 0, z: 0, yaw: .45, boost: false, camera: { x: 0, y: 3.5, z: -7 }, look: { x: 0, y: .5, z: 0 } };

test('compatibility studio uses the sculpted hypercar with round wheels and tint shading', () => {
  const ctx = canvas(), render = createSoftwareView(ctx, 'seattle', true);
  render({ ...pose, color: '#fc8855' });
  assert.ok(ctx.fills.length < 1800, 'static hero, selected head and plinth stay within a bounded polygon budget');
  assert.ok(ctx.fills.some(f => f.color === '#fc8855'));
  assert.ok(ctx.fills.some(f => f.color === '#9c5435'), 'paint retains shaded flanks');
  assert.equal(ctx.fills.filter(f => f.color === '#080e17' && f.points.length === 12).length, 4);
  assert.equal(ctx.fills.filter(f => f.color === '#ff4269').length, 2);
  assert.equal(ctx.fills.filter(f => f.color === '#92f7ff').length, 2);
  assert.ok(ctx.fills.every(f => f.points.flat().every(Number.isFinite)));
});

test('studio projection remains finite around every side and hides rear decals from the nose', () => {
  const ctx = canvas(), render = createSoftwareView(ctx, 'orbit', true);
  for (let step=0; step<32; step++) {
    ctx.fills.length=0;
    render({ ...pose, yaw: step*Math.PI/16, color: 'invalid' });
    assert.ok(ctx.fills.every(f => f.points.flat().every(Number.isFinite)));
    assert.ok(ctx.fills.some(f => f.color === '#89d9e7'));
    if(step===16) assert.equal(ctx.fills.filter(f => f.color === '#ff4269').length, 0);
  }
});

test('speed streaks are bounded, motion-safe, and absent from the studio', () => {
  const ctx = canvas(), render = createSoftwareView(ctx);
  render({ ...pose, speed: 40, boost: true });
  assert.equal(ctx.strokes.length, 12);
  ctx.strokes.length=0;
  render({ ...pose, speed: 40, boost: true, reducedMotion: true });
  assert.equal(ctx.strokes.length, 0);
  createSoftwareView(ctx, 'seattle', true)({ ...pose, speed: 40, boost: true });
  assert.equal(ctx.strokes.length, 0);
});

test('distant rivals use fewer polygons and beyond-range rivals are culled', () => {
  const ctx = canvas(), render = createSoftwareView(ctx, 'seattle', true);
  render(pose); const baseline=ctx.fills.length;
  ctx.fills.length=0;
  render({ ...pose, rivals: [{ ...pose, z: 12 }] });const near=ctx.fills.length-baseline;
  ctx.fills.length=0;
  render({ ...pose, rivals: [{ ...pose, z: 50 }] });const far=ctx.fills.length-baseline;
  assert.ok(far>0 && far<near);
  ctx.fills.length=0;
  render({ ...pose, rivals: [{ ...pose, z: 250 }] });
  assert.equal(ctx.fills.length,baseline);
});


test('all original garage choices render their own shared mesh and driver head', () => {
  const ctx = canvas(), render = createSoftwareView(ctx, 'seattle', true);
  const signatures = new Set();
  for (const ride of RIDES) {
    ctx.fills.length = 0;
    render({ ...pose, ride: { vehicle: ride.id, character: 'fox' }, color: '#fc8855' });
    assert.ok(ctx.fills.length > 100, `${ride.id} has complete coachwork and head`);
    assert.ok(ctx.fills.length < 9000, `${ride.id} remains bounded`);
    assert.ok(ctx.fills.every(f => f.points.flat().every(Number.isFinite)), ride.id);
    signatures.add(JSON.stringify(ctx.fills));
  }
  assert.equal(signatures.size, RIDES.length, 'different models are not repainted copies');
  const renderDriver = character => {
    ctx.fills.length = 0;
    render({ ...pose, ride: { vehicle: 'bmw-m3', character } });
    return JSON.stringify(ctx.fills);
  };
  assert.notEqual(renderDriver('fox'), renderDriver('panda'), 'selected head changes with driver');
});

test('compatibility race and showroom share the chosen vehicle, paint and driver', () => {
  const ctx = canvas(), render = createSoftwareView(ctx, 'seattle', true);
  const state = { ...pose, ride: { vehicle: 'ducati', character: 'fox' }, color: '#fc8855' };
  render(state); const first = JSON.stringify(ctx.fills);
  ctx.fills.length = 0; render(state);
  assert.equal(JSON.stringify(ctx.fills), first, 'cached meshes produce the same frame');
  ctx.fills.length = 0; render({ ...state, color: '#55aaff' });
  assert.notEqual(JSON.stringify(ctx.fills), first, 'paint changes do not reuse stale geometry');
});

test('ten selected models use bounded cached CPU geometry without losing their identities', t => {
  const ctx = canvas(), render = createSoftwareView(ctx, 'seattle', true);
  const state = {
    ...pose, ride: { vehicle: 'amg-g63', character: 'fox' },
    rivals: RIDES.slice(1,10).map((ride,i) => ({
      ...pose, x:(i%3-1)*3, z:3+Math.floor(i/3)*7,
      ride:{ vehicle:ride.id, character:'fox' },
    })),
  };
  render(state);
  assert.ok(ctx.fills.length < 18000, 'clustered opponents avoid a full-detail ten-car polygon explosion');
  assert.ok(ctx.fills.every(f => f.points.flat().every(Number.isFinite)));
  const counts=[];
  const start=performance.now();
  for(let i=0;i<6;i++) { ctx.fills.length=0;render(state);counts.push(ctx.fills.length); }
  assert.equal(new Set(counts).size,1,'repeated frames do not accumulate mesh faces');
  t.diagnostic(`Warmed 10-car CPU projection: ${((performance.now()-start)/6).toFixed(1)}ms/frame, ${counts[0]} polygons (mock canvas, not a device FPS claim)`);
});
