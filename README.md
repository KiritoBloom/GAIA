# GAIA: Geospatial Analysis & Investigation Assistant

A local planetary-intelligence workspace for NASA-derived Earth-system time series, trend uncertainty and competing explanations. GAIA coordinates; AURA (atmosphere), THALASSA (water), CHLORIS (plants) and ZOE (animals) have distinct, bounded scientific roles. Plain-language and technical views use the same numerical evidence and methods.

Built for NASA Space Apps 2026: [Be An Earth System Trend Detective!](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/).

## What works now

- GAIA-first conversation in the local Rune GPU/browser workspace. A new session opens ready to chat; GAIA owns clarification, location resolution, source/variable selection, analysis and selective specialist dispatch. Evidence, research and audit workspaces remain available, but users do not need to operate specialists or freeze a NASA target to ask a question. Earlier React UI is legacy only.
- User-configured OpenAI-compatible model endpoints and model discovery; masked, session-only credentials. OpenCode **2.3.0** embedded runtime, with actual five-role/tool checks.
- GAIA-owned NASA MODIS acquisition when a plant signal is relevant: GAIA resolves the requested place, selects a live-catalog fixed site only when it is within 50 km, and freezes its exact site/calendar before asking CHLORIS to assess the trend. The fixed footprint is never presented as a regional mean. New provider requests bypass local response caches; acquired records remain saved in the investigation for provenance and later review.
- GAIA can autonomously resolve named places with the public Open-Meteo geocoder and acquire selected NASA POWER monthly temperature, precipitation-rate and relative-humidity for a real geocoder result. POWER returns model-derived grid context at a point, not local station observations or a regional mean. These public endpoints need no additional API key.
- Deterministic seasonal linear regression, Newey–West uncertainty, sensitivity diagnostics, charts and downloadable analysis inputs.
- Licensed CSV imports, separately labeled as user-declared rather than authenticated NASA observations.
- Independent-process numerical reproduction without model credentials or renewed data downloads.
- Registered competing explanations and observation protocols, actual specialist tool traces, chronological-baseline-tested statistical models, bounded contextual comparisons and a staged prediction record with acquisition-denial checks.
- Real Jev typed semantic reviews, held in shadow mode. A small single-author claim-support microcase evaluation is available through `npm run test:jev`; it is not domain validation or proof of routing benefit.

**MODIS verified:** the actual Rune workflow acquired 2001–2025 EVI for the provider-listed Alberta Mixed Grass Prairie footprint, with 25 complete annual growing-season observations. Collection 6.1 was verified against exact NASA CMR granule identifiers; five unverifiable processing revisions were explicitly excluded, not assigned a guessed version. Quality, scaling, actual observation dates and coverage remain inspectable. The resulting trend did not meet the declared significance threshold.

**Not established:** complete plan acceptance, causal attribution, ecological expertise, research-ready forecasts, fully audited locked holdouts or autonomous interventions. Giovanni, CUAHSI, KNMI and AppEEARS provide manual discovery/export routes, not automated adapters. NOAA access returned real station metadata, not a validated station-data trend. Routing, transmission, animal-movement and vegetation-competition models remain explicitly unavailable rather than being replaced with climate models.

## Run locally

Tested development environment: Windows x64, Python 3.13, an existing Node 24+ installation and npm 10+. Setup installs checksum-verified portable Node **26.13.1**, a project-local GNU Rust/WASM toolchain, w64devkit and matching wasm-bindgen. No system PATH/toolchain is changed. This Rune setup script is Windows-specific; other platforms have not been verified. The browser needs WebGPU (verified in Chromium); no WebGL fallback is claimed.

From a terminal:

```powershell
git clone https://github.com/KiritoBloom/GAIA.git
cd GAIA
npm run setup
npm run dev
```

Open **http://127.0.0.1:4317/rune/**. The trusted local backend listens at **127.0.0.1:4317**. Stop the launcher with **Ctrl+C**. The first Rune source build can take several minutes; build logs stay in `.runtime/rune`.

Setup creates `.venv`, `node_modules`, `.cache`, `.tmp` and `.runtime` **inside this directory**. It uses local installation caches, no global npm/pip installs, and disables automatic dependency install scripts. OpenCode configuration, database and runtime state are also isolated inside this project. The initial setup downloads packages and the verified Windows runtime from their official distribution services.

For a built frontend:

```powershell
npm run build
npm start
```

Open **http://127.0.0.1:4317/rune/** in this mode. Do not expose this server publicly: it is a single-user local application, not a hardened multi-user service. `npm run dev:legacy` retains the earlier React development view at 5173; it is not the primary interface.

## Provider onboarding

1. Open **Provider settings**. Numerical acquisition and analysis do not require a model key.
2. Enter an approved OpenAI-compatible endpoint, provider label and masked key. Examples: `https://api.openai.com/v1`, `https://openrouter.ai/api/v1`, or an appropriate loopback model server.
3. Discover the actual model catalog and select a model. Arbitrary protocols are not automatically supported; native Anthropic/OAuth adapters are not implemented in this form.
4. Select **Connect and verify role tools**. Five actual role/tool round trips must pass before conversation is enabled. This uses provider requests and may incur costs. It proves integration, not scientific expertise.
5. Enter the workspace. A session-only key is held by the local backend; it is not saved in browser storage, chat or exports. Restarting the backend clears that selection.

If you deliberately create a private `.env`, onboarding can use its existing configuration without displaying credentials. Optional names are documented in `.env.example`; do not copy someone else's credentials or commit your file. NASA POWER/public metadata need no developer API key. Giovanni uses your Earthdata/GES DISC web authorization, and AppEEARS uses its own authenticated extraction workflow; do not paste Earthdata passwords into GAIA conversation.

Local-first does **not** mean offline: selected providers receive prompts, and NASA services receive region/time requests. Check their privacy policies and costs. Recorded numerical exports can be inspected and reproduced without a model provider.

## First investigation

Start in **Talk to GAIA** and describe the question in ordinary language. Give a place and the change or outcome you want investigated; if the timeframe is material and unclear, GAIA asks one focused follow-up. Otherwise GAIA resolves the place, selects a sensible retrospective period and relevant public data, acquires and analyses it, researches methods/alternative explanations, and assigns only the specialist functions needed. You do not select the roles or pre-acquire observations. The conversation returns the report; evidence, sources, uncertainties and audit details remain inspectable in their workspaces.

GAIA selects only relevant specialist functions and keeps the user-facing conversation with itself. AURA can retrieve POWER weather context; THALASSA supports bounded water methods and compatible gauges; CHLORIS handles MODIS vegetation series and QA when a suitable footprint is available; ZOE handles licensed occurrence context without converting it into abundance or mortality. Some regional ecological outcomes still require a suitable NASA footprint, matched field data, species identification or a source that is not currently automated. GAIA must report those as evidence gaps, not ask the user to configure tools or claim an unavailable observation.

Open **Evidence** and **Investigation record** for readable hypothesis assessments, protocol history, comparisons, source lineage, task status and export. A monthly weather grid and an annual satellite footprint are different supports: GAIA may report them as context, but must not call them a matched ecological test.

The map is a coordinate-support diagram, not a geographic land-cover map. A POWER point represents its reanalysis grid, **not** a local station or arbitrary watershed mean. Monthly precipitation is a mean daily rate in the provider's reported units, not an accumulated monthly total. MODIS greenness is an optical proxy, not yield, infection, species identity or animal abundance.

GAIA's report includes computed numbers and links them to their source records; evidence panels provide the full series and reproduction details. Model interpretation remains separate from measured quantities and never turns association into a verified cause. Plain-language and technical explanations use the same numerical method and certainty standards.

## Verify and reproduce

```powershell
npm test
npm run build
npm run test:runtime
```

The last command uses your private compatible provider configuration and makes real model requests. Synthetic role checks are kept distinct from Earth observations.

Download an investigation JSON from **Evidence**, then run:

```powershell
npm run reproduce -- .\gaia-investigation.json
```

Real, privacy-reviewed NASA examples are available in [`docs/examples/british-columbia.json`](docs/examples/british-columbia.json) and [`docs/examples/modis-prairie.json`](docs/examples/modis-prairie.json). The MODIS example includes accepted collection identities and QA exclusions. Rerun either without provider credentials or new data downloads:

```powershell
npm run reproduce -- docs/examples/british-columbia.json
```

This reruns numerical analyses in a separate project-local Python process, checks input/method hashes and compares results with a declared `1e-10` numerical tolerance. It does not regenerate language-model prose. Review private coordinates and redistribution permissions before publishing an export.

## Scientific boundaries and sources

Default monthly method: linear slope plus calendar-month effects; Bartlett/Newey–West HAC bandwidth 12 months with 6/24-month sensitivity; nominal two-sided alpha 0.05 and 95% interval. These are documented prototype conventions, not universally optimal statistical choices. Missing periods are not compressed or imputed; inadequate, short, constant or diagnostically sensitive records cannot silently receive a definitive significant-trend claim. Twenty years is project policy, not a NASA requirement. Annual recipes use explicit yearly bandwidths.

- [NASA POWER monthly API](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/) and [data sources](https://power.larc.nasa.gov/docs/methodology/data/sources/).
- [ORNL DAAC TESViS](https://modis.ornl.gov/data/modis_webservice.html), DOI [10.3334/ORNLDAAC/1600](https://doi.org/10.3334/ORNLDAAC/1600).
- Newey & West (1987), DOI [10.2307/1913610](https://doi.org/10.2307/1913610); [statsmodels HAC assumptions](https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_hac.html).
- [OpenCode V2 SDK](https://opencode.ai/docs/build/sdk/), [plugins](https://opencode.ai/docs/build/plugins/) and [providers](https://opencode.ai/docs/providers/).

A significant trend does not establish a cause. A nonsignificant trend does not establish no change. Nominal intervals cannot correct product transitions, sampling bias, long memory or unmeasured ecosystem processes.

## Submission and acknowledgements

GitHub distributes source and inspectable evidence; it does not host a running OpenCode/Python backend. The planned English demonstration is at most seven slides, including title/intro. Judge-facing evidence must be accessible without providing credentials or installing a model provider.

Code, interface and original identity work were developed with AI assistance; measured NASA values are acquired from identified providers, not generated by a language model. Original logo assets and their provenance are described in `artifacts/logos/README.md`. Rune, rune-kit, OpenCode theme, OpenCode, React/Vite/TypeScript (legacy UI), NumPy, SciPy, pandas and statsmodels retain their respective licenses. Rune is pinned to Anomaly revision `165f87a4700a5515b03d4de04876aa2e64a30c21`; see [Rune](https://github.com/anomalyco/rune). GAIA is an independent participant project, not NASA-endorsed.
