import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
const python = resolve(process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const env = { ...process.env, PYTHONNOUSERSITE: '1', TEMP: resolve('.tmp'), TMP: resolve('.tmp'), PYTHONPYCACHEPREFIX: resolve('.cache/pycache') };
const nodeTests=readdirSync(resolve('tests')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>resolve('tests',name));
for (const [command, args] of [[python, ['-m', 'unittest', 'discover', '-s', 'tests', '-v']], [process.execPath, ['--test', ...nodeTests]]]) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', cwd: process.cwd() });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
