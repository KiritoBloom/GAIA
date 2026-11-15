import '../app/backend/runtime.mjs';
import { semanticJudgment } from '../app/backend/jev.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

// Single-author development/evaluation microcases. No threshold fitting or external-validation claim.
const cases=[
 ['POWER air temperature is a reanalysis-derived grid quantity.','This record is a grid-supported model product.','supports'],
 ['Rainfall is atmospheric forcing, not river discharge.','Rainfall measures river discharge.','contradicts'],
 ['EVI is an optical greenness proxy.','EVI proves which insect infected the trees.','unsupported'],
 ['An occurrence record documents an observed animal, not a complete census.','An occurrence record is not a complete census.','supports'],
 ['A confidence interval spans zero.','The direction is conclusively positive.','contradicts'],
 ['The series has missing months and no imputation.','An exact unbiased causal estimate is available.','unsupported'],
 ['A concentration requires flow to calculate mass load.','Concentration alone establishes mass load.','contradicts'],
 ['This simulation omits parameter and structural uncertainty.','The interval omits parameter and structural uncertainty.','supports'],
 ['A regional trend does not identify its cause.','The trend identifies the sole ecological cause.','contradicts'],
 ['The station record has documented sampling dates.','The record proves pesticide exposure.','unsupported'],
 ['Monthly mean daily rainfall rates are reported in mm/day.','These values are monthly rainfall totals in millimetres.','contradicts'],
 ['The evidence concerns air temperature, not lake temperature.','The reported variable is air temperature.','supports'],
 ['Satellite greenness can change because of phenology or optical retrieval.','Reduced greenness proves animal mortality.','unsupported'],
 ['A gauge measures water flow at its station.','A gauge measures flow at its station.','supports'],
 ['Survey effort is missing; absence of records is not evidence of absence.','No records proves the species is absent.','contradicts'],
 ['The numerical analysis detects an association.','The mechanism has been experimentally proved.','unsupported'],
 ['A weather-grid comparison is contextual, not an ecological twin.','This comparison is contextual rather than an ecological twin.','supports'],
 ['The scenario lies outside the observed joint covariate domain and was rejected.','The scenario passed domain eligibility.','contradicts'],
 ['The source contains a rainfall time series and no pathology observations.','The source confirms a specific animal infection.','unsupported'],
 ['The held-out model failed the persistence baseline.','Its performance was worse than the persistence baseline.','supports']
].map(([source_context,claim,expected],index)=>({id:`case_${index}`,source_context,claim,expected,split:index<10?'development':'evaluation'}));
const questions=Object.fromEntries(cases.map(item=>[item.id,{type:'choice',instructions:`Consider ONLY cases[${Number(item.id.slice(5))}].source_context and its exact claim. Do not use other cases or infer missing data.`,criteria:{supports:'Directly supported by this context.',contradicts:'Explicitly incompatible with this context.',unsupported:'Required evidence is absent.'}}]));
const result=await semanticJudgment({cases:cases.map(({expected,split,...input})=>input)},questions,undefined,{force:true});
if(result.status!=='completed'){console.info('Optional Jev evaluation skipped: service unavailable or no credential. No scores were generated.');process.exit(0);}
const evaluate=split=>{const rows=cases.filter(row=>row.split===split);return {n:rows.length,accuracy:rows.filter(row=>result.answers[row.id].choice===row.expected).length/rows.length,brier:rows.reduce((sum,row)=>sum+Object.entries(result.answers[row.id].probabilities).reduce((total,[id,p])=>total+(p-(id===row.expected?1:0))**2,0),0)/rows.length,errors:rows.filter(row=>result.answers[row.id].choice!==row.expected).map(row=>row.id)};};
const report={model:result.model,evaluation:{status:'internal_single_rater_microcases',task:'source-context claim support only',development:evaluate('development'),held_out_microcases:evaluate('evaluation'),threshold_tuning:false,operational_influence:'shadow_only',limitation:'Developer-authored synthetic text; not external scientific/domain validation, expert calibration or proof of benefit for routing/protocol ranking.'},cases,...result};
await mkdir('.runtime/proofs',{recursive:true});await writeFile('.runtime/proofs/jev-evaluation.json',JSON.stringify(report,null,2));console.log(JSON.stringify({model:report.model,evaluation:report.evaluation,usage:result.usage,elapsed_ms:result.elapsed_ms},null,2));
