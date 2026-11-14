import test from 'node:test';
import assert from 'node:assert/strict';
import {freezeMissionScope,verifyMissionScope,missionAcquisitionRequest,sameMissionArtifact} from '../app/backend/mission-scope.mjs';

const sites=[{siteid:'prairie_01',sitename:'Prairie instrumented footprint',latitude:49.7,longitude:-112.9}];
const input={siteid:'prairie_01',start:2001,end:2025,months:[5,6,7,8,9]};

test('a mission target must be an exact live catalog site and freezes product, geometry, dates and seasonal recipe',()=>{
 const plan=freezeMissionScope(sites,input,'2026-11-14T12:00:00Z');
 assert.deepEqual(verifyMissionScope(plan),{version:'modis-evi-fixed-site-v1',provider:'NASA MODIS / ORNL DAAC TESViS',product:'MOD13Q1.061',variable:'EVI',siteid:'prairie_01',site_name:'Prairie instrumented footprint',latitude:49.7,longitude:-112.9,start:2001,end:2025,months:[5,6,7,8,9],created:'2026-11-14T12:00:00Z'});
});

test('foreign sites, invalid calendars, duplicate months and tampered frozen scope are rejected',()=>{
 assert.throws(()=>freezeMissionScope(sites,{...input,siteid:'invented_site'}),/current NASA provider catalog/);
 assert.throws(()=>freezeMissionScope(sites,{...input,start:1999}),/from 2000/);
 assert.throws(()=>freezeMissionScope(sites,{...input,months:[5,5]}),/distinct calendar months/);
 const plan=freezeMissionScope(sites,input,'2026-11-14T12:00:00Z');
 assert.throws(()=>verifyMissionScope({...plan,end:2024}),/invalid or was changed/);
});

test('a repeated acquisition is reusable only for the exact frozen mission support and recipe',()=>{
 const plan=verifyMissionScope(freezeMissionScope(sites,input,'2026-11-14T12:00:00Z'));
 const artifact={acquisition:{variable:{id:'EVI'},provenance:{product:'MOD13Q1',recipe:{months:[5,6,7,8,9]}},geometry:{siteid:'prairie_01',latitude:49.7,longitude:-112.9}},analysis:{requested_start:'2001-01-01',requested_end:'2025-01-01'}};
 assert.equal(sameMissionArtifact(artifact,plan),true);
 assert.equal(sameMissionArtifact({...artifact,analysis:{...artifact.analysis,requested_end:'2024-01-01'}},plan),false);
});

test('CHLORIS receives an acquisition request derived only from the verified frozen mission',()=>{
 const plan=freezeMissionScope(sites,input,'2026-11-14T12:00:00Z');
 assert.deepEqual(missionAcquisitionRequest(plan),{operation:'modis',siteid:'prairie_01',latitude:49.7,longitude:-112.9,start:2001,end:2025,months:[5,6,7,8,9],label:'Prairie instrumented footprint'});
 assert.throws(()=>missionAcquisitionRequest({...plan,latitude:20}),/invalid or was changed/);
});
