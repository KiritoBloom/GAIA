# Ecosystem-aware investigations

GAIA is not limited to forests. Its interpretation profiles cover forest, grassland, savanna, shrubland, desert, tundra, alpine, wetland, cropland, urban vegetation, freshwater, marine, cryosphere, mixed and unspecified environments. These are reusable interpretation routes, not an exhaustive biome taxonomy or a verified spatial classification. GAIA records the user's context and retrieved sources, chooses relevant specialists, and explains missing observations without asking the user to operate them.

## Match the measurement to the question

- Regional terrestrial vegetation can use fresh NASA AppEEARS **MOD13A3.061 EVI or NDVI** with aligned VI Quality. Select indices for their documented properties, not for a favorable trend. They are related observations from the same product, not independent corroboration.
- Dense vegetation, sparse soil-dominated cover, tree/grass mixtures, grazing, fire, crop rotation, inundation, snow and local growth cycles need different interpretation. Neither index directly measures ecosystem health, biodiversity, yield, mortality or recovery.
- Freshwater/marine/ice investigations must not substitute land greenness for chlorophyll, coral condition, water safety or ice loss. The regional vegetation acquisition handler rejects direct aquatic/ice outcomes when that context is recorded. Specialized numerical adapters remain necessary for those outcomes; supported context and source-grounded gaps are still useful.
- A named region is not a biome mask. Forest-, grassland-, crop- or other cover-specific conclusions require an appropriate dated classification or fractional-cover layer. This release does **not** claim an automatic global biome-mask adapter.

## Observation support and uncertainty

New regional acquisitions retain overlapping per-flag QA rejection counts, monthly valid area, actual scaling and a common-pixel intersection for declared support months. Flag counts must not be added as mutually exclusive categories or interpreted as ecological causes. Grid coordinates and mask bits jointly identify the common support.

`common_support` derives a fixed-pixel subset series from those retained diagnostics. It is not the original polygon mean, a biome mask, new acquisition or independent evidence. A tiny surviving subset may be unrepresentative; an empty intersection is unavailable. Old aggregate series cannot reconstruct missing pixel identities. Select support months with a stated rationale, not by searching for significance.

The conservative primary analysis is unchanged for missing calendars. Optional `gap_sensitivity` fits actual elapsed calendar time and uses Bartlett covariance at actual calendar lags, rather than treating observations separated by gaps as adjacent. Missing observations are not interpolated. This conditional result assumes sufficiently ignorable missingness and does **not** repair QA-dependent selection or changing cover. Its status is `conditional_sensitivity`, never primary trend confirmation; it cannot automatically satisfy detected/not-detected mechanism predicates. Primary results must be reported first. The explicit method and rationale are retained for deterministic reproduction.

Seasons are locally justified rather than Northern-Hemisphere defaults. `season_year_start_month` supports cross-year windows, for example December–February. Every selected month is required; incomplete boundary/interior seasons remain missing. Changing aggregation/support removes inherited sensitivity recipes so ordinary primary analysis is not silently replaced.

Antimeridian-crossing rings require a documented split MultiPolygon; the planar polygon-inclusion recipe does not silently wrap them. Geographic, scientific, credential, source-ownership and cancellation safeguards remain.

## Specialist-led follow-up when evidence is inadequate

After the initial reviews, GAIA checks for inconclusive/descriptive-only primary series, absent numerical evidence and failed acquisitions/reviews. GAIA identifies the material gap and selects a supported, scientifically justified alternative; only the relevant specialists perform its source research and authorized acquisition. GAIA handles essential coordinator-only boundary setup and evaluates what they return. Neither every specialist nor a user-operated provider is required.

This is not a search for statistical significance. A valid `not_detected` result does not by itself trigger recovery. Original artifacts, QA, calendar and findings remain intact. A different index or derived subset does not become independent corroboration, and conditional sensitivity does not override primary uncertainty. There is no fixed retry-count or investigation deadline; equivalent strategies or unchanged numerical evidence stop the loop rather than creating endless duplicate acquisitions. If no defensible supported route remains, the report states that available evidence is inconclusive and identifies the missing observation.

Decisions, selected domains, rationale, outcomes and errors are retained as `evidence_searches` in the evidence tool and JSON export. The deterministic partial-report fallback also includes attempted follow-ups. This feature cannot acquire an arbitrary new provider merely because a paper mentions it: an actual authorized adapter, source access and compatible measurements are still required.

## Verification and current limits

- Existing suite passed: **42 Python and 53 Node tests**, without adding test files. Rune build passed, with framework warnings.
- One-off synthetic checks verified complete-calendar covariance agreement with the existing HAC calculation, missing-calendar preservation, cross-year aggregation, EVI/NDVI float scaling, overlapping QA flags and fixed-subset identity. These are numerical/adapter checks, not ecological validation.
- Fresh public AppEEARS metadata confirmed both vegetation layers and VI Quality available. A fresh nonforest NDVI task for Nairobi National Park, 2001–2002, completed and was collected: NASA task `73dc78cd-4064-46d6-8e7d-4090faa7afb2`, NetCDF SHA-256 `4aa2f3d79877e7969bb1b41a52013bdfad5c7388eff8a6b5c816f9e3940ffe22`. Actual reduction retained 10 valid and 14 missing months, giving an inconclusive primary result. The full-calendar common-pixel intersection was empty and is unavailable, not silently replaced with a different window. The initial local status check failed on an unrecognized provider state; the original NASA task was resumed and collected, without another submission. This short adapter check does not establish a long-term savanna trend or validate the park as a biome-specific mask.
- No additional API credentials are required beyond the existing server-side Earthdata login. New acquisitions remain fresh/no-store; retained artifacts and derived sensitivities are explicitly labeled, not silently reused as fresh provider measurements.
- Global cover masks, universal aquatic/ice/animal/water-quality acquisition, validated disturbance attribution and independent usability/accessibility certification are not delivered by these changes.

Implementation: `app/backend/ecosystems.mjs`, scoped tools/access handlers, `science/appeears.py`, `science/support.py`, `science/gap_trends.py` and `science/aggregation.py`. Ecosystem interpretations, derivation recipes and numerical provenance are included in exports and illustrated reports.
