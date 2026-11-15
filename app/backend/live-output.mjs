// Only public answer fields and execution metadata cross this boundary.
// Provider reasoning, tool inputs, tool results and native payloads never do.
export function stringPrefix(source,start){
  let text='';
  for(let i=start+1;i<source.length;i++){
    const c=source[i];if(c==='"')return{text,end:i+1,complete:true};
    if(c!=='\\'){text+=c;continue;}
    if(++i>=source.length)break;
    const escaped=source[i];
    if(escaped==='u'){const code=source.slice(i+1,i+5);if(!/^[0-9a-f]{4}$/i.test(code))break;text+=String.fromCharCode(parseInt(code,16));i+=4;}
    else {const escapes={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'};if(!(escaped in escapes))break;text+=escapes[escaped];}
  }
  return{text,end:source.length,complete:false};
}
export function publicTextPrefix(source,field){
  if(!field)return '';
  let depth=0;
  for(let i=0;i<source.length;i++){
    const c=source[i];if(c==='{'||c==='['){depth++;continue;}if(c==='}'||c===']'){depth--;continue;}
    if(c!=='"')continue;
    const token=stringPrefix(source,i);if(!token.complete)return '';i=token.end-1;
    if(depth!==1||token.text!==field)continue;
    let p=token.end;while(/\s/.test(source[p]||'')&&p<source.length)p++;
    if(source[p++]!==':')continue;while(/\s/.test(source[p]||'')&&p<source.length)p++;
    if(source[p]==='"')return stringPrefix(source,p).text;
  }
  return '';
}
export const toolLabels={
  evidence:'Inspect evidence',catalog:'Inspect available methods',skill:'Load scientific procedure',reference:'Read producer documentation',
  search_literature:'Search literature',read_paper:'Read source',resolve_location:'Resolve location',resolve_region:'Resolve boundary',
  acquire_location:'Acquire NASA climate data',acquire:'Acquire climate context',prepare_vegetation:'Select vegetation footprint',
  acquire_region:'Acquire regional vegetation',resume_extraction:'Resume NASA extraction',acquire_vegetation:'Acquire vegetation data',
  diagnostic:'Run scientific diagnostic',aggregate_season:'Analyze declared season',evidence_sensitivity:'Check analysis sensitivity',
  request_peer:'Request specialist review',ecosystem_context:'Record ecosystem context',simulate:'Run registered scenario',
  propose_model:'Record model proposal',research_note:'Retain source note',animal_occurrences:'Retrieve animal observations'
};
export function publicTool(name){return toolLabels[String(name).replace(/^gaia[_.]/,'')]||'Scientific tool';}
export function redactLiveText(text){
  for(const [key,value] of Object.entries(process.env))if(/KEY|TOKEN|SECRET|PASSWORD|APPEEARS_USERNAME/i.test(key)&&value?.length>=6){
    text=text.split(value).join('[redacted]');
    // Never expose a credential prefix while its remaining tokens are arriving.
    for(let size=Math.min(value.length-1,text.length);size>=6;size--)if(text.endsWith(value.slice(0,size))){text=text.slice(0,-size)+'[redacted]';break;}
  }
  return text.replace(/ses_[A-Za-z0-9]+/g,'[internal session]').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
}
