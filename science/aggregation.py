"""Declared seasonal means from owned monthly evidence, never imputation."""
from copy import deepcopy
from datetime import date
import calendar
import math


def seasonal(request):
    acquisition = deepcopy(request['acquisition'])
    if acquisition.get('frequency') != 'monthly':
        raise ValueError('Seasonal aggregation requires monthly source observations.')
    months = request['months']
    if not isinstance(months, list) or not months or any(type(m) is not int or not 1 <= m <= 12 for m in months) or len(set(months)) != len(months):
        raise ValueError('Select distinct calendar months from 1 through 12.')
    months = sorted(months)
    records = {}
    for row in acquisition['series']:
        when = date.fromisoformat(row['date'][:10])
        key = (when.year, when.month)
        if key in records:
            raise ValueError('Duplicate source month; aggregation refused.')
        records[key] = row['value']
    years = sorted({year for year, _ in records})
    if not years:
        raise ValueError('No source calendar is available.')
    series = []
    for year in range(years[0], years[-1] + 1):
        values = [records.get((year, month)) for month in months]
        valid = all(value is not None and math.isfinite(float(value)) for value in values)
        weights = [calendar.monthrange(year, month)[1] for month in months]
        value = sum(float(v) * w for v, w in zip(values, weights)) / sum(weights) if valid else None
        series.append({'date': f'{year}-01-01', 'value': value})
    acquisition.update(series=series, frequency='annual', bandwidth=2)
    acquisition['provenance'] = {**acquisition.get('provenance', {}), 'derived_from_artifact': request['artifact_id'],
        'temporal_aggregation': {'method': 'calendar-day-weighted mean of declared monthly values', 'months': months,
            'completeness': 'All selected months required; otherwise annual season remains missing.',
            'rationale': request['rationale'], 'selected_by': 'GAIA; not selected to maximize significance'}}
    acquisition['limitations'] = [*acquisition.get('limitations', []),
        f'Trend describes calendar months {months}, not an all-year change. Season needs justification independent of the fitted result.',
        'Deterministic aggregation of the cited live source artifact, not independent evidence or a new provider acquisition.']
    return acquisition
