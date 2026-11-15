import { randomUUID } from 'node:crypto';
import { sha256 } from './security.mjs';

function coordinates(geometry) {
  if (!['Polygon','MultiPolygon'].includes(geometry?.type)) throw Error('A real Polygon or MultiPolygon boundary is required.');
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const points=[];
  for(const polygon of polygons){
    if(!Array.isArray(polygon)||!polygon.length)throw Error('Empty polygon.');
    for(const ring of polygon){
      if(!Array.isArray(ring)||ring.length<4)throw Error('Polygon rings must be closed and contain at least four vertices.');
      for(const point of ring){if(!Array.isArray(point)||!Number.isFinite(point[0])||!Number.isFinite(point[1])||Math.abs(point[0])>180||Math.abs(point[1])>90)throw Error('Boundary coordinates must be geographic longitude/latitude.');points.push(point);}
      if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('Polygon ring is not closed.');
    }
  }
  return points;
}

export function retainRegion(session,{name,geometry,source,source_sha256}){
  const points=coordinates(geometry),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const west=Math.min(...xs),east=Math.max(...xs),south=Math.min(...ys),north=Math.max(...ys);
  if(east<=west||north<=south)throw Error('Boundary has no area.');
  const region={id:randomUUID(),name,geometry,source,source_sha256,boundary_sha256:sha256(geometry),bbox:[west,south,east,north],longitude:(west+east)/2,latitude:(south+north)/2,resolved_at:new Date().toISOString(),support:'Source polygon; pixel-center inclusion and QA coverage are recorded during extraction. The bounding-box centre is only a climate-context point.'};
  session.regions||=[];session.regions.push(region);return region;
}

export async function resolveRegion(session,{query,source_url},signal){
  let url;
  if(source_url){
    url=new URL(source_url);
    // Only public, documented government ArcGIS query services, never arbitrary URLs.
    if(url.protocol!=='https:'||url.username||url.password||url.port||!(/\.gov\.bc\.ca$|\.gov$|\.gc\.ca$|\.arcgis\.com$/i.test(url.hostname))||!/\/MapServer\/\d+\/query$|\/FeatureServer\/\d+\/query$/i.test(url.pathname))throw Error('Boundary sources must be public government/ArcGIS feature-query HTTPS endpoints.');
    url.searchParams.set('f','geojson');url.searchParams.set('outSR','4326');url.searchParams.set('returnGeometry','true');
  }else{
    if(typeof query!=='string'||!query.trim())throw Error('Name the region to resolve.');
    url=new URL('https://nominatim.openstreetmap.org/search');url.search=new URLSearchParams({q:query,format:'geojson',polygon_geojson:'1',addressdetails:'1'});
  }
  const response=await fetch(url,{signal:AbortSignal.any([AbortSignal.timeout(60_000),...(signal?[signal]:[])]),redirect:'error',headers:{accept:'application/geo+json, application/json','user-agent':'GAIA-Earth-Investigator/1.0','cache-control':'no-cache, no-store',pragma:'no-cache'}});
  if(!response.ok)throw Error(`Boundary provider returned HTTP ${response.status}.`);
  const document=await response.json();
  if(document.exceededTransferLimit)throw Error('Boundary response is incomplete; narrow the named feature query.');
  const results=(document.features||[]).filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)).map(f=>retainRegion(session,{name:f.properties?.display_name||f.properties?.name||f.properties?.ECOPROVINCE_NAME||query||'Source boundary',geometry:f.geometry,source:url.toString(),source_sha256:sha256(document)}));
  if(!results.length)throw Error('No polygon boundary found. Clarify the region or resolve a documented public boundary; do not substitute an invented box or a single fixed site for a region.');
  return {results,attribution:source_url?'Boundary supplied by the cited public geographic service':'© OpenStreetMap contributors, ODbL; Nominatim',limitation:'Names can be ambiguous. Select the matching returned boundary and disclose any difference from the user’s requested ecological region.'};
}

export function ownedRegion(session,id){const region=session.regions?.find(item=>item.id===id);if(!region||sha256(region.geometry)!==region.boundary_sha256)throw Error('Region must be an unchanged provider boundary owned by this investigation.');return region;}
