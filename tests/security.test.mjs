import test from 'node:test';
import {evaluateSignature} from '../app/backend/protocols.mjs';
test('unrelated regional trends cannot become focal-region mechanism support',()=>{const make=(latitude)=>({id:`point-${latitude}`,acquisition:{variable:{id:'T2M'},frequency:'monthly',geometry:{type:'grid_supported_location',latitude,longitude:30}},analysis:{status:'detected',interval:[0.1,0.3],slope_per_year:0.2,requested_start:'2001-01-01',requested_end:'2025-12-01'}});const focal=make(20);assert.equal(evaluateSignature('heat_demand',focal,focal).status,'supported_signatures');assert.equal(evaluateSignature('heat_demand',make(40),focal).status,'context_only');});
import {executionVersions} from '../app/backend/versions.mjs';
test('current model reruns preserve, rather than overwrite, prior execution records',()=>{const old={id:'old',request:{model:'fixed'},median:1},newer={id:'new',request:{model:'fixed'},median:2};const result=executionVersions([old,newer]);assert.deepEqual(result.active,[newer]);assert.deepEqual(result.historical,[old]);assert.equal(old.median,1);});
import assert from 'node:assert/strict';
import { safeEndpoint, safeRequest, validRole, validateNumberClaims } from '../app/backend/security.mjs';

test('custom endpoint permits explicit HTTPS or loopback HTTP, not secret URLs', () => {
  assert.equal(safeEndpoint('https://api.example.org/v1'), 'https://api.example.org/v1');
  assert.equal(safeEndpoint('http://127.0.0.1:11434/v1'), 'http://127.0.0.1:11434/v1');
  for (const url of ['http://remote.example/v1', 'https://key:secret@example.org', 'file:///etc/passwd', 'https://example.org/?key=secret']) assert.throws(() => safeEndpoint(url));
});
test('local writes reject foreign origins, missing client header and DNS rebinding hosts', () => {
  assert.ok(safeRequest({ method: 'POST', headers: { host: '127.0.0.1:4317', origin: 'http://127.0.0.1:5173', 'x-gaia-client': '1' } }));
  assert.equal(safeRequest({ method: 'POST', headers: { host: '127.0.0.1:4317', origin: 'https://evil.example', 'x-gaia-client': '1' } }), false);
  assert.equal(safeRequest({ method: 'POST', headers: { host: '127.0.0.1:4317' } }), false);
  assert.equal(safeRequest({ method: 'GET', headers: { host: 'evil.example:4317' } }), false);
});
test('role IDs and numerical publication are bounded', () => {
  assert.ok(validRole('chloris')); assert.equal(validRole('god-mode'), false);
  assert.ok(validateNumberClaims([{ field: 'slope_per_year', value: 0.2 }], { analysis: { slope_per_year: 0.2 } }));
  assert.throws(() => validateNumberClaims([{ field: 'slope_per_year', value: 9 }], { analysis: { slope_per_year: 0.2 } }));
  assert.throws(() => validateNumberClaims([{ field: 'cause_probability', value: 0.9 }], { analysis: {} }));
});
