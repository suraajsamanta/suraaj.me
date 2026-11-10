// Rebuild all original scores without downloading audio or packages.
// Usage: node scripts/generate-race-score.mjs
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const compiledModule = { exports: {} }; modules.set(file, compiledModule.exports);
  new Function('require', 'module', 'exports', compiled)(name => load(resolve(dirname(file), `${name}.ts`)), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { renderRaceScore, SCORE_SAMPLE_RATE } = load(resolve(root, 'src/app/beerio/game/audioScore.ts'));
const { RACE_SCORES } = load(resolve(root, 'src/app/beerio/game/audioTracks.ts'));
for (const [trackId, score] of Object.entries(RACE_SCORES)) {
  const channels = renderRaceScore(SCORE_SAMPLE_RATE, trackId), frames = channels[0].length;
  const wav = Buffer.alloc(44 + frames * 4);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(SCORE_SAMPLE_RATE, 24); wav.writeUInt32LE(SCORE_SAMPLE_RATE * 4, 28);
  wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(frames * 4, 40);
  let peak = 0, energy = 0;
  for (let i = 0; i < frames; i++) for (let channel = 0; channel < 2; channel++) {
    const sample = channels[channel][i]; peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + (i * 2 + channel) * 2);
  }
  const destination = resolve(root, 'public/beerio/audio', score.file);
  mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, wav);
  console.log(`${trackId}: ${score.title}, ${score.bpm} BPM, ${(frames / SCORE_SAMPLE_RATE).toFixed(2)}s, ${wav.length} bytes, peak ${peak.toFixed(3)}, RMS ${Math.sqrt(energy / frames / 2).toFixed(3)}`);
}
