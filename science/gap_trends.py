"""Optional calendar-distance HAC sensitivity; no time compression/imputation.

Score cross-products receive a Bartlett weight based on ACTUAL calendar lag,
equivalent to zero score vectors at unobserved periods, not filled observations.
Inference is conditional on an ignorable observation process. QA-linked missing
data may violate that assumption; this never replaces the primary conservative
analysis or repairs changing pixel support.
"""
from copy import deepcopy
from datetime import date
import math
import numpy as np
from scipy.stats import norm
from .trends import analyze, digest, finite, monthly_index


def analyze_gaps(acquisition, rationale):
    if not isinstance(rationale, str) or not rationale.strip():
        raise ValueError('Gap-aware sensitivity requires an explicit missingness rationale.')
    frequency = acquisition.get('frequency', 'monthly')
    result = analyze(acquisition['series'], frequency=frequency, bandwidth=acquisition.get('bandwidth', 12))
    primary = {key: result[key] for key in ('status', 'slope_per_year', 'interval', 'p_value', 'n', 'missing', 'specification_hash')}
    entries = result['series']
    keys = np.asarray([monthly_index(row['date']) if frequency == 'monthly' else date.fromisoformat(row['date']).year for row in entries])
    valid = np.asarray([finite(row.get('value')) for row in entries])
    times, y = keys[valid], np.asarray([row['value'] for row in entries if finite(row.get('value'))])
    periods = 12 if frequency == 'monthly' else 1
    x = (times - keys[0]) / periods
    columns = [np.ones(len(y)), x]
    if frequency == 'monthly':
        columns.extend((times % 12 == month).astype(float) for month in range(1, 12))
    design = np.column_stack(columns)
    spec = {**result['specification'], 'method': 'calendar_distance_ols_hac_sensitivity_v1', 'missingness_rule': 'actual_calendar_lag_score_covariance_no_imputation', 'interpretation': 'conditional_sensitivity_not_primary_confirmation', 'rationale': rationale}
    result.update(specification=spec, specification_hash=digest(spec), interval=None, p_value=None, sensitivity=[], status='inconclusive')
    result['primary_analysis'] = primary
    result['limitations'].extend(['Optional sensitivity conditional on an ignorable missingness process; QA/cloud/snow/fire-related selection may bias the slope and interval.', 'Does not establish a biome-specific change, repair shifting spatial support, or provide independent confirmation of the primary analysis.'])
    result['sources'].append('https://doi.org/10.2307/1913610')
    if len(y) <= design.shape[1] or np.linalg.matrix_rank(design) < design.shape[1] or (keys[-1] - keys[0] + 1) / periods < 20:
        result['limitations'].append('Insufficient calendar span, observations or seasonal rank for conditional inference.')
        return result
    if result['slope_per_year'] is None or np.std(y) < 1e-12:
        return result
    beta = np.linalg.lstsq(design, y, rcond=None)[0]
    resid = y - design @ beta
    if np.std(resid) < 1e-12:
        return result
    scores = design * resid[:, None]
    bread = np.linalg.inv(design.T @ design)
    def estimate(lag):
        meat = scores.T @ scores
        pairs = 0
        for distance in range(1, lag + 1):
            lookup = {int(t): i for i, t in enumerate(times)}
            matched = [(i, lookup[int(t) - distance]) for i, t in enumerate(times) if int(t) - distance in lookup]
            if not matched:
                continue
            left, right = np.asarray(matched).T
            cross = scores[left].T @ scores[right]
            meat += (1 - distance / (lag + 1)) * (cross + cross.T)
            pairs += len(matched)
        covariance = bread @ meat @ bread * len(y) / (len(y) - design.shape[1])
        variance = float(covariance[1, 1])
        if not math.isfinite(variance) or variance <= 0:
            raise ValueError('Nonpositive gap-aware trend variance; no inference published.')
        se = math.sqrt(variance)
        z = float(norm.ppf(1 - spec['alpha'] / 2))
        return {'bandwidth': lag, 'interval': [float(beta[1] - z * se), float(beta[1] + z * se)], 'p_value': float(2 * norm.sf(abs(beta[1] / se))), 'actual_calendar_pairs': pairs}
    lags = [spec['bandwidth'], *([6, 24] if frequency == 'monthly' else [1, 3])]
    estimates = [estimate(lag) for lag in dict.fromkeys(lags)]
    result['interval'], result['p_value'] = estimates[0]['interval'], estimates[0]['p_value']
    result['sensitivity'] = estimates[1:]
    result['diagnostics']['conditional_detection'] = result['p_value'] < spec['alpha']
    result['diagnostics']['bandwidth_sensitive'] = any((item['p_value'] < spec['alpha']) != result['diagnostics']['conditional_detection'] for item in estimates[1:])
    result['status'] = 'conditional_sensitivity'
    return result


def sensitivity(request):
    acquisition = deepcopy(request['acquisition'])
    acquisition['analysis_recipe'] = {'method': 'calendar_distance_ols_hac_sensitivity_v1', 'rationale': request['rationale'], 'source_artifact_id': request['artifact_id']}
    return acquisition
