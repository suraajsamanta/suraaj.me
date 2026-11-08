import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = mkdtempSync(join(tmpdir(), 'beerio-space-tests-'));
const run = args => spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' }).status ?? 1;
try {
  process.exitCode = run([require.resolve('typescript/bin/tsc'), 'src/app/beerio/game/spaceCourse.test.ts', '--outDir', output, '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck', '--esModuleInterop']);
  if (process.exitCode === 0) process.exitCode = run(['--test', join(output, 'spaceCourse.test.js')]);
} finally { rmSync(output, { recursive: true, force: true }); }
