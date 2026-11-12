import { spawn } from 'node:child_process';
// The managed preview daemon supplies Vite-style flags; translate for Next.
const args = process.argv.slice(2).filter(x => x !== '--strictPort').map(x => x === '--host' ? '--hostname' : x);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', ...args], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
