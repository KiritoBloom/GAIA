import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../app/backend/environment.mjs';
import { science } from '../app/backend/science.mjs';

const file = process.argv[2];
if (!file) throw new Error('Usage: npm run reproduce -- path/to/gaia-investigation.json');
const exported = JSON.parse(readFileSync(resolve(ROOT, file), 'utf8'));
if (!Array.isArray(exported.artifacts) || !exported.artifacts.length) throw new Error('Export contains no numerical artifacts.');
const verified = [];
for (const artifact of exported.artifacts) {
  const result = await science({ operation: 'analyze', acquisition: artifact.acquisition });
  for (const field of ['slope_per_year', 'slope_per_decade', 'p_value', 'n', 'missing']) {
    const a = artifact.analysis[field], b = result.analysis[field];
    if (a == null ? b != null : b == null || Math.abs(a - b) > 1e-10) throw new Error(`Numerical mismatch: ${field}`);
  }
  if (artifact.analysis.inputs_sha256 !== result.analysis.inputs_sha256) throw new Error('Analysis-input checksum mismatch.');
  if (typeof artifact.analysis.specification_hash !== 'string' || artifact.analysis.specification_hash !== result.analysis.specification_hash) throw new Error('Method-specification checksum mismatch.');
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
console.log(JSON.stringify({ reproduced_without_provider_or_network: true, verified }, null, 2));
