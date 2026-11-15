"""Declared seasonal means from owned monthly evidence, never imputation."""
from copy import deepcopy
from datetime import date
import calendar
import math


def seasonal(request):
    acquisition = deepcopy(request['acquisition'])
    # A new aggregate gets its own conservative primary analysis. An upstream
    # conditional sensitivity must not silently become the default recipe.
    previous_recipe = acquisition.pop('analysis_recipe', None)
    if acquisition.get('frequency') != 'monthly':
        raise ValueError('Seasonal aggregation requires monthly source observations.')
    months = request['months']
    if not isinstance(months, list) or not months or any(type(m) is not int or not 1 <= m <= 12 for m in months) or len(set(months)) != len(months):
        raise ValueError('Select distinct calendar months from 1 through 12.')
    start_month = request.get('season_year_start_month', 1)
    if start_month is None:
        start_month = 1
    if type(start_month) is not int or not 1 <= start_month <= 12:
        raise ValueError('Season-year start month must be a calendar month.')
    months = sorted(months, key=lambda month: (month - start_month) % 12)
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
    anchor_years = [year - (month < start_month) for year, month in records if month in months]
    if not anchor_years:
        raise ValueError('No requested season months exist in the source calendar.')
    for year in range(min(anchor_years), max(anchor_years) + 1):
        calendar_months = [(year + (month < start_month), month) for month in months]
        values = [records.get(key) for key in calendar_months]
        valid = all(value is not None and math.isfinite(float(value)) for value in values)
        weights = [calendar.monthrange(calendar_year, month)[1] for calendar_year, month in calendar_months]
        value = sum(float(v) * w for v, w in zip(values, weights)) / sum(weights) if valid else None
        row = {'date': f'{year}-{start_month:02d}-01', 'value': value}
        if start_month != 1:
            row['source_months'] = [f'{y}-{m:02d}' for y, m in calendar_months]
        series.append(row)
    acquisition.update(series=series, frequency='annual', bandwidth=2)
    acquisition['provenance'] = {**acquisition.get('provenance', {}), 'derived_from_artifact': request['artifact_id'],
        'temporal_aggregation': {'method': 'calendar-day-weighted mean of declared monthly values', 'months': months,
            'completeness': 'All selected months required; otherwise annual season remains missing.',
             'rationale': request['rationale'], 'selected_by': 'GAIA; not selected to maximize significance'}}
    if previous_recipe:
        acquisition['provenance']['upstream_analysis_recipe'] = previous_recipe
    if start_month != 1:
        acquisition['provenance']['temporal_aggregation']['season_year_start_month'] = start_month
        acquisition['provenance']['temporal_aggregation']['year_label'] = 'Year containing the season-year start month; cross-year months belong to the following calendar year.'
    acquisition['limitations'] = [*acquisition.get('limitations', []),
        f'Trend describes calendar months {months}, not an all-year change. Season needs justification independent of the fitted result.',
        'Deterministic aggregation of the cited live source artifact, not independent evidence or a new provider acquisition.']
    return acquisition
