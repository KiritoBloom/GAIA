import { randomUUID } from 'node:crypto';

/** Resolve user-provided place names through Open-Meteo's public geocoder. */
export async function resolvePlace(session, query, signal) {
  if (typeof query !== 'string' || query.trim().length < 2) throw Error('Provide a place name with at least two characters.');
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: query.trim(), count: '6', language: 'en', format: 'json' });
  const response = await fetch(url, { signal: AbortSignal.any([AbortSignal.timeout(20_000), ...(signal ? [signal] : [])]), headers: { accept: 'application/json' } });
  if (!response.ok) throw Error(`Public geocoding service returned HTTP ${response.status}.`);
  const data = await response.json();
  const results = (data.results || []).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)).map(item => ({
    id: randomUUID(), name: item.name, admin1: item.admin1 || null, admin2: item.admin2 || null, country: item.country || null,
    latitude: item.latitude, longitude: item.longitude, elevation_m: item.elevation ?? null, feature_code: item.feature_code || null,
    source: 'Open-Meteo Geocoding API', url: 'https://open-meteo.com/en/docs/geocoding-api'
  }));
  if (!results.length) throw Error('No matching place was found. Ask the user to clarify the location instead of guessing coordinates.');
  session.placeResolutions ||= [];
  session.placeResolutions.push({ query: query.trim(), resolved_at: new Date().toISOString(), results });
  return { query: query.trim(), results, source: 'Open-Meteo Geocoding API', url: 'https://open-meteo.com/en/docs/geocoding-api', limitation: 'A named-place coordinate is a point, not a watershed, regional average or ecological study footprint. Select the matching administrative area when names are ambiguous.' };
}

export function ownedPlace(session, id) {
  for (const resolution of [...(session.placeResolutions || [])].reverse()) {
    const item = resolution.results.find(result => result.id === id);
    if (item) return item;
  }
  throw Error('Location must come from an actual geocoding result owned by this investigation.');
}
