import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const courseURL = moduleURL(compile(await readFile(new URL('./course.ts', import.meta.url), 'utf8')));
const source = await readFile(new URL('./software.ts', import.meta.url), 'utf8');
const { createSoftwareView } = await import(moduleURL(compile(source).replace("from './course'", `from '${courseURL}'`)));
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
  assert.ok(ctx.fills.length < 300, 'static hero and plinth stay within a small polygon budget');
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
