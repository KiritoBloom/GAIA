import '../app/backend/runtime.mjs';
import { semanticJudgment, reviewQuestions } from '../app/backend/jev.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const result = await semanticJudgment({ request:'Which observation distinguishes regional rainfall shortage from changed local drainage?', hypotheses:['Regional rainfall shortage','Changed local drainage'], protocol:'Compare measured streamflow above and below the affected reach and an unaffected reference over the reported onset interval, with catchment precipitation context.', source_context:'Precipitation is atmospheric forcing, not river discharge; a local gauge measures water flow at its station.', claim:'A precipitation record is not a measurement of river discharge.' }, reviewQuestions());
mkdirSync('.runtime/proofs', { recursive:true });
writeFileSync('.runtime/proofs/jev.json', JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if (result.status !== 'completed') process.exitCode = 1;
