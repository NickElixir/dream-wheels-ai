import test from 'node:test';
import assert from 'node:assert/strict';
import registry from '../src/data/catalog-asset-registry.json';
import reconciliation from '../src/data/catalog-reconciliation.json';
import { resolveCatalogImage, isCatalogPublicationReady } from '../../webapp/vnext/catalog-images.mjs';
import { selectedCatalogSku, catalogHandoffUrl } from '../src/lib/catalog-handoff';
import { showcaseVariants, getWheel } from '../src/data/catalog';
import { catalogEntries } from '../../webapp/vnext/catalog-data.mjs';
import { resolveCatalogSelection } from '../../webapp/vnext/catalog-handoff.mjs';
test('both catalog CTAs use the locale app domain and only canonical IDs',()=>{
  for(const variant of showcaseVariants)for(const locale of ['ru','en'] as const)for(const source of ['catalog','catalog-product-card']) {
    const url=new URL(catalogHandoffUrl('http://localhost/catalog?utm_source=test&token=secret',variant,locale,source)!);
    assert.equal(url.hostname,locale==='ru'?'app.dream-wheels.ru':'app.dreamwheels.pro');assert.equal(url.pathname,'/new');
    assert.equal(url.searchParams.get('catalog_sku'),selectedCatalogSku(variant)?.id);assert.equal(url.searchParams.get('utm_source'),'test');assert.equal(url.searchParams.has('token'),false);
    assert.equal(url.searchParams.has('image'),false);assert.equal(url.searchParams.get('catalog_locale'),locale);
  }
});
test('all thirty cards resolve one approved SKU and reject other executions of the same design',()=>{
  for(const pair of showcaseVariants){
    const sku=selectedCatalogSku(pair);assert.ok(sku,`Unresolved pair: ${pair.id}`);
    assert.ok(resolveCatalogSelection({variantId:pair.id,skuId:sku.id}));
    for(const other of pair.skuIds.filter(id=>id!==sku.id))assert.equal(resolveCatalogSelection({variantId:pair.id,skuId:other}),null);
  }
});
test('all thirty pair mappings and barcode images match WebApp manifest; unresolved executions never choose the first SKU',()=>{
  assert.equal(catalogEntries.length,30);
  for(const pair of showcaseVariants) {
    const entry=catalogEntries.find(x=>x.variantId===pair.id)!;assert.ok(entry);
    assert.deepEqual(entry.skus.map(x=>x.id),pair.skuIds);assert.equal(entry.selectedSkuId,selectedCatalogSku(pair)?.id||null);
    assert.equal(entry.designId,pair.wheelId);assert.equal(resolveCatalogImage(entry.assetId)?.barcode,getWheel(pair.wheelId)!.referenceBarcode);
    if(!entry.selectedSkuId)assert.equal(catalogHandoffUrl('https://dreamwheels.pro/catalog',pair,'en'),null);
  }
});

test('reconciled workbook preserves 71 links to 22 source images without choosing executions',()=>{
  assert.equal(reconciliation.links.length,71);assert.equal(registry.assets.length,22);
  for(const link of reconciliation.links){
    const entry=catalogEntries.find(x=>x.variantId===link.variantId)!;
    assert.ok(entry.skus.some(x=>x.id===link.skuId&&x.sku===link.sku));assert.equal(entry.assetId,link.assetId);assert.equal(link.fitmentStatus,'unknown');
  }
  assert.equal(isCatalogPublicationReady(registry,{projectRef:'staging'},'catalog-wheels',null),false);
});
