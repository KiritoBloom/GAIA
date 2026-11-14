import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../app/backend/environment.mjs';

const status = await (await fetch('http://127.0.0.1:4317/api/status')).json();
const session = status.sessions.find(item => item.artifacts.length);
if (!session) throw new Error('No actual UI investigation exists to export.');
const exported = await (await fetch(`http://127.0.0.1:4317/api/export/${session.id}`)).json();
const path = resolve(ROOT, '.runtime/proofs/ui-export.json');
mkdirSync(resolve(ROOT, '.runtime/proofs'), { recursive: true });
writeFileSync(path, JSON.stringify(exported, null, 2));
const result = spawnSync(process.execPath, ['scripts/reproduce.mjs', path], { cwd: ROOT, stdio: 'inherit' });
if (result.status !== 0) throw new Error('Actual exported investigation failed numerical reproduction.');
console.log('Actual UI export reproduced; no provider key or network data acquisition required.');
