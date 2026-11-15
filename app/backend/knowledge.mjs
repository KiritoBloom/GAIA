/** Reviewed short producer excerpts. They are evidence, never executable instructions. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const hash=text=>createHash('sha256').update(text).digest('hex');
export const REFERENCES = [
  {id:'power-monthly',roles:['aura'],title:'NASA POWER monthly data specification',url:'https://power.larc.nasa.gov/docs/services/api/temporal/monthly/',producer:'NASA POWER',text:"All parameters are available in their original source's spatial resolution. Meteorological parameters are derived from NASA's GMAO MERRA-2 assimilation model (Jan. 1, 1981 - as of the previous year)."},
  {id:'fao-atmospheric-demand',roles:['aura','chloris','thalassa'],title:'FAO Irrigation and Drainage Paper 56, Chapter 3',url:'https://www.fao.org/4/x0490e/x0490e07.htm',producer:'FAO',text:'While the energy supply from the sun and surrounding air is the main driving force for the vaporization of water, the difference between the water vapour pressure at the evapotranspiring surface and the surrounding air is the determining factor for the vapour removal.'},
  {id:'usgs-watershed',roles:['thalassa'],title:'Watersheds and Drainage Basins',url:'https://www.usgs.gov/special-topics/water-science-school/science/watersheds-and-drainage-basins',producer:'USGS Water Science School',text:'A watershed is an area of land that drains all the streams and rainfall to a common outlet such as the outflow of a reservoir, mouth of a bay, or any point along a stream channel.'},
  {id:'smap-surface',roles:['thalassa'],title:'SMAP Mission Description',url:'https://smap.jpl.nasa.gov/mission/description/',producer:'NASA JPL',text:'Everywhere on Earth not covered with water or not frozen, SMAP measures how much water is in the top layer of soil. It also distinguishes between ground that is frozen or thawed.'},
  {id:'grace-native-support',roles:['thalassa'],title:'JPL Global Mascons data processing',url:'https://grace.jpl.nasa.gov/data/get-data/jpl_global_mascons/',producer:'NASA JPL',text:'The data are represented on a Â½ degree lon-lat grid, but they represent the 3x3 degree equal-area caps, which is the current effective resolution of JPL-RL06M.'},
  {id:'mod13-observation',roles:['chloris'],title:'MOD13Q1 Version 6.1 product description',url:'https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061',producer:'NASA LP DAAC',text:'The algorithm chooses the best available pixel value from all the acquisitions from the 16 day period. The criteria used is low clouds, low view angle, and the highest NDVI/EVI value.'},
  {id:'gbif-sampling-events',roles:['zoe'],title:'Introduction to sampling-event data',url:'https://www.gbif.org/sampling-event-data',producer:'GBIF',text:'Sampling-event data describes species occurrences in time and space together with details of sampling effort. Such data are available from thousands of environmental, ecological, and natural resource investigations.'},
  {id:'ebird-observation-process',roles:['zoe'],title:'Use eBird Data and Tools',url:'https://ebird.org/science/use-ebird-data',producer:'Cornell Lab of Ornithology',text:'eBird data bring a number of analytical challenges and it is important to consider how the data are generated when using them for analysis.'}
].map(reference=>({...reference,version:'2026-11-14-reviewed-excerpt',sha256:hash(reference.text),reuse:'short attributed documentation excerpt; dataset rights remain source-specific',evidence_status:'producer text retrieved and excerpt checked; not independent expert review'}));
const PACKS={gaia:['gaia-investigation-control','shared-evidence-integrity'],aura:['aura-evidence','shared-evidence-integrity'],thalassa:['thalassa-evidence','shared-evidence-integrity'],chloris:['chloris-evidence','shared-evidence-integrity'],zoe:['zoe-evidence','shared-evidence-integrity']};
export const domainSkills=role=>[...(PACKS[role]||[])];
export function loadDomainSkill(role,id){
  if(!PACKS[role]?.includes(id))throw new Error('Skill owner/identifier denied.');
  const content=readFileSync(new URL(`../../.opencode/skills/${id}/SKILL.md`,import.meta.url),'utf8');
  return {id,role,version:'2.0.0',sha256:hash(content),content,loader:'application-managed exact-ID loader; no filesystem capability',readiness:'reviewed procedure; competence must be evaluated separately'};
}
export function referenceCatalog(role){return REFERENCES.filter(reference=>reference.roles.includes(role)).map(({text,...metadata})=>metadata);}
export function loadReference(role,id){const item=REFERENCES.find(reference=>reference.id===id&&reference.roles.includes(role));if(!item)throw new Error('Reference owner/identifier denied.');return {...item,untrusted_content:true};}
export function validateSourceEvidence(role,items){
  if(!Array.isArray(items)||!items.length)throw new Error('A domain review requires retrieved source evidence.');
   return items.map(item=>{const source=loadReference(role,item.source_id);if(typeof item.quote!=='string'||!source.text.includes(item.quote))throw new Error('Citation quotation is absent from the approved source.');return {source_id:source.id,url:source.url,source_sha256:source.sha256,quote:item.quote,status:'exact producer quotation; paraphrase entailment not certified'};});
}
export function competenceStatus(role,activeModel){
 try{const report=JSON.parse(readFileSync(new URL('../../.runtime/proofs/domain-evaluation.json',import.meta.url),'utf8'));const result=report.profiles?.[role];
  if(!result)return {status:'not_evaluated; review_only',independent_expert_certification:false};
  if(activeModel&&activeModel!==report.model)return {status:'model_changed; reevaluation_required',tested_model:report.model,independent_expert_certification:false};
  const current=domainSkills(role).map(id=>loadDomainSkill(role,id).sha256),tested=(report.skills?.[role]||[]).map(item=>item.sha256);
  if(JSON.stringify(current)!==JSON.stringify(tested))return {status:'procedures_changed; reevaluation_required',independent_expert_certification:false};
  return {...result,case_set:report.version,model:report.model,independent_expert_certification:false,limitation:report.limitation};
 }catch{return {status:'not_evaluated; review_only',independent_expert_certification:false};}
}
export const skillProfile=activeModel=>Object.fromEntries(Object.keys(PACKS).map(role=>[role,{skills:domainSkills(role).map(id=>{const {content,...metadata}=loadDomainSkill(role,id);return metadata;}),references:referenceCatalog(role),competence:competenceStatus(role,activeModel)}]));
