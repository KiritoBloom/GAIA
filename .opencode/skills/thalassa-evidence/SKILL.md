---
name: THALASSA water and aquatic chemistry
description: Catchment/control-volume accounting, compartments, hydrometry, chemistry loads, support and observation protocols.
---
# Version 2.0.0: THALASSA procedure

## Activate
Surface/ground/root-zone water, wetlands, rivers, aquifers, ocean/coastal state, hydrometry, aquatic constituents or water sampling. Not drinking-water certification or plant/animal diagnosis.

1. Define the control volume, contributing catchment and outlet, relevant store/depth/datum, quantity/units and sampling window. Load `usgs-watershed`; proximity alone does not establish hydraulic connectivity.
2. Load `smap-surface` and `grace-native-support` when those products are proposed. Surface retrievals differ from modeled root-zone states; posted gravity grids differ from effective support. Total storage anomalies are not groundwater alone or local well levels.
3. Inspect gauge method/rating curve, ice, withdrawals, sampling depth, detection/quantification limits, laboratory methods and source rights. Water elevation is not discharge; modeled runoff is not a gauge.
4. Write stores and external precipitation/inflow/outflow/ET/withdrawal terms before calculating closure. Snowmelt is internal transfer if the snow store is inside the volume. Never subtract total ET and transpiration twice. The fixed bucket conserves declared compatible fluxes but remains illustrative, not a calibrated basin solver.
5. For constituent load, concentration and flow need aligned support and timing. A fixed conversion can calculate instantaneous mass flux, but multiplying monthly means is not an integrated measured monthly load. Censoring, sample representativeness and unmeasured fluxes remain limitations.
6. Separate precipitation shortage, altered routing/diversion, groundwater exchange, evaporation and chemistry/exposure hypotheses. Atmospheric demand is forcing, not proof of root water or runoff.
7. Request matched upstream/downstream/reference measurements, appropriate depth/flow chemistry sampling and chronology. State contrasting expectations and remaining confounding factors.

## Handoffs and escalation
Request forcing from AURA, uptake/plant-host responses from CHLORIS and organism effects from ZOE. Optical chlorophyll/color does not measure toxin, oxygen, pathogens or water safety. Darcy/Richards/routing/reaction models require separately implemented solvers, data and held-out validation. Unsafe sampling or possible exposure requires qualified local authority; do not authorize treatment or intervention.

Return the compartment/flux ledger, handler references, exact producer quotations, closure/scale caveats, missing terms and useful observation. Keep numeric findings in artifacts. Evaluate support, ET/snow double counting, concentration/load, datum, missing boundary terms and unsafe certification separately.
