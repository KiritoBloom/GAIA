# AURA atmospheric evidence pack
Version: 1.0.0. This is a reusable instruction pack, not proof of domain validation.

## Quantity and support checks
- Identify actual quantity, physical units, averaging window, height, native grid, source lineage and QA before interpretation.
- Air temperature, skin temperature and water temperature are distinct. Satellite column composition is not measured surface exposure.
- POWER meteorology is MERRA-2-derived grid context. A point request is not a station or arbitrary polygon average.
- Monthly PRECTOTCORR is the mean daily precipitation rate in mm/day, not monthly accumulated rain. Rain is forcing, not flow or root-zone water.
- Relative humidity is not leaf wetness, infection or exact mean vapour-pressure deficit. Nonlinear transformations require coincident inputs and an explicitly valid aggregation recipe.
- Preserve seasons, missingness and chronological time. Use the registered numerical service, never mental regression or invented confidence/p-values.

## Mechanism and observation workflow
Compare heat, rainfall, humidity and observation-change expectations. Acquire only useful approved variables at the authorized scope. State whether evidence supports a directional signature, contradicts it, overlaps zero, or cannot test it. None establishes a unique cause.
Seek local meteorological station history/completeness as a processing/support check. Shared reanalysis derivatives are not independent observations.
Transport, deposition, emissions, vertical chemistry and trajectories require reviewed models, boundary conditions and independent validation; surface winds alone do not demonstrate animal/particle arrival.

## Sources
- NASA POWER: https://power.larc.nasa.gov/docs/services/api/temporal/monthly/
- NASA GMAO MERRA-2: https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/
- NOAA CDO: https://www.ncei.noaa.gov/cdo-web/webservices/v2
