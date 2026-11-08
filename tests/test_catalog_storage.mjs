import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildUploadPlan, publishCatalog, verifyPublicObject } from '../landing/scripts/catalog-storage.mjs';
import { catalogPublicImageUrl, isCatalogPublicationReady, verifyCatalogImage, resolveCatalogImage } from '../webapp/vnext/catalog-images.mjs';
import { catalogAssetRegistry } from '../webapp/vnext/catalog-assets.mjs';
import { CatalogHandoffController, HANDOFF_KEY } from '../webapp/vnext/catalog-handoff.mjs';
import { catalogEntries } from '../webapp/vnext/catalog-data.mjs';
const target={projectRef:'hnawojlnfoaccinlgjyn',origin:'https://hnawojlnfoaccinlgjyn.supabase.co'};
const bucket='catalog-wheels';
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=Buffer.from('local test image payload');
const entry={objectPath:`wheels/123456789012/${hash(bytes)}/source.jpg`,sizeBytes:bytes.length,sha256:hash(bytes),contentType:'image/jpeg',bytes};
const plan={registryDigest:'reviewed-registry',entries:[entry]};
const uploadOptions={target,bucket,upload:true,expectedProjectRef:target.projectRef,confirmedPolicyMigration:'0043',serviceKey:'test-server-key'};
function store(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function remote({existing=false,corrupt=false,cors='*',failUpload=false}={}){
  let exists=existing;const requests=[];
  const fetchImpl=async(url,options={})=>{
    requests.push({url,options});
    if(url.includes('/bucket/'))return Response.json({id:bucket,public:true,file_size_limit:8388608,allowed_mime_types:['image/jpeg','image/png','image/webp']});
    if(options.method==='POST'){
      assert.equal(options.headers['x-upsert'],'false');assert.equal(options.headers.Authorization,'Bearer test-server-key');
      if(failUpload)return new Response('failed',{status:500});exists=true;return new Response('{}',{status:200});
    }
    assert.equal(options.headers?.Authorization,undefined,'public download must never receive service credentials');
    if(!exists)return new Response('',{status:404});
    return new Response(corrupt?Buffer.from('changed'):bytes,{status:200,headers:{'content-type':'image/jpeg','access-control-allow-origin':cors}});
  };
  return {fetchImpl,requests};
}
test('public URLs allow only reviewed Supabase Storage paths',()=>{
  assert.match(catalogPublicImageUrl(target,bucket,entry.objectPath),/^https:\/\/hnawojlnfoaccinlgjyn\.supabase\.co\/storage\/v1\/object\/public\/catalog-wheels\//);
  for(const origin of ['https://evil.test','http://hnawojlnfoaccinlgjyn.supabase.co','https://hnawojlnfoaccinlgjyn.supabase.co:443/other','https://key@hnawojlnfoaccinlgjyn.supabase.co'])assert.throws(()=>catalogPublicImageUrl({...target,origin},bucket,entry.objectPath));
  assert.throws(()=>catalogPublicImageUrl(target,'raw',entry.objectPath));assert.throws(()=>catalogPublicImageUrl(target,bucket,'../../raw/private.jpg'));
});
test('readiness requires the complete verified registry in the correct environment',()=>{
  const registry={digest:'approved',assets:[{}]};const publication={mode:'published',registryDigest:'approved',projectRef:target.projectRef,bucket,objectCount:3};
  assert.equal(isCatalogPublicationReady(registry,target,bucket,publication),true);
  for(const changed of [{mode:'dry-run'},{registryDigest:'old'},{projectRef:'other'},{objectCount:2},{bucket:'raw'}])assert.equal(isCatalogPublicationReady(registry,target,bucket,{...publication,...changed}),false);
  assert.equal(isCatalogPublicationReady(registry,target,bucket,null),false);
});
test('image bytes must match the approved original, not just its MIME type',async()=>{
  const selection={imageAsset:{source:entry}};
  assert.equal(await verifyCatalogImage(new Blob([bytes],{type:'image/jpeg'}),selection),true);
  assert.equal(await verifyCatalogImage(new Blob([Buffer.alloc(bytes.length)],{type:'image/jpeg'}),selection),false);
  assert.equal(await verifyCatalogImage(new Blob([bytes],{type:'image/png'}),selection),false);
});
test('registry sources are JPEG originals and shared by all executions of a design',()=>{
  assert.equal(catalogAssetRegistry.assets.length,22);
  for(const pair of catalogEntries){const asset=resolveCatalogImage(pair.assetId);assert.ok(asset);assert.equal(asset.source.contentType,'image/jpeg');assert.match(asset.image,/\/source\.jpg$/);assert.match(asset.thumbnail,/\/preview-640-/);}
  assert.equal(new Set(catalogEntries.map(e=>resolveCatalogImage(e.assetId).image)).size,22);
});
test('an unpublished catalog never starts a download or overwrites a user draft',async()=>{
  const selected=catalogEntries.find(e=>e.selectedSkuId),storage=store();let writes=0,downloads=0;
  storage.setItem(HANDOFF_KEY,JSON.stringify({version:1,variantId:selected.variantId,skuId:selected.selectedSkuId,locale:'ru',source:'catalog',createdAt:Date.now()}));
  const c=new CatalogHandoffController({storage,current:()=>({authenticated:true,owner:'alice',version:1,wheel:null}),persist:()=>writes++,apply(){},publish(){},fetchImage:()=>downloads++,isReady:()=>false});
  await c.resume();assert.equal(downloads,0);assert.equal(writes,0);assert.equal(c.error,'unavailable');assert.ok(c.pending);
});
test('dry run never makes network calls, reads credentials or produces an activation receipt',async()=>{
  const result=await publishCatalog(plan,{target,bucket,fetchImpl(){throw Error('network forbidden');}});
  assert.equal(result.mode,'dry-run');assert.equal(result.objectCount,1);assert.equal(result.verifiedAt,undefined);assert.equal(result.uploaded,undefined);
});
test('publication rejects wrong target, missing policy acknowledgment and missing key before network',async()=>{
  for(const overrides of [{expectedProjectRef:'other'},{confirmedPolicyMigration:''},{serviceKey:''}])await assert.rejects(publishCatalog(plan,{...uploadOptions,...overrides,fetchImpl(){throw Error('Unexpected network');}}));
});
test('publication uploads once, verifies bytes and all RU/EN origins, then returns a receipt',async()=>{
  const r=remote();const result=await publishCatalog(plan,{...uploadOptions,fetchImpl:r.fetchImpl});
  assert.equal(result.mode,'published');assert.equal(result.uploaded,1);assert.equal(result.corsOrigins.length,4);assert.equal(r.requests.filter(x=>x.options.method==='POST').length,1);
  assert.ok(r.requests.filter(x=>x.url.includes('/object/public/')).every(x=>x.options.credentials==='omit'));
});
test('rerun is idempotent; an existing object is never overwritten',async()=>{
  const r=remote({existing:true});const result=await publishCatalog(plan,{...uploadOptions,fetchImpl:r.fetchImpl});assert.equal(result.uploaded,0);assert.equal(r.requests.filter(x=>x.options.method==='POST').length,0);
});
test('hosted HTTP 400 NoSuchKey permits missing-object upload, but other 400 errors fail closed',async()=>{
  const r=remote();
  const fetchImpl=async(url,options)=>{
    const response=await r.fetchImpl(url,options);
    return response.status===404?Response.json({statusCode:'404',error:'not_found',message:'Object not found',code:'NoSuchKey'},{status:400}):response;
  };
  assert.equal((await publishCatalog(plan,{...uploadOptions,fetchImpl})).uploaded,1);
  for(const error of [{statusCode:'404',error:'not_found',code:'NoSuchBucket'},{statusCode:'400',error:'InvalidRequest',code:'NoSuchKey'}])
    await assert.rejects(verifyPublicObject(entry,target,bucket,async()=>Response.json(error,{status:400})),/Catalog read failed/);
  await assert.rejects(verifyPublicObject(entry,target,bucket,async()=>new Response('invalid',{status:400})),/Catalog read failed/);
});
test('public verification retries bounded transient errors without retrying checksum failures',async()=>{
  let calls=0;
  const transient=async()=>{calls++;if(calls===1)throw new DOMException('slow network','TimeoutError');if(calls===2)return new Response('',{status:503});return new Response(bytes,{headers:{'content-type':'image/jpeg'}});};
  assert.equal(await verifyPublicObject(entry,target,bucket,transient),true);assert.equal(calls,3);
  calls=0;
  await assert.rejects(verifyPublicObject(entry,target,bucket,async()=>{calls++;throw new TypeError('network');}),/network/);assert.equal(calls,3);
  calls=0;
  await assert.rejects(verifyPublicObject(entry,target,bucket,async()=>{calls++;return new Response('wrong',{headers:{'content-type':'image/jpeg'}});}),/checksum/);assert.equal(calls,1);
});
test('corrupt remote content, failed uploads and CORS failure never produce a publication receipt',async()=>{
  for(const options of [{existing:true,corrupt:true},{failUpload:true},{cors:'https://wrong.test'}]){
    const r=remote(options);await assert.rejects(publishCatalog(plan,{...uploadOptions,fetchImpl:r.fetchImpl}));
    if(options.corrupt)assert.equal(r.requests.filter(x=>x.options.method==='POST').length,0);
  }
});
test('dry-run source verification detects changed files and directory escapes',async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'dw-catalog-plan-'));
  try{
    await fs.mkdir(path.join(temp,'source'));await fs.mkdir(path.join(temp,'public/assets/catalog/cutouts-v1'),{recursive:true});
    const base={fileName:'123456789012_1.jpg',sha256:hash(bytes),sizeBytes:bytes.length,contentType:'image/jpeg',objectPath:entry.objectPath};
    const previews=Object.fromEntries(['320','640'].map(size=>[size,{...base,fileName:`reference-123456789012-${size}.webp`,landingPath:`/assets/catalog/cutouts-v1/reference-123456789012-${size}.webp`,objectPath:entry.objectPath.replace('source.jpg',`preview-${size}-${hash(bytes)}.webp`)}]));
    const assets=[{id:'wheel-image-123456789012',barcode:'123456789012',source:base,previews}];const registry={version:1,digest:hash(JSON.stringify(assets)),assets};
    await fs.writeFile(path.join(temp,'source',base.fileName),bytes);for(const preview of Object.values(previews))await fs.writeFile(path.join(temp,'public',preview.landingPath),bytes);
    const paths={sourceDir:path.join(temp,'source'),publicDir:path.join(temp,'public')};assert.equal((await buildUploadPlan(registry,paths)).entries.length,3);
    await fs.writeFile(path.join(temp,'source',base.fileName),'tampered');await assert.rejects(buildUploadPlan(registry,paths),/mismatch/);
    await fs.unlink(path.join(temp,'source',base.fileName));await fs.writeFile(path.join(temp,'outside.jpg'),bytes);await fs.symlink(path.join(temp,'outside.jpg'),path.join(temp,'source',base.fileName));await assert.rejects(buildUploadPlan(registry,paths),/escapes/);
  }finally{await fs.rm(temp,{recursive:true,force:true});}
});
