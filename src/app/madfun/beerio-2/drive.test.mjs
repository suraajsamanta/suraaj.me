import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

// Keep production imports ordinary extensionless TypeScript, while exercising
// the exact same implementation in Node without introducing a runtime loader.
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = mkdtempSync(join(root, '.beerio2-drive-tests-'));
after(() => rmSync(output, { recursive: true, force: true }));
for (const name of ['course', 'drive']) {
  const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  writeFileSync(join(output, `${name}.mjs`), result.outputText.replaceAll("'./course'", "'./course.mjs'"));
}
const { createDrivingWorld } = await import(pathToFileURL(join(output, 'drive.mjs')).href);
const { course, locate, heading, ROAD_WIDTH } = await import(pathToFileURL(join(output, 'course.mjs')).href);
const idle = () => ({ steer: 0, throttle: false, brake: false, drift: false, reset: false });
const gas = () => ({ ...idle(), throttle: true });
const flatWorld = () => createDrivingWorld({ sampleHeight: () => 0 });
const tick = 1 / 60;
function place(world, driver, index, totalLaps = 3) {
  const p = course[index];
  Object.assign(driver.state, { x: p.x, y: p.y, z: p.z, speed: 0, yaw: heading(index), facing: heading(index) });
  world.step(driver, idle(), tick, totalLaps ?? undefined);
}
function circuit(world, driver, totalLaps = 3) {
  for (let i = 1; i < course.length; i++) place(world, driver, i, totalLaps);
  place(world, driver, 0, totalLaps);
}

test('grid is separated, staggered behind the line, on road, and initial crossing is not a lap', async () => {
  const world = await flatWorld();
  try {
    const drivers = Array.from({ length: 8 }, (_, i) => world.spawn(i));
    for (const driver of drivers) {
      const s = driver.state;
      assert.ok(s.progress < 0 && s.progress > -10);
      assert.ok(locate(s.x, s.z).distance < ROAD_WIDTH / 2 - 1);
      assert.equal(s.lap, 1);
      place(world, driver, 0);
      assert.equal(s.lap, 1);
      assert.equal(s.finished, false);
    }
    const fresh = Array.from({ length: 8 }, (_, i) => world.spawn(i));
    for (let i = 0; i < fresh.length; i++) for (let j = i + 1; j < fresh.length; j++) {
      assert.ok(Math.hypot(fresh[i].state.x - fresh[j].state.x, fresh[i].state.z - fresh[j].state.z) > 3.5);
    }
  } finally { world.dispose(); }
});

test('fixed stepping is deterministic, finite, speed-limited, and road-bounded', async () => {
  const world = await flatWorld();
  try {
    const a = world.spawn(), b = world.spawn();
    for (let i = 0; i < 1200; i++) {
      const input = { ...gas(), steer: Math.sin(i * 0.011) * 0.6, drift: i % 200 < 70 };
      world.step(a, input, tick); world.step(b, input, tick);
      assert.deepEqual(a.state, b.state);
      assert.ok(a.state.speed <= 37);
      assert.ok(locate(a.state.x, a.state.z).distance <= ROAD_WIDTH / 2 - 1 + 0.03);
      assert.ok(Object.values(a.state).every((value) => typeof value !== 'number' || Number.isFinite(value)));
    }
  } finally { world.dispose(); }
});


test('drift earns a temporary release boost, and braking overrides throttle', async () => {
  const world = await flatWorld();
  try {
    const driver = world.spawn();
    Object.assign(driver.state, { speed: 22, steer: 0.6 });
    for (let i = 0; i < 45; i++) world.step(driver, { ...gas(), drift: true, steer: 0.6 }, tick);
    assert.equal(driver.state.boost, false);
    world.step(driver, gas(), tick);
    assert.equal(driver.state.boost, true);
    const before = driver.state.speed;
    world.step(driver, { ...gas(), brake: true }, 0.1);
    assert.ok(driver.state.speed < before);
    for (let i = 0; i < 90; i++) world.step(driver, gas(), tick);
    assert.equal(driver.state.boost, false);
  } finally { world.dispose(); }
});

test('larger frame intervals use the same fixed-size driving steps', async () => {
  const world = await flatWorld();
  try {
    const a = world.spawn(), b = world.spawn();
    const input = { ...gas(), steer: 0.4 };
    for (let i = 0; i < 60; i++) world.step(a, input, tick, 3);
    for (let i = 0; i < 10; i++) world.step(b, input, 0.1, 3);
    for (const key of ['x', 'y', 'z', 'yaw', 'facing', 'speed', 'seconds', 'progress']) {
      assert.ok(Math.abs(a.state[key] - b.state[key]) < 1e-8, key);
    }
  } finally { world.dispose(); }
});

test('ranked clock includes idle time, but solo clock waits for driving', async () => {
  const world = await flatWorld();
  try {
    const online = world.spawn(), solo = world.spawn();
    world.step(online, idle(), 0.1, 3); world.step(solo, idle(), 0.1);
    assert.ok(Math.abs(online.state.seconds - 0.1) < 1e-10);
    assert.equal(solo.state.seconds, 0);
    world.step(solo, gas(), tick);
    assert.equal(solo.state.seconds, tick);
  } finally { world.dispose(); }
});

test('ordered forward gates are necessary, with no reverse or start-line farming', async () => {
  const world = await flatWorld();
  try {
    const driver = world.spawn();
    place(world, driver, 0);
    for (let n = 0; n < 4; n++) { place(world, driver, 179); place(world, driver, 0); }
    assert.equal(driver.state.lap, 1);
    for (let i = 179; i >= 0; i--) place(world, driver, i);
    assert.equal(driver.state.lap, 1);
    circuit(world, driver);
    assert.equal(driver.state.lap, 2);
  } finally { world.dispose(); }
});

test('three laps preserve lap times, cumulative finish time, and frozen results', async () => {
  const world = await flatWorld();
  try {
    const driver = world.spawn();
    place(world, driver, 0);
    circuit(world, driver);
    assert.equal(driver.state.lap, 2);
    assert.equal(driver.state.seconds, 0);
    assert.ok(driver.state.best > 3);
    circuit(world, driver);
    assert.equal(driver.state.lap, 3);
    assert.equal(driver.state.finished, false);
    circuit(world, driver);
    assert.equal(driver.state.lap, 3);
    assert.equal(driver.state.finished, true);
    assert.equal(driver.state.progress, 3 * course.length);
    assert.ok(Math.abs(driver.state.seconds - 3) < 1e-9);
    assert.ok(Math.abs(driver.state.best - 3) < 1e-9);
    assert.ok(Math.abs(driver.state.finishTime - (9 + tick)) < 1e-9);
    const result = { ...driver.state };
    world.step(driver, { ...gas(), reset: true, steer: 1 }, 0.2, 3);
    assert.deepEqual(driver.state, result);
  } finally { world.dispose(); }
});

test('solo is unlimited and reset preserves best; ranked reset never teleports or clears clock', async () => {
  const world = await flatWorld();
  try {
    const solo = world.spawn();
    world.step(solo, gas(), tick);
    for (let lap = 0; lap < 4; lap++) {
      for (let i = 1; i < course.length; i++) place(world, solo, i, null);
      Object.assign(solo.state, course[0], { speed: 0 });
      world.step(solo, idle(), tick);
    }
    assert.equal(solo.state.lap, 5);
    assert.equal(solo.state.finished, false);
    const best = solo.state.best;
    world.step(solo, { ...idle(), reset: true }, tick);
    assert.equal(solo.state.lap, 1);
    assert.equal(solo.state.seconds, 0);
    assert.equal(solo.state.best, best);
    assert.ok(solo.state.progress < 0);
    const online = world.spawn();
    for (let i = 0; i < 100; i++) world.step(online, gas(), tick, 3);
    const before = { ...online.state };
    world.step(online, { ...gas(), reset: true }, tick, 3);
    assert.ok(online.state.seconds > before.seconds);
    assert.ok(Math.hypot(online.state.x - before.x, online.state.z - before.z) < 1);
  } finally { world.dispose(); }
});

test('rejects foreign drivers, invalid timesteps do not corrupt state, dispose is idempotent', async () => {
  const world = await flatWorld(), other = await flatWorld();
  const driver = world.spawn(), before = { ...driver.state };
  for (const dt of [NaN, Infinity, -1, 0]) world.step(driver, gas(), dt);
  assert.deepEqual(driver.state, before);
  assert.throws(() => other.step(driver, gas(), tick), /different driving world/);
  world.dispose(); world.dispose(); other.dispose();
  assert.throws(() => world.spawn(), /disposed/);
  assert.throws(() => world.step(driver, gas(), tick), /disposed/);
});

test('production Rapier sampler works headlessly, follows elevated road, and frees cleanly', async () => {
  const world = await createDrivingWorld();
  try {
    const driver = world.spawn();
    const p = course[60];
    Object.assign(driver.state, p, { y: 0, speed: 0 });
    world.step(driver, idle(), 0.25, 3);
    assert.ok(driver.state.y > 15);
    assert.ok(Math.abs(driver.state.y - p.y) < 0.1);
  } finally { world.dispose(); world.dispose(); }
});
