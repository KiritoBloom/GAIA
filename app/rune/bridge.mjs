const state={status:{},catalog:{},models:[],sites:[],stations:null,operation:null,error:null,selected:null,selectedArtifact:'',artifact:null,chartSvg:'',scenarioSvg:''};
let notifier=()=>{},privateConfiguration=false;
function publish(){const session=state.status.sessions?.find(value=>value.id===state.selected);state.artifact=session?.artifacts?.find(value=>value.id===state.selectedArtifact)||session?.artifacts?.at(-1)||null;state.chartSvg=chart(state.artifact);state.scenarioSvg=scenarioChart(session?.simulations?.at(-1));state.viewportWidth=innerWidth;globalThis.gaiaSnapshot=JSON.stringify(state);notifier();}
addEventListener('resize',publish);
async function api(path,body){
  const response=await fetch(`/api${path}`,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json','x-gaia-client':'1'},body:JSON.stringify(body)});
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
  const grid=Array.from({length:5},(_,i)=>{const value=min+(max-min)*i/4,py=y(value);return `<path d="M70 ${py}H790" stroke="#2a322e"/><text x="62" y="${py+4}" text-anchor="end" ${font}>${Number(value.toPrecision(3))}</text>`;}).join('');
  const ticks=Array.from({length:5},(_,i)=>`<text x="${70+720*i/4}" y="265" text-anchor="middle" ${font}>${new Date(first+(last-first)*i/4).getUTCFullYear()}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="290" viewBox="0 0 840 290"><rect width="840" height="290" fill="#111514"/><text x="70" y="20" ${font}>${escape(artifact.acquisition.variable.units)} · source values: green · fitted seasonal trend: gold</text>${grid}<path d="M70 50V245H790" fill="none" stroke="#747e78"/><path d="${path(series)}" fill="none" stroke="#7de3bc" stroke-width="1.5"/><path d="${path(fitted)}" fill="none" stroke="#edd496" stroke-width="2"/>${ticks}</svg>`;
}
function scenarioChart(model){
  const points=model?.series?.filter(p=>Number.isFinite(p.low)&&Number.isFinite(p.value)&&Number.isFinite(p.high)).map(p=>({...p,median:p.value}));if(!points?.length)return '';
  const low=Math.min(...points.map(p=>p.low)),high=Math.max(...points.map(p=>p.high)),span=high-low||1;
  const xy=(p,key,i)=>`${55+i*560/Math.max(1,points.length-1)},${205-(p[key]-low)*170/span}`;
  const upper=points.map((p,i)=>xy(p,'high',i)),lower=points.map((p,i)=>xy(p,'low',i)).reverse(),median=points.map((p,i)=>xy(p,'median',i));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="260" viewBox="0 0 680 260"><rect width="680" height="260" fill="#101815"/><path d="M55,35V205H615" fill="none" stroke="#698079"/><path d="M${upper.join(' L')} L${lower.join(' L')} Z" fill="#7de3bc" opacity=".16"/><path d="M${median.join(' L')}" stroke="#edd496" stroke-width="2" fill="none"/></svg>`;
}
async function refresh(){
  state.status=await api('/status');
  const selected=state.status.sessions?.find(v=>v.id===state.selected);
  publish();
}
globalThis.gaiaCommand=async(name,input={})=>{
  if(name==='select'){state.selected=input.sessionID;await refresh();return;}
  if(name==='artifact-select'){state.selectedArtifact=input.artifactID;publish();return;}
  state.error=null;state.operation=name;publish();
  try{
    switch(name){
      case 'refresh':await refresh();break;
      case 'new':{const result=await api('/sessions',input);state.selected=result.id;break;}
      case 'provider-discover':{const result=await api('/provider/local-models',{});privateConfiguration=true;state.models=result.models;state.providerCandidate={name:result.name,endpoint:result.endpoint};break;}
      case 'provider-models':{const result=await api('/provider/models',input);privateConfiguration=false;state.models=result.models;break;}
      case 'provider-connect':{
        const chosen={...input,...(privateConfiguration?{...state.providerCandidate,use_local:true}: {})};
        await api('/provider/connect',chosen);input.apiKey='';delete chosen.apiKey;
        const proof=await api('/provider/proof',{});state.proof=proof;break;
      }
      case 'provider-remove':await api('/provider/remove',{});privateConfiguration=false;break;
      case 'chat':await api('/chat',input);break;
      case 'depth':await api('/sessions/settings',input);break;
      case 'analyze':await api('/analyze',input);break;
      case 'import-file':{
        const picker=document.createElement('input');picker.type='file';picker.accept='.csv,text/csv';
        const file=await new Promise(resolve=>{picker.onchange=()=>resolve(picker.files?.[0]);picker.oncancel=()=>resolve(null);picker.click();});
        if(file){if(file.size>2_000_000)throw new Error('CSV exceeds the two-megabyte import limit.');await api('/analyze',{...input,operation:'import',csv:await file.text()});}break;
      }
      case 'observation':await api('/observation/get',input);break;
      case 'simulate':await api('/simulate',input);break;
      case 'bucket':await api('/bucket',{sessionID:input.sessionID,inputs:JSON.parse(input.inputs_json)});break;
      case 'stations':state.stations=await api('/stations',input);break;
      case 'field-intake':await api('/field/intake',{sessionID:input.sessionID,case:input.case || JSON.parse(input.case_json)});break;
      case 'references':await api('/references/search',input);break;
      case 'prediction':await api('/prediction',input);break;
      case 'stop':await api('/jobs/stop',input);break;
      case 'sites':{const result=await api('/sites');state.sites=result.sites||result;break;}
      case 'export':{const result=await api(`/export/${encodeURIComponent(input.sessionID)}`);const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='gaia-investigation.json';link.click();URL.revokeObjectURL(url);break;}
      default:throw new Error('Unregistered UI operation.');
    }
    await refresh();
  }catch(error){state.error=String(error.message||'Local operation failed.').slice(0,400);}
  finally{if(input.apiKey)input.apiKey='';state.operation=null;publish();}
};
export async function connect(notify){
  notifier=notify;publish();
  try{state.catalog=await api('/catalog');await refresh();}catch(error){state.error=error.message;publish();}
  const events=new EventSource('/api/events');
  let refreshing=false;
  events.onmessage=async()=>{if(refreshing)return;refreshing=true;try{await refresh();}catch{state.error='Backend event connection interrupted.';publish();}finally{refreshing=false;}};
  events.onerror=()=>{state.error='Event connection interrupted; reconnecting.';publish();};
  addEventListener('pagehide',()=>events.close(),{once:true});
}
