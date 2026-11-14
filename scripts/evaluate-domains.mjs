import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {COMPETENCE_CASES} from '../app/backend/competence-cases.mjs';
import {referenceCatalog,domainSkills,validateSourceEvidence,loadDomainSkill} from '../app/backend/knowledge.mjs';
import {localProvider,discoverModels,configureProvider,createRoleSession,promptRole,registerScientificAccess,toolTrace,closeRuntime} from '../app/backend/runtime.mjs';
import {assistantObject} from '../app/backend/workflow.mjs';
import {sha256,publicError} from '../app/backend/security.mjs';
const roles=['aura','thalassa','chloris','zoe'];
const root=resolve(process.cwd()),results=[];
const specification={version:'domain-cases-1.0.0',cases_sha256:sha256(COMPETENCE_CASES),roles,threshold:'all critical cases pass; exact source quotation and actual procedure/reference calls required',rating:'developer-authored internal cases, no independent expert adjudication',threshold_tuning:false};
await mkdir(resolve(root,'.runtime/proofs'),{recursive:true});
await writeFile(resolve(root,'.runtime/proofs/domain-evaluation-specification.json'),JSON.stringify(specification,null,2));
registerScientificAccess({read:()=>({artifacts:[],animalRecords:[]}),catalog:role=>({skills:domainSkills(role),references:referenceCatalog(role),mode:'synthetic competence cases; no real Earth observations supplied'})});
try{
 const provider=localProvider();if(!provider)throw Error('A supported private provider is required.');
 const catalog=await discoverModels(provider),models=catalog.models,model=process.env.GAIA_MODEL||models.find(id=>/gpt-6\.1-sol$/i.test(id))||models[0];
 await configureProvider({...provider,model});
 for(let i=0;i<COMPETENCE_CASES.length;i+=2){
  results.push(...await Promise.all(COMPETENCE_CASES.slice(i,i+2).map(async test=>{
   const investigationID='competence-'+test.id,before=toolTrace(investigationID).length,start=Date.now();
   try{
    const sessionID=await createRoleSession(test.role,investigationID);
    const context=await promptRole(sessionID,test.role,`This is a developer-authored decision case, not a real field finding. Load your two approved gaia_skill procedures. Discover gaia_catalog and retrieve the owned producer source ${test.source} through gaia_reference. Do not invent input artifacts or run a diagnostic without them. Question: ${JSON.stringify(test.text)}. Return only strict JSON {"decision":"reject_inference|run_registered_diagnostic|request_distinguishing_observation","source_evidence":[{"source_id":"retrieved ID","quote":"exact producer excerpt substring"}],"caveat":"brief scope/observation/causal limitation"}. A run_registered_diagnostic decision means admissible if the stated prerequisites truly hold, not a performed numerical result.`,AbortSignal.timeout(90000));
    const answer=assistantObject(context),trace=toolTrace(investigationID).slice(before);
    validateSourceEvidence(test.role,answer.source_evidence);
    const procedures=domainSkills(test.role).every(id=>trace.some(item=>item.tool==='skill'&&item.output.id===id));
    const source=trace.some(item=>item.tool==='reference'&&item.output.id===test.source);
    const passed=answer.decision===test.expected&&procedures&&source&&typeof answer.caveat==='string'&&answer.caveat.length>=20;
    return{id:test.id,role:test.role,dimension:test.dimension,critical:test.critical,passed,decision:answer.decision,expected:test.expected,actual_procedures:procedures,actual_reference:source,caveat:answer.caveat,elapsed_ms:Date.now()-start};
   }catch(error){return{id:test.id,role:test.role,dimension:test.dimension,critical:test.critical,passed:false,reason:publicError(error),elapsed_ms:Date.now()-start};}
  })));
  console.log(`Completed ${results.length}/${COMPETENCE_CASES.length} actual domain decision cases.`);
 }
 const profiles=Object.fromEntries(roles.map(role=>{const cases=results.filter(item=>item.role===role),criticalFailures=cases.filter(item=>item.critical&&!item.passed);return[role,{total:cases.length,passed:cases.filter(item=>item.passed).length,critical_failures:criticalFailures.map(item=>item.id),status:criticalFailures.length?'restricted_review_only':'internal_cases_passed; independent expert review outstanding',allowed_influence:'source-backed proposal, never independent diagnosis/causal certification',dimensions:[...new Set(cases.map(item=>item.dimension))]}];}));
 const report={...specification,model,skills:Object.fromEntries(roles.map(role=>[role,domainSkills(role).map(id=>{const{content,...meta}=loadDomainSkill(role,id);return meta;})])),profiles,results,limitation:'Small developer-authored, source-informed cases. This is not an independently held-out expert examination, calibration or comprehensive field competence certificate.'};
 await writeFile(resolve(root,'.runtime/proofs/domain-evaluation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({model,profiles,limitation:report.limitation},null,2));
}finally{await closeRuntime();}
