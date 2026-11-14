import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { sha256 } from './security.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const tests=new Map();
const storage=resolve(process.cwd(),process.env.GAIA_INTEGRITY_TEST_FILE || '.runtime/data/prediction-tests.json');
try{for(const record of JSON.parse(readFileSync(storage,'utf8'))){if(record.state==='reveal_authorized'){record.state='committed';record.audit.push({type:'restart_paused_reveal',time:new Date().toISOString()});}delete record.capability;tests.set(record.id,record);}}catch(error){if(error.code!=='ENOENT')throw new Error('Prediction registry could not be read; access fails closed.');}
function persist(){mkdirSync(dirname(storage),{recursive:true});writeFileSync(storage,JSON.stringify([...tests.values()].map(publicTest),null,2));}
export function reserve(investigationID,variable='T2M') {
  if([...tests.values()].some(item=>item.investigationID===investigationID)) throw new Error('Existing reserved target retained; no outcome-driven reroll.');
  const universe=[[-20,135],[12,-10],[35,70],[-30,25],[45,105],[8,35],[28,-100],[-15,-65]];
  const selection={version:1,variable,universe,metadata:'NASA POWER global meteorological location support and calendar coverage; no science values',evaluation_year:2025,training_years:[2001,2024],selection:'seeded SHA256 ordering; first candidate; no reroll'};
  const specification_hash=sha256(selection),seed=randomBytes(16).toString('hex');
  const order=universe.map(point=>({point,order:createHash('sha256').update(seed+JSON.stringify(point)).digest('hex')})).sort((a,b)=>a.order.localeCompare(b.order));
  const [latitude,longitude]=order[0].point;
  const record={id:randomUUID(),investigationID,state:'reserved',variable,latitude,longitude,start:2025,end:2025,selection:{...selection,specification_hash,seed,ordered_candidates:order},audit:[],mode:'staged_reveal',incident:null,created:new Date().toISOString()};
   tests.set(record.id,record);persist();return record;
}

export function getTest(id,investigationID) {const record=tests.get(id);if(!record || record.investigationID!==investigationID) throw new Error('Foreign prediction test denied.');return record;}
export function checkAcquisition(request,capability) {
  if(request.operation==='compare'){for(const item of [request.focal,...(request.candidates || [])]){if(item?.acquisition)checkAcquisition({operation:'analyze',acquisition:item.acquisition},capability);}return;}
  if(!['power','modis','import','analyze','simulate'].includes(request.operation)) return;
  if(request.acquisition) {const acquisition=request.acquisition;request={...request,operation:acquisition.variable.id==='IMPORTED'?'import':request.operation,variable:acquisition.variable.id,latitude:acquisition.geometry.latitude,longitude:acquisition.geometry.longitude,start:Number(acquisition.series[0]?.date.slice(0,4)),end:Number(acquisition.series.at(-1)?.date.slice(0,4))};}
  for(const record of tests.values()) {
    if(record.state==='evaluated' || record.state==='cancelled') continue;
    const overlap=request.operation==='import' || (request.variable===record.variable && Math.abs(Number(request.latitude)-record.latitude)<.51 && Math.abs(Number(request.longitude)-record.longitude)<.626 && Number(request.start)<=record.end && Number(request.end)>=record.start);
    if(!overlap) continue;
    if(capability===record.capability && record.state==='reveal_authorized') {record.audit.push({type:'allow_evaluation',time:new Date().toISOString(),scope:'actual reserved target'});persist();continue;}
    record.audit.push({type:request.operation==='import'?'quarantine_unclassified_import':'denied_target_acquisition',time:new Date().toISOString(),scope:'actual reserved target or mixed unknown provenance'});
    persist();
    throw new Error('Reserved evidence access denied before authorized reveal; unknown imports are quarantined while a test is reserved.');
  }
}

export function commit(record,prediction) {
  if(record.state!=='reserved') throw new Error('Prediction has already been committed.');
   record.prediction=structuredClone(prediction);record.prediction_hash=sha256(prediction);record.state='committed';record.committed_at=new Date().toISOString();
   persist();
  return record;
}

export function authorize(record) {
  if(record.state!=='committed') throw new Error('Freeze the actual prediction before reveal.');
   record.state='reveal_authorized';record.capability=randomBytes(32).toString('hex');persist();return record.capability;
}

export function evaluate(record,artifact) {
  if(record.state!=='reveal_authorized') throw new Error('Evaluation state denied.');
  const actual=new Map(artifact.acquisition.series.filter(row=>typeof row.value==='number').map(row=>[row.date,row.value]));
  const pairs=record.prediction.series.filter(row=>actual.has(row.date)).map(row=>({date:row.date,predicted:row.value,observed:actual.get(row.date)}));
  record.evaluation={artifactID:artifact.id,n:pairs.length,rmse:pairs.length?Math.sqrt(pairs.reduce((sum,row)=>sum+(row.predicted-row.observed)**2,0)/pairs.length):null,pairs,outcome:pairs.length===12?'evaluated_numeric_prediction':'untestable_missing_periods',rule:'RMSE on the twelve predeclared monthly predictions; no threshold chosen after reveal',limitation:'Application logs are not independently trusted timestamps; numeric agreement does not identify a cause.'};
  record.state='evaluated';delete record.capability;
  // The first implementation guards acquisition/import and privately holds the target,
  // but has not proven every equivalent product, cache, export and derivative route.
  // Fail closed on the stronger label instead of claiming complete blind validation.
   record.mode='staged_reveal';record.label_decision={locked:false,reason:'Acquisition denial is demonstrated; complete equivalent-product/cache/derivative audit coverage is not independently proved.'};
   persist();
  return record;
}

export function publicTest(record) {const {capability,...safe}=record;return safe;}
export function cancel(record) {if(record.state==='evaluated') throw new Error('Retain the completed evaluation.');record.state='cancelled';record.mode='staged_reveal';record.audit.push({type:'cancelled_without_erasing_history',time:new Date().toISOString()});delete record.capability;persist();return publicTest(record);}
