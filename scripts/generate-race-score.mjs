// Rebuild the entirely original score, without downloading audio or packages.
// Usage: node scripts/generate-race-score.mjs
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const compiled = ts.transpileModule(readFileSync(resolve(root, 'src/app/beerio/game/audioScore.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(createRequire(import.meta.url), compiledModule, compiledModule.exports);
const { renderRaceScore, SCORE_SAMPLE_RATE } = compiledModule.exports;
const channels = renderRaceScore(), frames = channels[0].length;
const wav = Buffer.alloc(44 + frames * 4);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SCORE_SAMPLE_RATE, 24); wav.writeUInt32LE(SCORE_SAMPLE_RATE * 4, 28);
wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(frames * 4, 40);
for (let i = 0; i < frames; i++) for (let channel = 0; channel < 2; channel++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[channel][i])) * 32767), 44 + (i * 2 + channel) * 2);
const destination = resolve(root, 'public/beerio/audio/soda-pop-sprint.wav');
mkdirSync(resolve(destination, '..'), { recursive: true }); writeFileSync(destination, wav);
console.log(`Original score: ${frames} frames, ${SCORE_SAMPLE_RATE} Hz stereo, ${wav.length} bytes.`);
