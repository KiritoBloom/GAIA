import http from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT } from './environment.mjs';
import { science } from './science.mjs';
import { safeRequest, sha256, publicError } from './security.mjs';
import { providerStatus, localProvider, discoverModels, configureProvider, proveRuntime, setEvidence, closeRuntime, removeProvider, registerScientificAccess, toolTrace } from './runtime.mjs';
import { coordinate } from './workflow.mjs';
import { hypotheses, protocols, evaluateSignature } from './protocols.mjs';
import { semanticStatus } from './jev.mjs';
import { reserve, getTest, commit, authorize, evaluate, publicTest, cancel } from './integrity.mjs';
import { powerContextRequest } from './scope.mjs';
import { diagnosticPacket } from './field.mjs';
import { executionVersions } from './versions.mjs';

const storePath = resolve(ROOT, '.runtime/data/workspace.json');
mkdirSync(resolve(ROOT, '.runtime/data'), { recursive: true });
let sessions = existsSync(storePath) ? JSON.parse(readFileSync(storePath, 'utf8')) : [];
for(const session of sessions) { session.chatRunning=false; session.threads={}; }
const jobs = new Map(), listeners = new Set();
const save = () => writeFileSync(storePath, JSON.stringify(sessions));
function event(session, type, data) {
  const item = { id: randomUUID(), sequence: (session.events.at(-1)?.sequence || 0)+1, time: new Date().toISOString(), type, ...data };
  session.events.push(item); session.events = session.events.slice(-150); save();
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
  read:sessionFor,
  async catalog(role) { const catalog=await science({operation:'catalog'}); return {role,variables:catalog.variables.filter(variable=>role==='gaia' || variable.domain===role),protocols:Object.values(protocols).filter(protocol=>role==='gaia' || protocol.owner===role),resources:catalog.resources.map(resource=>({name:resource.name,mode:resource.mode,note:resource.note}))}; },
  async acquire(id,variable,signal) {
    const session=sessionFor(id), focal=session.artifacts.find(item=>item.acquisition.provenance.provider==='NASA POWER') || session.artifacts[0];
    if(!focal) throw new Error('Mark a region and acquire a focal record before automatic context acquisition.');
    const existing=session.artifacts.find(item=>item.acquisition.variable.id===variable && item.acquisition.geometry.latitude===focal.acquisition.geometry.latitude && item.acquisition.geometry.longitude===focal.acquisition.geometry.longitude);
    if(existing) return existing;
    const result=await science(powerContextRequest(focal,variable),signal);
    return retainArtifact(session,result);
  }
};
registerScientificAccess(scientificAccess);
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
      const base=name==='index.html'||name==='bridge.mjs'?resolve(ROOT,'app/rune'):resolve(ROOT,'.runtime/rune/gaia');
      const file=resolve(base,name),local=relative(base,file);
      if(local.startsWith('..')||isAbsolute(local)||!['.html','.mjs','.js','.wasm'].includes(extname(file))||!existsSync(file))return json(response,{error:'Rune asset unavailable; run the local Rune build.'},404);
      response.writeHead(200,{'Content-Type':extname(file)==='.wasm'?'application/wasm':extname(file)==='.html'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});
      return createReadStream(file).pipe(response);
    }
    if (request.method === 'GET' && url.pathname === '/api/status') return json(response, { ...providerStatus(), semantic:semanticStatus(), sessions, jobs: [...jobs.values()].map(job => ({ id: job.id, sessionID: job.sessionID, status: job.status, operation: job.operation, error: job.error })), science: { numerical: 'tested', domain_validation: 'not established', methods: 'seasonal OLS / Newey–West HAC' } });
    if (request.method === 'GET' && url.pathname === '/api/catalog') return json(response, await science({ operation: 'catalog' }));
    if (request.method === 'GET' && url.pathname === '/api/sites') return json(response, await science({ operation: 'sites' }));
    if(request.method==='POST' && url.pathname==='/api/stations') { const input=await body(request);sessionFor(input.sessionID);return json(response,await science({operation:'noaa_stations',latitude:input.latitude,longitude:input.longitude,start:input.start,end:input.end})); }
    if(request.method==='POST' && url.pathname==='/api/field/intake') {const input=await body(request),session=sessionFor(input.sessionID),packet={id:randomUUID(),created:new Date().toISOString(),...diagnosticPacket(input.case)};session.fieldCases ||= [];session.fieldCases.push(packet);event(session,'field.intake.saved',{summary:'Private reported-context intake saved; no verified diagnosis or professional contact is claimed.'});return json(response,packet);}
    if (request.method === 'GET' && url.pathname === '/api/models') return json(response,await science({operation:'models'}));
    if (request.method === 'GET' && url.pathname === '/api/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      response.write(': connected\n\n'); listeners.add(response); request.on('close', () => listeners.delete(response)); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/provider/local-models') {
      const input = localProvider(), catalog = await discoverModels(input);
      return json(response, { ...catalog, name: input.name });
    }
    if (request.method === 'POST' && url.pathname === '/api/provider/models') return json(response, await discoverModels(await body(request)));
    if (request.method === 'POST' && url.pathname === '/api/provider/connect') {
      const input = await body(request);
      return json(response, await configureProvider(input.use_local ? { ...localProvider(), model: input.model } : input));
    }
    if (request.method === 'POST' && url.pathname === '/api/provider/proof') return json(response, await proveRuntime());
    if (request.method === 'POST' && url.pathname === '/api/provider/remove') { const result = await removeProvider(); for (const session of sessions) session.threads = {}; save(); return json(response, result); }
    if (request.method === 'POST' && url.pathname === '/api/sessions/settings') {
      const input = await body(request), session = sessionFor(input.sessionID);
      session.depth = input.depth === 'technical' ? 'technical' : 'plain';
      event(session, 'settings.updated', { summary: 'Explanation depth changed; numerical methods and evidence are unchanged.' });
      return json(response, session);
    }
    if (request.method === 'POST' && url.pathname === '/api/sessions') {
      const input = await body(request);
      const session = { id: randomUUID(), title: 'Untitled investigation', created: new Date().toISOString(), depth: input.depth === 'technical' ? 'technical' : 'plain', messages: [], artifacts: [], events: [], threads: {}, roleSummaries: {}, hypothesisRecords: [] };
      sessions.unshift(session); save(); return json(response, session, 201);
    }
    if (request.method === 'POST' && url.pathname === '/api/analyze') {
      const input = await body(request), session = sessionFor(input.sessionID);
      for(const [id,job] of jobs) if(jobs.size>=50 && job.status!=='running') jobs.delete(id);
      if ([...jobs.values()].filter(job => job.status === 'running').length >= 2) throw new Error('Two active jobs maximum; wait for completion or stop a job.');
      if (!['power', 'modis', 'import'].includes(input.operation)) throw new Error('Scientific operation not registered.');
      const controller = new AbortController();
      const job = { id: randomUUID(), sessionID: session.id, operation: input.operation, status: 'running', controller }; jobs.set(job.id, job);
      event(session, 'job.started', { jobID: job.id, operation: input.operation, role: input.operation === 'modis' ? 'chloris' : 'aura', summary: 'Acquiring numerical science values and quality metadata.' });
      json(response, { jobID: job.id }, 202);
      try {
        const result = await science(input, controller.signal);
        if (controller.signal.aborted) return;
        const artifact = retainArtifact(session,result,job.id); session.title = `${artifact.acquisition.variable.name} / ${artifact.acquisition.geometry.label}`.slice(0, 85);
        session.roleSummaries[artifact.acquisition.variable.domain] = { source: 'deterministic artifact summary; not an executed language-model worker', artifactID: artifact.id, text: `${artifact.acquisition.variable.name}: ${artifact.analysis.n} valid observations. ${artifact.analysis.status.replaceAll('_', ' ')}. ${artifact.acquisition.variable.support}` };
        setEvidence(session.id, artifact);
        job.status = 'completed';
        event(session, 'artifact.completed', { jobID: job.id, artifactID: artifact.id, summary: 'Real series, trend diagnostics and reproducibility inputs are ready.' });
      } catch (error) { job.status = controller.signal.aborted ? 'cancelled' : 'failed'; job.error = publicError(error); event(session, 'job.failed', { jobID: job.id, summary: job.error }); }
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/jobs/stop') {
      const input = await body(request), job = jobs.get(input.jobID);
      if (!job || job.sessionID !== input.sessionID) throw new Error('Foreign job cancellation denied.');
      job.controller.abort(); job.status = 'cancelled'; return json(response, { status: 'cancelled' });
    }
    if (request.method === 'POST' && url.pathname === '/api/chat') {
      const input = await body(request), session = sessionFor(input.sessionID);
      if (!providerStatus().tested) throw new Error('Run the provider tool/role connection check before GAIA conversation. Numerical analysis remains available without it.');
      if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 4000) throw new Error('Use a message of at most 4,000 characters.');
      if (session.chatRunning) throw new Error('GAIA is finishing this session’s current reply.');
      session.chatRunning = true;
      const user = { id: randomUUID(), role: 'user', text: input.text, time: new Date().toISOString() }; session.messages.push(user);
      event(session, 'gaia.started', { role: 'gaia', summary: 'GAIA is considering the next useful question.' });
      try {
        const message = await coordinate(session,input.text,(type,data)=>event(session,type,data),AbortSignal.timeout(240_000)); session.messages.push(message);
        event(session, 'gaia.completed', { role: 'gaia', summary: 'A bounded follow-up is ready; scientific claims remain in the evidence panel.' }); return json(response, message);
      } finally { session.chatRunning = false; save(); }
    }
    if (request.method==='POST' && url.pathname==='/api/simulate') {
      const input=await body(request),session=sessionFor(input.sessionID),artifact=session.artifacts.find(item=>item.id===input.artifactID);
      if(!artifact) throw new Error('Simulation needs an owned acquired artifact.');
      if([...jobs.values()].filter(job=>job.status==='running').length>=2)throw new Error('Two numerical jobs are already active; wait or cancel an owned job.');
      const covariates=(input.covariateIDs || []).map(id=>{const item=session.artifacts.find(item=>item.id===id); if(!item) throw new Error('Foreign covariate denied.'); return item.acquisition;});
      const controller=new AbortController(), job={id:randomUUID(),sessionID:session.id,operation:'simulation',status:'running',controller}; jobs.set(job.id,job);
      event(session,'simulation.started',{jobID:job.id,role:'gaia',summary:'Executing a registered numerical model and chronological baseline checks.'}); json(response,{jobID:job.id},202);
      try { const modelRequest={operation:'simulate',model:input.model,acquisition:artifact.acquisition,covariates,horizon:input.horizon,members:input.members,seed:input.seed,scenario:input.scenario};const result=await science(modelRequest,controller.signal); session.simulations ||= []; session.simulations.push({id:randomUUID(),artifactID:artifact.id,request:modelRequest,created:new Date().toISOString(),...result}); job.status='completed'; event(session,'simulation.completed',{jobID:job.id,summary:`Executed model: ${result.readiness}; conditional ranges are not causal probabilities.`}); }
      catch(error){job.status=controller.signal.aborted?'cancelled':'failed';job.error=publicError(error);event(session,'simulation.failed',{jobID:job.id,summary:job.error});} return;
    }
    if(request.method==='POST' && url.pathname==='/api/observation/get') {
      const input=await body(request),session=sessionFor(input.sessionID),protocol=session.observationPlan;
      if(!protocol || protocol.operation!=='power') throw new Error('This observation needs a licensed import or qualified field evidence, not an invented adapter.');
      const before={id:randomUUID(),artifacts:session.artifacts.map(item=>item.id),hypotheses:structuredClone(session.hypothesisRecords),time:new Date().toISOString()};
      const artifact=await scientificAccess.acquire(session.id,protocol.variable,AbortSignal.timeout(180_000));
      const after=session.hypothesisRecords.map(record=>({...record,evidence:session.artifacts.map(item=>evaluateSignature(record.id,item,session.artifacts[0]))}));
      session.hypothesisRecords=after; session.evidenceUpdates ||= []; session.evidenceUpdates.push({id:randomUUID(),before,after,artifactID:artifact.id,mode:'staged_reveal',reason:'Actual compatible observable acquired or retrieved from the real-data cache; directional signatures recomputed without claiming causal proof.',time:new Date().toISOString()});
      event(session,'evidence.updated',{artifactID:artifact.id,summary:'Before/after evidence snapshots retained; inconclusive signatures remain inconclusive.'}); return json(response,session.evidenceUpdates.at(-1));
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/export/')) {
      // Exported predictions retain their original values, selection and disclosure mode.
      const id = url.pathname.split('/').at(-1), session = sessionFor(id);
      const exported = { schema_version: 2, generated: new Date().toISOString(), title: session.title, artifacts: session.artifacts, task_graph:session.taskGraph, hypotheses:session.hypothesisRecords, observation_plan:session.observationPlan, evidence_updates:session.evidenceUpdates || [], simulations:session.simulations || [], semantic_reviews:session.semanticReviews || [], tool_trace:toolTrace(session.id), limitations: ['Export is an explicit local user action. Review coordinates and source redistribution rights before publishing.', 'Language-model prose is not required to reproduce the numerical result.'], reproduction: 'npm run reproduce -- path/to/export.json' };
      exported.comparisons=session.comparisons || [];exported.prediction_test=session.predictionTest || null;
      const versions=executionVersions(session.simulations || []);exported.simulations=versions.active;exported.historical_simulations=versions.historical;
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
        const prediction=await science({operation:'simulate',model:'seasonal_continuation_v1',acquisition:training.acquisition,horizon:12,members:64,seed:20261114});commit(record,prediction);
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
