import {randomUUID} from 'node:crypto';
import {sha256} from './security.mjs';
import {protocols} from './protocols.mjs';
import {assessCandidate} from './creative.mjs';

export function observationProtocol(session){
 const plan=session.observationPlan,protocol=plan?.protocol||plan;
 if(!protocol||typeof protocol.id!=='string'||!protocol.id.length)return null;
 return protocol;
}

export function observationSnapshot(session){
 return {id:randomUUID(),artifacts:session.artifacts.map(item=>item.id),hypotheses:structuredClone(session.hypothesisRecords||[]),protocol:structuredClone(session.observationPlan||null),time:new Date().toISOString()};
}

export function selectObservationProtocol(session,id){
 if(session.chatRunning)throw Error('Finish or stop the current investigation before changing its observation protocol.');
 const protocol=protocols[id];if(!protocol)throw Error('Choose a registered observation protocol.');
 if(!session.artifacts.length)throw Error('Acquire a focal record before selecting a discriminating observation.');
 const {protocol:previousProtocol,...baseline}=observationSnapshot(session);baseline.previous_protocol_sha256=sha256(previousProtocol);
 const record={...structuredClone(protocol),selection_id:randomUUID(),selected_at:new Date().toISOString(),snapshot:sha256(session.artifacts.map(item=>item.manifest_sha256)),hypothesisIDs:(session.hypothesisRecords||[]).map(item=>item.id),baseline,availability:protocol.operation==='power'?'available_regional_context':protocol.operation==='import'?'requires_real_import':'requires_qualified_field_observation',disclosure:'Prospective protocol selection; previously inspected evidence stays disclosed in the frozen baseline. This does not erase or replace an earlier test.'};
 session.observationPlans ||= [];if(session.observationPlan)session.observationPlans.push(structuredClone(session.observationPlan));
 session.observationPlan=record;return record;
}

export function completeObservationUpdate(session,before,artifactID){
 if(sha256(session.observationPlan||null)!==sha256(before.protocol))throw Error('Observation protocol changed while evidence was being acquired; preserve the artifact but do not publish an ambiguous assessment.');
 const added=session.artifacts.filter(item=>!before.artifacts.includes(item.id)).map(item=>item.id);
 const after=(before.hypotheses||[]).map(record=>({...record,evidence:session.artifacts.map(item=>assessCandidate(record,item,session.artifacts[0]))}));
 const result={id:randomUUID(),before,after,artifactID:artifactID||null,added_artifacts:added,mode:'staged_reveal',reason:added.length?'Actual evidence added; frozen expectations recomputed with support and quantity checks. Added evidence does not establish a cause.':'Existing owned evidence reassessed; no new observation or causal proof is claimed.',time:new Date().toISOString()};
 session.hypothesisRecords=after;session.evidenceUpdates ||= [];session.evidenceUpdates.push(result);return result;
}
