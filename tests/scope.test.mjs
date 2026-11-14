import test from 'node:test';
import{readFileSync}from'node:fs';
test('actual public MODIS acquisition metadata supports honestly labelled POWER context',()=>{
 const exported=JSON.parse(readFileSync(new URL('../docs/examples/modis-prairie.json',import.meta.url),'utf8')),a=exported.artifacts[0];
 const request=powerContextRequest(a,'T2M');assert.equal(request.latitude,49.7093);assert.equal(request.longitude,-112.9402);assert.equal(request.start,2001);assert.equal(request.end,2025);assert.match(request.label,/not a MODIS footprint mean/);
});
import assert from 'node:assert/strict';
import { powerContextRequest } from '../app/backend/scope.mjs';

test('mission footprint weather context preserves its centre without calling it a footprint mean',()=>{
 const artifact={acquisition:{provenance:{provider:'NASA MODIS / ORNL DAAC'},geometry:{type:'fixed_site_footprint',latitude:49.7,longitude:-112.9,siteid:'provider_site',label:'Provider site'}},analysis:{requested_start:'2001-01-01',requested_end:'2025-01-01'}};
 const request=powerContextRequest(artifact,'T2M');assert.equal(request.start,2001);assert.equal(request.end,2025);assert.match(request.label,/not a MODIS footprint mean/);
});
const artifact={acquisition:{provenance:{provider:'NASA POWER'},geometry:{type:'grid_supported_location',latitude:53.91,longitude:-122.75,label:'Declared grid point'}},analysis:{requested_start:'2001-01-01',requested_end:'2025-12-01'}};
test('context acquisition uses actual nested provider and requested calendar contract',()=>{const request=powerContextRequest(artifact,'PRECTOTCORR');assert.equal(request.start,2001);assert.equal(request.end,2025);assert.equal(request.latitude,53.91);assert.equal(request.variable,'PRECTOTCORR');});
test('missing calendar, unsupported quantity or imported support cannot be guessed',()=>{assert.throws(()=>powerContextRequest({...artifact,analysis:{}},'T2M'));assert.throws(()=>powerContextRequest(artifact,'TREE_DEATHS'));assert.throws(()=>powerContextRequest({...artifact,acquisition:{...artifact.acquisition,provenance:{provider:'Import'}}},'T2M'));});
