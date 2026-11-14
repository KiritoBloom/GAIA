/** Approved POWER requests preserve the artifact's actual requested calendar and grid point. */
export function powerContextRequest(artifact,variable){
  const a=artifact?.acquisition,g=a?.geometry,analysis=artifact?.analysis;
  const power=a?.provenance?.provider==='NASA POWER'&&g?.type==='grid_supported_location';
  const mission=['NASA MODIS / ORNL DAAC','NASA MODIS / ORNL DAAC TESViS'].includes(a?.provenance?.provider)&&g?.type==='fixed_site_footprint'&&typeof g.siteid==='string';
  if(!power&&!mission)throw new Error('Automatic context requires classified owned NASA POWER or MODIS support.');
  if(!['T2M','PRECTOTCORR','RH2M'].includes(variable)||!Number.isFinite(g.latitude)||!Number.isFinite(g.longitude))throw new Error('Unregistered variable or invalid support.');
  const start=analysis?.requested_start,end=analysis?.requested_end;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(end||''))throw new Error('The actual requested calendar is missing; automatic acquisition cannot guess it.');
  return {operation:'power',variable,latitude:g.latitude,longitude:g.longitude,start:Number(start.slice(0,4)),end:Number(end.slice(0,4)),label:mission?`Meteorological grid context centred on ${g.label}; not a MODIS footprint mean`:g.label};
}
