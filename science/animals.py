"""Licensed animal occurrences with identity/scope checks, never a population census."""
from urllib.parse import urlencode
from .acquisition import read_json, scope

def occurrences(request):
    lat,lon,start,end=scope(request)
    name=request.get('scientific_name','')
    if not isinstance(name,str) or not 3<=len(name)<=150:raise ValueError('Supply the requested scientific name; species are not guessed from habitat.')
    taxon,metadata=read_json('https://api.gbif.org/v1/species/match?'+urlencode({'name':name,'strict':'true'}))
    if taxon.get('matchType')!='EXACT' or taxon.get('rank')!='SPECIES' or taxon.get('kingdom')!='Animalia':raise ValueError('An exact animal-species database match is required; other names need identification review.')
    key=taxon.get('acceptedUsageKey') or taxon.get('usageKey')
    parameters={'taxonKey':key,'hasCoordinate':'true','hasGeospatialIssue':'false','year':f'{start},{end}','decimalLatitude':f'{max(-90,lat-.5)},{min(90,lat+.5)}','decimalLongitude':f'{max(-180,lon-.5)},{min(180,lon+.5)}','limit':100}
    document,provenance=read_json('https://api.gbif.org/v1/occurrence/search?'+urlencode(parameters))
    records=[];rejected=[];seen=set()
    for item in document.get('results',[]):
        license=item.get('license','').replace('/legalcode','').rstrip('/')
        permitted=license in ('http://creativecommons.org/licenses/by/4.0','https://creativecommons.org/licenses/by/4.0','http://creativecommons.org/publicdomain/zero/1.0','https://creativecommons.org/publicdomain/zero/1.0')
        point=(item.get('decimalLatitude'),item.get('decimalLongitude'))
        within=all(type(v) in (int,float) for v in point) and abs(point[0]-lat)<=.5 and abs(point[1]-lon)<=.5 and start<=item.get('year',0)<=end
        if not permitted or not within or item.get('kingdom')!='Animalia' or item.get('speciesKey')!=key or item.get('key') in seen:
            rejected.append({'key':item.get('key'),'reason':'license, taxonomy, duplicate or explicit spatial/calendar scope failed'});continue
        seen.add(item['key'])
        records.append({'key':item['key'],'scientificName':item.get('scientificName'),'speciesKey':item.get('speciesKey'),'eventDate':item.get('eventDate'),'basisOfRecord':item.get('basisOfRecord'),'license':item.get('license'),'datasetKey':item.get('datasetKey'),'datasetName':item.get('datasetName'),'source':f"https://www.gbif.org/occurrence/{item['key']}",'samplingEffort':item.get('samplingEffort'),'samplingProtocol':item.get('samplingProtocol'),'coordinateUncertaintyInMeters':item.get('coordinateUncertaintyInMeters'),'generalization_present':bool(item.get('dataGeneralizations') or item.get('informationWithheld'))})
    return {'kind':'licensed_animal_occurrence_context','requested_name':name,'matched_taxon':{'scientificName':taxon.get('scientificName'),'speciesKey':key,'matchType':'EXACT','not_field_identification':True},'records':records,'rejected':rejected,'provider_total':document.get('count'),'retrieved_limit':100,'provenance':{'provider':'GBIF','taxonomy':metadata,**provenance},'privacy':'Exact coordinates and observer names withheld from model/UI records; raw publisher response remains private.','limitations':['Finite API subset of reported occurrences, not complete species coverage or a systematic survey.','Only CC0/CC BY records admitted; source record/publisher/license attribution retained.','Species database match is not on-site identification. Missing effort, nondetection and denominators prohibit population/mortality inference.']}
