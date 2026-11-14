import {sha256} from './security.mjs';

export const accessPolicyVersion='gaia-owned-science-v2';
export function investigationScope(session,frame=null){
 const focal=session.artifacts?.[0];
 return sha256({investigation:session.id,access_policy:accessPolicyVersion,focal:focal?{geometry:focal.acquisition.geometry,quantity:focal.acquisition.variable.id,provider:focal.acquisition.provenance.provider,calendar:[focal.analysis.requested_start,focal.analysis.requested_end]}:null,frame});
}

/** Immutable role/parent/scope bindings, with retained superseded attempts instead of silent rebinding. */
export async function ownedThread(session,role,{scope,snapshot,request,graphID},create,stop){
 session.threads||={};session.threadLifecycle||=[];
 const previous=session.threadLifecycle.findLast(item=>item.thread_id===session.threads[role]&&item.state==='active');
 const time=new Date().toISOString(),question_sha256=sha256(request);
 if(previous&&previous.role===role&&previous.parent_investigation===session.id&&previous.scope===scope&&previous.access_policy===accessPolicyVersion){
  previous.continuations.push({time,graph_id:graphID,snapshot,question_sha256,reason:previous.continuations.at(-1)?.snapshot===snapshot?'compatible owned scope and evidence snapshot':'compatible scope; new evidence snapshot requires fresh assessment'});
  return previous.thread_id;
 }
 const old=session.threads[role];
 if(old){await stop(old);if(previous){previous.state='superseded';previous.ended=time;previous.end_reason='Scope, scientific frame, access policy or runtime binding changed.';}}
 const id=await create(role,session.id);
 session.threads[role]=id;
 session.threadLifecycle.push({thread_id:id,role,parent_investigation:session.id,scope,access_policy:accessPolicyVersion,version:(session.threadLifecycle.filter(item=>item.role===role).length+1),state:'active',created:time,predecessor:old||null,continuations:[{time,graph_id:graphID,snapshot,question_sha256,reason:'new immutable owned binding'}]});
 return id;
}

export function retireThreads(session,reason){
 for(const item of session.threadLifecycle||[])if(item.state==='active'){item.state='interrupted';item.ended=new Date().toISOString();item.end_reason=reason;}
 session.threads={};
}

export function lifecycleForExport(session){
 return(session.threadLifecycle||[]).map(({thread_id,predecessor,...item})=>({...item,runtime_binding_present:!!thread_id,predecessor_present:!!predecessor}));
}

export function taskGraphForExport(graph){
 if(!graph)return null;
 const {requests=[],...metadata}=graph;
 return{...metadata,requests:requests.map(({sessionID,threadID,...item})=>({...item,runtime_binding_present:!!(sessionID||threadID)}))};
}
