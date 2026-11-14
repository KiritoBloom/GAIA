import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {missionAcquisitionRequest,sameMissionArtifact,verifyMissionScope} from '../app/backend/mission-scope.mjs';

const base='http://127.0.0.1:4317',status=await(await fetch(`${base}/api/status`)).json();
const session=status.sessions.find(item=>item.missionScope&&item.id===process.argv[2]);
if(!session)throw Error('Freeze a mission in the actual browser and pass its selected investigation ID.');
const scope=verifyMissionScope(session.missionScope),request=missionAcquisitionRequest(session.missionScope),existing=new Set(session.artifacts.filter(item=>sameMissionArtifact(item,scope)).map(item=>item.id));
const controller=new AbortController(),response=await fetch(`${base}/api/events`,{signal:controller.signal});
if(!response.ok||!response.body)throw Error('Mission acquisition event stream is unavailable.');
const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',terminal;
try{
 while(!terminal){const part=await reader.read();if(part.done)throw Error('Event stream ended before the mission acquisition became terminal.');pending+=decoder.decode(part.value,{stream:true});let boundary;
  while((boundary=pending.indexOf('\n\n'))>=0){const block=pending.slice(0,boundary);pending=pending.slice(boundary+2);const line=block.split('\n').find(value=>value.startsWith('data: '));if(!line)continue;const event=JSON.parse(line.slice(6));if(event.sessionID!==session.id)continue;
   if(['job.started','artifact.completed','job.failed','job.cancelled'].includes(event.event?.type))console.log(JSON.stringify({type:event.event.type,operation:event.event.operation||null,time:event.event.time||null}));
   if(['artifact.completed','job.failed','job.cancelled'].includes(event.event?.type))terminal=event.event;
  }
 }
}finally{await reader.cancel();controller.abort();}
const current=(await(await fetch(`${base}/api/status`)).json()).sessions.find(item=>item.id===session.id);
if(terminal.type!=='artifact.completed')throw Error(`Mission acquisition ended as ${terminal.type}.`);
const artifact=current.artifacts.find(item=>item.id===terminal.artifactID);
if(!artifact||!sameMissionArtifact(artifact,scope))throw Error('Acquired artifact does not match the frozen NASA mission identity, support, period and seasonal recipe.');
if(existing.has(artifact.id))throw Error('Acquisition event did not produce a new artifact record.');
const proof={browser_started:true,event_driven_no_polling:true,scope:{provider:scope.provider,product:scope.product,siteid:scope.siteid,site_name:scope.site_name,coordinates:[scope.latitude,scope.longitude],period:[scope.start,scope.end],months:scope.months,selection_sha256:session.missionScope.selection_sha256},request,artifact:{id:artifact.id,quantity:artifact.acquisition.variable.id,frequency:artifact.frequency||artifact.acquisition.frequency||'annual',support:artifact.acquisition.geometry,period:[artifact.analysis.requested_start,artifact.analysis.requested_end],observations:artifact.analysis.n,status:artifact.analysis.status,manifest_sha256:artifact.manifest_sha256},prior_exact_artifact_count:existing.size,limitation:'Optical greenness is not species, yield, disease or mortality; a matching retrieval is not a causal finding.'};
mkdirSync(resolve('.runtime/proofs'),{recursive:true});writeFileSync(resolve('.runtime/proofs/mission-acquisition.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
