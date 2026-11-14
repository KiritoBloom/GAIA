import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { matchedProofReceipt } from '../app/backend/runtime.mjs';

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
