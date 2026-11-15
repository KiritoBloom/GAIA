"""Fresh NASA AppEEARS area extraction and registered MOD13A3 EVI/QA reduction.

Credentials and temporary tokens never enter results. Tasks are asynchronous;
the application owns their IDs and cancellation. Downloaded files are temporary
processing inputs, never reused as an acquisition cache.
"""
import base64
import datetime as dt
import hashlib
import json
import os
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import numpy as np

BASE = 'https://appeears.earthdatacloud.nasa.gov/api'
PRODUCT = 'MOD13A3.061'
EVI = '_1_km_monthly_EVI'
QA = '_1_km_monthly_VI_Quality'


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        from urllib.parse import urlparse
        if urlparse(newurl).scheme != 'https':
            raise ValueError('Insecure NASA download redirect denied.')
        result = super().redirect_request(req, fp, code, msg, headers, newurl)
        if urlparse(newurl).netloc != urlparse(req.full_url).netloc:
            result.remove_header('Authorization')
        return result


def _request(path, token=None, payload=None, method=None, basic=False):
    if not path.startswith('/') or '..' in path:
        raise ValueError('Invalid AppEEARS resource.')
    headers = {'Accept': 'application/json', 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache', 'User-Agent': 'GAIA-Earth-Investigator/1.0'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if basic:
        user, password = os.environ.get('APPEEARS_USERNAME'), os.environ.get('APPEEARS_PASSWORD')
        if not user or not password:
            raise ValueError('NASA AppEEARS Earthdata Login credentials are not configured.')
        headers['Authorization'] = 'Basic ' + base64.b64encode((user + ':' + password).encode()).decode()
    data = json.dumps(payload).encode() if payload is not None else (b'' if method == 'POST' else None)
    if payload is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        return urllib.request.build_opener(SafeRedirect()).open(req, timeout=120)
    except urllib.error.HTTPError as exc:
        raise ValueError(f'NASA AppEEARS returned HTTP {exc.code}; no numerical result published.') from None


def _json(path, token=None, payload=None, method=None, basic=False):
    with _request(path, token, payload, method, basic) as response:
        raw = response.read()
    return json.loads(raw), {'url': BASE + path, 'retrieved_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'raw_sha256': hashlib.sha256(raw).hexdigest(), 'acquisition_mode': 'live_acquisition', 'cache_policy': 'no local response cache; no-cache, no-store'}


def _login():
    document, _ = _json('/login', method='POST', basic=True)
    if not document.get('token'):
        raise ValueError('NASA AppEEARS login did not return a token.')
    return document['token']


def _task_id(request):
    value = str(request.get('task_id', ''))
    try:
        uuid.UUID(value)
    except ValueError:
        raise ValueError('A valid owned AppEEARS task ID is required.') from None
    return value


def submit(request):
    start, end = request.get('start'), request.get('end')
    if not isinstance(start, int) or not isinstance(end, int) or start < 2001 or end < start or end >= dt.date.today().year:
        raise ValueError('Monthly MOD13A3 analysis requires complete retrospective years from 2001.')
    geometry = request.get('geometry', {})
    if geometry.get('type') not in ('Polygon', 'MultiPolygon'):
        raise ValueError('AppEEARS area extraction requires an owned polygon.')
    metadata, receipt = _json('/product/' + PRODUCT)
    for layer in (EVI, QA):
        if layer not in metadata or metadata[layer].get('Available') is False:
            raise ValueError('NASA does not currently expose the registered monthly EVI/QA layers.')
    token = _login()
    payload = {'task_type': 'area', 'task_name': 'GAIA-' + str(uuid.uuid4()), 'params': {
        'dates': [{'startDate': f'01-01-{start}', 'endDate': f'12-31-{end}'}],
        'layers': [{'product': PRODUCT, 'layer': EVI}, {'product': PRODUCT, 'layer': QA}],
        'geo': {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'name': request.get('label', 'Investigation region')}, 'geometry': geometry}]},
        'output': {'format': {'type': 'netcdf4'}, 'projection': 'geographic'}}}
    document, submitted = _json('/task', token, payload, 'POST')
    if not document.get('task_id'):
        raise ValueError('NASA did not accept the extraction task.')
    return {'task_id': document['task_id'], 'status': document.get('status', 'pending'), 'request': payload, 'metadata': metadata, 'metadata_receipt': receipt, 'submission_receipt': submitted}


def status(request):
    task_id = _task_id(request)
    document, receipt = _json('/task/' + task_id, _login())
    return {'task_id': task_id, 'status': document.get('status'), 'error': bool(document.get('error')), 'summary': document.get('summary'), 'receipt': receipt}


def _rings_contains(x, y, ring):
    inside = np.zeros(x.shape, dtype=bool)
    for a, b in zip(ring, ring[1:]):
        if a[1] == b[1]:
            continue
        cross = ((a[1] > y) != (b[1] > y)) & (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])
        inside ^= cross
    return inside


def _polygon_mask(lon, lat, geometry):
    # Scan each latitude against vectorized boundary segments, rather than
    # broadcasting every segment over the entire raster. Complex government
    # boundaries otherwise require billions of temporary pixel operations.
    def ring_mask(ring):
        points = np.asarray(ring, dtype=float)[:, :2]
        a, b = points[:-1], points[1:]
        result = np.zeros((len(lat), len(lon)), dtype=bool)
        for row, y in enumerate(lat):
            crossed = (a[:, 1] > y) != (b[:, 1] > y)
            left, right = a[crossed], b[crossed]
            intersections = np.sort(left[:, 0] + (right[:, 0] - left[:, 0]) * (y - left[:, 1]) / (right[:, 1] - left[:, 1]))
            result[row] = (np.searchsorted(intersections, lon, side='right') % 2) == 1
        return result
    mask = np.zeros((len(lat), len(lon)), dtype=bool)
    for rings in ([geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']):
        polygon = ring_mask(rings[0])
        for hole in rings[1:]:
            polygon &= ~ring_mask(hole)
        mask |= polygon
    return mask


def _find(dataset, term):
    matches = [v for k, v in dataset.variables.items() if k.lower().endswith(term.lower()) or k.lower().endswith(term.lower().lstrip('_'))]
    if len(matches) != 1:
        raise ValueError(f'NASA NetCDF must contain exactly one {term} variable.')
    return matches[0]


def _reduce_file(path, request):
    from netCDF4 import Dataset, num2date
    with Dataset(path) as dataset:
        dataset.set_auto_maskandscale(False)
        evi, qa = _find(dataset, EVI), _find(dataset, QA)
        if evi.dimensions != qa.dimensions or evi.shape != qa.shape or len(evi.shape) != 3:
            raise ValueError('EVI and QA grids are not aligned time/latitude/longitude arrays.')
        dims = list(evi.dimensions)
        time_dim = next((d for d in dims if d.lower() == 'time'), None)
        def coordinate(kind):
            names = ('lat', 'latitude') if kind == 'latitude' else ('lon', 'longitude')
            units = ('degrees_north', 'degree_north') if kind == 'latitude' else ('degrees_east', 'degree_east')
            return next((v for name, v in dataset.variables.items() if len(v.dimensions) == 1 and v.dimensions[0] in dims and (name.lower() in names or getattr(v, 'standard_name', '').lower() == kind or getattr(v, 'units', '').lower() in units)), None)
        lat_var, lon_var = coordinate('latitude'), coordinate('longitude')
        lat_dim = lat_var.dimensions[0] if lat_var is not None else None
        lon_dim = lon_var.dimensions[0] if lon_var is not None else None
        if not time_dim or not lat_dim or not lon_dim:
            raise ValueError('Geographic NetCDF time and latitude/longitude support is required.')
        lat, lon = np.asarray(lat_var[:], dtype=float), np.asarray(lon_var[:], dtype=float)
        if lat.size < 2 or lon.size < 2:
            raise ValueError('The extraction has insufficient pixels for a regional mean.')
        # Regular geographic cells: spherical strip area weights proportional to
        # sin(north edge)-sin(south edge); longitude cell widths must be constant.
        if not np.allclose(np.diff(lon), np.diff(lon)[0]) or not np.allclose(np.diff(lat), np.diff(lat)[0]):
            raise ValueError('Irregular grid needs a different registered area-weighting recipe.')
        half = abs(float(np.diff(lat)[0])) / 2
        weights = np.broadcast_to(np.abs(np.sin(np.deg2rad(np.minimum(90, lat + half))) - np.sin(np.deg2rad(np.maximum(-90, lat - half))))[:, None], (len(lat), len(lon)))
        footprint = _polygon_mask(lon, lat, request['geometry'])
        if not footprint.any():
            raise ValueError('No pixel centres fall within the selected polygon.')
        # AppEEARS exposes float32 already-scaled EVI as well as NetCDF-packed
        # integer representations. Never apply the original HDF scale twice.
        packed = 'scale_factor' in evi.ncattrs() or np.issubdtype(evi.dtype, np.integer)
        scale = float(getattr(evi, 'scale_factor', request['metadata'][EVI]['ScaleFactor'])) if packed else 1.0
        if (packed and not np.isclose(scale, 0.0001)) or float(getattr(evi, 'add_offset', 0)) != 0:
            raise ValueError('Unexpected EVI scaling; registered raw-integer recipe cannot be applied.')
        fill = float(getattr(evi, '_FillValue', -3000))
        time = dataset[time_dim]
        dates = num2date(time[:], time.units, calendar=getattr(time, 'calendar', 'standard'))
        rows = []
        for i, date in enumerate(dates):
            selection = [slice(None)] * 3
            selection[dims.index(time_dim)] = i
            raw, quality = np.asarray(evi[tuple(selection)]), np.asarray(qa[tuple(selection)])
            if dims.index(lat_dim) > dims.index(lon_dim):
                raw, quality = raw.T, quality.T
            quality_valid = np.isfinite(quality) & (quality >= 0) & (quality < 65535) & (quality == np.floor(quality))
            q = np.where(quality_valid, quality, 65535).astype(np.uint16)
            valid = footprint & quality_valid & np.isfinite(raw) & (raw != fill) & (raw >= (-2000 if packed else -0.2)) & (raw <= (10000 if packed else 1.0))
            valid &= ((q & 3) == 0) & (((q >> 2) & 15) <= 4) & (((q >> 6) & 3) < 3)
            valid &= ((q & (1 << 8)) == 0) & ((q & (1 << 10)) == 0) & ((q & (1 << 14)) == 0) & ((q & (1 << 15)) == 0)
            total = float(weights[footprint].sum())
            accepted = float(weights[valid].sum())
            coverage = accepted / total
            value = float(np.sum(raw[valid] * scale * weights[valid]) / accepted) if accepted and coverage >= request.get('min_coverage', 0.8) else None
            rows.append({'date': f'{date.year:04d}-{date.month:02d}-01', 'value': value, 'valid_pixels': int(valid.sum()), 'footprint_pixels': int(footprint.sum()), 'valid_area_fraction': coverage, 'applied_scale_factor': scale, 'quality': 'qa_area_mean' if value is not None else 'insufficient_qa_coverage'})
    return rows


def collect(request):
    task_id = _task_id(request)
    token = _login()
    task, _ = _json('/task/' + task_id, token)
    if task.get('status') != 'done':
        raise ValueError('NASA extraction is not complete; no partial raster trend published.')
    # Do not accept values for a task whose provider-side scope differs.
    expected = request['submitted_request']['params']
    for key in ('dates', 'geo', 'output'):
        if task.get('params', {}).get(key) != expected[key]:
            raise ValueError('NASA task geometry/calendar/product differs from its owned submission.')
    actual_layers = {(item.get('product'), item.get('layer')) for item in task.get('params', {}).get('layers', [])}
    if not {(PRODUCT, EVI), (PRODUCT, QA)}.issubset(actual_layers) or any(product != PRODUCT for product, _ in actual_layers):
        raise ValueError('NASA task product or required science/QA layers differ from its owned submission.')
    bundle, receipt = _json('/bundle/' + task_id, token)
    files = [f for f in bundle.get('files', []) if f.get('file_name', '').lower().endswith(('.nc', '.nc4'))]
    if not files:
        raise ValueError('NASA completed the task without NetCDF numerical outputs.')
    rows, receipts = [], []
    with tempfile.TemporaryDirectory(prefix='gaia-appeears-') as directory:
        for index, item in enumerate(files):
            file_id = str(uuid.UUID(item['file_id']))
            path = Path(directory) / f'{index}.nc'
            digest = hashlib.sha256()
            with _request('/bundle/' + task_id + '/' + file_id, token) as response, path.open('wb') as out:
                while chunk := response.read(1024 * 1024):
                    digest.update(chunk)
                    out.write(chunk)
            if not item.get('sha256') or digest.hexdigest() != item['sha256']:
                raise ValueError('NASA bundle file SHA-256 verification failed.')
            rows.extend(_reduce_file(path, request))
            receipts.append({'file_id': file_id, 'file_name': item['file_name'], 'raw_sha256': digest.hexdigest(), 'bytes': path.stat().st_size, 'retrieved_at': dt.datetime.now(dt.timezone.utc).isoformat()})
    by_date = {}
    for row in rows:
        if row['date'] in by_date:
            raise ValueError('Duplicate regional month: overlapping raster files require a registered mosaic recipe.')
        by_date[row['date']] = row
    series = [by_date.get(f'{year}-{month:02d}-01', {'date': f'{year}-{month:02d}-01', 'value': None, 'quality': 'missing_provider_month'}) for year in range(request['start'], request['end'] + 1) for month in range(1, 13)]
    from .catalog import VARIABLES
    variable = dict(next(v for v in VARIABLES if v['id'] == 'EVI'))
    variable.update({'provider': 'NASA AppEEARS / MODIS MOD13A3.061', 'cadence': 'monthly', 'support': 'Spherical cell-area-weighted QA-filtered EVI at pixel centres inside the source polygon; 1-km monthly MOD13A3 Collection 6.1.', 'source': 'https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13a3-061'})
    return {'series': series, 'frequency': 'monthly', 'bandwidth': 12, 'variable': variable, 'geometry': {'type': 'polygon_area_mean', 'label': request['label'], 'geojson': request['geometry'], 'boundary_source': request['boundary_source'], 'boundary_sha256': request['boundary_sha256'], 'latitude': request['latitude'], 'longitude': request['longitude'], 'context_point_definition': 'bounding-box centre; not an atmospheric polygon mean'}, 'provenance': {**receipt, 'provider': 'NASA AppEEARS / MODIS', 'product': PRODUCT, 'task_id': task_id, 'submitted_request': request['submitted_request'], 'files': receipts, 'metadata': request['metadata'], 'metadata_receipt': request['metadata_receipt'], 'recipe': {'version': 'appeears_mod13a3_polygon_v1', 'scale': 0.0001, 'spatial_weighting': 'spherical cell-area weights; pixel centres inside polygon, holes excluded', 'minimum_valid_area_fraction': request.get('min_coverage', 0.8), 'qa': 'MODLAND 0; usefulness <=4; aerosol not high; no adjacent/mixed cloud, snow or shadow; valid raw range; fill excluded', 'temporal': 'provider monthly product; every requested month retained, insufficient support becomes missing'}}, 'limitations': ['EVI is canopy optical greenness, not mortality, species identity or biomass.', 'Polygon is not forest-only without a compatible forest mask; landscape change must not be called forest-specific change.', 'Valid-pixel support may vary between months; cloud/aerosol/seasonal and retrieval effects can remain. Missing months are not interpolated.', 'Pixel-centre inclusion approximates polygon-edge areas at 1-km resolution; partial boundary cells are not intersected exactly.', 'Nearby or centre-point POWER series are climate context, not spatially matched regional means or causal attribution.']}
