import {mechanismGraph} from './graph.mjs';
import {readUiState,writeUiState} from './ui-state.mjs';
import {reportDocument} from './report.mjs';
import {uiSnapshot,artifactDetail} from './snapshot.mjs';
import {updateBuffer} from './stream-updates.mjs';
const ui=readUiState(sessionStorage);
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const state={status:{},catalog:{},competence:{},referrals:[],models:[],providerSettings:{revision:0,phase:'idle',models:[]},sites:[],stations:null,operation:null,error:null,selected:null,selectedArtifact:'',artifact:null,investigation:null,paperID:'',paperText:'',graphSvg:'',chartSvg:'',scenarioSvg:'',connected:false,reducedMotion:motionPreference.matches,motionEvents:[]};
let notifier=()=>{},privateConfiguration=false,chartArtifact,chartModel,streamTimer,refreshTimer,refreshFlight,refreshRequested=false,refreshVersion=0;
const updates=updateBuffer(),pendingMessages=new Map();
const artifactCache=new Map();let artifactBytes=0;
let providerDraft={},providerDiscovery={kind:'idle'},providerAttempt=0;
const inferredProtocol=endpoint=>{try{const host=new URL(endpoint).hostname;return host==='api.anthropic.com'?'anthropic':host==='api.openai.com'||host==='freegg.app'||host.endsWith('.freegg.app')?'responses':'chat';}catch{return 'responses';}};
function settingsPublish(patch){Object.assign(state.providerSettings,patch);state.providerSettings.revision++;publish();}
function cancelDiscovery(){providerAttempt++;if(providerDiscovery.kind==='debouncing')clearTimeout(providerDiscovery.timer);if(providerDiscovery.kind==='loading')providerDiscovery.controller.abort();providerDiscovery={kind:'idle'};}
async function discoverSettings(input={},automatic=false){
  cancelDiscovery();const attempt=providerAttempt,controller=new AbortController();providerDiscovery={kind:'loading',controller};
  if(!automatic)providerDraft={endpoint:input.endpoint,protocol:input.protocol||inferredProtocol(input.endpoint),key:input.apiKey||input.key||'',source:input.source||'manual'};
  const draft={...providerDraft};
  settingsPublish({phase:'loading',message:'Finding available models…',legacy:!state.status.provider_settings_version});
  try{
    let result;
    if(automatic){
      if(!Object.hasOwn(state.status,'configured'))await refresh();
      if(attempt!==providerAttempt)return;
      if(state.status.provider_settings_version)result=await api('/provider/auto-models',{},controller.signal);
      else if(state.status.local_configuration_available)result={...await api('/provider/local-models',{},controller.signal),source:'local',current_model:state.status.model};
      else result={available:false,source:'manual'};
    }else if(draft.source==='current'&&state.status.provider_settings_version)result=await api('/provider/current-models',{endpoint:draft.endpoint,protocol:draft.protocol},controller.signal);
    else if(draft.source==='local')result={...await api('/provider/local-models',{},controller.signal),source:'local'};
    else result=await api('/provider/models',{endpoint:draft.endpoint,protocol:draft.protocol,key:draft.key},controller.signal);
    if(attempt!==providerAttempt)return;
    if(result.available===false){providerDraft={source:'manual',protocol:'responses',endpoint:'https://api.openai.com/v1',key:''};settingsPublish({source:'manual',protocol:providerDraft.protocol,endpoint:providerDraft.endpoint,phase:'awaiting',models:[],message:'Add a credential to discover models.'});return;}
    const protocol=result.protocol||draft.protocol||inferredProtocol(result.endpoint),source=result.source||draft.source||'manual';
    providerDraft={...draft,endpoint:result.endpoint,protocol,source};
    privateConfiguration=source==='local';state.models=result.models||[];state.providerCandidate={name:result.name||new URL(result.endpoint).hostname,endpoint:result.endpoint,protocol};
    const details=(result.modelDetails||state.models.map(id=>({id,name:id,variants:[],tools:null,metadata_source:'unreported'}))).map(({id,name,tools,metadata_source,variants})=>({id,name,tools,metadata_source,variants:(variants||[]).map(({id,name})=>({id,name}))}));
    const preferred=state.providerSettings.model||result.current_model||state.status.model||'';
    const model=details.some(item=>item.id===preferred)?preferred:'';
    const variant=state.providerSettings.variant??result.current_variant??state.status.variant??'';
    settingsPublish({phase:'ready',source,endpoint:result.endpoint,protocol,models:details,model,variant:details.find(item=>item.id===model)?.variants.some(item=>item.id===variant)?variant:'',message:details.length?`${details.length} models available`:'No chat models were returned.'});
  }catch(error){if(attempt===providerAttempt&&!controller.signal.aborted)settingsPublish({phase:'error',message:error.message,models:[]});}
  finally{if(attempt===providerAttempt)providerDiscovery={kind:'idle'};}
}
function editProvider(input){
  cancelDiscovery();providerDraft={source:input.source||'manual',endpoint:input.endpoint,protocol:input.protocol,key:input.apiKey||''};
  const changed=state.providerSettings.endpoint!==input.endpoint||state.providerSettings.protocol!==input.protocol;
  let valid=false;try{const url=new URL(input.endpoint);valid=url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);}catch{}
  const ready=valid&&(providerDraft.key||providerDraft.source!=='manual'||input.endpoint.startsWith('http://'));
  settingsPublish({source:providerDraft.source,protocol:input.protocol,endpoint:input.endpoint,...(changed?{models:[],model:'',variant:''}:{}),phase:ready?'debouncing':'awaiting',message:ready?'Finding models automatically…':'Add a credential and a valid API endpoint.'});
  if(ready){const attempt=providerAttempt;providerDiscovery={kind:'debouncing',timer:setTimeout(()=>{if(attempt===providerAttempt)discoverSettings({...providerDraft,apiKey:providerDraft.key});},800)};}
}
function retainArtifact(artifact){
  const detail=artifactDetail(artifact),bytes=JSON.stringify(detail).length;
  const old=artifactCache.get(detail.id);if(old)artifactBytes-=old.bytes;
  artifactCache.delete(detail.id);artifactCache.set(detail.id,{artifact:detail,bytes});artifactBytes+=bytes;
  while(artifactCache.size>4||artifactBytes>8_000_000&&artifactCache.size>1){const id=artifactCache.keys().next().value;artifactBytes-=artifactCache.get(id).bytes;artifactCache.delete(id);}
  return detail;
}
function selectedArtifact(){const session=state.status.sessions?.find(value=>value.id===state.selected);return session?.artifacts?.find(value=>value.id===state.selectedArtifact)||session?.artifacts?.at(-1)||null;}
async function loadArtifact(){
  const summary=selectedArtifact();if(!summary||artifactCache.has(summary.id))return;
  if(Array.isArray(summary.analysis?.series)){retainArtifact(summary);return;}
  const sessionID=state.selected,artifact=await api(`/artifact/${encodeURIComponent(summary.id)}?sessionID=${encodeURIComponent(sessionID)}`);
  if(state.selected===sessionID&&selectedArtifact()?.id===summary.id)retainArtifact(artifact);
}
globalThis.gaiaDrainUpdates=()=>JSON.stringify(updates.drain());
function notifyStream(){if(streamTimer)return;streamTimer=setTimeout(()=>{streamTimer=null;notifier();},40);}
function publish(){
  const session=state.status.sessions?.find(value=>value.id===state.selected);
  state.missionScope=session?.missionScope||null;state.draft=ui.drafts[state.selected]||'';
  const selected=selectedArtifact();state.artifact=artifactCache.get(selected?.id)?.artifact||null;
  if(chartArtifact!==state.artifact){chartArtifact=state.artifact;state.chartSvg=chart(state.artifact);}
  const model=session?.simulations?.at(-1);if(chartModel!==model){chartModel=model;state.scenarioSvg=scenarioChart(model);}
  state.viewportWidth=innerWidth;
  globalThis.gaiaSnapshot=JSON.stringify(uiSnapshot(state));globalThis.gaiaRevision=((globalThis.gaiaRevision||0)+1)>>>0;notifier();
}
function requestRefresh(){refreshRequested=true;if(refreshTimer||refreshFlight)return;refreshTimer=setTimeout(()=>{refreshTimer=null;refresh().catch(()=>{state.connected=false;state.error='Backend event connection interrupted.';publish();});},500);}
addEventListener('resize',publish);
motionPreference.addEventListener('change',event=>{state.reducedMotion=event.matches;publish();});
async function api(path,body,signal){
  const response=await fetch(`/api${path}`,body===undefined?{signal}:{method:'POST',headers:{'content-type':'application/json','x-gaia-client':'1'},body:JSON.stringify(body),signal});
  const content=await response.text();let value;
  try{value=JSON.parse(content);}catch{throw new Error(`The local backend returned HTTP ${response.status} without a valid application response.`);}
  if(!response.ok)throw new Error(value.error||`Local operation failed (HTTP ${response.status}).`);
  return value;
}
function chart(artifact){
  const series=artifact?.analysis?.series||[],fitted=artifact?.analysis?.fitted||[];
  const valid=series.filter(p=>Number.isFinite(p.value));if(valid.length<2)return '';
  const first=Date.parse(series[0].date),last=Date.parse(series.at(-1).date);
  const numbers=[...valid,...fitted.filter(p=>Number.isFinite(p.value))].map(p=>p.value);
  const lo=Math.min(...numbers),hi=Math.max(...numbers),pad=(hi-lo||1)*.04,min=lo-pad,max=hi+pad;
  const x=date=>70+(Date.parse(date)-first)/(last-first||1)*720;
  const y=value=>245-(value-min)/(max-min)*195;
  const path=values=>{let pen=false;return values.map(point=>{
    if(!Number.isFinite(point.value)){pen=false;return '';}
    const result=`${pen?'L':'M'}${x(point.date).toFixed(2)},${y(point.value).toFixed(2)}`;pen=true;return result;
  }).join(' ');};
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const font='font-family="sans-serif" font-size="11" fill="#d9dfdc"';
  // Rune's SVG renderer does not resolve text fonts. Numeric axis paths render
  // identically in the application and standalone reports without a font service.
  const axis=(value,px,py,anchor='middle')=>{
    const valueText=String(value),segments={a:'M1 0H5',b:'M6 1V4',c:'M6 6V9',d:'M1 10H5',e:'M0 6V9',f:'M0 1V4',g:'M1 5H5'};
    const digits={'0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afgecd','7':'abc','8':'abcdefg','9':'abfgcd','-':'g','e':'afged','E':'afged'};
    const width=valueText.length*8,origin=anchor==='end'?px-width:anchor==='middle'?px-width/2:px;
    return `<g transform="translate(${origin},${py-10})" stroke="#d9dfdc" stroke-width="1" fill="none"><title>${escape(valueText)}</title>${[...valueText].map((c,i)=>c==='.'?`<circle cx="${i*8+3}" cy="10" r=".8" fill="#d9dfdc"/>`:c==='+'?`<path d="M${i*8} 5h6m-3 -3v6"/>`:`<path transform="translate(${i*8},0)" d="${[...(digits[c]||'')].map(s=>segments[s]).join(' ')}"/>`).join('')}</g>`;
  };
  const grid=Array.from({length:5},(_,i)=>{const value=min+(max-min)*i/4,py=y(value);return `<path d="M70 ${py}H790" stroke="#33383d"/>${axis(Number(value.toPrecision(3)),62,py+4,'end')}`;}).join('');
  const ticks=Array.from({length:5},(_,i)=>axis(new Date(first+(last-first)*i/4).getUTCFullYear(),70+720*i/4,265)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="290" viewBox="0 0 840 290"><rect width="840" height="290" fill="#16191c"/><text x="70" y="20" ${font}>${escape(artifact.acquisition.variable.units)} · observations: light · fitted trend: steel / dashed</text>${grid}<path d="M70 50V245H790" fill="none" stroke="#89939d"/><path d="${path(series)}" fill="none" stroke="#e1e5e9" stroke-width="1.5"/><path d="${path(fitted)}" fill="none" stroke="#879db4" stroke-dasharray="5 3" stroke-width="2"/>${ticks}</svg>`;
}
function scenarioChart(model){
  const points=model?.series?.filter(p=>Number.isFinite(p.low)&&Number.isFinite(p.value)&&Number.isFinite(p.high)).map(p=>({...p,median:p.value}));if(!points?.length)return '';
  const low=Math.min(...points.map(p=>p.low)),high=Math.max(...points.map(p=>p.high)),span=high-low||1;
  const xy=(p,key,i)=>`${55+i*560/Math.max(1,points.length-1)},${205-(p[key]-low)*170/span}`;
  const upper=points.map((p,i)=>xy(p,'high',i)),lower=points.map((p,i)=>xy(p,'low',i)).reverse(),median=points.map((p,i)=>xy(p,'median',i));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="260" viewBox="0 0 680 260"><rect width="680" height="260" fill="#16191c"/><path d="M55,35V205H615" fill="none" stroke="#89939d"/><path d="M${upper.join(' L')} L${lower.join(' L')} Z" fill="#879db4" opacity=".20"/><path d="M${median.join(' L')}" stroke="#e1e5e9" stroke-width="2" fill="none"/></svg>`;
}
async function loadStatus(){
  const version=++refreshVersion,requestedSession=state.selected;
  const mergeLiveTurns=next=>{for(const incoming of next.sessions||[]){
    const current=state.status?.sessions?.find(s=>s.id===incoming.id);
    if(!incoming.messages)continue;
    for(const turn of current?.liveTurns||[]){const found=incoming.liveTurns?.find(t=>t.id===turn.id);if(!found){(incoming.liveTurns||=[]).push(turn);}else if(turn.sequence>found.sequence)Object.assign(found,turn);}
    const pending=pendingMessages.get(incoming.id);if(pending&&!incoming.messages?.some(m=>m.id===pending.id)){(incoming.messages||=[]).push(pending);incoming.chatRunning=true;}
  }};
  const query=id=>`/status?view=ui${id?`&sessionID=${encodeURIComponent(id)}`:''}`;
  let next=await api(query(state.selected||ui.selected||''));
  if(version!==refreshVersion||requestedSession!==state.selected)return;
  mergeLiveTurns(next);
  state.status=next;
  if(!state.status.sessions?.length){const created=await api('/sessions',{depth:'plain'});state.status.sessions=[created];}
  if(!state.status.sessions?.some(value=>value.id===state.selected)){state.selected=state.status.sessions?.some(value=>value.id===ui.selected)?ui.selected:state.status.sessions?.[0]?.id||null;state.selectedArtifact=ui.artifacts[state.selected]||'';}
  let selected=state.status.sessions?.find(v=>v.id===state.selected);
  if(selected&&!selected.messages){const detailID=state.selected;next=await api(query(detailID));if(version!==refreshVersion||detailID!==state.selected)return;mergeLiveTurns(next);state.status=next;}
  await loadArtifact();
  if(version!==refreshVersion)return;
  publish();
}
async function refresh(){
  if(refreshFlight){refreshRequested=true;return refreshFlight;}
  refreshRequested=false;clearTimeout(refreshTimer);refreshTimer=null;
  refreshFlight=loadStatus();
  try{await refreshFlight;}finally{refreshFlight=null;if(refreshRequested)requestRefresh();}
}
globalThis.gaiaCommand=async(name,input={})=>{
   if(['provider-connect','provider-remove','provider-proof','semantic-settings'].includes(name)&&((state.status.sessions||[]).some(session=>session.chatRunning)||state.status.proof?.state==='running')){settingsPublish({message:'Connection changes are locked while an investigation is running.'});input.apiKey='';return;}
   if(['provider-connect','semantic-settings'].includes(name)&&!state.status.provider_settings_version){settingsPublish({message:'These controls activate after a safe backend reload.'});input.apiKey='';return;}
   if(name==='provider-open'){if(state.providerSettings.phase==='idle')await discoverSettings({},true);return;}
   if(name==='provider-form'){editProvider(input);input.apiKey='';return;}
   if(name==='provider-choice'){settingsPublish({model:input.model,variant:input.variant||''});return;}
   if(name==='provider-reload'){await discoverSettings({...providerDraft,apiKey:providerDraft.key});return;}
   if(name==='provider-discover'){await discoverSettings({},true);return;}
   if(name==='provider-models'){await discoverSettings(input);input.apiKey='';return;}
   if(name==='draft'){if(input.sessionID&&typeof input.text==='string'){ui.drafts[input.sessionID]=input.text;state.draft=input.text;writeUiState(sessionStorage,ui);}return;}
   if(name==='select'){state.selected=input.sessionID;state.motionEvents=[];state.paperID='';state.paperText='';ui.selected=state.selected;state.selectedArtifact=ui.artifacts[state.selected]||'';writeUiState(sessionStorage,ui);state.investigation=null;state.graphSvg='';await refresh();return;}
   if(name==='artifact-select'){state.selectedArtifact=input.artifactID;ui.artifacts[state.selected]=input.artifactID;writeUiState(sessionStorage,ui);publish();try{await loadArtifact();publish();}catch(error){state.error=error.message;publish();}return;}
   if(name==='chat'){
     const session=state.status.sessions?.find(s=>s.id===input.sessionID);
     if(!session||session.chatRunning||pendingMessages.has(input.sessionID)||!input.text?.trim())return;
     input.messageID=crypto.randomUUID();const message={id:input.messageID,role:'user',text:input.text,time:new Date().toISOString()};
     pendingMessages.set(input.sessionID,message);session.messages||=[];session.messages.push(message);session.chatRunning=true;
     ui.drafts[input.sessionID]='';writeUiState(sessionStorage,ui);
   }
   state.error=null;state.operation=name;publish();
  try{
    switch(name){
      case 'refresh':await refresh();break;
      case 'investigation-record':state.investigation=await api(`/investigation/${encodeURIComponent(input.sessionID)}`);state.graphSvg=mechanismGraph(state.investigation.mechanism_graph);break;
       case 'new':{const result=await api('/sessions',input);state.selected=result.id;state.paperID='';state.paperText='';ui.selected=result.id;state.selectedArtifact='';state.investigation=null;state.graphSvg='';writeUiState(sessionStorage,ui);break;}
       case 'provider-connect':{
         const source=input.source||providerDraft.source||(privateConfiguration?'local':'manual');
         const chosen={name:input.name||state.providerCandidate?.name,endpoint:input.endpoint||providerDraft.endpoint,protocol:input.protocol||providerDraft.protocol,model:input.model,variant:input.variant||'',...(source==='local'?{use_local:true}:source==='current'?{use_current:true}:{key:input.apiKey||providerDraft.key||''})};
         input.apiKey='';try{await api('/provider/connect',chosen);}finally{delete chosen.key;}
         providerDraft={source:'current',endpoint:chosen.endpoint,protocol:chosen.protocol,key:''};privateConfiguration=false;
         settingsPublish({source:'current',phase:'ready',message:'Connection updated.'});state.proof=null;state.competence=await api('/competence');break;
       }
       case 'provider-proof':state.proof=await api('/provider/proof',{});state.competence=await api('/competence');break;
      case 'provider-remove':await api('/provider/remove',{});privateConfiguration=false;providerDraft={};cancelDiscovery();settingsPublish({source:'manual',phase:'awaiting',models:[],model:'',variant:'',message:'Disconnected. Add a credential to discover models.'});break;
      case 'semantic-settings':state.status.semantic=await api('/semantic/settings',input);break;
       case 'chat':{const result=await api('/chat',input),pending=pendingMessages.get(input.sessionID);if(pending)pending.id=result.userMessageID;pendingMessages.delete(input.sessionID);break;}
      case 'extraction-resume':await api('/regions/resume',input);break;
      case 'chat-stop':await api('/chat/stop',input);break;
       case 'report-export':{const result=await api(`/export/${encodeURIComponent(input.sessionID)}`);const session={...result,messages:result.report?[result.report]:[],ecosystemContexts:result.ecosystem_contexts,evidenceSearches:result.evidence_searches};const url=URL.createObjectURL(new Blob([reportDocument(session,chart)],{type:'text/html;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='gaia-report.html';link.click();URL.revokeObjectURL(url);break;}
      case 'research-search':await api('/research/search',input);break;
       case 'research-read':{const result=await api('/research/read',input);state.paperID=input.id;state.paperText=typeof result.text==='string'?result.text:'';break;}
      case 'animals':await api('/animals',input);break;
      case 'depth':await api('/sessions/settings',input);break;
      case 'session-settings':await api('/sessions/settings',input);break;
      case 'analyze':await api('/analyze',input);break;
      case 'import-file':{
        const picker=document.createElement('input');picker.type='file';picker.accept='.csv,text/csv';
        const file=await new Promise(resolve=>{picker.onchange=()=>resolve(picker.files?.[0]);picker.oncancel=()=>resolve(null);picker.click();});
        if(file){if(file.size>2_000_000)throw new Error('CSV exceeds the two-megabyte import limit.');await api('/analyze',{...input,operation:'import',csv:await file.text()});}break;
      }
       case 'observation':await api('/observation/get',input);break;
       case 'observation-plan':await api('/observation/plan',input);break;
      case 'simulate':await api('/simulate',input);break;
      case 'bucket':await api('/bucket',{sessionID:input.sessionID,inputs:JSON.parse(input.inputs_json)});break;
      case 'stations':state.stations=await api('/stations',input);break;
      case 'field-intake':await api('/field/intake',{sessionID:input.sessionID,case:input.case || JSON.parse(input.case_json)});break;
      case 'field-referrals':state.referrals=await api('/field/referrals');break;
      case 'field-handoff':{const result=await api('/field/handoff',input),url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='gaia-private-handoff.json';link.click();URL.revokeObjectURL(url);break;}
      case 'references':await api('/references/search',input);break;
      case 'prediction':await api('/prediction',input);break;
      case 'stop':await api('/jobs/stop',input);break;
       case 'sites':{const result=await api('/sites');state.sites=result.sites||result;break;}
       case 'mission-plan':state.missionScope=await api('/mission/plan',input);break;
       case 'mission-clear':state.missionScope=null;await api('/mission/clear',input);break;
      case 'export':{const result=await api(`/export/${encodeURIComponent(input.sessionID)}`);const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='gaia-investigation.json';link.click();URL.revokeObjectURL(url);break;}
      default:throw new Error('Unregistered UI operation.');
    }
    await refresh();
   }catch(error){state.error=String(error.message||'Local operation failed.');if(name.startsWith('provider-')||name==='semantic-settings')settingsPublish({phase:'error',message:state.error});if(name==='chat'){const session=state.status.sessions?.find(s=>s.id===input.sessionID);if(session){session.messages=session.messages.filter(m=>m.id!==input.messageID);session.chatRunning=false;}pendingMessages.delete(input.sessionID);if(!ui.drafts[input.sessionID])ui.drafts[input.sessionID]=input.text;writeUiState(sessionStorage,ui);}}
  finally{if(input.apiKey)input.apiKey='';state.operation=null;publish();}
};
export async function connect(notify){
  notifier=notify;publish();
  const resources=await Promise.allSettled([api('/catalog'),api('/competence')]);
  if(resources[0].status==='fulfilled')state.catalog=resources[0].value;
  if(resources[1].status==='fulfilled')state.competence=resources[1].value;
  try{await refresh();}catch(error){state.error=error.message;publish();}
  const events=new EventSource('/api/events');
  events.onopen=()=>{state.connected=true;if(state.error==='Event connection interrupted; reconnecting.')state.error=null;publish();refresh().catch(()=>{state.connected=false;publish();});};
  events.onmessage=async message=>{
    try{
      const packet=JSON.parse(message.data);
      if(packet.stream){
        const session=state.status?.sessions?.find(s=>s.id===packet.sessionID),patch=packet.stream;
        if(!session)return;
        session.liveTurns||=[];let turn=session.liveTurns.find(t=>t.id===patch.id);
        if(patch.kind==='start'&&!turn){turn=patch.turn;session.liveTurns.push(turn);}
        else if(turn&&patch.sequence>turn.sequence){
          if(patch.append!==undefined)turn.text+=patch.append;
          if(patch.text!==undefined)turn.text=patch.text;
          if(patch.thinking!==undefined)turn.thinking=patch.thinking;
          if(patch.tool){const tool=turn.tools.find(t=>t.id===patch.tool.id);if(tool)Object.assign(tool,patch.tool);else turn.tools.push(patch.tool);}
          if(patch.status){turn.status=patch.status;turn.thinking=false;}
          if(patch.connection)turn.connection=patch.connection;
          turn.sequence=patch.sequence;
        }
         state.connected=true;if(packet.sessionID===state.selected){updates.add(packet.sessionID,patch);notifyStream();}return;
      }
      if(['worker.started','worker.completed'].includes(packet.event?.type))state.motionEvents.push({...packet.event,sessionID:packet.sessionID});
    }catch{/* Malformed stream records never create visual activity. */}
     state.connected=true;requestRefresh();
  };
  events.onerror=()=>{state.connected=false;state.error='Event connection interrupted; reconnecting.';publish();};
   addEventListener('pagehide',()=>{events.close();clearTimeout(streamTimer);clearTimeout(refreshTimer);cancelDiscovery();providerDraft={};},{once:true});
}
