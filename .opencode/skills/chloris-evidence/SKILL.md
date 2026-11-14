---
name: CHLORIS plant evidence
description: Optical QA, phenology/stage, host and injury differentials, crop/root evidence, scenarios and diagnostic boundaries.
---
# Version 2.0.0: CHLORIS procedure

## Activate
Plants/crops/forests, optical greenness, phenology, plant-host pathology, invasive plants, roots/soil context and restoration monitoring. Animal pests belong to ZOE; water budgets to THALASSA.

1. Establish the actual plant/host/crop, stage, symptom/outcome, onset/patch distribution, management/irrigation history and prior failed actions. A reported symptom is not a confirmed diagnosis.
2. Load `mod13-observation` before interpreting indices. Inspect actual collection and granule identity, scale/fill, pixel reliability/VI flags, observation days, cloud/snow/shadow, accepted-pixel support and composite season. Greenness is not species, yield, infection, biomass census or restoration success.
3. Use the fixed greenness QA audit. Preserve excluded processing revisions, calendar years, missing seasons and changed support. Growing-season annual aggregation has yearly dependence settings; it is not a compressed monthly series or continuous physiology integral.
4. Compare like stages, windows and supports. Retrospective phenology/gap-filled products may use later observations; do not leak them into historical/prospective prediction inputs.
5. Request only relevant AURA atmospheric demand/forcing, THALASSA root-water/chemistry and ZOE animal-pest/feeding observations. Load `fao-atmospheric-demand` for the forcing concept, not as a crop-diagnosis rule.
6. Contrast heat/water shortage, drainage/root failure, disturbance, phenology/retrieval, management, invasive competition and host-specific pathology. Normal regional rain does not exclude local root failure; greener pixels can coexist with ecological damage.
7. Fixed statistical scenarios require real response/covariates and chronological baseline/domain checks. A validated crop/pathology/competition solver is not installed by naming a model family.
8. Propose matched healthy/affected observations, stage/management history and qualified diagnostic interpretation where needed. State what result would challenge each candidate mechanism.

## Safety and output
Do not guess pesticides, species/pathogens, crop recovery or treatment; do not direct unauthorized specimen transfer/releases. Verify relevant local laboratory/professional credentials and consent before handoff. Return plant-stage/QA facts, exact source quotations, owned artifacts, differential/gaps and one actionable safe observation, with all numbers handler-owned.

Evaluation targets: greenness/yield/diagnosis, QA/scaling, season/gaps, retrospective leakage, host/pest ownership, normal-rain/root failure, unsafe intervention and misleading recovery claims.
