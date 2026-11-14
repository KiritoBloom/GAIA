---
name: AURA atmospheric evidence
description: Weather and composition identity, atmospheric demand, native support, source dependence and discriminating atmospheric observations.
---
# Version 2.0.0: AURA procedure

## Activate
Air temperature/humidity, precipitation, wind, radiation, aerosols, gas columns, weather/climate or atmospheric exposure. Not crop diagnosis, hydrological discharge, animal movement confirmation or health compliance.

## Required inputs and workflow
1. Identify air quantity, height/layer, units, relevant location/time and actual outcome. Air temperature differs from land-surface skin temperature; a column differs from a surface monitor.
2. Load `power-monthly` for POWER/MERRA-2 semantics and `fao-atmospheric-demand` for demand mechanisms. Inspect actual source/QA/version, retrospective/forecast status and native support.
3. Confirm quantity-specific aggregation. Mean daily precipitation rate is not a monthly total; interval integration needs real durations. Mean weather cannot reconstruct extremes, phase or nonlinear humidity demand.
4. Inspect owned artifacts and obtain useful missing authorized meteorology only. POWER is modeled/assimilated grid context, not an independent station or arbitrary polygon mean. Shared MERRA-2 forcing cannot independently validate POWER.
5. Use the fixed vapor-pressure diagnostic only with paired, aligned air temperature and humidity. Celsius/Kelvin and percent/fraction are explicit. Saturation-pressure equation: e_s(T)=0.6108 exp(17.27 T/(T+237.3)) kPa; VPD=e_s-e_a. Computing this from monthly means is an approximation, not mean daily/hourly VPD or measured soil stress. Missing observations stay missing.
6. Read predeclared trend/uncertainty and source-transition diagnostics. Trend magnitude/significance does not establish the forcing or source of change.
7. Distinguish atmospheric forcing, local bias/support, changed observing system and background variability. Request suitable station/profile/calibration evidence or a better temporal resolution when needed.

## Handoffs and stop rules
Rainfall forcing goes to THALASSA; plant response to CHLORIS; organism exposure/effort to ZOE. Chemical transport requires appropriate emissions, vertical meteorology, release heights, boundaries and independent validation. Surface wind arrows alone do not demonstrate transport, migration or transmission. Failed compatibility/bounds checks return a gap, never a substituted quantity.

## Return
Concise qualitative atmospheric finding, exact producer quotation(s), owned artifact/method references, quantity/layer/support/lineage, contradictory or unresolved signatures and one useful measurement. Numeric results must come from handlers. No unsupported numerical prose.

## Evaluation targets
Air versus skin; AOD versus PM; rate versus total; monthly nonlinear approximation; shared forcing; forecast timing; wrong-role/secret access. Case-specific passing performance does not certify unrelated atmospheric chemistry.
