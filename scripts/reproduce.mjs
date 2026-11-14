import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../app/backend/environment.mjs';
import { science } from '../app/backend/science.mjs';
import {verifyArtifactManifest} from '../app/backend/investigation-records.mjs';
import {preparePrediction,predictionEvaluation} from '../app/backend/integrity.mjs';
import {sha256} from '../app/backend/security.mjs';

const file = process.argv[2];
if (!file) throw new Error('Usage: npm run reproduce -- path/to/gaia-investigation.json');
const exported = JSON.parse(readFileSync(resolve(ROOT, file), 'utf8'));
if (!Array.isArray(exported.artifacts) || !exported.artifacts.length) throw new Error('Export contains no numerical artifacts.');
const verified = [];
for (const artifact of exported.artifacts) {
  verifyArtifactManifest(artifact);
  const result = await science({ operation: 'analyze', acquisition: artifact.acquisition });
  for (const field of ['slope_per_year', 'slope_per_decade', 'p_value', 'n', 'missing']) {
    const a = artifact.analysis[field], b = result.analysis[field];
    if (a == null ? b != null : b == null || Math.abs(a - b) > 1e-10) throw new Error(`Numerical mismatch: ${field}`);
  }
  if (artifact.analysis.inputs_sha256 !== result.analysis.inputs_sha256) throw new Error('Analysis-input checksum mismatch.');
  if (typeof artifact.analysis.specification_hash !== 'string' || artifact.analysis.specification_hash !== result.analysis.specification_hash) throw new Error('Method-specification checksum mismatch.');
  equal(result.analysis,artifact.analysis,'analysis');
  verified.push({ artifact: artifact.id, variable: artifact.acquisition.variable.name, inputs: 'matched', methods: 'matched', tolerance: 1e-10, status: result.analysis.status });
}
function equal(a,b,path='result'){
 if(typeof a==='number'){if(typeof b!=='number'||!Number.isFinite(b)||Math.abs(a-b)>1e-10*Math.max(1,Math.abs(a)))throw new Error(`Reproduction mismatch at ${path}`);return;}
 if(a===null||typeof a!=='object'){if(a!==b)throw new Error(`Reproduction mismatch at ${path}`);return;}
 if(Array.isArray(a)){if(!Array.isArray(b)||a.length!==b.length)throw new Error(`Reproduction mismatch at ${path}`);a.forEach((value,index)=>equal(value,b[index],`${path}[${index}]`));return;}
 for(const [key,value]of Object.entries(a))equal(value,b?.[key],`${path}.${key}`);
}
for(const record of [...(exported.simulations||[]),...(exported.comparisons||[])]){
 if(!record.request)throw new Error('This older model/comparison record lacks frozen reproduction inputs; rerun it before claiming reproducibility.');
 const result=await science(record.request);
 for(const [key,value]of Object.entries(result))equal(value,record[key],key);
 verified.push({operation:record.request.operation,result:'matched',tolerance:1e-10});
}
const prediction=exported.prediction_test;
if(prediction?.state==='evaluated'&&prediction.prediction?.prediction_evaluation_specification){
 if(sha256(prediction.prediction)!==prediction.prediction_hash)throw Error('Frozen prediction hash mismatch.');
 const frozen=prediction.prediction,training=frozen.training_acquisition;
 if(!training)throw Error('Frozen prediction training inputs are missing.');
 equal(preparePrediction(frozen,training).prediction_evaluation_specification,frozen.prediction_evaluation_specification,'training_only_baseline');
 const result=await science({operation:'simulate',model:'seasonal_continuation_v1',acquisition:training,horizon:12,members:64,seed:20261114});
 for(const[key,value]of Object.entries(result))equal(value,frozen[key],`frozen_prediction.${key}`);
 const observed=exported.artifacts.find(item=>item.id===prediction.evaluation.artifactID);if(!observed)throw Error('Prediction evaluation artifact is missing.');
 equal(predictionEvaluation(frozen,observed),prediction.evaluation,'prediction_evaluation');
 verified.push({operation:'frozen_prediction_and_training_only_evaluation',result:'matched',classification:prediction.evaluation.classification.status,tolerance:1e-10});
}
console.log(JSON.stringify({ reproduced_without_provider_or_network: true, verified }, null, 2));
