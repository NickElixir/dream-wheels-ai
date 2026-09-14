import assert from 'node:assert/strict';
import test from 'node:test';
import { getVariant, getVariantsForVehicle, vehicles, wheels } from '../src/data/catalog';
import { getAppTargetFromUrl } from '../src/lib/attribution';
import { sanitizeFavoriteIds, toggleFavoriteIds } from '../src/lib/favorites';

test('catalog contains five vehicles with three mock variants each', () => {
  assert.equal(vehicles.length, 5);
  assert.equal(wheels.length, 3);
  for (const vehicle of vehicles) {
    assert.equal(getVariantsForVehicle(vehicle.id).length, 3);
    assert.equal(getVariantsForVehicle(vehicle.id).every((variant) => variant.isMock), true);
  }
});

test('invalid variant ids never resolve to a factual catalog result', () => {
  assert.equal(getVariant('missing-vehicle', 'missing-wheel'), undefined);
});

test('favorites are version-safe and toggle idempotently', () => {
  assert.deepEqual(sanitizeFavoriteIds('{bad json}'), []);
  assert.deepEqual(sanitizeFavoriteIds(['zeekr-001-wheel-a', 42]), []);
  assert.deepEqual(toggleFavoriteIds([], 'zeekr-001-wheel-a'), ['zeekr-001-wheel-a']);
  assert.deepEqual(toggleFavoriteIds(['zeekr-001-wheel-a'], 'zeekr-001-wheel-a'), []);
});

test('CTA keeps supported attribution parameters and drops unrelated query values', () => {
  const target = new URL(
    getAppTargetFromUrl(
      'https://dreamwheels.pro/?utm_source=telegram&utm_campaign=summer&market=ru&debug=true',
    ),
  );
  assert.equal(target.pathname, '/app/new');
  assert.equal(target.searchParams.get('utm_source'), 'telegram');
  assert.equal(target.searchParams.get('utm_campaign'), 'summer');
  assert.equal(target.searchParams.get('market'), 'ru');
  assert.equal(target.searchParams.has('debug'), false);
});
