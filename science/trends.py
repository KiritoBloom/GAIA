"""Seasonal linear trends with explicit, dependence-aware inference.

Newey & West (1987), DOI 10.2307/1913610. HAC requires consecutive,
equally spaced observations; missing months are NEVER silently compressed.
"""
from __future__ import annotations
import hashlib
import json
import math
import warnings
from datetime import date
import numpy as np
import statsmodels.api as sm
from scipy.stats import theilslopes
from statsmodels.stats.diagnostic import acorr_ljungbox


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def monthly_index(text):
    day = date.fromisoformat(text[:10])
    return day.year * 12 + day.month - 1


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def analyze(series, *, frequency="monthly", bandwidth=12, min_years=20, alpha=0.05):
    if frequency not in ("monthly", "annual"):
        raise ValueError("Only registered monthly and annual trend recipes are supported.")
    if not series or len(series) > 6000:
        raise ValueError("Supply between 1 and 6000 observations.")
    if not 0 < alpha < 1 or not 1 <= bandwidth <= 48 or min_years < 10:
        raise ValueError("Unsupported inference settings.")
    # Canonicalize JSON's single numeric type before hashing. A browser/export
    # may serialize Python 0.0 as 0 without changing the physical value.
    entries = [{**row, "value": float(row["value"]) if finite(row.get("value")) else None} for row in sorted(series, key=lambda row: row["date"])]
    keys = [monthly_index(row["date"]) if frequency == "monthly" else date.fromisoformat(row["date"]).year for row in entries]
    if len(set(keys)) != len(keys):
        raise ValueError("Duplicate periods must be resolved in acquisition, not silently averaged here.")
    intervals = 12 if frequency == "monthly" else 1
    observed = [(key, row) for key, row in zip(keys, entries) if finite(row.get("value"))]
    specification = {"method": "seasonal_ols_hac_v1" if frequency == "monthly" else "annual_ols_hac_v1", "frequency": frequency, "alpha": alpha, "bandwidth": bandwidth, "kernel": "bartlett", "small_sample_correction": True, "inference_distribution": "asymptotic_normal", "minimum_years": min_years, "missingness_rule": "full_requested_period_must_be_contiguous_no_imputation", "seasonality": "fixed_calendar_month_effects" if frequency == "monthly" else "predeclared_annual_aggregate"}
    result = {"specification": specification, "specification_hash": digest(specification), "inputs_sha256": digest(entries), "n": len(observed), "missing": keys[-1] - keys[0] + 1 - len(observed), "requested_start": entries[0]["date"], "requested_end": entries[-1]["date"], "status": "inconclusive", "slope_per_year": None, "slope_per_decade": None, "interval": None, "p_value": None, "diagnostics": {}, "sensitivity": [], "series": entries, "fitted": [], "anomalies": [], "limitations": ["A trend does not establish its cause.", "Confidence intervals and significance are nominal and assumption-dependent; they are not causal probabilities."], "sources": ["https://doi.org/10.2307/1913610", "https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_hac.html"]}
    if len(observed) < 3:
        result["limitations"].append("Too few valid observations to estimate a trend.")
        return result
    x = np.array([(key - keys[0]) / intervals for key, _ in observed], dtype=float)
    y = np.array([row["value"] for _, row in observed], dtype=float)
    columns = [np.ones(len(y)), x]
    if frequency == "monthly":
        columns.extend(np.array([1.0 if key % 12 == month else 0.0 for key, _ in observed]) for month in range(1, 12))
    design = np.column_stack(columns)
    if len(y) <= design.shape[1] or np.linalg.matrix_rank(design) < design.shape[1]:
        result["limitations"].append("Insufficient observations or seasonal coverage for the registered model.")
        return result
    fit = sm.OLS(y, design).fit()
    slope = float(fit.params[1])
    result.update(slope_per_year=slope, slope_per_decade=slope * 10, fitted=[{"date": row["date"], "value": float(value)} for (_, row), value in zip(observed, fit.fittedvalues)])
    season = design @ fit.params - fit.params[0] - fit.params[1] * x
    result["anomalies"] = [{"date": row["date"], "value": float(value - seasonal)} for (_, row), value, seasonal in zip(observed, y, season)]
    years = (keys[-1] - keys[0] + 1) / intervals
    result["years"] = years
    contiguous = len(observed) == keys[-1] - keys[0] + 1
    result["diagnostics"].update(contiguous=contiguous, rank=int(np.linalg.matrix_rank(design)), residual_std=float(np.std(fit.resid)), coverage=len(observed) / (keys[-1] - keys[0] + 1))
    if not contiguous:
        result["limitations"].append("Missing periods: descriptive slope only. Ordinary HAC would compress time and give unsupported significance.")
        result["status"] = "descriptive_only"
        return result
    if years < min_years:
        result["limitations"].append(f"Record has {years:.1f} years, below the predeclared {min_years}-year product policy. Descriptive output, not a long-term inference.")
        result["status"] = "descriptive_only"
        return result
    if float(np.std(y)) < 1e-12 or float(np.std(fit.resid)) < 1e-12:
        result["limitations"].append("Constant or effectively exact synthetic fit: stochastic significance is not defined by this workflow.")
        result["status"] = "descriptive_only"
        return result
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        robust = fit.get_robustcov_results(cov_type="HAC", maxlags=bandwidth, kernel="bartlett", use_correction=True, use_t=False)
    interval = [float(v) for v in robust.conf_int(alpha=alpha)[1]]
    p = float(robust.pvalues[1])
    if not all(math.isfinite(v) for v in [*interval, p]):
        result["limitations"].append("Nonfinite covariance or inference; no significance published.")
        return result
    result.update(interval=interval, p_value=p, status="detected" if p < alpha else "not_detected")
    for lag in ([6, 24] if frequency == "monthly" else [1, 3]):
        alternative = fit.get_robustcov_results(cov_type="HAC", maxlags=lag, kernel="bartlett", use_correction=True, use_t=False)
        result["sensitivity"].append({"bandwidth": lag, "p_value": float(alternative.pvalues[1]), "interval": [float(v) for v in alternative.conf_int(alpha=alpha)[1]]})
    disagree = any((s["p_value"] < alpha) != (p < alpha) for s in result["sensitivity"])
    result["diagnostics"]["bandwidth_sensitive"] = disagree
    if disagree:
        result["status"] = "inconclusive"
        result["limitations"].append("Significance changes with the predeclared HAC bandwidth sensitivity checks; evidence is inconclusive.")
    lag = min(12 if frequency == "monthly" else 2, len(y) // 5)
    lb = acorr_ljungbox(fit.resid, lags=[lag], return_df=True)
    result["diagnostics"]["ljung_box_p"] = float(lb["lb_pvalue"].iloc[0])
    result["diagnostics"]["residual_lag1"] = float(np.corrcoef(fit.resid[:-1], fit.resid[1:])[0, 1])
    if frequency == "annual":
        result["diagnostics"]["theil_sen_descriptive_slope"] = float(theilslopes(y, x).slope)
    result["limitations"].append("HAC addresses suitable short-range dependence, not sensor transitions, changing spatial coverage, long memory, nonlinear change, or every climate-series problem.")
    if len(y) > intervals * 12:
        trim = intervals * 2
        endpoint = sm.OLS(y[trim:-trim], design[trim:-trim]).fit()
        result["diagnostics"]["two_year_endpoint_trim_slope"] = float(endpoint.params[1])
    return result
