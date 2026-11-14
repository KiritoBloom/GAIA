import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { matchedProofReceipt, runProofBatch, configureProvider, providerStatus } from '../app/backend/runtime.mjs';

test('provider proof requires the owned tool receipt and its unpredictable token in the actual assistant reply', () => {
  const token = 'ae8f7694-90d6-4f59-a87a-784715a2c053';
  const receipt = { sessionID: 'session-a', role: 'gaia', nonce: 'gaia-nonce', sum: 6, tokenHash: createHash('sha256').update(token).digest('hex') };
  const request = { sessionID: 'session-a', role: 'gaia', nonce: 'gaia-nonce', sum: 6, assistantText: `Receipt: ${token}` };
  assert.equal(matchedProofReceipt([receipt], request), true);
  assert.equal(matchedProofReceipt([receipt], { ...request, assistantText: 'complete' }), false);
  assert.equal(matchedProofReceipt([receipt], { ...request, role: 'aura' }), false);
  assert.equal(matchedProofReceipt([receipt], { ...request, nonce: 'foreign' }), false);
  assert.equal(matchedProofReceipt([receipt], { ...request, assistantText: `${token.slice(0, -1)}0` }), false);
});

test('failed parallel provider checks abort and await every sibling before cleanup', async () => {
  const controller = new AbortController();
  let siblingCleaned = false;
  await assert.rejects(runProofBatch([
    async () => { throw new Error('synthetic role failure'); },
    async () => {
      await new Promise(resolve => controller.signal.addEventListener('abort', resolve, { once: true }));
      siblingCleaned = true;
      return 'stopped';
    },
  ], controller), /synthetic role failure/);
  assert.equal(controller.signal.aborted, true);
  assert.equal(siblingCleaned, true);
});

test('blank setup form uses only the existing local provider credential without returning it', async () => {
  const prior = process.env.FreeGG_API_KEY, priorLLM = process.env.LLM_KEY, priorRuntime = process.env.GAIA_PROVIDER_KEY;
  process.env.FreeGG_API_KEY = 'test-only-local-provider-key'; delete process.env.LLM_KEY; delete process.env.GAIA_PROVIDER_KEY;
  try {
    const result = await configureProvider({ name: 'Local test', endpoint: 'http://127.0.0.1:4317/v1', model: 'test-model', key: '' });
    assert.equal(process.env.GAIA_PROVIDER_KEY, 'test-only-local-provider-key');
    assert.equal(result.configured, true);
    assert.equal(JSON.stringify(result).includes('test-only-local-provider-key'), false);
    assert.equal(providerStatus().local_configuration_available, true);
  } finally {
    if (prior === undefined) delete process.env.FreeGG_API_KEY; else process.env.FreeGG_API_KEY = prior;
    if (priorLLM === undefined) delete process.env.LLM_KEY; else process.env.LLM_KEY = priorLLM;
    if (priorRuntime === undefined) delete process.env.GAIA_PROVIDER_KEY; else process.env.GAIA_PROVIDER_KEY = priorRuntime;
  }
});
