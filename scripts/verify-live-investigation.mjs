import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {investigationRecords} from '../app/backend/investigation-records.mjs';

const status=await(await fetch('http://127.0.0.1:4317/api/status')).json();
const session=status.sessions.find(s=>s.chatRunning&&s.artifacts.some(a=>a.acquisition.variable.id==='EVI'));
if(!session)throw Error('This acceptance check requires the actual browser-started mission investigation to be running.');
const signal=new AbortController();
const stream=await fetch('http://127.0.0.1:4317/api/events',{signal:signal.signal});
if(!stream.ok||!stream.body)throw Error('The actual investigation event stream is unavailable.');
const reader=stream.body.getReader(),decoder=new TextDecoder();let pending='',completed=false;
try{
 while(!completed){const next=await reader.read();if(next.done)throw Error('The event stream ended before the investigation completed.');pending+=decoder.decode(next.value,{stream:true});let end;
  while((end=pending.indexOf('\n\n'))>=0){const block=pending.slice(0,end);pending=pending.slice(end+2);const line=block.split('\n').find(line=>line.startsWith('data: '));if(!line)continue;const message=JSON.parse(line.slice(6));if(message.sessionID!==session.id)continue;const event=message.event;
   if(['worker.started','worker.completed','worker.failed','peer.review.completed','jev.completed','gaia.completed','gaia.failed'].includes(event.type))console.log(JSON.stringify({type:event.type,role:event.role??null,time:event.time}));
    if(['gaia.completed','gaia.failed','gaia.interrupted'].includes(event.type))completed=true;
  }
 }
}finally{await reader.cancel();signal.abort();}
const current=(await(await fetch('http://127.0.0.1:4317/api/status')).json()).sessions.find(s=>s.id===session.id);
const record=investigationRecords(current),tasks=current.taskGraph?.requests||[];
const update=current.evidenceUpdates?.at(-1),report={browser_started:true,event_driven_no_polling:true,tasks:tasks.map(t=>({role:t.role,status:t.status,failure:t.failure})),approvedReviews:tasks.filter(t=>t.status==='completed').length,allRequestedReviewsCompleted:tasks.length>0&&tasks.every(t=>t.status==='completed'),sourceProofs:(current.investigations?.at(-1)?.reviews||[]).flatMap(t=>t.sources||[]).map(s=>({url:s.url,sha256:s.source_sha256||s.sha256,status:s.status})),artifacts:current.artifacts.map(a=>({quantity:a.acquisition.variable.id,provider:a.acquisition.provenance.provider,support:a.acquisition.geometry.type,frequency:a.frequency||a.acquisition.frequency||'monthly legacy',period:[a.analysis.requested_start,a.analysis.requested_end],manifest_sha256:a.manifest_sha256})),diagnostics:(current.domainDiagnostics||[]).map(d=>({method:d.method,readiness:d.readiness})),evidenceUpdate:update?{added_artifacts:update.added_artifacts,reason:update.reason,protocol_snapshotted:!!update.before.protocol,hypothesis_statuses:update.after.map(h=>({id:h.id,statuses:h.evidence.map(e=>e.status)}))}:null,jev:current.semanticReviews?.at(-1)?.status,backbone:record.backbone,recordHash:record.record_hash,limitation:'Mismatched spatial supports produce contextual evidence, not a direct focal signature. A completed workflow is not independent expert, causal, diagnostic or calibrated-forecast certification.'};
mkdirSync(resolve('.runtime/proofs'),{recursive:true});writeFileSync(resolve('.runtime/proofs/live-investigation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(!report.allRequestedReviewsCompleted)process.exitCode=1;
