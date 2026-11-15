// UI projections never mutate or replace the retained scientific record.
export function artifactSummary(artifact) {
  const a=artifact.acquisition||{},d=artifact.analysis||{};
  return {id:artifact.id,created:artifact.created,acquisition:{variable:a.variable,frequency:a.frequency,geometry:{label:a.geometry?.label}},analysis:{status:d.status,requested_start:d.requested_start,requested_end:d.requested_end,n:d.n,missing:d.missing,slope_per_decade:d.slope_per_decade,p_value:d.p_value,interval:d.interval,specification:d.specification}};
}
function withoutGeometry(value) {
  if(Array.isArray(value))return value.map(withoutGeometry);
  if(!value||typeof value!=='object')return value;
  const output={};
  for(const [key,item] of Object.entries(value)){
    if(['geojson','coordinates','submitted_request'].includes(key))continue;
    output[key]=withoutGeometry(item);
  }
  return output;
}
export function sessionSummary(session) {
  return {id:session.id,title:session.title,created:session.created,archived:session.archived,chatRunning:session.chatRunning,message_count:session.message_count??session.messages?.length??0,field_case_count:session.field_case_count??session.fieldCases?.length??0,artifacts:(session.artifacts||[]).map(artifactSummary)};
}
export function sessionDetail(session) {
  const {investigations,regions,artifacts,roleSummaries,domainDiagnostics,literature,extractions,threads,threadLifecycle,taskGraph,peerRequests,...rest}=session;
  return {...rest,_ui_detail:true,artifacts:(artifacts||[]).map(artifactSummary),
    regions:(regions||[]).map(withoutGeometry),
    threadLifecycle:(threadLifecycle||[]).map(({thread_id,predecessor,runtime_binding_present,predecessor_present,...item})=>({...item,runtime_binding_present:runtime_binding_present??!!thread_id,predecessor_present:predecessor_present??!!predecessor})),
    taskGraph:taskGraph?{...taskGraph,requests:(taskGraph.requests||[]).map(({sessionID,threadID,runtime_binding_present,...item})=>({...item,runtime_binding_present:runtime_binding_present??!!(sessionID||threadID)}))}:null,
    peerRequests:(peerRequests||[]).map(({review_thread,runtime_binding_present,...item})=>({...item,runtime_binding_present:runtime_binding_present??!!review_thread})),
    roleSummaries:Object.fromEntries(Object.entries(roleSummaries||{}).map(([role,{threadID,...review}])=>[role,{...review,evidence_ids:review.evidence_ids||(review.cited_evidence||[]).map(item=>item.id),trace:(review.trace||[]).map(({tool,time})=>({tool,time}))}])),
    domainDiagnostics:(domainDiagnostics||[]).map(({request,...diagnostic})=>withoutGeometry(diagnostic)),
    literature:(literature||[]).map(({text,...paper})=>paper),
    extractions:(extractions||[]).map(({request,...extraction})=>({...extraction,request:request?{start:request.start,end:request.end,index:request.index,label:request.label}:undefined}))};
}
export function artifactDetail(artifact) {
  if(!artifact)return null;
  const acquisition=artifact.acquisition||{},provenance=acquisition.provenance||{};
  const {submitted_request,metadata,...receipt}=provenance;
  return {...artifact,acquisition:{...acquisition,geometry:withoutGeometry(acquisition.geometry),provenance:receipt}};
}
export function uiSnapshot(state) {
  return {...state,artifact:artifactDetail(state.artifact),status:{...state.status,sessions:(state.status.sessions||[]).map(session=>session.id===state.selected?sessionDetail(session):sessionSummary(session))}};
}
