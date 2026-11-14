import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { localProvider, discoverModels, configureProvider, proveRuntime, closeRuntime } from '../app/backend/runtime.mjs';
try {
  const provider = localProvider(), catalog = await discoverModels(provider);
  const model = process.env.GAIA_MODEL || catalog.models.find(id => /gpt-6\.1-sol$/i.test(id)) || catalog.models.find(id => /gpt-6\.1/i.test(id)) || catalog.models.find(id => /claude.*sonnet/i.test(id));
  if (!model) throw new Error('Choose an explicit tool-capable catalog model using GAIA_MODEL.');
  console.log('Testing provider:', provider.name, 'model:', model, '(no credentials printed)');
  await configureProvider({ ...provider, model });
  const proof = await proveRuntime();
  mkdirSync(resolve('.runtime/proofs'), { recursive: true });
  writeFileSync(resolve('.runtime/proofs/runtime.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
} catch (error) { console.error('Runtime proof failed:', error.message?.slice(0, 400)); process.exitCode = 1; }
finally { await closeRuntime(); }
