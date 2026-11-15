# Feature audit — GAIA-led investigations

Verified 15 November 2026. This maps the local `plan.md` feature list to the implemented, mostly hands-free product. **The entire aspirational feature list is not 100% implemented or independently validated.** Working source code, a successful run, a scientific validation and an organizer submission are separate claims.

## Product contract

See [ecosystem-aware investigations](ECOSYSTEM-INVESTIGATIONS.md) for the subsequent all-biome interpretation profiles, EVI/NDVI selection, common-pixel/QA diagnostics, cross-year seasons and explicitly conditional gap sensitivity. These additions do not imply universal biome masks, aquatic/ice adapters or validated ecological attribution.

The user talks only to GAIA. GAIA clarifies material ambiguities, selects relevant specialists, researches and acquires supported data, runs registered numerical methods, follows up internally, and returns an illustrated report. No compulsory agent/product configuration, research-capacity approval, fixed specialist-count limit, report-length ceiling or overall investigation deadline is part of that experience. Network fault containment, scientific eligibility, privacy and explicit user cancellation remain.

## Feature-by-feature status

| Plan area | Delivered behavior / evidence | Remaining boundary |
|---|---|---|
| 0–2: adaptive user journey and NASA trend challenge | Chat-first intake, optional clarification, conversational report depth, GAIA-selected variables, owned places/polygons, actual time series, uncertainty, charts and reports. Real BC, Nairobi and Chennai runs completed. | Not every Earth-system variable or geographical question has an integrated numerical provider. Unsupported questions must produce useful gaps, not fabricated measurements. |
| 3: coordinator and specialist execution | Application-managed OpenCode GAIA/AURA/THALASSA/CHLORIS/ZOE sessions, immutable role/scope bindings, concurrent selected work, scoped peer requests, retained events and cancellation. | This is not native child-agent spawning. External provider availability is outside GAIA's control. |
| 4: adaptive investigation lifecycle | Literature search/read, actual source ownership, hypotheses, diagnostics, reviews, optional protocols, evidence snapshots and synthesis; partial-evidence fallback on failure. | Optional stages are not a mandatory nine-step user checklist. A protocol omitted by GAIA is now `not_requested`, not silently fabricated. |
| 5: four domain procedures | Versioned skills, documented producer excerpts, registered diagnostics, role-bound evidence, exact quotations and explicit domain gaps. | Small internal competence cases do not establish professional/ecological expertise. Animal occurrences are not mortality/abundance; optical greenness is not a diagnosis. |
| 6: live NASA/model acquisition | Fresh POWER T2M/PRECTOTCORR/RH2M; exact-site MOD13Q1; authenticated AppEEARS MOD13A3.061 EVI/QA polygon extraction, task resume, checksums and NetCDF reduction; owned boundary sources. | POWER is point/grid context. Regional EVI is landscape, not forest-only. NOAA currently supplies station metadata; Giovanni/CUAHSI/KNMI are documented manual/import routes, not working numerical adapters. |
| 7: statistical change | Seasonal OLS, calendar-month effects, Bartlett/Newey–West uncertainty, bandwidth/endpoint sensitivity, units, actual elapsed time, missing/short/constant-series handling. Existing Python regression checks pass. | Incomplete calendars do not receive unsupported HAC significance. Association never establishes causation. |
| 8.1–8.2: simulation families and readiness | Registered continuation/response emulator, chronological baselines/domain checks, illustrative water bucket, explicit per-model readiness and conservation checks. | Routing, movement, transmission, competition and demography are unavailable registry entries with prerequisites—not implemented scientific solvers. |
| 8.3–8.4: observations and signature tests | Registered and source-backed custom protocols, contrasting outcomes, approved predicates, selection snapshots, actual added-evidence reassessment. | No validated general information-gain/T-optimal observation optimizer. Unmeasured signatures remain untested. |
| 8.5–8.6: reference comparisons/counterexamples | Frozen local comparison pool, baseline/support matching, analyzed differences, multiplicity/selection/shared-source caveats. | Contextual comparisons are not causal controls or a global autonomous counterexample search. |
| 8.7: prediction and reveal | Persistent commitments, target reservation/denial, immutable forecasts, staged reveal and frozen training-only evaluation baselines; existing integrity checks pass. | A fully blinded/locked replay claim is withheld without complete acquisition/access proof. No universal prospective forecast calibration. |
| 8.8–8.9 and 11: records/portfolios/publication | Owned manifests, hashes, mechanism graph, separate readiness states, disagreements, provisional notebooks, signatures, scenarios and reproducible exports. | Proposed edges/model ideas are not validated causal mechanisms or executable newly invented solvers. Not a populated global scientific knowledge base. |
| 9: worked ecological cases | Adaptable intake and selective relevant evidence. BC is a real regional example; Nairobi/Chennai demonstrate different locations/variables. | Every farmer/animal/invasive-species/beaver scenario is not an independently validated end-to-end scientific case. |
| 10: Jev | Typed semantic API and retained shadow evaluations; numerical truth and permissions remain deterministic. | Operational benefit is not established. Shadow scores do not select diagnoses or override measurements. |
| 12: tools and layout | Actual tools live in `app/backend/runtime.mjs`, access handlers in `server.mjs`, science worker operations in `science/worker.py`. | The plan's conceptual tool names are not a promise that every proposed command is registered. |
| 13: interface and recovery | Responsive Rune field desk, conversation-first navigation, progress/task states, dataset selection, numerical charts, narrative, HTML/print-to-PDF and JSON exports, retained sessions/drafts, explicit stop/resume. Browser rendering and real report download exercised. | No complete keyboard/screen-reader/accessibility certification or independent usability study. Secondary manual evidence controls remain optional. |
| 14: credentials/privacy | Ignored `.env`, server-side provider secrets, ephemeral AppEEARS login tokens, local origin/role checks, sanitized errors and private draft handoffs. | Local single-user workspace, not a hardened public multi-user hosting platform. Recipient consent is required; no automatic handoff transmission. |
| 15–16: verification/submission | Existing suite: **42 Python + 53 Node tests passed**, without adding new tests. BC's eight numerical artifacts reproduce independently at `1e-10`; Nairobi/Chennai also reproduced. Source-backed seven-slide deck and companion records. | Build/test success is not universal scientific validation. Public release verification and organizer submission must be checked separately. |
| 17–19: skills, sources and scientific limits | Six versioned skill packs, source register, documented uncertainty/dependence and unavailable capabilities. | A citation/source-family listing is not proof of a live adapter, expert acceptance or a validated solver. |

## Ecosystem-aware follow-up

The additional implementation described in [Ecosystem-aware investigations](ECOSYSTEM-INVESTIGATIONS.md) supports EVI/NDVI selection, ecosystem interpretation profiles, explicit common-pixel and conditional missingness sensitivities, and cross-year seasons. Inadequate evidence can trigger GAIA to select and brief relevant specialists for a defensible source follow-up before synthesis. Decisions and unsuccessful routes remain recorded; repeated inputs do not count as new evidence and a valid null trend is not a reason to hunt for significance. This does not supply universal biome masks or arbitrary aquatic/ice/animal measurement adapters.

## BC demonstration: what actually completed

Selected boundary: the official **Central Interior ecoprovince**, not every meaning of “Interior Plateau.” Original NASA task `f26efd05-28ef-48b7-a750-23f3e9b3bafc` completed and was collected without duplicate submission. NetCDF SHA-256: `98e7f0cbee3950f267fceeb9fffa12d2d010658f7063ef32895c93aa6aadb671`.

- **Monthly EVI, 2001–2024:** 101 valid / 187 missing months after the 80% QA-valid-area rule. Inconclusive; no estimable slope, interval or p-value.
- **Exploratory July–September EVI:** 21 complete / 3 missing seasons. Descriptive slope **+0.006126 EVI/decade**; no inferential interval or p-value because the calendar has gaps. No gap interpolation or significance-selected window.
- **Climate context:** three fresh monthly POWER series and three seasonal derivatives. Seasonal temperature increased; that does not establish forest decline or its cause. No forest mask, stable-pixel sensitivity or spatially matched disturbance-attribution model was supplied.

The honest answer is **not “forest decline proved,” “no ecological damage,” or “forest recovery proved.”** It is a completed regional acquisition/report with unresolved forest-specific inference and concrete distinguishing observations.

## Reproduce the published evidence

```powershell
npm run setup
npm run reproduce -- docs/submission/bc-central-interior-investigation.json.gz
```

The gzip file losslessly packages retained provenance and numerical inputs, not a provider-response cache used for new acquisitions. `scripts/reproduce.mjs` accepts ordinary JSON and gzip JSON. It verifies artifact manifests and reruns all numerical analyses without provider/network access. The archived report redacts internal runtime role-session identifiers; artifact contents and hashes are unchanged.
