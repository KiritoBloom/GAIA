import {z} from 'zod';
import {sha256} from './security.mjs';

const nodeSchema=z.object({id:z.string(),kind:z.enum(['quantity','proposed_mechanism','requested_outcome']),label:z.string(),evidence_class:z.string(),artifact_id:z.string().optional(),units:z.string().optional(),geometry:z.any().optional(),period:z.array(z.string()).optional(),sources:z.array(z.string())});
const edgeSchema=z.object({id:z.string(),from:z.string(),to:z.string(),relationship:z.string(),status:z.string(),sources:z.array(z.string()),conditions:z.array(z.string()),causal_certification:z.literal(false)});
const graphSchema=z.object({version:z.literal(1),outcome_owner:z.string(),nodes:z.array(nodeSchema),edges:z.array(edgeSchema),dependencies:z.array(z.object({provider:z.string(),artifact_ids:z.array(z.string()),independence:z.literal('not established by agreement between workers')}))});
const unique=items=>[...new Set(items.filter(value=>typeof value==='string'&&value.length))];

export function verifyArtifactManifest(artifact){
 const {manifest_sha256,id,created,...payload}=artifact;
 if(typeof manifest_sha256!=='string'||sha256(payload)!==manifest_sha256)throw Error('An investigation artifact manifest no longer matches its contents.');
 return manifest_sha256;
}

export function investigationRecords(session){
 const artifacts=session.artifacts||[],hypotheses=session.hypothesisRecords||[],simulations=session.simulations||[];
 const artifactMap=new Map(artifacts.map(item=>[item.id,item]));
 for(const artifact of artifacts)verifyArtifactManifest(artifact);
 const owner=session.taskGraph?.owner||'gaia';
 const nodes=artifacts.map(artifact=>({id:`quantity:${artifact.id}`,kind:'quantity',label:artifact.acquisition.variable.name,evidence_class:artifact.acquisition.variable.evidence_class||'user-declared evidence',artifact_id:artifact.id,units:artifact.acquisition.variable.units,geometry:artifact.acquisition.geometry,period:[artifact.analysis.requested_start,artifact.analysis.requested_end],sources:unique([artifact.acquisition.variable.source,...(artifact.analysis.sources||[])])}));
 nodes.push({id:'requested-outcome',kind:'requested_outcome',label:'Requested outcome; not automatically a measured biological or causal result',evidence_class:'user question, not independent observation',sources:[]});
 const edges=[],disagreements=[];
 for(const hypothesis of hypotheses){
  const sources=unique([hypothesis.source,...(hypothesis.source_ids||[]).map(id=>(session.literature||[]).find(paper=>paper.id===id)?.url)]);
  const id=`mechanism:${hypothesis.id}`;
  nodes.push({id,kind:'proposed_mechanism',label:hypothesis.name||hypothesis.id,evidence_class:'proposed explanation, not established cause',sources});
  edges.push({id:`outcome:${hypothesis.id}`,from:id,to:'requested-outcome',relationship:hypothesis.expectation||'Qualitative proposed pathway',status:'proposed; causal identification not established',sources,conditions:hypothesis.required_observations||(hypothesis.required?[hypothesis.required]:[]),causal_certification:false});
  for(const assessment of hypothesis.evidence||[]){
   const artifactID=assessment.artifactID||assessment.artifact_id;
   if(!artifactMap.has(artifactID))throw Error('A hypothesis references evidence outside the owned investigation.');
   edges.push({id:`signature:${hypothesis.id}:${artifactID}`,from:`quantity:${artifactID}`,to:id,relationship:assessment.reason||'Registered signature assessment',status:assessment.status,sources,conditions:[assessment.limitation||'Signature agreement is not causal proof.'],causal_certification:false});
  }
  const evidence=hypothesis.evidence||[],positive=evidence.filter(item=>item.status==='supported_signatures'),negative=evidence.filter(item=>item.status==='contradicted_signatures');
  if(positive.length&&negative.length)disagreements.push({id:`disagreement:${hypothesis.id}`,hypothesis_id:hypothesis.id,status:'unresolved_conflicting_signatures',artifact_ids:unique([...positive,...negative].map(item=>item.artifactID)),resolution:'Inspect quantity, support, time, QA and shared lineage; a worker majority does not resolve this conflict.'});
 }
 const providers=new Map();for(const artifact of artifacts){const provider=artifact.acquisition.provenance.provider||artifact.acquisition.variable.provider||'user-declared source';providers.set(provider,[...(providers.get(provider)||[]),artifact.id]);}
 const graph=graphSchema.parse({version:1,outcome_owner:owner,nodes,edges,dependencies:[...providers].map(([provider,artifact_ids])=>({provider,artifact_ids,independence:'not established by agreement between workers'}))});
 const portfolios=hypotheses.map(hypothesis=>({id:`scenario:${hypothesis.id}`,mechanism: hypothesis.name||hypothesis.id,owner:hypothesis.owner,required_observations:hypothesis.required_observations||[],model_results:simulations.map(item=>({id:item.id,model:item.model,target_artifact:item.artifactID,readiness:item.readiness,validation:item.validation,relationship:'Executed numerical context; not an automatic model of this mechanism'})),mechanism_validation:'not established',limitations:['A missing plant, animal, hydraulic or chemistry solver is not replaced by a weather extrapolation.']}));
 const tests=hypotheses.map(hypothesis=>({id:`signature-test:${hypothesis.id}`,version:1,hypothesis_id:hypothesis.id,expectation:hypothesis.expectation,contrary_expectation:hypothesis.contradiction,required_observations:hypothesis.required_observations||(hypothesis.required?[hypothesis.required]:[]),assessments:hypothesis.evidence||[],source:hypothesis.source,source_ids:hypothesis.source_ids||[],mode:'observational_signature_test; not causal identification',dependencies:unique((hypothesis.evidence||[]).map(item=>item.artifactID||item.artifact_id)),limitations:['A transferred test must recheck support, observation process and method eligibility; an old conclusion is not a new observation.']}));
 const updates=session.evidenceUpdates||[];
 const status={data:artifacts.length?(artifacts.every(item=>item.analysis.missing===0)?'adequate_for_recorded_recipe':'partial'):'unavailable',trend:artifacts.map(item=>({artifact_id:item.id,status:item.analysis.status})),hypothesis:hypotheses.map(item=>({id:item.id,assessments:(item.evidence||[]).map(value=>value.status)})),simulation:simulations.map(item=>({id:item.id,status:item.readiness})),review:session.semanticReviews?.at(-1)?.status||'not_requested',discovery:session.comparisons?.length?'contextual_comparison_only':'not_requested',prediction:session.predictionTest?.evaluation?.outcome||session.predictionTest?.state||'not_requested',integrity:session.predictionTest?.label_decision?.locked?'access_verified':'unproved_or_audit_incomplete',test_mode:session.predictionTest?.mode||'not_requested'};
 const backbone={long_nasa_series:artifacts.some(item=>String(item.acquisition.provenance.provider||'').startsWith('NASA')&&['detected','not_detected'].includes(item.analysis.status)),competing_expectations:hypotheses.length>=2&&hypotheses.every(item=>item.expectation&&item.contradiction&&item.expectation!==item.contradiction),observation_plan:!!session.observationPlan?.protocol?.id,additional_evidence_update:updates.some(update=>(update.added_artifacts||[]).some(id=>artifactMap.has(id))),artifact_manifests:'matched',numerical_rerun:'must be executed independently; a matching manifest is not a numerical rerun'};
 const report={schema_version:1,mechanism_graph:graph,disagreements,scenario_portfolio:portfolios,signature_test_records:tests,status_dimensions:status,backbone,artifact_descriptors:artifacts.map(item=>({id:item.id,type:'numerical_acquisition_and_trend',manifest_sha256:item.manifest_sha256,input_sha256:item.analysis.inputs_sha256,method_hash:item.analysis.specification_hash,units:item.acquisition.variable.units,source_class:item.acquisition.variable.evidence_class,geometry:item.acquisition.geometry,registered_viewer:'evidence_summary',access:'owned investigation; review redistribution rights before publication'})),limitations:['No graph edge certifies a cause, diagnosis, independent confirmation or forecast validity.','The status dimensions are separate; successful retrieval does not certify every scientific interpretation.']};
 return {...report,record_hash:sha256(report)};
}
