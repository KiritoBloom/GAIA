"""Resolve collection identity from exact NASA identifiers, never latest-version assumptions."""
import re
from urllib.parse import urlencode

GRANULE = re.compile(r'^(MOD13Q1)\.(A\d{7})\.(h\d{2}v\d{2})\.(006|061)\.(\d{13})(?:\.hdf)?$')

def identify_rows(rows, start, end, read_json):
    identities = {}
    missing = []
    for row in rows:
        key = (row.get('modis_date'), row.get('tile'), str(row.get('proc_date', '')))
        if not re.fullmatch(r'A\d{7}', str(key[0])) or not re.fullmatch(r'h\d{2}v\d{2}', str(key[1])) or not re.fullmatch(r'\d{13}', key[2]):
            raise ValueError('MODIS row lacks an inspectable composite, tile or processing identifier.')
        filename = GRANULE.fullmatch(str(row.get('filename') or row.get('title') or ''))
        version = str(row.get('version', ''))
        if filename:
            if (filename[2], filename[3], filename[5]) != key:
                raise ValueError('MODIS filename and observation metadata disagree.')
            version = filename[4]
        if version in ('006', '061'):
            if key in identities and identities[key]['version'] != version:
                raise ValueError('MODIS science/QA rows disagree on collection.')
            identities[key] = {'version':version, 'title':f'MOD13Q1.{key[0]}.{key[1]}.{version}.{key[2]}', 'source':'provider granule metadata'}
        else:
            missing.append(key)
    queries = []
    excluded = []
    tiles = sorted({key[1] for key in missing})
    if len(tiles) > 4:
        raise ValueError('Fixed-site MODIS identity search exceeds the four-tile budget.')
    for tile in tiles:
        parameters = {'short_name':'MOD13Q1', 'readable_granule_name':f'MOD13Q1.*.{tile}.*', 'options[readable_granule_name][pattern]':'true', 'temporal':f'{start}-01-01T00:00:00Z,{end}-12-31T23:59:59Z', 'page_size':'2000'}
        catalog, provenance = read_json('https://cmr.earthdata.nasa.gov/search/granules.json?' + urlencode(parameters))
        entries = catalog.get('feed', {}).get('entry', [])
        if len(entries) >= 2000:
            raise ValueError('CMR page reached its limit; incomplete identity matching is not accepted.')
        matches = {}
        for entry in entries:
            match = GRANULE.fullmatch(str(entry.get('title', '')))
            if match:
                key = (match[2], match[3], match[5])
                matches.setdefault(key, []).append({'version':match[4], 'title':entry['title'], 'granule_concept_id':entry.get('id'), 'collection_concept_id':entry.get('collection_concept_id'), 'source':'NASA CMR exact granule identifier'})
        for key in sorted(set(missing)):
            if key[1] != tile:
                continue
            candidates = matches.get(key, [])
            if not candidates:
                excluded.append({'modis_date':key[0], 'tile':key[1], 'processing_timestamp':key[2], 'reason':'exact processing revision absent from current NASA CMR metadata; excluded, not assigned the latest collection'})
                continue
            if len({item['version'] for item in candidates}) != 1:
                raise ValueError('NASA CMR cannot uniquely verify the MODIS composite/tile/processing collection; no version is guessed.')
            if key in identities and identities[key]['version'] != candidates[0]['version']:
                raise ValueError('Provider and NASA CMR collection identifiers disagree.')
            identities[key] = candidates[0]
        queries.append(provenance)
    versions = sorted({item['version'] for item in identities.values()})
    if len(versions) != 1:
        raise ValueError('Mixed MODIS collections need separate harmonization; they are not merged silently.')
    accepted=[{**item,'modis_date':key[0],'tile':key[1],'processing_timestamp':key[2]} for key,item in identities.items()]
    return versions, {'method':'exact product/composite/tile/processing identifier; provider filename or NASA CMR match for every accepted science/QA row', 'metadata_queries':queries, 'matched_granules':accepted, 'excluded_granules':excluded, 'limitation':'Catalog identity verification is not bitwise verification of original HDF pixel contents. Unverifiable processing revisions are excluded and can cause missing annual observations.'}
