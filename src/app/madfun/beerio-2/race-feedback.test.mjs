import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { createRaceSound } from './race-audio.ts';

const source = await readFile(new URL('./race-effects.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const compiled = outputText.replace(/from '(@babylonjs[^']+)'/g, (_, path) => `from '${import.meta.resolve(`${path}.js`)}'`);
const { createRaceEffects } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('drift / boost effects use bounded pools and respect reduced-motion speed lines', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const camera = new FreeCamera('camera', new Vector3(0, 5, -10), scene);
    const effects = createRaceEffects(scene, camera), initial = scene.meshes.length;
    assert.ok(initial <= 50);
    const frame = { x: 0, y: 1, z: 0, yaw: .3, pitch: 0, speed: 33, steer: 1, boost: true, drift: .8, reducedMotion: false };
    for (let i = 0; i < 300; i++) effects.update(frame, 1 / 60);
    assert.equal(scene.meshes.length, initial);
    assert.ok(scene.meshes.filter(m => m.name.startsWith('tire-spark') && m.isEnabled()).length > 0);
    assert.ok(scene.meshes.filter(m => m.name.startsWith('velocity-streak') && m.isEnabled()).length > 0);
    effects.update({ ...frame, boost: false, drift: 0, reducedMotion: true }, 1 / 60);
    assert.ok(scene.meshes.filter(m => m.name.startsWith('velocity-streak')).every(m => !m.isEnabled()));
    assert.ok(scene.meshes.filter(m => m.name.startsWith('exhaust')).every(m => !m.isEnabled()));
    effects.clear();
    assert.ok(scene.meshes.filter(m => m.name.startsWith('tire-spark')).every(m => !m.isEnabled()));
    for (const mesh of scene.meshes) assert.ok([mesh.position.x, mesh.position.y, mesh.position.z].every(Number.isFinite));
  } finally { scene.dispose(); engine.dispose(); }
});

test('audio remains locked before a gesture, mutes, suspends, and tears down', () => {
  const listeners = new Map(); const nodes = []; const contexts = [];
  class Parameter {
    value = 0;
    setTargetAtTime(value) { this.value = value; }
    setValueAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) { this.value = value; }
  }
  class Node {
    gain = new Parameter(); frequency = new Parameter(); Q = new Parameter();
    threshold = new Parameter(); knee = new Parameter(); ratio = new Parameter();
    stopped = false;
    constructor() { nodes.push(this); }
    connect() {} disconnect() {} start() {} stop() { this.stopped = true; }
  }
  class Context {
    state = 'suspended'; currentTime = 0; sampleRate = 8000; destination = new Node();
    constructor() { contexts.push(this); }
    createGain() { return new Node(); } createBiquadFilter() { return new Node(); }
    createOscillator() { return new Node(); } createBufferSource() { return new Node(); }
    createDynamicsCompressor() { return new Node(); }
    createBuffer() { return { getChannelData: () => new Float32Array(16000) }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  const oldWindow = globalThis.window;
  globalThis.window = { AudioContext: Context, addEventListener: (type, callback) => listeners.set(type, callback), removeEventListener: type => listeners.delete(type) };
  try {
    const sound = createRaceSound();
    assert.equal(contexts.length, 0);
    listeners.get('pointerdown')({ isTrusted: false });
    assert.equal(contexts.length, 0);
    listeners.get('keydown')({ isTrusted: true });
    assert.equal(contexts.length, 1); assert.equal(sound.ready, true);
    sound.update({ speed: 30, throttle: true, drift: 1, boost: true, active: true, muted: false });
    const count = nodes.length; sound.cue('boost'); assert.ok(nodes.length > count);
    sound.update({ speed: 30, throttle: true, drift: 1, boost: true, active: true, muted: true });
    const mutedCount = nodes.length; sound.cue('boost'); assert.equal(nodes.length, mutedCount);
    sound.setVisible(false); assert.equal(contexts[0].state, 'suspended');
    sound.setVisible(true); assert.equal(contexts[0].state, 'running');
    sound.dispose(); sound.dispose();
    assert.equal(contexts[0].state, 'closed'); assert.equal(listeners.size, 0);
    sound.unlock(); assert.equal(contexts.length, 1);
  } finally { globalThis.window = oldWindow; }
});
