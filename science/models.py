"""Finite numerical model registry. No model code supplied by an agent is executed."""
from datetime import date
import hashlib
from pathlib import Path
import numpy as np
import statsmodels.api as sm
from scipy.spatial import Delaunay, QhullError
from .trends import digest, monthly_index, finite

REGISTRY = [
    {"id": "seasonal_continuation_v1", "process": "Continuation of fitted seasonal statistical structure", "readiness": "implemented", "causal": False},
    {"id": "response_emulator_v1", "process": "Conditional association with at most two measured covariates", "readiness": "implemented", "causal": False},
    {"id": "water_bucket_v1", "process": "Conservative single-compartment water budget", "readiness": "illustrative_only", "causal": False},
    {"id": "watershed_routing", "readiness": "unavailable", "requires": "Conditioned network/bathymetry, boundary flows, solver and reference observations"},
    {"id": "animal_movement", "readiness": "unavailable", "requires": "Species-specific tracks, observation error, accessibility and validation"},
    {"id": "transmission", "readiness": "unavailable", "requires": "Diagnosed cases, denominators, contacts and validated rates"},
    {"id": "vegetation_competition", "readiness": "unavailable", "requires": "Species/density, resources, process parameters and observed response"}
]


def _rows(acquisition):
    rows = sorted(acquisition["series"], key=lambda row: row["date"])
    if not rows or any(not finite(row.get("value")) for row in rows):
        raise ValueError("Simulation needs a complete valid series; missing observations are not imputed.")
    annual = acquisition.get("frequency") == "annual"
    indices = np.array([date.fromisoformat(row["date"][:10]).year if annual else monthly_index(row["date"]) for row in rows])
    if len(set(indices)) != len(indices) or np.any(np.diff(indices) != 1):
        raise ValueError("Simulation requires consecutive, unique periods.")
    return rows, indices, np.array([float(row["value"]) for row in rows]), annual


def _design(indices, first, annual):
    columns = [np.ones(len(indices)), (indices-first)/(1 if annual else 12)]
    if not annual:
        columns.extend((indices % 12 == month).astype(float) for month in range(1, 12))
    return np.column_stack(columns)


def simulate(request):
    model_id = request.get("model", "seasonal_continuation_v1")
    if model_id == "water_bucket_v1":
        return water_bucket(request)
    if model_id not in ("seasonal_continuation_v1", "response_emulator_v1"):
        raise ValueError("Requested model is not implemented or validated; no unrelated model is substituted.")
    acquisition = request["acquisition"]
    rows, indices, y, annual = _rows(acquisition)
    n = len(y)
    if n < (15 if annual else 180):
        raise ValueError("Record is too short for the registered chronological simulation recipe.")
    horizon = int(request.get("horizon", 2 if annual else 12))
    members = int(request.get("members", 64))
    seed = int(request.get("seed", 20261114))
    if not 1 <= horizon <= (3 if annual else 36) or not 16 <= members <= 128:
        raise ValueError("Simulation horizon or ensemble budget exceeded.")
    split = int(n*.8)
    covariates = request.get("covariates", [])
    if len(covariates) > 2 or (model_id == "response_emulator_v1" and not covariates):
        raise ValueError("Response emulator requires one or two measured compatible covariates.")
    if model_id == "seasonal_continuation_v1" and covariates:
        raise ValueError("Continuation model does not accept additional covariates.")
    x = _design(indices, indices[0], annual)
    cov_values = []
    for cov in covariates:
        other_rows, other_indices, values, other_annual = _rows(cov)
        support = lambda item: {key: item.get("geometry", {}).get(key) for key in ("type", "latitude", "longitude", "siteid")}
        if acquisition.get('geometry',{}).get('type') not in ('model_grid_point','grid_supported_location','fixed_site_footprint'):
            raise ValueError('Response model needs independently specified compatible support; unknown imported locations are not silently matched.')
        if other_annual != annual or not np.array_equal(indices, other_indices) or support(cov) != support(acquisition):
            raise ValueError("Response covariates must have identical periods and defensible physical support.")
        cov_values.append(values)
    means = np.array([values[:split].mean() for values in cov_values])
    scales = np.array([values[:split].std() for values in cov_values])
    if covariates and np.any(scales <= 1e-12):
        raise ValueError("A constant covariate cannot identify a response coefficient.")
    if covariates:
        z = (np.column_stack(cov_values)-means)/scales
        x = np.column_stack([x, z])
    if np.linalg.matrix_rank(x[:split]) < x.shape[1]:
        raise ValueError("Training model is not identifiable.")
    spec = {"model": model_id, "train_count": split, "test_count": n-split, "split": "chronological first 80 percent", "metric": "RMSE", "acceptance": "strictly improve over both seasonal climatology and seasonal persistence", "seed": seed, "members": members, "horizon": horizon, "annual": annual, "block_length": 2 if annual else 12, "covariates": [cov["variable"]["id"] for cov in covariates], "implementation_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    spec_hash = digest(spec)
    fitted = sm.OLS(y[:split], x[:split]).fit()
    predicted = fitted.predict(x[split:])
    seasonal = np.array([y[:split][indices[:split] % 12 == index % 12].mean() for index in indices[split:]]) if not annual else np.full(n-split, y[:split].mean())
    persistence = np.array([y[split-(1 if annual else 12)+offset % (1 if annual else 12)] for offset in range(n-split)])
    metric = lambda values: {"rmse": float(np.sqrt(np.mean((values-y[split:])**2))), "mae": float(np.mean(np.abs(values-y[split:])))}
    performance = {"model": metric(predicted), "seasonal_climatology": metric(seasonal), "seasonal_persistence": metric(persistence)}
    passed = performance["model"]["rmse"] < min(performance["seasonal_climatology"]["rmse"], performance["seasonal_persistence"]["rmse"])
    future_indices = np.arange(indices[-1]+1, indices[-1]+horizon+1)
    future_x = _design(future_indices, indices[0], annual)
    scenario = request.get("scenario", {})
    if covariates:
        future_covs = []
        for cov, values in zip(covariates, cov_values):
            supplied = scenario.get(cov["variable"]["id"])
            if supplied is None:
                supplied = [float(values[:split][indices[:split] % 12 == index % 12].mean()) if not annual else float(values[:split].mean()) for index in future_indices]
            if not isinstance(supplied, list) or len(supplied) != horizon or any(not finite(value) for value in supplied):
                raise ValueError("Scenario needs one finite covariate value per future period.")
            future_covs.append(supplied)
        future_z = (np.column_stack(future_covs)-means)/scales
        training_z = z[:split]
        if len(covariates) == 1:
            admissible = np.all((future_z >= training_z.min(axis=0)) & (future_z <= training_z.max(axis=0)))
        else:
            try:
                admissible = np.all(Delaunay(training_z).find_simplex(future_z) >= 0)
            except QhullError:
                admissible = False
        if not admissible:
            raise ValueError("Scenario lies outside the observed joint training-covariate domain.")
        future_x = np.column_stack([future_x, future_z])
    # Evaluate before refitting on the full observed record for the declared continuation.
    full = sm.OLS(y, x).fit()
    center = full.predict(future_x)
    residuals = np.asarray(fitted.resid)-np.mean(fitted.resid)
    block = spec["block_length"]
    rng = np.random.default_rng(seed)
    ensemble = []
    for _ in range(members):
        sampled = []
        while len(sampled) < horizon:
            start = int(rng.integers(0, len(residuals)-block+1))
            sampled.extend(residuals[start:start+block])
        ensemble.append(center+np.array(sampled[:horizon]))
    low, median, high = np.quantile(np.array(ensemble), [.05, .5, .95], axis=0)
    physical = acquisition["variable"]["id"]
    bounds = {"RH2M": (0,100), "PRECTOTCORR": (0,float("inf")), "EVI": (-.2,1)}.get(physical)
    bounds_pass = bounds is None or all(np.all((values >= bounds[0]) & (values <= bounds[1])) for values in (low, high))
    points = []
    for index, value, lo, hi in zip(future_indices, median, low, high):
        stamp = f"{index}-01-01" if annual else f"{index//12}-{index%12+1:02d}-01"
        points.append({"date": stamp, "value": float(value), "low": float(lo), "high": float(hi)})
    return {"model": model_id, "specification": spec, "specification_hash": spec_hash, "inputs_sha256": digest({"target": rows, "covariates": cov_values and [values.tolist() for values in cov_values], "scenario": scenario}), "readiness": "validated_for_domain" if passed and bounds_pass else "illustrative_only", "validation": {"metrics": performance, "baseline_improvement": bool(passed), "physical_bounds_pass": bool(bounds_pass), "test_start": rows[split]["date"], "test_end": rows[-1]["date"]}, "series": points, "units": acquisition["variable"]["units"], "uncertainty_label": "illustrative block-residual scenario range, not calibrated forecast confidence", "limitations": ["Chronological hindcast tests limited predictive adequacy, not mechanism or intervention effects.", "Coefficient, forcing and structural uncertainty are not fully represented.", "Residual block resampling assumes sufficiently stable residual behavior; it has not been independently calibrated.", "Prediction uses continuation or supplied conditional covariates, not a complete Earth-system forecast."], "sources": ["https://doi.org/10.1080/02626668609491024", "https://doi.org/10.1214/aos/1176347265"]}


def water_bucket(request):
    initial = float(request.get("initial_storage", 0))
    capacity = float(request["capacity"])
    fluxes = request["fluxes"]
    if not np.isfinite(initial) or not np.isfinite(capacity) or initial < 0 or capacity <= 0 or initial > capacity or not 1 <= len(fluxes) <= 366:
        raise ValueError("Invalid bucket capacity, initial storage or step budget.")
    storage = initial
    result = []
    for row in fluxes:
        values = {key: float(row.get(key, 0)) for key in ("precipitation", "inflow", "evapotranspiration", "runoff", "drainage", "withdrawals")}
        if any(not np.isfinite(value) or value < 0 for value in values.values()):
            raise ValueError("Bucket fluxes must be nonnegative finite amounts in compatible mm/step units.")
        net = values["precipitation"]+values["inflow"]-sum(values[key] for key in ("evapotranspiration", "runoff", "drainage", "withdrawals"))
        available = storage+net
        if available < 0:
            raise ValueError("Specified losses exceed available storage; no silent clipping or invented water.")
        overflow = max(0, available-capacity)
        previous = storage
        storage = available-overflow
        residual = storage-previous-net+overflow
        if abs(residual) > 1e-9:
            raise ValueError("Water budget failed conservation tolerance.")
        result.append({"storage": storage, "overflow": overflow, "closure_residual": residual})
    return {"model": "water_bucket_v1", "readiness": "illustrative_only", "series": result, "specification_hash": digest(request), "units": "mm over declared control volume", "limitations": ["Teaching/sensitivity sandbox; no catchment, discharge, local root water or restoration validation.", "All supplied amounts must share the control-volume area and timestep; snowmelt is internal if snow is included."]}
