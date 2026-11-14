import {readFile,writeFile,mkdir} from 'node:fs/promises';
const recorded=JSON.parse(await readFile('.runtime/proofs/modis-ui-export.json','utf8'));
const artifact=recorded.artifacts.find(a=>a.acquisition.variable.id==='EVI'&&a.acquisition.geometry.siteid==='ca_alberta_alberta__mixed_grass_prairie');
if(!artifact||artifact.analysis.n!==25||artifact.analysis.missing!==0||!artifact.acquisition.provenance.collection_versions.includes('061'))throw new Error('Verified public mission example missing; no substitute data are generated.');
await mkdir('docs/examples',{recursive:true});
await writeFile('docs/examples/modis-prairie.json',JSON.stringify({schema:2,title:'NASA MODIS EVI: provider-listed Alberta Mixed Grass Prairie footprint',artifacts:[artifact],simulations:[],comparisons:[],disclosure:['Actual 2001–2025 annual growing-season observations, not a daily vegetation record.','Collection 6.1 verified against exact granule identifiers; five unverifiable revisions excluded.','Native footprint, optical proxy and changing QA sampling; not species, mortality, yield or causal proof.','Public NASA/ORNL metadata and numerical evidence only; no private chat, provider keys or field cases.']},null,2));
console.log('Generated verified public MODIS example with QA and collection-identity ledger.');
