import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { portableNode } from './portable-node.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (resolve(process.cwd()) !== root) throw new Error('Run setup from the GAIA working directory.');
for (const dir of ['.cache/npm', '.cache/pip', '.tmp', '.runtime/config', '.runtime/data', '.runtime/cache', '.runtime/state']) mkdirSync(resolve(root, dir), { recursive: true });
const env = { ...process.env, TEMP: resolve(root, '.tmp'), TMP: resolve(root, '.tmp'), TMPDIR: resolve(root, '.tmp'), PIP_CACHE_DIR: resolve(root, '.cache/pip'), PIP_DISABLE_PIP_VERSION_CHECK: '1', npm_config_cache: resolve(root, '.cache/npm'), PYTHONNOUSERSITE: '1' };
const node = await portableNode(root);
env.PATH = `${dirname(node)}${process.platform === 'win32' ? ';' : ':'}${env.PATH}`;
writeFileSync(resolve(root, '.npmrc'), `cache=${resolve(root, '.cache/npm').replaceAll('\\', '/')}\nfund=false\naudit=false\n`);
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' && command === 'npm' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!existsSync(resolve(root, '.venv'))) run('python', ['-m', 'venv', '.venv']);
const python = resolve(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
run(python, ['-m', 'pip', 'install', '--only-binary=:all:', '-r', 'requirements.txt']);
run('npm', ['install', '--ignore-scripts']);
console.log('Project-local installation complete. All installation caches and the virtual environment are inside GAIA.');
