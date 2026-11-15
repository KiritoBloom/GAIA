# British Columbia Central Interior greenness, 2001–2024

## Executive conclusion

**The acquired evidence does not establish a sustained decline in forest greenness during 2001–2024.** It also does not establish that forests were stable or recovering ecologically.

The regional satellite quantity is **landscape Enhanced Vegetation Index (EVI)** within the official BC Central Interior ecoprovince—not forest-only greenness. A compatible forest mask was not applied. The fixed July–September landscape series has a positive descriptive slope of **+0.00061264 EVI/year**, equivalent to **+0.0061264 EVI/decade**, but three missing seasons prevent confidence intervals and p-values under the registered procedure. This is not statistically established greening. The all-calendar monthly EVI analysis is inconclusive because 187 of 288 months fail the coverage requirement.

Fresh NASA POWER context at live-geocoded Williams Lake indicates **July–September warming of +0.062772 °C/year**, with nominal 95% confidence interval **[+0.004995, +0.120550] °C/year**, p=**0.033221**. Declining precipitation or relative humidity is not detected. These are point-grid climate estimates, not regional climate means, and do not attribute the EVI trajectory to climate.

Completed CHLORIS and AURA reviews agree that disturbance, beetle legacies, regeneration, management and changing observation support remain competing explanations. Their contributions to this regional series have not been quantified.

## 1. Study boundary, evidence classes and provenance

The explicitly chosen boundary is the **official BC CENTRAL INTERIOR ecoprovince**, owned region **1baf3cbf-b520-4438-ad95-bb27f03c7a36**. It is a defensible demonstration boundary, **not every geographical or ecological meaning of Interior Plateau**.

Boundary source: https://delivery.maps.gov.bc.ca/arcgis/rest/services/mpcm/bcgwpub/MapServer/85/query?where=UPPER%28ECOPROVINCE_NAME%29+%3D+%27CENTRAL+INTERIOR%27&outFields=ECOPROVINCE_NAME&f=geojson&outSR=4326&returnGeometry=true

Boundary SHA-256: c09a1c4de56e4ff61fb521d7ee40b6680face75952ab51cc15bd6263a4b07ab2. The polygon bounding-box centre, 52.935596° N, 124.042230° W, is a geometric reference—not an atmospheric polygon mean.

Williams Lake was resolved through live Open-Meteo geocoding to **52.14153° N, 122.14451° W**. Its NASA POWER values represent approximately **0.5° latitude × 0.625° longitude MERRA-2 grid support**. They are neither Williams Lake station observations nor ecoprovince averages. Geocoder documentation: https://open-meteo.com/en/docs/geocoding-api

The evidence classes must remain distinct:
- **Satellite optical proxy:** MODIS EVI reflects vegetation spectral properties; it does not directly measure tree deaths, biomass, species composition or restoration success.
- **Model/grid context:** POWER supplies reanalysis-derived near-surface meteorology.
- **Published studies:** provide observations and mechanism evidence from their own sites, not measurements of this entire polygon.
- **User question:** asks whether decline occurred; it does not itself document a measured decline.

The existing AppEEARS extraction **85f55057-fded-46c9-ba33-cb7a29f0530f**, NASA task **f26efd05-28ef-48b7-a750-23f3e9b3bafc**, was resumed after interruption and is now **collected**. No duplicate extraction was submitted. Its retained abortion message describes the earlier interruption, not a current pending task or failed final acquisition.

Product: **MOD13A3.061**, monthly nominal 1-km EVI and VI Quality. File: MOD13A3.061_1km_aid0001.nc, **115,071,107 bytes**, downloaded 15 November 2026. File SHA-256: **98e7f0cbee3950f267fceeb9fffa12d2d010658f7063ef32895c93aa6aadb671**.

Extraction provenance: https://appeears.earthdatacloud.nasa.gov/api/bundle/f26efd05-28ef-48b7-a750-23f3e9b3bafc
Product metadata: https://appeears.earthdatacloud.nasa.gov/api/product/MOD13A3.061

The three fresh POWER acquisitions were retrieved on 15 November 2026 using API **v2.10.0**, with raw-response checksums, source metadata and fill value **−999** retained. No acquisition or literature search was repeated for this final report.

## 2. Numerical findings

All confidence intervals below are **nominal 95% intervals for slopes per year**, not per decade. RH slope units are **percentage points**, not relative percent change. Precipitation slope units describe changes in **mean daily precipitation rate**, not accumulated rainfall.

| Quantity and temporal support | Valid / missing | Slope per year | Slope per decade | 95% CI, per year | p-value | Registered result |
|---|---:|---:|---:|---|---:|---|
| Landscape EVI, all months, Jan 2001–Dec 2024 | 101 / 187 months | Unavailable | Unavailable | Unavailable | Unavailable | Inconclusive |
| Landscape EVI, July–September, 2001–2024 | 21 / 3 seasons | +0.00061264 index/year | +0.0061264 index/decade | Unavailable | Unavailable | Descriptive only |
| T2M, all months, Jan 2001–Dec 2024 | 288 / 0 months | +0.019442 °C/year | +0.194424 °C/decade | [−0.019716, +0.058601] | 0.330492 | Not detected |
| PRECTOTCORR, all months | 288 / 0 months | +0.012162 (mm/day)/year | +0.121623 (mm/day)/decade | [−0.001790, +0.026114] | 0.087531 | Not detected |
| RH2M, all months | 288 / 0 months | +0.095052 points/year | +0.950518 points/decade | [−0.047962, +0.238065] | 0.192691 | Not detected |
| T2M, July–September, 2001–2024 | 24 / 0 seasons | +0.062772 °C/year | +0.627722 °C/decade | [+0.004995, +0.120550] | 0.033221 | Detected |
| PRECTOTCORR, July–September | 24 / 0 seasons | +0.003123 (mm/day)/year | +0.031233 (mm/day)/decade | [−0.018223, +0.024470] | 0.774285 | Not detected |
| RH2M, July–September | 24 / 0 seasons | +0.124822 points/year | +1.248221 points/decade | [−0.108246, +0.357891] | 0.293866 | Not detected |

### Artifact and figure references

The evidence panel and illustrated export render the real dated series and available fitted trends. Use these figures together with their actual temporal support:

- **Monthly landscape EVI:** artifact/figure **49c21a7b-eaf3-40b7-991b-823d64749803**. Missing months break the series; no supported monthly trend estimate exists.
- **Annual July–September landscape EVI:** **49fc7e72-acc7-467e-b205-2c1de1749768**. Its fitted line is descriptive, with missing seasons retained and no supported confidence band.
- **Monthly T2M:** **e381ac0d-4a0c-4782-a0f1-931822fa38e5**; annual seasonal derivative: **4fa3a12b-5108-42ca-9a72-aee16b06ffd3**.
- **Monthly PRECTOTCORR:** **7bf0744c-0e5b-4330-9176-b5258b021373**; annual seasonal derivative: **1d23e5a3-86c1-44ea-9c07-6b246e8ea3a4**.
- **Monthly RH2M:** **bb628518-0f15-4675-9695-16b17c3b6f2a**; annual seasonal derivative: **64b97edf-bda2-42b9-a8c6-6d54e94e52ce**.

The annual dates label the year of the July–September aggregate; they do not represent January environmental conditions. A linear fit summarizes the series, not every disturbance episode or recovery interval.

## 3. EVI method, QA and missingness

### Spatial and product method

The registered extraction recipe **appeears_mod13a3_polygon_v1** applies scale factor **0.0001**, excludes fill and invalid raw values, and computes spherical cell-area-weighted means of accepted pixel centres inside the source polygon, excluding holes. Partially intersecting boundary cells are not clipped exactly. Nominal 1-km pixels can mix canopy, understory and nonforest cover.

Acceptance requires:
- MODLAND quality **0**;
- VI usefulness **≤4**;
- aerosol not high;
- no flagged adjacent/mixed cloud, snow or shadow;
- valid raw values;
- **at least 80% valid polygon area**.

The inspected NASA MOD13 Collection 6.1 user guide, source **cf05bfa0-7466-43bb-884f-beb972c3151b**, describes MOD13A3 as temporal-overlap-weighted compositing of overlapping 16-day 1-km inputs. It states: **“the pixel with the lowest quality determines the final pixel QA.”** MOD13A3 lacks an individual composite-day-of-year layer. The 16-day MOD13Q1 description is therefore not substituted for the actual monthly regional product method.

Retrieved guide: https://www.earthdata.nasa.gov/s3fs-public/2025-04/MOD13_User_Guide_V61.pdf?VersionId=j5CPB3hnoqeE6kYG23_dYWHBwy1vpNkq
Product catalog: https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13a3-061

### Seasonal choice and completeness

The registered aggregate_season tool used **July–September**, chosen independently of fitted significance to represent established summer foliage through early autumn while avoiding spring snowmelt/green-up and late-autumn/winter snow and low illumination. This is not the complete growing season and excludes antecedent spring conditions and June events.

The annual value is a **calendar-day-weighted mean**, requiring all three monthly values. Missing seasons are **2011, 2018 and 2021**. Coverage is **0.875**, or 21 of 24 seasons. Missing values were neither interpolated nor replaced with other months.

The completed CHLORIS bounded QA diagnostic **0a90f3b9-a3c5-4236-a880-d4f372deba32** identifies actual coverage failures:
- July 2011: valid-area fraction **0.589139**, below 0.8;
- August 2018: **0.650187**;
- July 2021: **0.768161**;
- September 2021: **0.796181**.

August 2017 was accepted at **0.800230**, barely above threshold. These are observations of retrieval support—not vegetation absence. Without reason-specific QA counts, the failures cannot be attributed specifically to snow, smoke or cloud. Area fractions also do not establish stable pixel identity or representative coverage of all vegetation classes.

### What the seasonal slope means

The seasonal fit preserves actual calendar years and gives **+0.000612637543 EVI/year**. The registered annual procedure returns **descriptive_only** because the years are not contiguous. It supplies **no confidence interval or p-value**; ordinary HAC inference that compresses these gaps is not permitted. The residual standard deviation, **0.00952559 EVI**, is a model residual spread, not a confidence interval or measurement-error estimate. No EVI trend-sensitivity analysis was returned.

Annual-value diagnostic **776d374b-e7c4-4179-a347-f3013167261e** and the aggregate show:
- 2001: **0.302213677**;
- 2007: **0.276300301**;
- 2020: **0.315633565**;
- 2024: **0.294820005**.

Thus the series is nonmonotonic, and 2024 is lower than 2001 despite the positive fitted slope. An endpoint comparison is not the same estimator as a whole-window trend. Neither establishes a forest-specific trend without forest support and defensible uncertainty.

## 4. Climate methods and actual sensitivity

### Regression specifications

The monthly climate analyses use **seasonal_ols_hac_v1**: OLS with fixed calendar-month effects, Bartlett HAC covariance, **12-month bandwidth**, small-sample correction and asymptotic-normal inference. All three contain 288 contiguous observations.

The annual July–September analyses use **annual_ols_hac_v1**: OLS on complete calendar-day-weighted seasonal means, Bartlett HAC covariance with **two-year bandwidth**, small-sample correction and asymptotic-normal inference. All contain 24 complete seasons.

These intervals address the specified regression uncertainty; they do not encompass every terrain, reanalysis, calibration, structural-change or representativeness error. Several related tests are reported without multiple-testing adjustment. p-values are not probabilities that a causal explanation is true.

### Temperature

Monthly T2M is near-surface air temperature at two metres, not land-surface skin temperature. Its whole-calendar trend is not detected. At HAC bandwidths 6 and 24 months, respectively, p-values are **0.292171** and **0.390684**, with intervals **[−0.016733, +0.055618]** and **[−0.024951, +0.063836] °C/year**. Trimming two years at each endpoint changes its descriptive slope to **−0.015171 °C/year**. A strong whole-calendar warming claim is therefore unwarranted for this record.

The seasonal temperature estimate is positive and nominally detected. Bandwidths 1 and 3 years give p=**0.029425** and **0.036109**, with intervals **[+0.006277, +0.119267]** and **[+0.004066, +0.121479] °C/year**. Its descriptive Theil–Sen slope is **+0.056485 °C/year**; two-year endpoint trimming gives **+0.038183 °C/year**. The direction is consistent across these reported checks, while magnitude is endpoint-sensitive. Seasonal and whole-calendar estimates answer different questions.

### Precipitation rate

PRECTOTCORR is corrected precipitation expressed as a monthly mean daily rate, **mm/day**. It is not accumulated rainfall, exclusively liquid rain, river flow or plant-available water.

Monthly bandwidths 6 and 24 give p=**0.089146** and **0.085146**, with intervals **[−0.001861, +0.026185]** and **[−0.001684, +0.026009] (mm/day)/year**. Endpoint-trim slope: **+0.013816 (mm/day)/year**.

Seasonal bandwidths 1 and 3 give p=**0.814907** and **0.737572**, with intervals **[−0.023026, +0.029273]** and **[−0.015146, +0.021393] (mm/day)/year**. Descriptive Theil–Sen slope: **+0.000860**; endpoint-trim slope: **+0.006359 (mm/day)/year**. None supports a declining long-term precipitation-rate signature at this grid. This does not exclude drought episodes, prolonged dry spells or changed snow storage.

### Relative humidity

Monthly RH exhibits pronounced residual dependence: lag-1 correlation **0.478355**, Ljung–Box p=**5.630473×10⁻¹⁶**. HAC does not remove every dependence problem. Monthly bandwidths 6 and 24 give p=**0.131552** and **0.223094**, with intervals **[−0.028487, +0.218591]** and **[−0.057859, +0.247963] percentage points/year**. Endpoint-trim slope: **+0.185458 points/year**.

Seasonal bandwidths 1 and 3 give p=**0.344046** and **0.278525**, with intervals **[−0.133735, +0.383379]** and **[−0.100942, +0.350586] points/year**. Descriptive Theil–Sen slope: **+0.086252**; endpoint-trim slope: **+0.284841 points/year**. A declining RH trend is not detected.

### Atmospheric-demand diagnostic

Completed AURA diagnostic **0dfa1f75-3d53-41ec-9c31-d387be182789** uses paired monthly T2M and RH to produce **288 valid VPD approximations**, zero missing, ranging from **0.000745 to 1.043608 kPa**. It returns **no VPD trend, confidence interval or p-value**.

VPD calculated from monthly means is not mean hourly/daytime VPD because of nonlinear temperature dependence. It cannot establish heat-wave exposure, actual evaporation or diagnosed plant stress. Warming can increase saturation vapour pressure, while humidity changes can modify the deficit; the net demand trend remains unresolved. Radiation, wind and water availability also matter. Relevant reviewed mechanism source: https://www.fao.org/4/x0490e/x0490e07.htm

## 5. Completed specialist findings and competing explanations

**CHLORIS**, completed thread **[internal role-session ID redacted]**, verified the regional product identity, QA support failures, missing annual seasons and descriptive-only inference. It concluded that landscape EVI cannot establish declining forest greenness or tree mortality. Its principal distinguishing test is forest-masked, support-stable optical analysis validated against structure and composition.

**AURA**, completed thread **[internal role-session ID redacted]**, verified POWER support, seasonal versus whole-calendar differences, residual dependence and the bounded VPD calculation. It found partial thermal context for heat demand but no established VPD or precipitation-shortage trend and no climate attribution.

These are executed source-backed reviews—not independent professional certification. They examine shared artifacts and therefore are not two independent observational confirmations. No specialist role failed.

### Fire and beetle legacies: plausible mechanisms, unmeasured regional contributions

Talucci, Meigs, Knudby and Krawchuk (2022), source **586d3a5e-c9e1-41ef-8b68-c6f7236eb185**, studied three central-interior fires in **2012–2014**, using Landsat indices, high-resolution imagery, field observations and boosted regression trees. Their conclusion includes: **“While fire weather was a primary driver in most cases, prefire vegetation was an influential predictor variable across all burning conditions.”**

The study distinguishes peak beetle damage from the later mixture of live and dead vegetation before fire and reports nonlinear associations. This supports considering interacting disturbance legacies rather than a simple rule that increasing beetle damage necessarily increases subsequent fire severity.

Contrary evidence is explicit: the paper discusses other-region studies with inconsistent post-outbreak fire likelihood and limited outbreak effects. Those studies were examined through Talucci's discussion, not independently retrieved. The selected park fires, mostly under modified-response management, are not a representative ecoprovince-wide 2001–2024 attribution sample.

Retrieved source: https://iopscience.iop.org/article/10.1088/1748-9326/aca2c1
DOI: https://doi.org/10.1088/1748-9326/aca2c1

Fire and beetles could cause substantial local canopy losses while regrowth or unaffected areas offset their landscape-average optical signal. However, no owned footprint-matched burn-severity or insect-damage series measures their contribution here. EVI does not identify a pest or establish damage causation.

### Recovery, vegetation composition and management

Smith-Tripp et al. (2024), source **827dbedb-3ea1-4a22-9c9b-07c29d4d8bfc**, linked Landsat spectral recovery following **2006 central-BC fires** to field plots and RPA lidar. The retrieved abstract/excerpt reports different recovery trajectories associated with forest structure and composition. It states: **“Satellite imagery can detect burn patterns, but monitoring changes in forest structure post fire is challenging due to complex vegetation responses.”**

Source: https://doi.org/10.1016/j.isprsjprs.2024.01.008

This supports distinguishing conifer regeneration, deciduous vegetation and low-stature regrowth from mature-canopy recovery. Greener understory or young vegetation can coexist with depleted live-tree canopy or carbon stocks. The study does not independently verify this polygon trend.

Harvest, salvage, planting, stand development and understory release remain plausible management/succession alternatives, but no dated management record was quantified. They are untested explanations, not established causes.

### Greenness is not evapotranspiration

AURA inspected Hao et al. (2024), source **bfd243d2-4e1c-494f-babc-55f71c111ed7**, concerning **2007–2016** observations at Kennedy Siding, a different northern-interior stand. The study combined eddy covariance, remote sensing and modeled flux partitioning. It reports that EVI lagged transpiration and overstory mortality and was a poor predictor of annual evapotranspiration and its partitioning.

Source: https://www.frontiersin.org/journals/forests-and-global-change/articles/10.3389/ffgc.2024.1352853/full

Its EVI was gap-filled, unlike this investigation's gap-preserving series; flux partitioning was modeled, and pre-disturbance fluxes were unavailable. This is evidence against equating greenness with water flux—not a regional causal test.

### Rainfall shortage and heat demand

The acquired precipitation point estimates are positive, with intervals containing zero. This weighs against a simple persistent precipitation-rate-decline explanation at Williams Lake. It does not exclude root-water deficits, precipitation-phase changes, antecedent drought or dry-spell timing elsewhere in the polygon.

Summer warming supplies relevant thermal context, but the registered heat-demand assessment remains unresolved: actual daytime VPD, spatially representative forcing and a compatible biological response are absent. No climate–EVI association model was fitted, much less causal attribution.

### Observation-system or sampling change

Actual accepted-area variation makes observation change a material alternative. Changing pixel identity, snow/phenology, aerosol, illumination and retrieval conditions could influence regional means. Yet varying coverage alone does not prove an observational artifact. Common-pixel and vegetation-class-specific comparisons, rejection-reason counts and acquisition geometry were not available. One collection designation does not demonstrate stable sampling or calibration throughout the record.

## 6. Dependencies, unavailable evidence and operational limits

- Seasonal aggregates and bounded diagnostics derive from their parent series; they are **not independent corroboration**. All three climate variables share POWER/MERRA-2 lineage. Published Landsat studies have their own observational support and cannot be pooled as equivalent regional EVI records.
- No baseline forest mask, time-varying forest-cover layer, common-pixel sensitivity, forest-type stratification or repeat local structure/composition observations were acquired. A current-only forest mask could exclude areas that lost forest and bias the requested retrospective trend.
- No owned dated burn-severity, confirmed insect-damage or harvest/salvage/planting records establish regional attribution. The registered burn protocol is a proposed next observation, not a completed test. Burned area is not burn severity.
- Hourly representative meteorology, radiation, wind, precipitation phase, snowpack and root-zone moisture are absent. Monthly point-grid weather cannot resolve extreme exposures or timing relative to canopy injury.
- EVI missingness may be nonrandom. Neither 187 missing months nor three missing seasons should be interpreted as no change, zero greenness or no disturbance.
- The linear models do not quantify nonlinear disturbance losses, changepoints, spatial cancellation or long-memory dependence. No novel ecological solver or validated scenario simulation was executed.
- GAIA's direct greenness diagnostic attempt was authorization-denied; CHLORIS subsequently completed the relevant bounded diagnostics. This was not a failed EVI acquisition. AURA's research-note retention attempts failed; its completed review remains available. GAIA note **9c72a17e-9e5b-4b10-b734-850e647f62c9** and CHLORIS note **ef726f67-2ae6-47d8-a4e4-69d8f27d22c3** were successfully retained as provisional source-grounded findings, not new observations or external certification.

## 7. Observations that would change the assessment

1. **A negative, support-stable baseline-forest trajectory with defensible gap-aware uncertainty** would change the present conclusion that forest decline is unestablished. Retain initially forested land even after canopy loss, and validate classifications and QA.
2. **Falling live-tree cover or canopy height alongside rising low-stature vegetation** would show that positive landscape EVI conceals forest structural decline. Repeat field plots or lidar should record live/dead trees, height and species composition.
3. **Disappearance or reversal of the EVI slope under common-pixel support** would strengthen a sampling explanation. Persistence across stable support, forest types and independently processed optical records would weaken that explanation.
4. **Spatially and temporally matched canopy loss following measured burn severity, confirmed insect injury or documented harvest**, relative to comparable unaffected stands, would strengthen the corresponding disturbance explanation. Similar changes in references would weaken a disturbance-specific account.
5. **Increasing independently measured daytime VPD preceding a forest-specific response**, with water supply and disturbance histories accounted for, would strengthen heat demand. Declining representative growing-season precipitation, longer dry spells or measured snow/root-water deficits would strengthen water-shortage mechanisms.

These tests are not executed attribution. The central result remains: **the current landscape proxy does not support a statistically established forest-greenness decline, while local forest damage and ecological change remain entirely possible.**

## 8. Numerical source URLs and statistical references

POWER T2M acquisition: https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M&community=AG&latitude=52.14153&longitude=-122.14451&start=2001&end=2024&format=JSON

POWER PRECTOTCORR acquisition: https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=PRECTOTCORR&community=AG&latitude=52.14153&longitude=-122.14451&start=2001&end=2024&format=JSON

POWER RH2M acquisition: https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=RH2M&community=AG&latitude=52.14153&longitude=-122.14451&start=2001&end=2024&format=JSON

Reviewed POWER producer documentation: https://power.larc.nasa.gov/docs/services/api/temporal/monthly/
Source-method documentation: https://power.larc.nasa.gov/docs/methodology/data/sources/

Registered HAC references: https://doi.org/10.2307/1913610 and https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_hac.html

Only inspected sources and completed reviews support the interpretations above; additional search-discovered papers were not treated as verified findings.

The highest-value next step is a baseline-forest-mask, fixed-spatial-support analysis validated against repeat canopy structure and dated fire, insect and management records.
