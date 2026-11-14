"""Bounded, allowlisted data routes. Raw responses retain checksums/provenance."""
from __future__ import annotations
import calendar
import csv
import hashlib
import io
import json
import math
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from .catalog import VARIABLES

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".runtime" / "science-cache"
ALLOWED = {"power.larc.nasa.gov", "modis.ornl.gov", "www.ncei.noaa.gov", "cmr.earthdata.nasa.gov", "api.gbif.org"}
MAX_BYTES = 48 * 1024 * 1024


def read_json(url, headers=None):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED:
        raise ValueError("Scientific retrieval route is not allowlisted.")
    # Never include authentication in a cache identifier, saved URL or error.
    key = hashlib.sha256(url.encode()).hexdigest()
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{key}.json"
    if path.exists():
        package = json.loads(path.read_text(encoding="utf-8"))
        return package["response"], {**package["provenance"], "acquisition_mode": "cached_real_data"}
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "GAIA-SpaceApps/0.1 scientific-prototype", **(headers or {})})
    for attempt in range(2):
        try:
            if parsed.hostname in ('modis.ornl.gov','cmr.earthdata.nasa.gov','api.gbif.org'):
                executable=ROOT/'.runtime'/'bin'/('node.exe' if os.name=='nt' else 'node')
                if not executable.exists():
                    executable='node'
                fetched=subprocess.run([str(executable),str(ROOT/'scripts'/'fetch-tesvis.mjs'),url],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=70,check=True)
                data=fetched.stdout
                if len(data)>MAX_BYTES:
                    raise ValueError('Provider response exceeds the declared 48-MiB acquisition ceiling.')
                document=json.loads(data)
            else:
                with urllib.request.urlopen(request, timeout=60) as response:
                    data = response.read(MAX_BYTES + 1)
                    if len(data) > MAX_BYTES:
                        raise ValueError("Provider response exceeds the declared 48-MiB acquisition ceiling.")
                    document = json.loads(data)
            provenance = {"url": url, "retrieved_at": datetime.now(timezone.utc).isoformat(), "raw_sha256": hashlib.sha256(data).hexdigest(), "acquisition_mode": "live_acquisition"}
            temporary = path.with_name(f'{key}.{uuid4().hex}.tmp')
            temporary.write_text(json.dumps({"response": document, "provenance": provenance}), encoding="utf-8")
            temporary.replace(path)
            return document, provenance
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt == 0:
                time.sleep(1)
                continue
            raise ValueError(f"Scientific provider returned HTTP {exc.code}; no values were invented.") from None
        except (urllib.error.URLError, TimeoutError,subprocess.TimeoutExpired,subprocess.CalledProcessError):
            if attempt == 0:
                continue
            raise ValueError("Scientific provider could not be reached within the acquisition budget.") from None
    raise ValueError("Scientific acquisition did not complete.")


def scope(request):
    latitude, longitude = float(request["latitude"]), float(request["longitude"])
    start, end = int(request["start"]), int(request["end"])
    if not math.isfinite(latitude) or not math.isfinite(longitude) or not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise ValueError("Coordinates must be finite WGS84 latitude/longitude.")
    if not 1981 <= start <= end <= datetime.now(timezone.utc).year - 1:
        raise ValueError("Use a retrospective complete-year interval from 1981 to the previous year.")
    return latitude, longitude, start, end


def power(request):
    latitude, longitude, start, end = scope(request)
    variable = request["variable"]
    if variable not in ("T2M", "PRECTOTCORR", "RH2M"):
        raise ValueError("Unknown registered POWER variable.")
    query = urllib.parse.urlencode({"parameters": variable, "community": "AG", "latitude": latitude, "longitude": longitude, "start": start, "end": end, "format": "JSON"})
    document, provenance = read_json("https://power.larc.nasa.gov/api/temporal/monthly/point?" + query)
    data = document.get("properties", {}).get("parameter", {}).get(variable)
    if not isinstance(data, dict):
        raise ValueError("NASA POWER returned no usable parameter record.")
    header = document.get("header", {})
    fill = header.get("fill_value", -999)
    entries = []
    for year in range(start, end + 1):
        for month in range(1, 13):
            value = data.get(f"{year}{month:02d}")
            valid = isinstance(value, (int, float)) and math.isfinite(value) and value != fill
            entries.append({"date": f"{year}-{month:02d}-01", "value": float(value) if valid else None, "quality": "provider_value" if valid else "missing_or_fill"})
    metadata = dict(next(item for item in VARIABLES if item["id"] == variable))
    actual_units = document.get("parameters", {}).get(variable, {}).get("units")
    if actual_units:
        metadata["units"] = actual_units
    return {"series": entries, "variable": metadata, "frequency": "monthly", "geometry": {"type": "grid_supported_location", "latitude": latitude, "longitude": longitude, "label": request.get("label", "Selected location"), "not_polygon_mean": True}, "provenance": {**provenance, "provider": "NASA POWER", "api_version": header.get("api", {}).get("version"), "source_metadata": header.get("sources"), "parameter_metadata": document.get("parameters", {}).get(variable), "fill_value": fill, "temporal_aggregation": "provider monthly means; annual summaries excluded"}, "limitations": [metadata["support"], "Reanalysis-derived values are not independent local ground observations."]}


def sites():
    document, provenance = read_json("https://modis.ornl.gov/rst/api/v1/sites")
    return {"sites": document.get("sites", []), "provenance": provenance}


def modis(request):
    _, _, start, end = scope(request)
    if start < 2000:
        raise ValueError("MODIS record begins in 2000; select a later start year.")
    siteid = request.get("siteid", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,120}", siteid):
        raise ValueError("Select a real TESViS fixed-site identifier.")
    site = next((site for site in sites()["sites"] if site["siteid"] == siteid), None)
    if site is None:
        raise ValueError("Selected fixed site is not present in the NASA provider catalog.")
    product = "MOD13Q1"
    parameters={"startDate": f"A{start}001", "endDate": f"A{end}{366 if calendar.isleap(end) else 365}"}
    # Acquire raw science and QA together, not rendered map colors or an
    # undocumented pre-filter whose criterion cannot be reproduced.
    bands=['250m_16_days_EVI','250m_16_days_pixel_reliability','250m_16_days_VI_Quality','250m_16_days_composite_day_of_the_year']
    def retrieve(band):
        query=urllib.parse.urlencode({**parameters,'band':band})
        return read_json(f'https://modis.ornl.gov/rst/api/v1/{product}/{siteid}/subset?{query}')
    with ThreadPoolExecutor(max_workers=2) as pool:
        packages=list(pool.map(retrieve,bands))
    support_keys=('nrows','ncols','cellsize','xllcorner','yllcorner','latitude','longitude')
    for (item,_),band in zip(packages,bands):
        if item.get('band')!=band or any(item.get(key)!=packages[0][0].get(key) for key in support_keys):
            raise ValueError('MODIS science/QA bands do not share the same declared pixel support.')
    if float(packages[0][0].get('scale','nan'))!=0.0001:
        raise ValueError('MODIS EVI scaling is not the registered raw-integer recipe.')
    document={**packages[0][0],'subset':[row for item,_ in packages for row in item.get('subset',[])]}
    provenance={**packages[0][1],'band_requests':[{**metadata,'band':band} for (_,metadata),band in zip(packages,bands)]}
    rows = document.get("subset", [])
    if not rows:
        raise ValueError("No MODIS science/quality observations available for this site and interval.")
    by_date = {}
    from .modis_identity import identify_rows
    versions, identity_evidence = identify_rows(rows, start, end, read_json)
    provenance['collection_identity_evidence'] = identity_evidence
    accepted_keys={(item['modis_date'],item['tile'],item['processing_timestamp']) for item in identity_evidence['matched_granules']}
    unverified_dates={row['modis_date'] for row in rows if (row['modis_date'],row['tile'],str(row['proc_date'])) not in accepted_keys}
    for row in rows:
        group = by_date.setdefault(row.get('modis_date'), {})
        if row.get('band') in group:
            raise ValueError('Duplicate MODIS science/QA rows cannot be silently overwritten.')
        group[row.get('band')] = row
    from collections import defaultdict
    samples = defaultdict(list)
    diagnostics = []
    selected_months = request.get("months", [5, 6, 7, 8, 9])
    if not isinstance(selected_months, list) or not selected_months or len(set(selected_months)) != len(selected_months) or any(type(month) is not int or not 1 <= month <= 12 for month in selected_months):
        raise ValueError("Choose valid distinct growing-season months before viewing results.")
    selected_months = sorted(selected_months)
    for composite, bands in sorted(by_date.items()):
        if composite in unverified_dates:
            diagnostics.append({'composite':composite,'valid_fraction':0,'accepted':False,'reason':'unverifiable_collection_identity'})
            continue
        if not composite or not re.fullmatch(r"A\d{7}", composite):
            continue
        evi = bands.get("250m_16_days_EVI", {}).get("data", [])
        reliability = bands.get("250m_16_days_pixel_reliability", {}).get("data", [])
        quality = bands.get("250m_16_days_VI_Quality", {}).get("data", [])
        days = bands.get("250m_16_days_composite_day_of_the_year", {}).get("data", [])
        if not evi or not (len(evi) == len(reliability) == len(quality) == len(days)):
            raise ValueError("MODIS acquisition lacks aligned EVI, reliability, VI quality or actual observation dates.")
        if len(evi) != document.get('nrows',0)*document.get('ncols',0):
            raise ValueError('MODIS pixel arrays do not match the declared raster footprint.')
        year = int(composite[1:5])
        valid = 0
        monthly = defaultdict(list)
        for value, reliability_value, qa, day in zip(evi, reliability, quality, days):
            if not all(type(item) in (int, float) and math.isfinite(item) for item in (value, reliability_value, qa, day)):
                continue
            if not float(value).is_integer() or not float(qa).is_integer() or not 0 <= qa <= 65535 or not float(day).is_integer():
                continue
            qa = int(qa)
            # MOD13 Collection 6/6.1 QA: good MODLAND, usefulness <=4,
            # no high aerosol, adjacent/mixed clouds, snow/ice or shadow.
            good = reliability_value == 0 and (qa & 3) == 0 and ((qa >> 2) & 15) <= 4 and ((qa >> 6) & 3) != 3 and not any(qa & (1 << bit) for bit in (8, 10, 14, 15))
            if not good or not -2000 <= value <= 10000 or not 1 <= day <= (366 if calendar.isleap(year) else 365):
                continue
            from datetime import timedelta
            observation = date(year, 1, 1) + timedelta(days=int(day) - 1)
            monthly[observation.month].append(float(value) * 0.0001)
            valid += 1
        fraction = valid / len(evi)
        diagnostics.append({"composite": composite, "valid_fraction": fraction, "pixels": len(evi)})
        if fraction >= 0.8:
            for month, values in monthly.items():
                if month in selected_months:
                    samples[(year, month)].append(sum(values) / len(values))
    annual = []
    for year in range(start, end + 1):
        monthly_means = []
        complete = True
        for month in selected_months:
            composites = samples[(year, month)]
            if not composites:
                complete = False
                break
            monthly_means.append(sum(composites) / len(composites))
        annual.append({"date": f"{year}-01-01", "value": sum(monthly_means) / len(monthly_means) if complete else None, "quality": "season_complete" if complete else "season_incomplete"})
    metadata = dict(next(item for item in VARIABLES if item["id"] == "EVI"))
    metadata["cadence"] = "annual growing-season mean of observed, QA-filtered composite pixels"
    metadata["support"] = f"Actual TESViS subset grid: {document.get('nrows')} rows x {document.get('ncols')} columns, {document.get('cellsize')} metre posting. Site support, not administrative boundary or watershed mean."
    return {"series": annual, "variable": metadata, "frequency": "annual", "bandwidth": 2, "geometry": {"type": "fixed_site_footprint", "latitude": site["latitude"], "longitude": site["longitude"], "label": site["sitename"], "siteid": siteid, "nrows": document.get("nrows"), "ncols": document.get("ncols"), "cellsize_metres": document.get("cellsize"), "projection": "MODIS sinusoidal", "xllcorner": document.get("xllcorner"), "yllcorner": document.get("yllcorner")}, "provenance": {**provenance, "provider": "NASA MODIS / ORNL DAAC TESViS", "product": product, "collection_versions": sorted(versions), "scale_factor": 0.0001, "recipe": {"months": selected_months, "valid_composite_pixel_fraction": 0.8, "quality": "pixel reliability=0; MODLAND=0; VI usefulness<=4; no high aerosol, adjacent/mixed cloud, snow or shadow", "aggregation": "actual pixel observation month -> within-composite observed-pixel mean -> equal composite means within month -> equal selected-month mean; all selected months required", "note": "Composite observations are not daily observations. Changing accepted pixel support and sampling remain limitations."}, "grid": {key: document.get(key) for key in ("nrows", "ncols", "cellsize", "xllcorner", "yllcorner")}, "qa_diagnostics": diagnostics}, "limitations": [metadata["support"], "EVI is optical greenness, not tree mortality, species, yield, infection or biodiversity.", "Clear-sky selection and changing accepted pixels can affect the series; the QA/coverage ledger is exported.", "Equal-weight composite/month sampling is a declared descriptive aggregation, not a continuous physiological seasonal integral."]}


def import_csv(request):
    text = request.get("csv", "")
    if not isinstance(text, str) or len(text) > 2_000_000:
        raise ValueError("CSV exceeds the two-MB import limit.")
    lines = text.splitlines()
    date_column = request.get('date_column')
    recognized = {'date','time','datetime','timestamp','date_start','time_start','start_date','start_time'}
    def is_header(line):
        if not line.strip() or line.lstrip().startswith('#') or ',' not in line:
            return False
        columns=next(csv.reader([line.lstrip('\ufeff')]))
        return date_column in columns if date_column else any(column.strip().lower() in recognized for column in columns)
    header_line = next((i for i, line in enumerate(lines) if is_header(line)), None)
    if header_line is None:
        raise ValueError("CSV needs a date/time column and a value column. Preserve the original export/provenance.")
    reader = csv.DictReader(io.StringIO("\n".join(lines[header_line:]).lstrip('\ufeff')))
    fields = reader.fieldnames or []
    date_field = date_column or next((field for field in fields if field.strip().lower() in recognized), None)
    value_field = request.get("value_column") or next((field for field in fields if field != date_field and field.lower().strip() in ("value", "data", "mean")), None)
    if value_field not in fields:
        remaining = [field for field in fields if field != date_field]
        if len(remaining) == 1:
            value_field = remaining[0]
        else:
            raise ValueError("Select the explicit numeric value column; ambiguous columns are not guessed.")
    source = str(request.get("source", ""))
    if not source or len(source) > 1200:
        raise ValueError("Supply a source/product/provenance reference for imported evidence.")
    entries = []
    for row in reader:
        if len(entries) >= 6000:
            raise ValueError("CSV observation budget exceeded.")
        label = row.get(date_field, "").strip()
        if re.fullmatch(r"\d{4}-\d{2}", label):
            label += "-01"
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?", label):
            raise ValueError("Use ISO dates (YYYY-MM-DD); dates are not locale-guessed.")
        date.fromisoformat(label[:10])
        if len(label)>10:
            datetime.fromisoformat(label)
        raw = row.get(value_field, "").strip()
        value = None if raw.lower() in ("", "na", "nan", "null", "-999", "-9999") else float(raw)
        if value is not None and not math.isfinite(value):
            raise ValueError("Nonfinite imported values are not scientific measurements.")
        entries.append({"date": label[:10], "value": value, "quality": "user_supplied_not_authenticated"})
    if request.get('domain','aura') not in ('aura','thalassa','chloris','zoe'):
        raise ValueError('Imported evidence needs a registered domain, not a new agent identity.')
    metadata = {"id": "IMPORTED", "name": str(request.get("name", "Imported series"))[:120], "definition": str(request.get("definition", "User-supplied numerical series"))[:800], "units": str(request.get("units", ""))[:40], "domain": request.get("domain", "aura"), "provider": "User-supplied export", "evidence_class": request.get("evidence_class", "imported observation"), "support": str(request.get("support", "Support not supplied"))[:800], "source": source, "cadence": request.get("frequency", "monthly")}
    if not metadata["units"] or not entries:
        raise ValueError("Imported series needs explicit units and at least one row.")
    return {"series": entries, "variable": metadata, "frequency": request.get("frequency", "monthly"), "bandwidth": 2 if request.get("frequency") == "annual" else 12, "geometry": {"type": "user_declared_support", "label": metadata["support"]}, "provenance": {"provider": "User-supplied import", "source": source, "raw_sha256": hashlib.sha256(text.encode()).hexdigest(), "retrieved_at": datetime.now(timezone.utc).isoformat(), "acquisition_mode": "manual_import", "authenticity": "not_independently_authenticated"}, "limitations": ["Imported provenance and QA are user-declared, not automatically producer-verified.", metadata["support"]]}


def noaa_stations(request):
    token = os.environ.get("NOAA_CDO_TOKEN", "")
    if not token:
        raise ValueError("NOAA CDO needs its separate token in local backend settings.")
    lat, lon, _, _ = scope(request)
    extent = f"{max(-90, lat-0.5)},{max(-180, lon-0.5)},{min(90, lat+0.5)},{min(180, lon+0.5)}"
    document, provenance = read_json("https://www.ncei.noaa.gov/cdo-web/api/v2/stations?" + urllib.parse.urlencode({"extent": extent, "limit": 25, "datasetid": "GHCND"}), headers={"token": token})
    return {"stations": document.get("results", []), "provenance": provenance, "limitations": ["Station discovery is not station-data acquisition or validation. Inspect station history, dates, elevation and completeness before comparison."]}
