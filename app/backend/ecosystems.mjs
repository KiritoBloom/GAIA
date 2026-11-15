import { randomUUID } from 'node:crypto';

export const ecosystemGuidance = `\nInvestigate all ecosystems, not just forests. GAIA can record gaia_ecosystem_context from the user's concern and retrieved sources; this is an interpretation, never a verified biome mask. Forest, savanna, grassland, shrubland, desert, tundra, alpine, wetland, cropland, urban, freshwater, marine, ice and mixed systems have different observables and confounders. Never infer biome identity from latitude or EVI alone. Match measurement to outcome; MOD13 terrestrial EVI/NDVI cannot measure ocean chlorophyll, coral health, water safety or ice loss. Prefer truthful supported climate/context and a specific missing-data route over an inappropriate greenness acquisition.\nFor terrestrial vegetation select EVI/NDVI based on optical properties and literature, not significance; preserve mixed-cover limitations until a compatible dated cover mask exists. Justify local phenology, hemispheric seasons, rainfall pulses, crop cycles and any cross-year season. gaia_acquire_region can retain common-pixel support for declared support_months, plus overlapping QA-flag counts. gaia_evidence_sensitivity can inspect a fixed common-pixel subset or actual-calendar gap covariance; neither establishes biome identity or repairs nonrandom missingness. Always report primary results first, then explicitly conditional sensitivity with support/selection assumptions. Do not search seasons, indices or missingness methods until a significant result appears. Disturbance, pollution, management and species/structural change require independently matched measurements; no automatic causal winner from climate correlations.\n`;

// These are interpretation routes, not remotely sensed biome classifications.
// Geography/latitude and vegetation indices cannot establish ecosystem identity.
export const ecosystemProfiles = {
  forest: {realm:'terrestrial', concerns:['canopy composition and structure','fire, harvest, insects and regeneration','optical saturation and cloud contamination'], observations:['forest-cover mask with date and classification accuracy','canopy structure and disturbance histories']},
  grassland: {realm:'terrestrial', concerns:['grazing, mowing and fire','rainfall pulses and seasonal senescence','woody encroachment'], observations:['grassland-cover mask','grazing/fire history and field biomass or composition']},
  savanna: {realm:'terrestrial', concerns:['tree/grass mixtures','fire and grazing','wet/dry season timing'], observations:['tree/grass fractional cover','burn history and matched seasonal field observations']},
  shrubland: {realm:'terrestrial', concerns:['sparse canopy and soil background','fire recovery and species turnover','rainfall-driven phenology'], observations:['shrub-cover mask','disturbance and composition records']},
  desert: {realm:'terrestrial', concerns:['soil reflectance dominates sparse vegetation','brief rainfall-driven growth pulses','dust, irrigation and land-use change'], observations:['vegetated-fraction or land-cover mask','rainfall timing and field cover; greenness is not ecosystem productivity']},
  tundra: {realm:'terrestrial', concerns:['snow and short growing season','shrub expansion versus species loss','permafrost and wetness changes'], observations:['snow/phenology and vegetation-cover observations','composition and ground/permafrost measurements']},
  alpine: {realm:'terrestrial', concerns:['elevation/aspect and mixed pixels','snow and growing-season shifts','treeline and species turnover'], observations:['elevation and vegetation masks','snowmelt, phenology and field composition']},
  wetland: {realm:'transition', concerns:['inundation changes observation support','emergent vegetation versus open water','salinity, drainage and water levels'], observations:['wetland boundary and inundation history','water level, chemistry and vegetation composition']},
  cropland: {realm:'terrestrial', concerns:['crop calendars and rotation','irrigation, harvest and management','greenness is not yield or disease diagnosis'], observations:['crop type and calendar','management, yield and soil/root-water measurements']},
  urban: {realm:'terrestrial', concerns:['mixed impervious/vegetated pixels','irrigation and landscaping','land conversion and heat exposure'], observations:['vegetated/impervious fractional cover','management and independent surface/air measurements']},
  freshwater: {realm:'aquatic', concerns:['water depth, flow, turbidity and mixing','chlorophyll versus terrestrial canopy greenness','sampling effort and biological composition'], observations:['aquatic chlorophyll/turbidity/temperature with water-specific QA','gauges, chemistry and biological surveys']},
  marine: {realm:'aquatic', concerns:['ocean colour, water-column depth and clouds','currents, heat and nutrient supply','coral/seagrass/kelp condition is not land EVI'], observations:['ocean-colour chlorophyll/SST with marine QA','depth-matched water chemistry and habitat surveys']},
  cryosphere: {realm:'ice', concerns:['snow/ice extent and melt timing','albedo versus vegetation','ice retreat is not a land greenness trend'], observations:['snow/ice extent, albedo and temperature with ice-specific QA']},
  mixed: {realm:'mixed', concerns:['land-cover mixtures and changing composition','administrative boundaries are not biome masks'], observations:['dated fractional land-cover or ecosystem masks','stratified matched measurements']},
  unspecified: {realm:'unknown', concerns:['ecosystem identity has not been established'], observations:['documented ecosystem identity and measurement support']}
};

export function recordEcosystem(session, input) {
  const profile=ecosystemProfiles[input.ecosystem];
  if(!profile||!input.rationale?.trim())throw Error('Select a registered ecosystem interpretation and explain its evidence basis.');
  if(input.region_id&&!session.regions?.some(r=>r.id===input.region_id))throw Error('Ecosystem region must belong to this investigation.');
  const sources=(input.source_ids||[]).map(id=>{
    const source=session.literature?.find(s=>s.id===id&&s.text);
    if(!source)throw Error('Ecosystem references need owned retrieved text.');
    return {id,url:source.url,text_sha256:source.text_sha256};
  });
  const result={id:randomUUID(),ecosystem:input.ecosystem,region_id:input.region_id||null,rationale:input.rationale,sources,created:new Date().toISOString(),
    evidence_class:sources.length?'source_grounded_interpretation_not_spatial_classification':'investigation_context_not_verified_classification',...profile,
    vegetation_route:!['aquatic','ice'].includes(profile.realm)?'MOD13A3 EVI or NDVI can measure terrestrial vegetated landscape context, subject to QA and mixed support.':'MOD13A3 terrestrial EVI/NDVI is not a direct aquatic/ice outcome measurement. Use relevant implemented context or report the missing specialized adapter.',
    limits:['This record is not a land-cover mask or verified biome map.','No universal growing season: justify months locally, including Southern Hemisphere and multiple growth cycles.','A positive greenness trend does not prove biodiversity gain, health, productivity or recovery.']};
  session.ecosystemContexts||=[];session.ecosystemContexts.push(result);return result;
}
