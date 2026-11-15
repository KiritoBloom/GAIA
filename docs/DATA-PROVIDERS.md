# Data-provider contracts and checks

These checks establish specific supported operations, not universal service uptime, coverage or scientific equivalence.

| Provider | Supported operation | Verified boundary |
|---|---|---|
| NASA POWER | Public monthly point retrieval: T2M, PRECTOTCORR, RH2M | Actual 300-month British Columbia series and separate-process reproduction. Reanalysis grid, not station or polygon mean; precipitation is mean daily rate. |
| ORNL DAAC TESViS / MODIS | Provider-listed fixed-site MOD13Q1 EVI plus three raw QA/date bands | Actual Rune acquisition of 25 complete annual growing-season values. Native public transport, exact Collection 6.1 granule identity, scaling, quality and observation-calendar checks. |
| NASA CMR | Public granule metadata discovery | Exact product/composite/tile/processing matches, not an assumption that every response is the latest collection. Unmatched processing revisions excluded; ambiguous or mixed collections rejected. |
| NOAA CDO | Token-authenticated station metadata discovery | Actual 25 station metadata entries. Does not imply complete station observations, independent trend validation or matched spatial support. |
| Giovanni | User-authenticated NASA area-averaged export, then explicit CSV import | Earthdata/GES DISC authorization is performed at the provider. No invented Giovanni API key or automated adapter. Same underlying data remain the same observation lineage. |
| CUAHSI HIS | Discovery and lawful export/import from the original publisher | Permissions, quantities, methods and catchment support remain publisher-specific. Same gauge through another portal is not independent evidence. |
| KNMI Climate Explorer | Manual climate-series discovery/export and documented CSV preparation | Actual dataset/source lineage must be retained. Observations, models and reanalyses are not interchangeable. |
| NASA AppEEARS | Implemented authenticated asynchronous polygon extraction of MOD13A3.061 monthly EVI and VI Quality | GAIA resolves an owned geographic polygon; submits a fresh area task; records provider progress; downloads NetCDF afresh and verifies bundle SHA-256. Explicit integer-versus-scaled-float decoding, QA, polygon holes, spherical cell-area weighting and monthly missingness. Live acceptance is recorded in `docs/IMPLEMENTATION.md`; implementation alone does not prove a successful regional run. |

Manual imports require an explicit source, units, ISO dates and an unambiguous numeric column. They remain user-supplied evidence, not automatically authenticated NASA observations. Daily or irregular observations must not be mislabeled as a monthly series; duplicate periods are rejected rather than silently averaged.

MODIS quality acceptance uses the registered pixel-reliability/VI-quality flags, raw EVI scale 0.0001, actual composite observation days, at least 80% accepted pixels per composite, and every selected growing-season month per annual observation. Unverifiable granules and failed QA remain in the exclusion ledger; missing years suppress regular-series inference rather than compressing time.

The separate AppEEARS regional recipe uses the provider's monthly MOD13A3 product, not an invented aggregation of the fixed-site series. It accepts MODLAND quality zero, usefulness at most four, non-high aerosol, and excludes fill, adjacent/mixed cloud, snow and shadow. At least 80% of polygon cell-area support must survive QA in a month; otherwise that month remains missing and continuous-calendar inference is withheld. This conservative threshold is a declared scientific QA choice, not a limit on how long agents work. Geographic pixel centres approximate boundary intersections. A landscape polygon is not a forest mask; report landscape greenness unless suitable land-cover evidence has actually been acquired.

AppEEARS requires `APPEEARS_USERNAME` and `APPEEARS_PASSWORD` in the server's ignored `.env`. Login tokens remain ephemeral and are never exported. Existing Earthdata profile bearer tokens are not interchangeable. Boundary resolution supports real Nominatim polygons and researched public government ArcGIS GeoJSON feature-query endpoints. Ambiguous names require an explicit disclosed boundary choice, not guessed coordinates. All new data acquisitions send no-cache/no-store headers and bypass local response caches; retained investigation artifacts and explicit resume of an owned queued task are provenance, not a new live extraction.

Run `npm test`, `node scripts/mission-proof.mjs`, and `node scripts/verify-modis.mjs` with the project-local Node runtime after setup. The final command requires an actual MODIS investigation acquired through the running local UI.
