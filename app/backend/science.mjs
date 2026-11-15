import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { ROOT } from './environment.mjs';
import { checkAcquisition } from './integrity.mjs';

export function science(input, signal, onProgress, capability) {
  checkAcquisition(input,capability);
  return new Promise((done, reject) => {
    const binary = resolve(ROOT, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
    const child = spawn(binary, ['-m', 'science.worker'], { cwd: ROOT, env: process.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let output = '', settled = false;
    const finish = (error, result) => { if (settled) return; settled = true; signal?.removeEventListener('abort', abort); error ? reject(error) : done(result); };
    const abort = () => { child.kill(); finish(new Error('Scientific job cancelled; incomplete output was not published.')); };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 16_000_000) { child.kill(); finish(new Error('Scientific output budget exceeded.')); } });
    child.stderr.on('data', () => {}); // Never send internal traces/paths/credentials to the browser.
    child.stdin.on('error', () => { /* Close handler reports structured worker failure; a closed pipe must not crash the server. */ });
    child.on('error', () => finish(new Error('Project-local Python worker unavailable. Run npm run setup.')));
    child.on('close', code => {
      if (settled) return;
      try {
        const response = JSON.parse(output);
        if (!response.ok || code !== 0) {const error=new Error(response.error || 'Numerical operation failed.');if(response.error_details)error.details=response.error_details;finish(error);}
        else finish(null, response.result);
      } catch { finish(new Error('Invalid scientific worker response; no result published.')); }
    });
    child.stdin.end(JSON.stringify(input));
    onProgress?.('Numerical worker started');
  });
}
