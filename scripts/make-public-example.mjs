import {readFile,mkdir,writeFile} from 'node:fs/promises';
const input=JSON.parse(await readFile('.runtime/proofs/ui-export.json','utf8'));
const artifacts=input.artifacts.filter(a=>a.acquisition.provenance.provider==='NASA POWER'&&a.acquisition.geometry.latitude===53.91&&a.acquisition.geometry.longitude===-122.75&&a.analysis.n===300);
if(artifacts.length!==3)throw new Error('Expected exactly the three genuine public NASA demonstration series.');
const ids=new Set(artifacts.map(a=>a.id));
const output={schema_version:2,title:'British Columbia NASA POWER example: 2001–2025',privacy_review:'Only author-selected public gridded NASA demo inputs are included. No chat, model credential, runtime thread, field-case or private observation is included.',sources:artifacts.map(a=>a.acquisition.provenance.url),artifacts,simulations:(input.simulations||[]).filter(r=>ids.has(r.artifactID)),comparisons:[],limitations:['NASA reanalysis grid support, not station measurements or a watershed mean.','Nominal trends do not establish cause; the chosen model did not improve over both baselines.','No accepted mission-derived vegetation trend or verified animal outcome is included.']};
await mkdir('docs/examples',{recursive:true});await writeFile('docs/examples/british-columbia.json',JSON.stringify(output,null,2));
const jev=JSON.parse(await readFile('.runtime/proofs/jev-evaluation.json','utf8'));await mkdir('docs/validation',{recursive:true});await writeFile('docs/validation/jev-summary.json',JSON.stringify({model:jev.model,evaluation:jev.evaluation,usage:jev.usage,elapsed_ms:jev.elapsed_ms},null,2));
console.log('Generated public NASA example and authored-microcase Jev summary, without private runtime context.');
