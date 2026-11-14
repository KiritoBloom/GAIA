import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const python = resolve(process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const env = { ...process.env, PYTHONNOUSERSITE: '1', TEMP: resolve('.tmp'), TMP: resolve('.tmp'), PYTHONPYCACHEPREFIX: resolve('.cache/pycache') };
for (const [command, args] of [[python, ['-m', 'unittest', 'discover', '-s', 'tests', '-v']], [process.execPath, ['--test', 'tests/security.test.mjs','tests/integrity.test.mjs','tests/scope.test.mjs','tests/field.test.mjs']]]) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', cwd: process.cwd() });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
