import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { showcaseVariants, getWheel, getVehicle, getWheelSku } from '../src/data/catalog';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flag = (key: string) => { const i=args.indexOf(key); if(i<0 || !args[i+1])throw Error(`Missing ${key}`);return args[i+1]; };
const audit = JSON.parse(execFileSync('python3', [path.join(root,'scripts/catalog/audit_sources.py'),
  '--workbook',flag('--workbook'),'--matrix',flag('--matrix'),'--source-dir',flag('--source-dir'),
  '--public-dir',path.join(root,'landing/public')],{encoding:'utf8'}));
const normalize = (value: string) => value.toLowerCase().replaceAll('’',"'").replace(/\s+/g,' ').trim();
const links: Record<string,unknown>[] = [];
assert.equal(audit.skuRows.length,71);assert.equal(audit.designRows.length,30);assert.equal(audit.assets.length,22);
for(const variant of showcaseVariants) {
  const vehicle=getVehicle(variant.vehicleId)!, wheel=getWheel(variant.wheelId)!;
  const selection=audit.selections.find((r:any)=>r.selection_id===variant.id);
  assert.ok(selection,`Missing pair ${variant.id}`);assert.equal(selection.barcode,wheel.referenceBarcode);
  assert.equal(normalize(selection.car),normalize(vehicle.displayName));assert.equal(normalize(selection.wheel_model),normalize(wheel.displayName));
  const summary=audit.designRows.find((r:any)=>normalize(r.A)===normalize(vehicle.displayName)&&normalize(r.C)===normalize(wheel.displayName));
  assert.ok(summary,`Missing workbook design ${variant.id}`);assert.equal(summary.F,wheel.referenceBarcode);
  const actual=variant.skuIds.map(id=>getWheelSku(id)!);
  assert.deepEqual(new Set(summary.G.split(',').map((x:string)=>x.trim())),new Set(actual.map(x=>x.sku)),`SKU set ${variant.id}`);
  for(const sku of actual){
    const row=audit.skuRows.find((r:any)=>normalize(r.A)===normalize(vehicle.displayName)&&r.F===sku.sku);
    assert.ok(row,`Missing SKU row ${variant.id}/${sku.sku}`);
    assert.equal(normalize(row.D),normalize(wheel.displayName));
    for(const [key,col] of [['width','H'],['diameter','I'],['et','K'],['dia','L']] as const)assert.equal(sku[key],Number(row[col].replace(',','.')),`${sku.sku} ${key}`);
    assert.equal(sku.pcd,row.J);
    links.push({variantId:variant.id,vehicleId:vehicle.id,vehicle:vehicle.displayName,designId:wheel.id,design:wheel.displayName,
      skuId:sku.id,sku:sku.sku,barcode:wheel.referenceBarcode,assetId:`wheel-image-${wheel.referenceBarcode}`,excelRow:row.excelRow,
      parameters:{width:sku.width,diameter:sku.diameter,pcd:sku.pcd,et:sku.et,dia:sku.dia},fitmentStatus:'unknown'});
  }
}
assert.equal(links.length,71);assert.equal(new Set(links.map(x=>x.skuId)).size,68);
const assets=audit.assets.map((asset:any)=>{
  const prefix=`wheels/${asset.barcode}/${asset.source.sha256}`;
  return {...asset,source:{...asset.source,objectPath:`${prefix}/source.jpg`},previews:Object.fromEntries(Object.entries(asset.previews).map(([size,data]:[string,any])=>[size,{...data,objectPath:`${prefix}/preview-${size}-${data.sha256}.webp`}]))};
});
const digest=createHash('sha256').update(JSON.stringify(assets)).digest('hex');
const registry={version:1,digest,assets};
const report={version:1,workbookSha256:audit.workbookSha256,matrixSha256:audit.matrixSha256,registryDigest:digest,
  counts:{pairs:30,images:22,rows:71,uniqueSkus:68,multiSkuPairs:showcaseVariants.filter(x=>x.skuIds.length>1).length},links};
fs.writeFileSync(path.join(root,'landing/src/data/catalog-asset-registry.json'),JSON.stringify(registry,null,2)+'\n');
fs.writeFileSync(path.join(root,'landing/src/data/catalog-reconciliation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.counts));
