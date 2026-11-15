import http from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT } from './environment.mjs';
import { science } from './science.mjs';
import { safeRequest, sha256, publicError } from './security.mjs';
import { providerStatus, localProvider, discoverModels, configureProvider, proveRuntime, setEvidence, closeRuntime, removeProvider, registerScientificAccess, toolTrace } from './runtime.mjs';
import { coordinate, evidenceReport } from './workflow.mjs';
import { hypotheses, protocols, evaluateSignature } from './protocols.mjs';
import { semanticStatus } from './jev.mjs';
import { reserve, getTest, commit, authorize, evaluate, publicTest, cancel, preparePrediction } from './integrity.mjs';
import { powerContextRequest } from './scope.mjs';
import { diagnosticPacket } from './field.mjs';
import{prepareHandoff,referralDirectory}from'./handoff.mjs';
import { executionVersions } from './versions.mjs';
import { domainSkills, referenceCatalog, skillProfile } from './knowledge.mjs';
import {investigationRecords} from './investigation-records.mjs';
import{observationProtocol,observationSnapshot,selectObservationProtocol,completeObservationUpdate}from'./observations.mjs';
import {searchLiterature,readPaper} from './research.mjs';
import {stopRuntimeSession} from './runtime.mjs';
import{retireThreads,lifecycleForExport,taskGraphForExport,peerRequestsForExport}from'./thread-lifecycle.mjs';
import{freezeMissionScope,verifyMissionScope,missionAcquisitionRequest,nearestMissionSite}from'./mission-scope.mjs';
import { resolvePlace, ownedPlace } from './location.mjs';
import { resolveRegion, ownedRegion } from './regions.mjs';
import { setTimeout as delay } from 'node:timers/promises';

const storePath = resolve(ROOT, '.runtime/data/workspace.json');
mkdirSync(resolve(ROOT, '.runtime/data'), { recursive: true });
let sessions = existsSync(storePath) ? JSON.parse(readFileSync(storePath, 'utf8')) : [];
for(const session of sessions) { session.chatRunning=false;session.activeGraphID=null;retireThreads(session,'Backend restarted; actual embedded runtime bindings must be recreated.');for(const task of session.taskGraph?.requests||[])if(!task.status||task.status==='running')task.status='interrupted'; }
const jobs = new Map(), listeners = new Set();
const extractionRuns=new Map();
const chats=new Map();
const save = () => writeFileSync(storePath, JSON.stringify(sessions));
function event(session, type, data) {
  const item = { id: randomUUID(), sequence: (session.events.at(-1)?.sequence || 0)+1, time: new Date().toISOString(), type, ...data };
  session.events.push(item); save();
  for (const client of listeners) client.write(`data: ${JSON.stringify({ sessionID: session.id, event: item })}\n\n`);
}
function sessionFor(id) { const session = sessions.find(item => item.id === id); if (!session) throw new Error('Investigation not found.'); return session; }
function retainArtifact(session,result,jobID) {
  const artifact={id:randomUUID(),created:new Date().toISOString(),...result,manifest_sha256:sha256(result)};
  session.artifacts.push(artifact); setEvidence(session.id,artifact);
  event(session,'artifact.completed',{jobID,artifactID:artifact.id,summary:'Actual numerical values, QA, support and reproduction inputs recorded.'});
  return artifact;
}
const scientificAccess={
   async aggregateSeason(id,role,input,signal){
     if(!['gaia','aura','chloris','thalassa'].includes(role))throw Error('Seasonal analysis access denied.');
     const session=sessionFor(id),artifact=session.artifacts?.find(a=>a.id===input.artifact_id);
     if(!artifact||!input.rationale?.trim())throw Error('Seasonal analysis needs owned monthly evidence and an explicit scientific rationale.');
     const result=await science({operation:'aggregate_season',artifact_id:artifact.id,acquisition:artifact.acquisition,months:input.months,rationale:input.rationale},signal);
     const derived=retainArtifact(session,result);
     return {id:derived.id,variable:result.acquisition.variable,analysis:result.analysis,temporal_aggregation:result.acquisition.provenance.temporal_aggregation,limitations:result.acquisition.limitations};
   },
   async resolveRegion(id,role,input,signal){
     if(role!=='gaia')throw Error('Region selection is GAIA-owned.');
     const session=sessionFor(id),result=await resolveRegion(session,input,signal);
     event(session,'region.resolved',{role,summary:`Resolved ${result.results.length} real polygon boundary candidate(s).`});
     return {...result,results:result.results.map(({geometry,...region})=>region)};
   },
   async acquireRegion(id,role,input,signal){
     if(!['gaia','chloris'].includes(role))throw Error('Regional EVI acquisition requires GAIA or CHLORIS.');
     const session=sessionFor(id),region=ownedRegion(session,input.region_id);
     const request={start:input.start,end:input.end,geometry:region.geometry,label:region.name,boundary_source:region.source,boundary_sha256:region.boundary_sha256,latitude:region.latitude,longitude:region.longitude,min_coverage:0.8};
     const submitted=await science({...request,operation:'appeears_submit'},signal);
     const extraction={id:randomUUID(),region_id:region.id,task_id:submitted.task_id,status:submitted.status,created:new Date().toISOString(),request:{...request,submitted_request:submitted.request,metadata:submitted.metadata,metadata_receipt:submitted.metadata_receipt},submission_receipt:submitted.submission_receipt};
     session.extractions||=[];session.extractions.push(extraction);
     event(session,'extraction.submitted',{role,taskID:extraction.task_id,summary:'Fresh NASA AppEEARS monthly EVI/QA polygon task submitted. Waiting on NASA, with no overall agent deadline.'});
     return scientificAccess.finishRegion(id,role,{extraction_id:extraction.id},signal);
   },
    async finishRegion(id,role,input,signal){
      const key=`${id}:${input.extraction_id}`;
      if(extractionRuns.has(key))return extractionRuns.get(key);
      const work=scientificAccess.collectRegion(id,role,input,signal);
      extractionRuns.set(key,work);
      try{return await work;}finally{extractionRuns.delete(key);}
    },
    async collectRegion(id,role,input,signal){
     if(!['gaia','chloris'].includes(role))throw Error('Regional extraction access denied.');
     const session=sessionFor(id),extraction=session.extractions?.find(e=>e.id===input.extraction_id);
      if(!extraction)throw Error('Foreign extraction denied.');
      extraction.failure=null;
     // Resume only this owned asynchronous task. New investigations submit fresh
     // tasks; a resume is never misrepresented as a new provider extraction.
     try{
       let previous;
       for(;;){
         signal?.throwIfAborted();
         const state=await science({operation:'appeears_status',task_id:extraction.task_id},signal);
         extraction.status=state.status;extraction.last_receipt=state.receipt;
         if(previous!==state.status){event(session,'extraction.progress',{role,taskID:extraction.task_id,status:state.status,summary:`NASA regional extraction: ${state.status}.`});previous=state.status;}
         if(state.error||state.status==='error')throw Error('NASA AppEEARS extraction failed; no regional trend available.');
         if(state.status==='done')break;
         if(!['pending','processing'].includes(state.status))throw Error('NASA returned an unrecognized extraction state.');
         await delay(15_000,undefined,{signal});
       }
       const result=await science({...extraction.request,operation:'appeears_collect',task_id:extraction.task_id},signal);
       signal?.throwIfAborted();
       const artifact=retainArtifact(session,result);extraction.artifact_id=artifact.id;extraction.status='collected';
       session.title=`Regional vegetation · ${regionLabel(result)} · ${extraction.request.start}–${extraction.request.end}`;
       event(session,'extraction.completed',{role,artifactID:artifact.id,taskID:extraction.task_id,summary:'NASA polygon EVI/QA downloaded fresh, checksummed, area-weighted and analyzed; monthly support gaps remain explicit.'});
        const {geojson,...geometry}=result.acquisition.geometry;
        const {submitted_request,metadata,...provenance}=result.acquisition.provenance;
        return {id:artifact.id,variable:result.acquisition.variable,geometry,analysis:result.analysis,provenance};
     }catch(error){extraction.status=signal?.aborted?'paused':'failed';extraction.failure=publicError(error);event(session,'extraction.interrupted',{role,taskID:extraction.task_id,summary:extraction.failure});throw error;}
   },
   async resolvePlace(id,role,input,signal){if(role!=='gaia')throw Error('Location resolution is coordinated by GAIA.');return resolvePlace(sessionFor(id),input.query,signal);},
    async acquireLocation(id,role,input,signal){
     if(role!=='gaia')throw Error('Initial location-bound acquisition is coordinated by GAIA.');
     const session=sessionFor(id),place=ownedPlace(session,input.location_id);
     const start=Number(input.start),end=Number(input.end),variables=[...new Set(input.variables||[])];
     if(!Number.isInteger(start)||!Number.isInteger(end)||start<1981||end<start||end>new Date().getUTCFullYear()-1)throw Error('NASA POWER needs an explicit complete retrospective period from 1981 through the previous year. Ask one clarification if the period is not clear.');
      if(!variables.length||variables.some(variable=>!['T2M','PRECTOTCORR','RH2M'].includes(variable)))throw Error('Choose one or more approved NASA POWER variables relevant to the question.');
     const artifacts=[];
     for(const variable of variables){if(signal?.aborted)throw Error('Investigation cancelled before all selected variables were acquired.');
       const request={operation:'power',variable,latitude:place.latitude,longitude:place.longitude,start,end,label:`${place.name}${place.admin1?`, ${place.admin1}`:''}${place.country?`, ${place.country}`:''} · geocoded point; not a regional mean`};
        artifacts.push(retainArtifact(session,await science(request,signal)));
     }
      session.title=`Earth-system investigation · ${place.name}`;
     setEvidence(session.id,session.artifacts.at(-1));
      return {location:place,acquired:artifacts.map(artifact=>({id:artifact.id,variable:artifact.acquisition.variable,geometry:artifact.acquisition.geometry,analysis:{status:artifact.analysis.status,slope_per_year:artifact.analysis.slope_per_year,slope_per_decade:artifact.analysis.slope_per_decade,interval:artifact.analysis.interval,p_value:artifact.analysis.p_value,n:artifact.analysis.n,period:[artifact.analysis.requested_start,artifact.analysis.requested_end],limitations:artifact.analysis.limitations,sources:artifact.analysis.sources}})),source:'NASA POWER',limitation:'POWER is MERRA-2 model-derived grid context at the selected point, not local station weather or a regional area mean.'};
    },
    async prepareVegetation(id,role,input,signal){
      if(role!=='gaia')throw Error('NASA vegetation target selection is coordinated by GAIA.');
      const session=sessionFor(id),place=ownedPlace(session,input.location_id),catalog=await science({operation:'sites'},signal);
       const nearest=nearestMissionSite(catalog.sites,place),year=new Date().getUTCFullYear(),end=input.end??year-1,start=input.start??Math.max(2000,end-19),months=input.months?.length?input.months:Array.from({length:12},(_,index)=>index+1);
       if(!Number.isInteger(start)||!Number.isInteger(end)||end>year-1)throw Error('Choose a retrospective NASA MODIS period ending by the previous complete year.');
      if(session.missionScope)verifyMissionScope(session.missionScope);
      const plan=freezeMissionScope(catalog.sites,{siteid:nearest.site.siteid,start,end,months},new Date().toISOString(),'gaia');
      session.missionScopes||=[];session.missionScopes.push(structuredClone(plan));session.missionScope=plan;session.missionSelectionContext=null;
      session.missionSelectionContext={location_id:place.id,siteid:nearest.site.siteid,distance_km:Number(nearest.distance_km.toFixed(2)),support_note:'Nearest catalog-backed fixed site within 50 km; this does not represent a regional mean.'};
      event(session,'mission.target.frozen',{summary:`GAIA selected nearby NASA MODIS site ${plan.site_name} (${nearest.distance_km.toFixed(1)} km from the resolved place) for ${start}–${end}; fixed-site evidence is not a regional mean.`});
      return{selection:plan,site_distance_km:session.missionSelectionContext.distance_km,limitations:[session.missionSelectionContext.support_note,'MODIS EVI is an optical greenness proxy, not plant mortality or species identity. CHLORIS will acquire only if dispatched.']};
    },
   async notebook(id,role,input){const session=sessionFor(id);const sources=input.source_ids.map(id=>{const paper=session.literature?.find(item=>item.id===id&&item.text);if(!paper)throw Error('A research note needs actual retrieved source content.');return{id,url:paper.url,sha256:paper.text_sha256};});const result={id:randomUUID(),role,...input,sources,created:new Date().toISOString(),status:'provisional_source_grounded_note; not externally reviewed'};session.researchNotes ||= [];session.researchNotes.push(result);event(session,'research.note.created',{role,title:result.title,summary:'A specialist retained a provisional source-linked finding with prerequisites and limitations.'});return result;},
  async animals(id,role,input,signal){if(role!=='zoe')throw Error('Animal discovery is ZOE-owned.');const session=sessionFor(id),focal=session.artifacts[0];if(!focal)throw Error('Animal discovery needs an approved investigation scope.');const scope=powerContextRequest(focal,'T2M');const result={id:randomUUID(),created:new Date().toISOString(),...await science({...scope,operation:'animal_occurrences',scientific_name:input.scientific_name},signal)};session.animalRecords ||= [];session.animalRecords.push(result);event(session,'animal.occurrences.completed',{role,summary:'Licensed scoped GBIF occurrences acquired; effort and population-inference gaps remain explicit.'});return result;},
  async research(id,role,input,signal){const session=sessionFor(id),result=await searchLiterature(session,role,input,signal);event(session,'research.search.completed',{role,query:input.query,papers:result.papers.length,summary:'Actual literature discovery completed; sources still require relevance and methods review.'});return result;},
  async paper(id,role,input,signal){const session=sessionFor(id),result=await readPaper(session,role,input.id,signal);event(session,'research.paper.read',{role,paperID:input.id,summary:'Owned source content retrieved; external text remains evidence, not executable instructions.'});return result;},
  async peer(id,role,input){const session=sessionFor(id);if(role===input.role)throw Error('A cross-domain peer request needs a different function.');session.peerRequests ||= [];const graphID=session.activeGraphID||session.taskGraph?.id;const duplicate=session.peerRequests.find(item=>item.graphID===graphID&&item.requester===role&&item.role===input.role&&item.question===input.question);if(duplicate)return duplicate;const result={id:randomUUID(),requester:role,role:input.role,question:input.question,reason:input.reason,graphID,status:'pending',time:new Date().toISOString()};session.peerRequests.push(result);event(session,'peer.review.requested',{role,recipient:input.role,summary:'A specialist requested a scoped cross-domain check; not yet an executed peer result.'});return result;},
  async simulate(id,role,input,signal){const session=sessionFor(id),target=session.artifacts.find(item=>item.id===input.artifact_id);if(!target)throw Error('Simulation needs an actual owned target.');const covariates=(input.covariate_ids||[]).map(id=>{const item=session.artifacts.find(item=>item.id===id);if(!item)throw Error('Foreign covariate denied.');return item.acquisition;});const request={operation:'simulate',model:input.model,acquisition:target.acquisition,covariates,horizon:input.horizon,members:input.members,seed:input.seed||20261114,scenario:input.scenario};const result={id:randomUUID(),artifactID:target.id,request,created:new Date().toISOString(),initiated_by:role,...await science(request,signal)};session.simulations ||= [];session.simulations.push(result);event(session,'simulation.completed',{role,model:input.model,summary:`Actual AI-selected scenario executed: ${result.readiness}; omitted uncertainty and baseline tests retained.`});return result;},
  async proposal(id,role,input){const session=sessionFor(id);session.modelProposals ||= [];const result={id:randomUUID(),role,...input,status:'proposed_not_implemented_or_validated',time:new Date().toISOString()};session.modelProposals.push(result);event(session,'model.proposed',{role,summary:'New model idea and validation requirements recorded; equations are not executed or promoted as validated science.'});return result;},
  read:sessionFor,
   async catalog(role,id) { const catalog=await science({operation:'catalog'}),methods=await science({operation:'domain_methods'}); const session=sessionFor(id);return {role,skills:domainSkills(role),references:referenceCatalog(role),methods:Object.entries(methods).filter(([,item])=>item.role===role).map(([id,item])=>({id,...item})),variables:catalog.variables.filter(variable=>role==='gaia' || variable.domain===role),protocols:Object.values(protocols).filter(protocol=>role==='gaia' || protocol.owner===role),resources:catalog.resources.map(resource=>({name:resource.name,mode:resource.mode,note:resource.note})),mission_scope:session.missionScope?{...session.missionScope}:null,mission_capability:'GAIA and CHLORIS can acquire regional MOD13A3 EVI/QA from an owned real polygon with acquire_region or resume an owned extraction. CHLORIS can additionally acquire_vegetation for an exact frozen MOD13Q1 catalog footprint. Fixed-site evidence is not a regional mean; landscape polygons are not forest-only without a mask.'}; },
  async diagnostic(id,role,input,signal){const session=sessionFor(id),acquisitions=input.artifact_ids.map(id=>{const artifact=session.artifacts.find(item=>item.id===id);if(!artifact)throw Error('Foreign diagnostic artifact denied.');return artifact.acquisition;});const request={operation:'domain_diagnostic',role,method:input.method,acquisitions,records:role==='zoe'?session.animalRecords?.flatMap(item=>item.records)||[]:[]};const result={id:randomUUID(),created:new Date().toISOString(),request,...await science(request,signal)};session.domainDiagnostics ||= [];session.domainDiagnostics.push(result);event(session,'domain.diagnostic.completed',{role,method:input.method,summary:'Fixed domain computation completed; quantity, approximation and limitations retained.'});return result;},
   async acquire(id,variable,signal) {
     const session=sessionFor(id), focal=session.artifacts[0];
    if(!focal) throw new Error('Mark a region and acquire a focal record before automatic context acquisition.');
     const request=powerContextRequest(focal,variable);
     const result=await science(request,signal);
     return retainArtifact(session,result);
   },
   async acquireMission(id,signal){
     const session=sessionFor(id),selection=verifyMissionScope(session.missionScope);
      const result=await science({operation:'modis',siteid:selection.siteid,latitude:selection.latitude,longitude:selection.longitude,start:selection.start,end:selection.end,months:selection.months,label:selection.site_name},signal);
     if(signal?.aborted)throw Error('NASA vegetation acquisition cancelled before the artifact was retained.');
     const artifact=retainArtifact(session,result);
       session.title=`NASA vegetation · ${selection.site_name} · ${selection.start}–${selection.end}`;
     setEvidence(session.id,artifact);
     return{artifact,newly_acquired:true,selection_sha256:session.missionScope.selection_sha256};
   }
};
registerScientificAccess(scientificAccess);
function regionLabel(result){return result.acquisition.geometry.label;}
function json(response, data, status = 200) { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(JSON.stringify(data)); }
async function body(request) { let text = ''; for await (const chunk of request) { text += chunk; if (text.length > 2_500_000) throw new Error('Request size budget exceeded.'); } return text ? JSON.parse(text) : {}; }
function extractReply(context) {
  const messages = context.filter(message => message.type === 'assistant');
  const latest = messages.at(-1);
  if (!latest) throw new Error('No completed assistant response.');
  const content = latest.content || latest.parts || [];
  const text = Array.isArray(content) ? content.filter(part => part.type === 'text').map(part => part.text).join('\n') : '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

const server = http.createServer(async (request, response) => {
  if (!safeRequest(request)) return json(response, { error: 'Local-only request/origin denied.' }, 403);
    const url = new URL(request.url, 'http://127.0.0.1:4317');
    if(request.method==='GET' && url.pathname==='/'){response.writeHead(302,{Location:'/rune/'});return response.end();}
  try {
    if(request.method==='GET'&&(url.pathname==='/rune'||url.pathname==='/rune/'||url.pathname.startsWith('/rune/'))){
      const name=url.pathname.replace(/^\/rune\/?/,'')||'index.html';
      const base=['index.html','bridge.mjs','graph.mjs','ui-state.mjs','report.mjs'].includes(name)?resolve(ROOT,'app/rune'):resolve(ROOT,'.runtime/rune/gaia');
      const file=resolve(base,name),local=relative(base,file);
      if(local.startsWith('..')||isAbsolute(local)||!['.html','.mjs','.js','.wasm'].includes(extname(file))||!existsSync(file))return json(response,{error:'Rune asset unavailable; run the local Rune build.'},404);
      response.writeHead(200,{'Content-Type':extname(file)==='.wasm'?'application/wasm':extname(file)==='.html'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});
      return createReadStream(file).pipe(response);
    }
    if (request.method === 'GET' && url.pathname === '/api/status') return json(response, { ...providerStatus(), semantic:semanticStatus(), sessions, jobs: [...jobs.values()].map(job => ({ id: job.id, sessionID: job.sessionID, status: job.status, operation: job.operation, error: job.error })), science: { numerical: 'tested', domain_validation: 'not established', methods: 'seasonal OLS / Newey–West HAC' } });
    if(request.method==='GET'&&url.pathname.startsWith('/api/investigation/'))return json(response,investigationRecords(sessionFor(url.pathname.split('/').at(-1))));
    if (request.method === 'GET' && url.pathname === '/api/catalog') return json(response, {...await science({ operation: 'catalog' }),protocols:Object.values(protocols)});
    if (request.method === 'GET' && url.pathname === '/api/sites') return json(response, await science({ operation: 'sites' }));
    if(request.method==='POST'&&url.pathname==='/api/regions/resolve'){const input=await body(request);return json(response,await scientificAccess.resolveRegion(input.sessionID,'gaia',input));}
    if(request.method==='POST'&&['/api/regions/acquire','/api/regions/resume'].includes(url.pathname)){
      const input=await body(request),session=sessionFor(input.sessionID),controller=new AbortController();
      const job={id:randomUUID(),sessionID:session.id,operation:'appeears',status:'running',controller};jobs.set(job.id,job);
      json(response,{jobID:job.id},202);
      try{const result=await (url.pathname.endsWith('/resume')?scientificAccess.finishRegion:scientificAccess.acquireRegion)(session.id,'gaia',input,controller.signal);job.artifactID=result.id;job.status='completed';}
      catch(error){job.status=controller.signal.aborted?'cancelled':'failed';job.error=publicError(error);event(session,'job.failed',{jobID:job.id,summary:job.error});}return;
    }
    if(request.method==='POST'&&url.pathname==='/api/mission/plan'){
      const input=await body(request),session=sessionFor(input.sessionID);
      if(session.chatRunning||[...jobs.values()].some(job=>job.sessionID===session.id&&job.status==='running'))throw Error('Finish or stop active investigation work before changing its NASA mission target.');
      const catalog=await science({operation:'sites'},AbortSignal.timeout(60_000));
      const plan=freezeMissionScope(catalog.sites,input);
      session.missionScopes||=[];session.missionScopes.push(structuredClone(plan));session.missionScope=plan;
      event(session,'mission.target.frozen',{summary:`User froze NASA MODIS Collection 6.1 EVI at ${plan.site_name} for ${plan.start}–${plan.end}; CHLORIS may acquire this exact target.`});
      return json(response,plan);
    }
    if(request.method==='POST'&&url.pathname==='/api/mission/clear'){
      const input=await body(request),session=sessionFor(input.sessionID);
      if(session.chatRunning||[...jobs.values()].some(job=>job.sessionID===session.id&&job.status==='running'))throw Error('Finish or stop active investigation work before releasing its NASA mission target.');
        session.missionScope=null;session.missionSelectionContext=null;session.missionScopes||=[];
      event(session,'mission.target.released',{summary:'The user released the current NASA MODIS target; its retained history and acquired artifacts are unchanged.'});
      return json(response,{released:true,history:session.missionScopes.length});
    }
    if(request.method==='POST' && url.pathname==='/api/stations') { const input=await body(request);sessionFor(input.sessionID);return json(response,await science({operation:'noaa_stations',latitude:input.latitude,longitude:input.longitude,start:input.start,end:input.end})); }
    if(request.method==='GET'&&url.pathname==='/api/competence')return json(response,{profiles:skillProfile(providerStatus().model),limitation:'Reviewed procedures and sources are not independent domain certification.'});
    if(request.method==='POST'&&url.pathname==='/api/research/search'){const input=await body(request),session=sessionFor(input.sessionID);if(!['gaia','aura','thalassa','chloris','zoe'].includes(input.role))throw Error('Unknown research role.');return json(response,await scientificAccess.research(session.id,input.role,{query:input.query},AbortSignal.timeout(45_000)));}
    if(request.method==='POST'&&url.pathname==='/api/research/read'){const input=await body(request),session=sessionFor(input.sessionID);return json(response,await scientificAccess.paper(session.id,'gaia',{id:input.id},AbortSignal.timeout(45_000)));}
    if(request.method==='POST'&&url.pathname==='/api/animals'){const input=await body(request),session=sessionFor(input.sessionID);return json(response,await scientificAccess.animals(session.id,'zoe',{scientific_name:input.scientific_name},AbortSignal.timeout(180_000)));}
    if(request.method==='POST' && url.pathname==='/api/field/intake') {const input=await body(request),session=sessionFor(input.sessionID),packet={id:randomUUID(),created:new Date().toISOString(),...diagnosticPacket(input.case)};session.fieldCases ||= [];session.fieldCases.push(packet);event(session,'field.intake.saved',{summary:'Private reported-context intake saved; no verified diagnosis or professional contact is claimed.'});return json(response,packet);}
    if(request.method==='GET'&&url.pathname==='/api/field/referrals')return json(response,referralDirectory);
    if(request.method==='POST'&&url.pathname==='/api/field/handoff'){const input=await body(request),session=sessionFor(input.sessionID),packet=session.fieldCases?.find(item=>item.id===input.caseID);if(!packet)throw Error('Private handoff needs an owned reported-context packet.');const result={id:randomUUID(),caseID:packet.id,created:new Date().toISOString(),...prepareHandoff(packet,input.selection)};session.handoffPackets ||= [];session.handoffPackets.push(result);event(session,'field.handoff.prepared',{summary:'User-confirmed private handoff draft prepared locally; nothing sent and no diagnosis claimed.'});return json(response,result);}
    if (request.method === 'GET' && url.pathname === '/api/models') return json(response,await science({operation:'models'}));
    if (request.method === 'GET' && url.pathname === '/api/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      response.write(': connected\n\n'); listeners.add(response);
      const heartbeat=setInterval(()=>{if(!response.destroyed)response.write(': keep-alive\n\n');},15000);heartbeat.unref();
      request.on('close', () => {clearInterval(heartbeat);listeners.delete(response);}); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/provider/local-models') {
      const input = localProvider(), catalog = await discoverModels(input);
      return json(response, { ...catalog, name: input.name });
    }
    if (request.method === 'POST' && url.pathname === '/api/provider/models') return json(response, await discoverModels(await body(request)));
    if (request.method === 'POST' && url.pathname === '/api/provider/connect') {
      if(sessions.some(session=>session.chatRunning)||providerStatus().proof?.state==='running')return json(response,{error:'Stop active investigations or finish provider verification before changing the provider.'},409);
      const input = await body(request);
      const result=await configureProvider(input.use_local ? { ...localProvider(), model: input.model } : input);for(const session of sessions){retireThreads(session,'Provider changed; old runtime bindings cannot continue.');}save();return json(response,result);
    }
    if (request.method === 'POST' && url.pathname === '/api/provider/proof') return json(response,await proveRuntime(progress=>{const message=`data: ${JSON.stringify({type:'provider.proof.progress',progress})}\n\n`;for(const listener of listeners)listener.write(message);}));
    if (request.method === 'POST' && url.pathname === '/api/provider/remove') {if(chats.size||providerStatus().proof?.state==='running')throw Error('Stop the active investigation or finish provider verification before disconnecting.');const result = await removeProvider(); for (const session of sessions) retireThreads(session,'Provider disconnected.'); save(); return json(response, result); }
    if (request.method === 'POST' && url.pathname === '/api/sessions/settings') {
      const input = await body(request), session = sessionFor(input.sessionID);
      if(input.depth!==undefined){if(!['technical','plain'].includes(input.depth))throw Error('Unsupported explanation depth.');session.depth=input.depth;}
      event(session, 'settings.updated', { summary: 'Conversation settings changed; numerical methods, uncertainty and existing evidence are unchanged.' });
      return json(response, session);
    }
    if (request.method === 'POST' && url.pathname === '/api/sessions') {
      const input = await body(request);
      const session = { id: randomUUID(), title: 'Untitled investigation', created: new Date().toISOString(), depth: input.depth === 'technical' ? 'technical' : 'plain', messages: [], artifacts: [], events: [], threads: {}, roleSummaries: {}, hypothesisRecords: [] };
      sessions.unshift(session); save(); return json(response, session, 201);
    }
    if (request.method === 'POST' && url.pathname === '/api/analyze') {
      const input = await body(request), session = sessionFor(input.sessionID);
      if (!['power', 'modis', 'import'].includes(input.operation)) throw new Error('Scientific operation not registered.');
      // MODIS is a CHLORIS capability bound to the user's immutable, live-catalog mission
      // selection. Never let a browser payload or model rewrite its coordinates/calendar.
      const scienceRequest=input.operation==='modis'?missionAcquisitionRequest(session.missionScope):input;
      const controller = new AbortController(),observationBefore=input.operation==='import'&&session.observationPlan?observationSnapshot(session):null;
      const job = { id: randomUUID(), sessionID: session.id, operation: input.operation, status: 'running', controller }; jobs.set(job.id, job);
      event(session, 'job.started', { jobID: job.id, operation: input.operation, role: input.operation === 'modis' ? 'chloris' : 'aura', summary: 'Acquiring numerical science values and quality metadata.' });
      json(response, { jobID: job.id }, 202);
      try {
         const result = await science(scienceRequest, controller.signal);
        if (controller.signal.aborted) return;
         const artifact = retainArtifact(session,result,job.id); session.title = `${artifact.acquisition.variable.name} / ${artifact.acquisition.geometry.label}`;
        session.roleSummaries[artifact.acquisition.variable.domain] = { source: 'deterministic artifact summary; not an executed language-model worker', artifactID: artifact.id, text: `${artifact.acquisition.variable.name}: ${artifact.analysis.n} valid observations. ${artifact.analysis.status.replaceAll('_', ' ')}. ${artifact.acquisition.variable.support}` };
        setEvidence(session.id, artifact);
        if(observationBefore){completeObservationUpdate(session,observationBefore,artifact.id);event(session,'evidence.updated',{artifactID:artifact.id,summary:'Actual imported observations assessed against the retained protocol; declared provenance and incompatible support remain explicit.'});}
        job.status = 'completed';
        event(session, 'artifact.completed', { jobID: job.id, artifactID: artifact.id, summary: 'Real series, trend diagnostics and reproducibility inputs are ready.' });
      } catch (error) { job.status = controller.signal.aborted ? 'cancelled' : 'failed'; job.error = publicError(error); event(session, 'job.failed', { jobID: job.id, summary: job.error }); }
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/jobs/stop') {
      const input = await body(request), job = jobs.get(input.jobID);
      if (!job || job.sessionID !== input.sessionID) throw new Error('Foreign job cancellation denied.');
      if(job.status!=='running')throw Error('This numerical job is already terminal.');
      job.controller.abort(); job.status = 'cancelled';event(sessionFor(job.sessionID),'job.cancelled',{jobID:job.id,summary:'User cancelled the actual numerical request; completed evidence is retained.'}); return json(response, { status: 'cancelled' });
    }
    if (request.method === 'POST' && url.pathname === '/api/chat') {
      const input = await body(request), session = sessionFor(input.sessionID);
      if (!providerStatus().configured) throw new Error('Connect a compatible model provider to start a GAIA conversation.');
      if (typeof input.text !== 'string' || !input.text.trim()) throw new Error('Message cannot be empty.');
      if (session.chatRunning) throw new Error('GAIA is finishing this session’s current reply.');
      session.chatRunning = true;const controller=new AbortController();chats.set(session.id,controller);
      const user = { id: randomUUID(), role: 'user', text: input.text, time: new Date().toISOString() }; session.messages.push(user);
      if(session.title==='Untitled investigation')session.title=input.text.replace(/\s+/g,' ').trim()||'Earth-system investigation';
      event(session, 'gaia.started', { role: 'gaia', summary: 'GAIA is considering the next useful question.' });
      // The response acknowledges the durable investigation immediately. SSE
      // delivers progress/results; HTTP clients need not keep one request open
      // for NASA's queue or the entire agent investigation.
      json(response,{sessionID:session.id,status:'running',userMessageID:user.id},202);
      try {
        // No overall investigation deadline: only the user's stop signal cancels working agents.
        const message = await coordinate(session,input.text,(type,data)=>event(session,type,data),controller.signal); session.messages.push(message);
        event(session, 'gaia.completed', { role: 'gaia', summary: 'GAIA’s report is ready, with owned evidence, numerical findings and limitations.' });
      } catch(error){const cancelled=controller.signal.aborted;controller.abort();await Promise.allSettled(Object.values(session.threads).map(stopRuntimeSession));retireThreads(session,cancelled?'User cancelled this owned investigation.':'Investigation was interrupted.');for(const task of session.taskGraph?.requests||[])if(!['completed','failed'].includes(task.status))task.status=cancelled?'cancelled':'interrupted';if(!cancelled)session.messages.push({id:randomUUID(),role:'gaia',text:evidenceReport(session,input.text,[],null,publicError(error)),label:'Partial evidence report; model investigation interrupted, not a completed assessment.',time:new Date().toISOString()});event(session,'gaia.interrupted',{summary:cancelled?'Owned investigation cancelled; completed evidence and source records were retained.':'Investigation interrupted; a clearly labeled partial evidence report is available.',reason:cancelled?'user_cancelled':publicError(error)});} finally { session.chatRunning = false;session.activeGraphID=null;chats.delete(session.id);save(); }return;
    }
    if(request.method==='POST'&&url.pathname==='/api/chat/stop'){const input=await body(request),session=sessionFor(input.sessionID),controller=chats.get(session.id);if(!controller)throw Error('No running owned investigation.');controller.abort();await Promise.allSettled(Object.values(session.threads).map(stopRuntimeSession));retireThreads(session,'User explicitly cancelled the investigation.');event(session,'gaia.cancelled',{summary:'User stopped the owned investigation and its actual specialist sessions; partial evidence remains inspectable.'});return json(response,{status:'cancelled'});}
    if (request.method==='POST' && url.pathname==='/api/simulate') {
      const input=await body(request),session=sessionFor(input.sessionID),artifact=session.artifacts.find(item=>item.id===input.artifactID);
      if(!artifact) throw new Error('Simulation needs an owned acquired artifact.');
      const covariates=(input.covariateIDs || []).map(id=>{const item=session.artifacts.find(item=>item.id===id); if(!item) throw new Error('Foreign covariate denied.'); return item.acquisition;});
      const controller=new AbortController(), job={id:randomUUID(),sessionID:session.id,operation:'simulation',status:'running',controller}; jobs.set(job.id,job);
      event(session,'simulation.started',{jobID:job.id,role:'gaia',summary:'Executing a registered numerical model and chronological baseline checks.'}); json(response,{jobID:job.id},202);
      try { const modelRequest={operation:'simulate',model:input.model,acquisition:artifact.acquisition,covariates,horizon:input.horizon,members:input.members,seed:input.seed,scenario:input.scenario};const result=await science(modelRequest,controller.signal); session.simulations ||= []; session.simulations.push({id:randomUUID(),artifactID:artifact.id,request:modelRequest,created:new Date().toISOString(),...result}); job.status='completed'; event(session,'simulation.completed',{jobID:job.id,summary:`Executed model: ${result.readiness}; conditional ranges are not causal probabilities.`}); }
      catch(error){job.status=controller.signal.aborted?'cancelled':'failed';job.error=publicError(error);event(session,'simulation.failed',{jobID:job.id,summary:job.error});} return;
    }
    if(request.method==='POST'&&url.pathname==='/api/observation/plan'){
      const input=await body(request),session=sessionFor(input.sessionID);
      if([...jobs.values()].some(job=>job.sessionID===session.id&&job.status==='running'))throw Error('Finish or stop the numerical job before changing its observation protocol.');
      const plan=selectObservationProtocol(session,input.protocolID);event(session,'observation.selected',{summary:'Observation protocol and pre-acquisition evidence baseline retained; earlier plans remain in history.'});return json(response,plan);
    }
    if(request.method==='POST' && url.pathname==='/api/observation/get') {
      const input=await body(request),session=sessionFor(input.sessionID),protocol=observationProtocol(session);
      if(session.chatRunning)throw Error('Finish or stop the current investigation before requesting a separate observation update.');
      if([...jobs.values()].some(job=>job.sessionID===session.id&&job.status==='running'))throw Error('Finish or stop the active numerical job before requesting an observation update.');
      if(!protocol)throw Error('Select an observation protocol first.');
      const existing=protocol.route==='existing_data'||protocol.availability==='inspect_existing_owned_data';
      if(protocol.operation!=='power'&&!existing)throw Error('Use Add another dataset to import real observations, or obtain the qualified field evidence in this protocol. No automatic adapter is claimed.');
      const before=observationSnapshot(session),controller=new AbortController(),job={id:randomUUID(),sessionID:session.id,operation:'observation',status:'running',controller};jobs.set(job.id,job);
      event(session,'observation.started',{jobID:job.id,summary:'Using the retained protocol; existing evidence will not be relabelled as a new observation.'});json(response,{jobID:job.id},202);
      try{const artifact=protocol.operation==='power'?await scientificAccess.acquire(session.id,protocol.variable,controller.signal):null;
        if(controller.signal.aborted)throw Error('Observation acquisition cancelled.');
        completeObservationUpdate(session,before,artifact?.id);job.status='completed';
        event(session,'evidence.updated',{jobID:job.id,artifactID:artifact?.id,summary:'Before/after evidence snapshots retained; inconclusive signatures remain inconclusive.'});
      }catch(error){job.status=controller.signal.aborted?'cancelled':'failed';job.error=publicError(error);event(session,'observation.failed',{jobID:job.id,summary:job.error});}return;
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/export/')) {
      // Exported predictions retain their original values, selection and disclosure mode.
      const id = url.pathname.split('/').at(-1), session = sessionFor(id);
      const exported = { schema_version: 2, generated: new Date().toISOString(), title: session.title, artifacts: session.artifacts, task_graph:taskGraphForExport(session.taskGraph), thread_lifecycle:lifecycleForExport(session), hypotheses:session.hypothesisRecords, observation_plan:session.observationPlan, evidence_updates:session.evidenceUpdates || [], simulations: session.simulations || [], semantic_reviews: session.semanticReviews || [], tool_trace:toolTrace(session.id).map(({threadID,output,...item})=>({...item,output_sha256:sha256(output)})), limitations: ['Export is an explicit local user action. Review coordinates and source redistribution rights before publishing.', 'Private runtime identifiers and raw tool inputs/outputs are excluded; tool output digests preserve trace integrity without publishing conversation content.', 'Language-model prose is not required to reproduce the numerical result.'], reproduction: 'npm run reproduce -- path/to/export.json' };
       exported.comparisons=session.comparisons || [];exported.prediction_test=session.predictionTest || null;exported.observation_plan_history=session.observationPlans||[];
       exported.domain_diagnostics=session.domainDiagnostics||[];exported.animal_records=session.animalRecords||[];exported.peer_requests=peerRequestsForExport(session.peerRequests);exported.model_proposals=session.modelProposals||[];exported.research_notes=session.researchNotes||[];
       exported.mission_scope=session.missionScope||null;exported.mission_scope_history=session.missionScopes||[];exported.mission_selection_context=session.missionSelectionContext||null;
       exported.regions=session.regions||[];exported.extractions=session.extractions||[];exported.report=session.messages.filter(m=>m.role==='gaia').at(-1)||null;
       exported.literature=(session.literature||[]).map(({text,...metadata})=>metadata);exported.literature_disclosure='Raw third-party texts excluded from standard export; review quotations and redistribution rights before publishing.';
      const versions=executionVersions(session.simulations || []);exported.simulations=versions.active;exported.historical_simulations=versions.historical;
       exported.investigation_record=investigationRecords(session);
       exported.reproduction_scope='All analyses, comparisons and the latest execution of each frozen model request. Earlier repeated model executions remain in historical_simulations; rerunning them requires their recorded implementation checksum/version.';
      response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="gaia-investigation.json"', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(exported, null, 2)); return;
    }
    if(request.method==='POST' && url.pathname==='/api/bucket') {
      const input=await body(request),session=sessionFor(input.sessionID);
      const modelRequest={...input.inputs,operation:'simulate',model:'water_bucket_v1'};
      const result=await science(modelRequest,AbortSignal.timeout(60_000));
      session.simulations ||= [];session.simulations.push({id:randomUUID(),request:modelRequest,created:new Date().toISOString(),...result});
      event(session,'simulation.completed',{summary:'Conservative bucket arithmetic executed; illustrative only, not validated discharge or root-water prediction.'});return json(response,result);
    }
    if(request.method==='POST' && url.pathname==='/api/references/search') {
      const input=await body(request),session=sessionFor(input.sessionID),focal=session.artifacts.find(item=>item.id===input.artifactID);
      if(!focal || focal.acquisition.variable.provider!=='NASA POWER') throw new Error('This bounded climatic comparison currently needs an owned POWER record; no arbitrary ecological reference is fabricated.');
      const g=focal.acquisition.geometry,baseline_end=focal.acquisition.series[Math.floor(focal.acquisition.series.length*.8)-1].date;
      const pool=[{latitude:g.latitude-.75,longitude:g.longitude},{latitude:g.latitude+.75,longitude:g.longitude},{latitude:g.latitude,longitude:g.longitude+1.25}].filter(point=>point.latitude>=-90 && point.latitude<=90 && point.longitude<=180);
      session.referenceSearch={id:randomUUID(),pool,variable:focal.acquisition.variable.id,baseline_end,selection:'fixed neighboring coarse locations before acquisition; no outcome-selected replacement',hash:sha256({pool,baseline_end})};event(session,'reference.started',{role:'gaia',summary:'Declared a bounded coarse-context comparison pool; not ecological twins.'});
      const candidates=[],rejected=[];
      for(const point of pool) {try {const result=await science({...powerContextRequest(focal,focal.acquisition.variable.id),...point,label:`Context ${point.latitude.toFixed(2)}, ${point.longitude.toFixed(2)}`},AbortSignal.timeout(180_000));candidates.push(retainArtifact(session,result));}catch(error){rejected.push({point,reason:publicError(error)});}}
      const comparisonRequest={operation:'compare',focal,candidates,baseline_end};const result=await science(comparisonRequest);session.comparisons ||= [];session.comparisons.push({id:randomUUID(),focalID:focal.id,request:comparisonRequest,created:new Date().toISOString(),...result,rejected});event(session,'reference.completed',{summary:'Actual candidate values and paired slope differences retained; selected contrasts remain exploratory.'});return json(response,session.comparisons.at(-1));
    }
    if(request.method==='POST' && url.pathname==='/api/prediction') {
      const input=await body(request),session=sessionFor(input.sessionID);
      if(input.action==='reserve') {const record=reserve(session.id);session.predictionTest=publicTest(record);save();return json(response,session.predictionTest);}
      const record=getTest(session.predictionTest?.id,session.id);
      if(input.action==='cancel') {session.predictionTest=cancel(record);save();return json(response,session.predictionTest);}
      if(input.action==='commit') {
        const training=await science({operation:'power',variable:record.variable,latitude:record.latitude,longitude:record.longitude,start:2001,end:2024,label:'Metadata-selected historical comparison target'},AbortSignal.timeout(180_000));
        const prediction=await science({operation:'simulate',model:'seasonal_continuation_v1',acquisition:training.acquisition,horizon:12,members:64,seed:20261114});commit(record,preparePrediction(prediction,training.acquisition));
      } else if(input.action==='prove') {
        try {await science({operation:'power',variable:record.variable,latitude:record.latitude,longitude:record.longitude,start:2025,end:2025,label:'Actual reserved target ordinary-read proof'});record.incident='Denied-read test unexpectedly returned reserved values.';}
        catch(error){if(!String(error.message).includes('Reserved evidence access denied')) throw error;record.denial_proof={actual_target:true,decision:'denied',time:new Date().toISOString()};}
      } else if(input.action==='reveal') {
        if(!record.denial_proof) throw new Error('Demonstrate the actual reserved-target denial before this reveal.');
        const capability=authorize(record),result=await science({operation:'power',variable:record.variable,latitude:record.latitude,longitude:record.longitude,start:2025,end:2025,label:'Authorized historical evaluation'},AbortSignal.timeout(180_000),undefined,capability);
        evaluate(record,retainArtifact(session,result));
      } else throw new Error('Unknown prediction state transition.');
      session.predictionTest=publicTest(record);event(session,'prediction.updated',{summary:`Historical test state: ${record.state}. Stronger locked label withheld without complete route proof.`});return json(response,session.predictionTest);
    }
    if (request.method === 'GET' && url.pathname.startsWith('/logos/')) {
      const file = url.pathname.slice(7);
      if (!/^(gaia|aura|thalassa|chloris|zoe)-icon\.svg$/.test(file)) return json(response, { error: 'Logo not found' }, 404);
      response.writeHead(200, { 'Content-Type': 'image/svg+xml', 'X-Content-Type-Options': 'nosniff' }); response.end(readFileSync(resolve(ROOT, 'artifacts/logos', file))); return;
    }
    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
      let file = resolve(ROOT, 'dist', '.' + decodeURIComponent(url.pathname));
      const contained = relative(resolve(ROOT, 'dist'), file);
      if (contained.startsWith('..') || isAbsolute(contained)) return json(response, { error: 'Static path denied' }, 403);
      if (!existsSync(file) || url.pathname === '/') file = resolve(ROOT, 'dist/index.html');
      if (!existsSync(file)) return json(response, { error: 'Run npm run build, or npm run dev for development.' }, 404);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
      response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); response.end(readFileSync(file)); return;
    }
    json(response, { error: 'Route not found.' }, 404);
  } catch (error) {
    const known = error instanceof SyntaxError ? 'Invalid JSON request.' : error.message;
    // SDK errors can contain upstream request bodies; only our bounded application
    // errors cross this boundary. Never return SDK stack/cause objects.
    json(response, { error: publicError({message:known}) }, 400);
  }
});
server.listen(4317, '127.0.0.1', () => console.log('GAIA local backend: http://127.0.0.1:4317 (OpenCode SDK 2.3.0; keys remain server-side)'));
for (const name of ['SIGINT', 'SIGTERM']) process.on(name, async () => { for (const job of jobs.values()) job.controller.abort(); server.close(); await closeRuntime(); process.exit(0); });
