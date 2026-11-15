import {parentPort,workerData} from 'node:worker_threads';
import {readFileSync,existsSync} from 'node:fs';
import {writeFile,rename} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

let sessions=existsSync(workerData.path)?JSON.parse(readFileSync(workerData.path,'utf8')):[];
let dirty=false,timer,writing=Promise.resolve();
function persist(){
  clearTimeout(timer);timer=null;
  writing=writing.then(async()=>{
    if(!dirty)return;dirty=false;
    const content=JSON.stringify(sessions),temporary=`${workerData.path}.next`;
    try{await writeFile(temporary,content);for(let attempt=0;;attempt++){try{await rename(temporary,workerData.path);break;}catch(error){if(attempt>=5||!['EACCES','EPERM','EBUSY','EEXIST'].includes(error.code))throw error;await delay(50*(attempt+1));}}}
    catch(error){dirty=true;throw error;}
  });return writing;
}
parentPort.on('message',message=>{
  if(message.kind==='update'){
    let session=sessions.find(session=>session.id===message.id);
    if(!session){session={};sessions.unshift(session);}
    if(message.fields.extractions)message.fields.extractions=message.fields.extractions.map(update=>({...session.extractions?.find(e=>e.id===update.id),...update}));
    Object.assign(session,message.fields);
    for(const [key,values] of Object.entries(message.append)){session[key]||=[];session[key].push(...values);}
    dirty=true;if(!timer)timer=setTimeout(()=>persist().catch(error=>parentPort.postMessage({error:true,code:error.code||'WRITE_FAILED'})),200);
  }else if(message.kind==='flush')persist().then(()=>parentPort.postMessage({id:message.id}),error=>parentPort.postMessage({id:message.id,error:true,code:error.code||'WRITE_FAILED'}));
});
