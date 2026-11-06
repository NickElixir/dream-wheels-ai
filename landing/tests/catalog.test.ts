import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getVariant, getVariantsForVehicle, getWheel, getWheelSku, showcaseVariants, wheelSkus, vehicles, wheels } from '../src/data/catalog';
import { getAppTargetFromUrl } from '../src/lib/attribution';
import { sanitizeFavoriteIds, toggleFavoriteIds } from '../src/lib/favorites';

test('catalog has thirty explicit previews, six per vehicle, with unconfirmed fitment', () => {
  assert.equal(vehicles.length, 5);
  assert.equal(wheels.length, 22);
  assert.equal(wheelSkus.length, 68);
  assert.equal(showcaseVariants.length, 30);
  assert.equal(new Set(showcaseVariants.map((item) => item.id)).size, 30);
  for (const vehicle of vehicles) {
    const variants = getVariantsForVehicle(vehicle.id);
    assert.equal(variants.length, 6);
    assert.equal(new Set(variants.map((item) => item.wheelId)).size, 6);
  }
  for (const variant of showcaseVariants) {
    assert.equal(variant.isMock, false);
    assert.equal(variant.compatibility.status, 'unknown');
    assert.ok(variant.skuIds.length);
    assert.ok(getWheel(variant.wheelId));
    for (const id of variant.skuIds) assert.equal(getWheelSku(id)?.wheelId, variant.wheelId);
    assert.ok(existsSync(resolve('public', variant.image.src.slice(1))));
    assert.ok(variant.image.srcSet);
  }
  for (const wheel of wheels) assert.ok(existsSync(resolve('public', wheel.thumbnail.src.slice(1))));
});

test('selected corrected assets and SKU specifications stay linked', () => {
  const gle = showcaseVariants.find((item) => item.id === '6c25143191fe3361')!;
  const sku = getWheelSku(gle.skuIds[0])!;
  assert.equal(sku.sku, 'S087057');
  assert.equal(sku.diameter, 22);
  assert.equal(sku.width, 10);
  assert.equal(sku.et, 55);
  assert.equal(sku.dia, 66.6);
  const component = readFileSync('src/components/MiniCatalog.tsx', 'utf8');
  assert.equal(component.includes('OZ<br />Superturismo'), false);
  assert.equal(component.includes('QA_WHEEL_CELLS'), false);
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
  assert.equal(target.pathname, '/new');
  assert.equal(target.searchParams.get('utm_source'), 'telegram');
  assert.equal(target.searchParams.get('utm_campaign'), 'summer');
  assert.equal(target.searchParams.get('market'), 'ru');
  assert.equal(target.searchParams.has('debug'), false);
});

test('Timeweb CTA uses the existing application origin and short new route', () => {
  const target = new URL(getAppTargetFromUrl('https://landing-test.dream-wheels.ru/?utm_source=test&token=private', undefined, 'timeweb'));
  assert.equal(target.origin, 'https://app.dream-wheels.ru');
  assert.equal(target.pathname, '/new');
  assert.equal(target.search, '?utm_source=test');
  assert.equal(new URL(getAppTargetFromUrl('https://landing-test.dream-wheels.ru/', '/', 'timeweb')).pathname, '/');
});

test('RU domain hands off to its application subdomain', () => {
  const target = new URL(getAppTargetFromUrl('https://колесамечты.рф/catalog?utm_source=test'));
  assert.equal(target.hostname, 'app.dream-wheels.ru');
  assert.equal(target.pathname, '/new');
  assert.equal(target.searchParams.get('utm_source'), 'test');
});

test('RU and EN catalog links use their application subdomain and retain only marketing query', () => {
  for (const [host, app] of [['www.dream-wheels.ru', 'app.dream-wheels.ru'], ['dreamwheels.pro', 'app.dreamwheels.pro']]) {
    const target = new URL(getAppTargetFromUrl(`https://${host}/catalog?utm_source=landing&token=secret`));
    assert.equal(target.hostname, app);
    assert.equal(target.pathname, '/new');
    assert.equal(target.search, '?utm_source=landing');
  }
});
