import test from 'node:test';
import assert from 'node:assert/strict';
import {investigationScope,ownedThread,retireThreads,lifecycleForExport,taskGraphForExport,peerRequestsForExport} from '../app/backend/thread-lifecycle.mjs';
test('only compatible role, parent, scope and policy continue; new snapshots retain explicit history',async()=>{
 let next=0;const stopped=[],create=async()=>`thread-${++next}`,stop=async id=>stopped.push(id),session={id:'owned',artifacts:[]};
 const context={scope:investigationScope(session),snapshot:'before',request:'Question',graphID:'first'};
 const first=await ownedThread(session,'aura',context,create,stop);
 assert.equal(await ownedThread(session,'aura',{...context,snapshot:'after',graphID:'second'},create,stop),first);
 assert.match(session.threadLifecycle[0].continuations[1].reason,/fresh assessment/);
 const changed=await ownedThread(session,'aura',{...context,scope:'changed'},create,stop);
 assert.notEqual(changed,first);assert.deepEqual(stopped,[first]);assert.equal(session.threadLifecycle[0].state,'superseded');
 assert.notEqual(await ownedThread(session,'zoe',context,create,stop),changed);
 retireThreads(session,'runtime restart');assert.deepEqual(session.threads,{});assert.ok(session.threadLifecycle.every(item=>item.state!=='active'));
});
test('different outcomes, support, calendar and parent cannot reuse a scientific frame',()=>{
 const artifact={acquisition:{geometry:{type:'grid_supported_location',latitude:1,longitude:2},variable:{id:'T2M'},provenance:{provider:'NASA POWER'}},analysis:{requested_start:'2001-01-01',requested_end:'2025-12-01'}},s={id:'one',artifacts:[artifact]};
 assert.notEqual(investigationScope(s,{owner:'aura'}),investigationScope(s,{owner:'zoe'}));
 assert.notEqual(investigationScope(s),investigationScope({...s,id:'two'}));
 assert.notEqual(investigationScope(s),investigationScope({...s,artifacts:[{...artifact,analysis:{...artifact.analysis,requested_end:'2024-12-01'}}]}));
});
test('public lifecycle and task exports omit private runtime thread identifiers',()=>{
 const session={threadLifecycle:[{thread_id:'ses_private',predecessor:'ses_old',role:'aura',scope:'sha256',continuations:[]} ]};
 const graph=taskGraphForExport({id:'graph',requests:[{role:'aura',sessionID:'ses_private',status:'completed'}]});
 assert.equal(lifecycleForExport(session)[0].runtime_binding_present,true);
 assert.equal(graph.requests[0].runtime_binding_present,true);
 assert.doesNotMatch(JSON.stringify([lifecycleForExport(session),graph]),/ses_private|ses_old/);
});

test('public peer-review export preserves outcome metadata without exposing runtime thread IDs',()=>{
 const exported=peerRequestsForExport([{id:'peer-1',role:'aura',status:'completed',review_thread:'ses_private_runtime_12345678901234567890'}]);
 assert.deepEqual(exported,[{id:'peer-1',role:'aura',status:'completed',runtime_binding_present:true}]);
 assert.doesNotMatch(JSON.stringify(exported),/ses_[A-Za-z0-9]{20}/);
});
