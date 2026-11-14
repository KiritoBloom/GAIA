import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export async function portableNode(root) {
  if (process.platform !== 'win32') {
    if (Number(process.versions.node.split('.')[0]) < 26) throw new Error('OpenCode V2 dependencies require Node 26.4+; install a compatible Node inside this project or use your compatible existing interpreter.');
    return process.execPath;
  }
  const path = resolve(root, '.runtime/bin/node.exe');
  const version = 'v26.13.1';
  if (existsSync(path)) {
    const found = spawnSync(path, ['--version'], { encoding: 'utf8' });
    if (found.stdout.trim() === version) return path;
    throw new Error('Unexpected existing project Node binary; refusing to overwrite it.');
  }
  mkdirSync(resolve(root, '.runtime/bin'), { recursive: true });
  console.log(`Installing verified portable Node ${version} inside .runtime/bin (system Node remains unchanged).`);
  const checks = await (await fetch(`https://nodejs.org/dist/${version}/SHASUMS256.txt`)).text();
  const expected = checks.split('\n').find(line => /\swin-x64\/node\.exe$/.test(line))?.split(/\s+/)[0];
  if (!expected) throw new Error('Official Node checksum entry unavailable.');
  const response = await fetch(`https://nodejs.org/dist/${version}/win-x64/node.exe`);
  if (!response.ok) throw new Error('Portable Node download failed.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Portable Node checksum mismatch.');
  writeFileSync(path, bytes);
  writeFileSync(resolve(root, '.runtime/bin/node.sha256'), expected);
  return path;
}

if (process.argv[1]?.endsWith('portable-node.mjs')) console.log(await portableNode(process.cwd()));
