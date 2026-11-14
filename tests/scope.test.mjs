import test from 'node:test';
import assert from 'node:assert/strict';
import { powerContextRequest } from '../app/backend/scope.mjs';
const artifact={acquisition:{provenance:{provider:'NASA POWER'},geometry:{type:'grid_supported_location',latitude:53.91,longitude:-122.75,label:'Declared grid point'}},analysis:{requested_start:'2001-01-01',requested_end:'2025-12-01'}};
test('context acquisition uses actual nested provider and requested calendar contract',()=>{const request=powerContextRequest(artifact,'PRECTOTCORR');assert.equal(request.start,2001);assert.equal(request.end,2025);assert.equal(request.latitude,53.91);assert.equal(request.variable,'PRECTOTCORR');});
test('missing calendar, unsupported quantity or imported support cannot be guessed',()=>{assert.throws(()=>powerContextRequest({...artifact,analysis:{}},'T2M'));assert.throws(()=>powerContextRequest(artifact,'TREE_DEATHS'));assert.throws(()=>powerContextRequest({...artifact,acquisition:{...artifact.acquisition,provenance:{provider:'Import'}}},'T2M'));});
