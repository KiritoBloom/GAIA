"""Bounded, named domain diagnostics; language models never execute equations themselves."""
import hashlib
import json
import math

METHODS = {
    'vpd_context': {'role':'aura','inputs':2,'source':'https://www.fao.org/4/x0490e/x0490e07.htm','scope':'paired temperature/humidity; monthly means yield an approximation, not mean daily VPD'},
    'concentration_load': {'role':'thalassa','inputs':2,'source':'https://www.usgs.gov/special-topics/water-science-school/science/watersheds-and-drainage-basins','equation_basis':'SI dimensional conversion: 1 m3 = 1000 L; 1 kg = 1,000,000 mg','scope':'paired mg/L and m3/s; instantaneous product or product-of-means approximation, not integrated mass'},
    'greenness_qa': {'role':'chloris','inputs':1,'source':'https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061','scope':'audit the actual registered optical proxy, quality, collection and seasonal coverage'},
    'animal_observation': {'role':'zoe','inputs':0,'source':'https://www.gbif.org/sampling-event-data','scope':'identity, duplicates, licenses and missing observation effort; no abundance/mortality inference'},
}

def same_support(first,second):
    geometry=first.get('geometry',{})
    if geometry.get('type') not in ('grid_supported_location','fixed_site_footprint','model_grid_point'):
        raise ValueError('Unclassified spatial support cannot earn a quantitative join.')
    if any(geometry.get(key)!=second.get('geometry',{}).get(key) for key in ('type','latitude','longitude','siteid')):
        raise ValueError('Incompatible spatial support; retain separate contextual records.')
    if first.get('frequency')!=second.get('frequency') or [x['date'] for x in first['series']]!=[x['date'] for x in second['series']]:
        raise ValueError('A quantitative join requires matching actual periods and cadence.')

def diagnose(request):
    method=request['method']; specification=METHODS.get(method)
    if not specification or specification['role']!=request.get('role'):
        raise ValueError('Method/function authorization denied.')
    inputs=request.get('acquisitions',[])
    if len(inputs)!=specification['inputs']:
        raise ValueError('Registered method input count does not match.')
    result={'method':method,'role':specification['role'],'version':'1.0.0','source':specification['source'],'readiness':'bounded_diagnostic_not_causal_validation','limitations':[]}
    if method in ('vpd_context','concentration_load'):
        first,second=inputs;same_support(first,second)
        if method=='vpd_context':
            if first['variable']['id']!='T2M' or second['variable']['id']!='RH2M' or first['variable']['units'] not in ('C','degC','°C') or second['variable']['units']!='%':
                raise ValueError('VPD needs actual air-temperature Celsius and relative-humidity percent, not skin temperature or another quantity.')
            units='kPa';result['limitations']=['FAO saturation curve over water; not an ice-surface or crop-response model.','Nonlinear calculation from period means is an approximation, not the mean of instantaneous vapor-pressure deficit.','Atmospheric demand is not measured soil water or diagnosed plant damage.']
        else:
            if first['variable']['units'] not in ('mg/L','mg L-1') or second['variable']['units'] not in ('m3/s','m³/s'):
                raise ValueError('Load conversion requires declared mg/L concentration and m3/s discharge.')
            units='kg/s';result['limitations']=['Matching date labels do not independently verify matched sampling/flow windows.','Product of period means is not the mean product; no integrated mass, exposure or safe-water determination is made.']
        values=[]
        for a,b in zip(first['series'],second['series']):
            x,y=a['value'],b['value'];value=None
            if x is not None and y is not None:
                if type(x) not in (int,float) or type(y) not in (int,float) or not math.isfinite(x) or not math.isfinite(y):raise ValueError('Nonfinite or nonnumerical method input.')
                if method=='vpd_context':
                    if not -80<=x<=60 or not 0<=y<=100:raise ValueError('Temperature/humidity exceed this declared diagnostic domain.')
                    value=0.6108*math.exp(17.27*x/(x+237.3))*(1-y/100)
                else:
                    if x<0 or y<0:raise ValueError('Negative concentration/discharge needs a separately declared physical convention.')
                    value=x*y/1000
            values.append({'date':a['date'],'value':value})
        valid=[x['value'] for x in values if x['value'] is not None]
        result.update(series=values,units=units,valid=len(valid),missing=len(values)-len(valid),range=[min(valid),max(valid)] if valid else None,aggregation_status='period_mean_approximation' if first.get('frequency') in ('monthly','annual') else 'paired_observation_product')
    elif method=='greenness_qa':
        item=inputs[0];variable=item['variable'];provenance=item.get('provenance',{})
        if variable['id']!='EVI' or variable.get('evidence_class')!='mission-derived proxy':raise ValueError('Greenness audit requires the actual mission EVI proxy.')
        identity=provenance.get('collection_identity_evidence',{})
        result.update(quantity='optical canopy greenness; not species, biomass, crop yield, infection or mortality',collection=provenance.get('collection_versions'),verified_granules=len(identity.get('matched_granules',[])),excluded_revisions=len(identity.get('excluded_granules',[])),recipe=provenance.get('recipe'),valid=sum(x.get('value') is not None for x in item['series']),missing=sum(x.get('value') is None for x in item['series']),limitations=item.get('limitations',[]))
    else:
        records=request.get('records',[])
        if not isinstance(records,list) or len(records)>500:raise ValueError('Animal observation audit budget exceeded.')
        ids=[r.get('key') for r in records];duplicates=len(ids)-len(set(ids))
        has_effort=bool(records) and all(r.get('samplingEffort') and r.get('samplingProtocol') and r.get('eventDate') for r in records)
        result.update(records=len(records),duplicate_ids=duplicates,effort_recorded=has_effort,permitted_inference='occurrence_context_only' if not has_effort else 'structured_observation_review_required',population_trend=None,mortality=None,limitations=['Taxonomic database matching is not field identification or diagnostic confirmation.','Opportunistic observations and changing reporting effort cannot establish absence, abundance trend, migration or mortality.','Even recorded effort requires comparable protocols and an appropriate detection/population model.'])
    result['inputs_sha256']=hashlib.sha256(json.dumps(request,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
    return result
