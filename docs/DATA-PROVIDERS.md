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
| AppEEARS | Provider-authenticated, asynchronous extraction/export fallback | Requires its own supported login/token workflow; an Earthdata bearer is not silently substituted. No claim of instant queue completion. |

Manual imports require an explicit source, units, ISO dates and an unambiguous numeric column. They remain user-supplied evidence, not automatically authenticated NASA observations. Daily or irregular observations must not be mislabeled as a monthly series; duplicate periods are rejected rather than silently averaged.

MODIS quality acceptance uses the registered pixel-reliability/VI-quality flags, raw EVI scale 0.0001, actual composite observation days, at least 80% accepted pixels per composite, and every selected growing-season month per annual observation. Unverifiable granules and failed QA remain in the exclusion ledger; missing years suppress regular-series inference rather than compressing time.

Run `npm test`, `node scripts/mission-proof.mjs`, and `node scripts/verify-modis.mjs` with the project-local Node runtime after setup. The final command requires an actual MODIS investigation acquired through the running local UI.
