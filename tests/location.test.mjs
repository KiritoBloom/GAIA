import test from 'node:test';
import assert from 'node:assert/strict';
import { ownedPlace, resolvePlace } from '../app/backend/location.mjs';

test('Gaia location selection comes from a live owned geocoder result, never model-guessed coordinates', async t => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  let requested;
  globalThis.fetch = async (url, options) => {
    requested = new URL(url);
    assert.ok(options.signal);
    return { ok: true, json: async () => ({ results: [
      { name: 'Manaus', admin1: 'Amazonas', country: 'Brazil', latitude: -3.119, longitude: -60.021, elevation: 92, feature_code: 'PPLA' },
      { name: 'Manaus', admin1: 'Other place', country: 'Elsewhere', latitude: 1, longitude: 2 }
    ] }) };
  };
  const session = {};
  const result = await resolvePlace(session, 'Manaus, Brazil');
  assert.equal(requested.hostname, 'geocoding-api.open-meteo.com');
  assert.equal(requested.searchParams.get('name'), 'Manaus, Brazil');
  assert.equal(result.results.length, 2);
  assert.deepEqual(ownedPlace(session, result.results[0].id), result.results[0]);
  assert.throws(() => ownedPlace(session, 'invented-coordinate-id'), /actual geocoding result/);
  assert.match(result.limitation, /not a watershed/);
});

test('geocoder no-match is a clarification boundary, not a guessed location', async t => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ results: [] }) });
  await assert.rejects(resolvePlace({}, 'Somewhere'), /Ask the user to clarify/);
  await assert.rejects(resolvePlace({}, 'x'), /at least two characters/);
});
