import test from 'node:test';
import assert from 'node:assert/strict';
import { agentConfiguration } from '../app/backend/agents.mjs';

test('scientific agents have no application-imposed tool-turn cap',()=>{
 const agents=agentConfiguration();
 assert.deepEqual(Object.keys(agents).sort(),['aura','chloris','gaia','thalassa','zoe']);
 for(const agent of Object.values(agents)){
  assert.equal(Object.hasOwn(agent,'steps'),false);
  assert.equal(Object.hasOwn(agent,'maxSteps'),false);
  assert.equal(agent.permissions[0].effect,'deny');
 }
});
