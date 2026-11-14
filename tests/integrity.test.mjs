import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync } from 'node:fs';
process.env.GAIA_INTEGRITY_TEST_FILE='.tmp/integrity-unit-test.json';
try{unlinkSync(process.env.GAIA_INTEGRITY_TEST_FILE);}catch{}
const {reserve,checkAcquisition,commit,authorize,evaluate,publicTest,getTest}=await import('../app/backend/integrity.mjs');
test('reserved target guards reads, imports, derivatives and ownership',()=>{
 const record=reserve('unit-investigation');
 const request={operation:'power',variable:record.variable,latitude:record.latitude,longitude:record.longitude,start:2025,end:2025};
 assert.throws(()=>checkAcquisition(request),/Reserved evidence/);
 assert.throws(()=>checkAcquisition({operation:'import'}),/quarantined/);
 assert.throws(()=>getTest(record.id,'foreign'),/Foreign/);
 assert.throws(()=>reserve('unit-investigation'),/no outcome-driven reroll/);
 const acquisition={variable:{id:record.variable},geometry:{latitude:record.latitude,longitude:record.longitude},series:[{date:'2025-01-01',value:1}]};
 assert.throws(()=>checkAcquisition({operation:'compare',focal:{acquisition},candidates:[]}),/Reserved evidence/);
 commit(record,{series:[{date:'2025-01-01',value:2}]});
 assert.throws(()=>authorize({...record,state:'reserved'}),/Freeze/);
 const capability=authorize(record);assert.equal(publicTest(record).capability,undefined);
 assert.doesNotThrow(()=>checkAcquisition(request,capability));
 evaluate(record,{id:'test-artifact',acquisition});
 assert.equal(record.evaluation.rmse,1);assert.equal(record.mode,'staged_reveal');assert.equal(record.label_decision.locked,false);
});
process.on('exit',()=>{try{unlinkSync(process.env.GAIA_INTEGRITY_TEST_FILE);}catch{}});
