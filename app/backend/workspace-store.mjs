import {Worker} from 'node:worker_threads';

// The writer owns JSON serialization, filesystem writes and atomic replacement.
// Immutable geometry/observations are transferred once, not at every activity event.
export function workspaceStore(path,getSessions) {
  const worker=new Worker(new URL('./workspace-writer.mjs',import.meta.url),{workerData:{path},execArgv:process.execArgv.filter(arg=>!arg.startsWith('--input-type'))});
  const retained=new Map(),dirty=new Set(),waiters=new Map();let scheduled=false,sequence=0,failure;
  const appendKeys=new Set(['artifacts','regions','domainDiagnostics','investigations']);
  worker.on('message',message=>{
    if(message.error){failure=Error(`Workspace persistence failed (${message.code||'WRITE_FAILED'}); retained evidence has not been deleted.`);console.error(failure.message);}
    const waiter=waiters.get(message.id);if(waiter){waiters.delete(message.id);failure?waiter.reject(failure):waiter.resolve();}
  });
  worker.on('error',()=>{failure=Error('Workspace writer unavailable.');for(const waiter of waiters.values())waiter.reject(failure);waiters.clear();console.error(failure.message);});
  function transfer(){
    scheduled=false;
    for(const session of dirty){
       const known=retained.get(session.id)||{lengths:{},requests:new Map()};const fields={},append={};
      for(const [key,value] of Object.entries(session)){
        if(appendKeys.has(key)&&Array.isArray(value)){const length=known.lengths[key]??0;if(length===0&&value.length===0)fields[key]=[];else if(value.length>length)append[key]=value.slice(length);known.lengths[key]=value.length;}
        else if(key==='extractions'){fields[key]=(value||[]).map(extraction=>{if(!known.requests.has(extraction.id)||known.requests.get(extraction.id)!==extraction.request){known.requests.set(extraction.id,extraction.request);return extraction;}const {request,...update}=extraction;return update;});}
        else fields[key]=value;
      }
      worker.postMessage({kind:'update',id:session.id,fields,append,newSession:!retained.has(session.id)});retained.set(session.id,known);
    }
    dirty.clear();
  }
  // The writer reads the existing file. First updates must replace—not append—
  // existing arrays, so seed the transferred identities from startup state.
  for(const session of getSessions())retained.set(session.id,{lengths:Object.fromEntries([...appendKeys].map(key=>[key,session[key]?.length||0])),requests:new Map((session.extractions||[]).map(e=>[e.id,e.request]))});
  return {
    save(session){if(failure)throw failure;for(const item of session?[session]:getSessions())dirty.add(item);if(!scheduled){scheduled=true;setImmediate(transfer);}},
    async flush(){if(failure)throw failure;transfer();const id=++sequence;const done=new Promise((resolve,reject)=>waiters.set(id,{resolve,reject}));worker.postMessage({kind:'flush',id});await done;},
    async close(){try{await this.flush();}finally{await worker.terminate();}}
  };
}
