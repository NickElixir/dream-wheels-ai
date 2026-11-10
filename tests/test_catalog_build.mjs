import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {assertCatalogBuild,expectedCatalogTarget} from '../scripts/catalog/verify-build.mjs';
import {build} from '../deploy/timeweb-static/build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFile(path.join(root,name),'utf8');
async function fixture(target){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'dw-catalog-build-'));
 for(const dir of ['landing/src/data','webapp/vnext','scripts/catalog','webapp/scripts'])await fs.mkdir(path.join(temp,dir),{recursive:true});
 for(const name of ['catalog-storage','catalog-publications','catalog-asset-registry','catalog-reconciliation','catalog-primary-skus'])await fs.copyFile(path.join(root,`landing/src/data/${name}.json`),path.join(temp,`landing/src/data/${name}.json`));
 const config=JSON.parse(await read('landing/src/data/catalog-storage.json')),publications=JSON.parse(await read('landing/src/data/catalog-publications.json')),registry=JSON.parse(await read('landing/src/data/catalog-asset-registry.json'));
 await fs.writeFile(path.join(temp,'webapp/vnext/catalog-assets.mjs'),`export const catalogAssetRegistry = ${JSON.stringify(registry)};\nexport const catalogStorageTarget = ${JSON.stringify(config.targets[target])};\nexport const catalogBucket = ${JSON.stringify(config.bucket)};\nexport const catalogPublication = ${JSON.stringify(publications[target])};\n`);
 await fs.copyFile(path.join(root,'webapp/vnext/catalog-data.mjs'),path.join(temp,'webapp/vnext/catalog-data.mjs'));
 await fs.copyFile(path.join(root,'scripts/catalog/verify-build.mjs'),path.join(temp,'scripts/catalog/verify-build.mjs'));
 return temp;
}
test('hosting profiles pin catalog target; overrides cannot weaken production/preview checks',()=>{
 assert.equal(expectedCatalogTarget({VERCEL_ENV:'production'}),'production');assert.equal(expectedCatalogTarget({VERCEL_ENV:'preview'}),'staging');
 assert.equal(expectedCatalogTarget({VERCEL_ENV:'preview',EXPECTED_SUPABASE_URL:'https://qmgyccghsbdpehiybjae.supabase.co'}),'production');
 assert.equal(expectedCatalogTarget({TIMEWEB_PROFILE:'ru-test'}),'production');
 assert.equal(expectedCatalogTarget({TIMEWEB_LANDING_PROFILE:'landing-ru-test'}),'staging');
 for(const env of [{VERCEL_ENV:'production',CATALOG_BUILD_TARGET:'staging'},{VERCEL_ENV:'production',EXPECTED_SUPABASE_URL:'https://qmgyccghsbdpehiybjae.supabase.co',CATALOG_BUILD_TARGET:'staging'},{TIMEWEB_LANDING_PROFILE:'landing-ru-production',CATALOG_BUILD_TARGET:'staging'}])assert.throws(()=>expectedCatalogTarget(env),/disagree/);
});
for(const target of ['staging','production'])test(`generated ${target} bundle fails closed for the other environment`,async()=>{
 const temp=await fixture(target);
 try{
  assert.equal(assertCatalogBuild({root:temp,env:{CATALOG_BUILD_TARGET:target}}),target);
  assert.throws(()=>assertCatalogBuild({root:temp,env:{CATALOG_BUILD_TARGET:target==='staging'?'production':'staging'}}),/deployment target/);
  const file=path.join(temp,'webapp/vnext/catalog-assets.mjs');await fs.writeFile(file,(await fs.readFile(file,'utf8')).replace('"digest":','"digest":"stale","oldDigest":'));
  assert.throws(()=>assertCatalogBuild({root:temp,env:{CATALOG_BUILD_TARGET:target}}),/stale registry/);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('actual Timeweb production builder rejects staging before installing, writing or publishing',async()=>{
 const temp=await fixture('staging');
 try{await assert.rejects(build({root:temp,output:path.join(temp,'artifact'),env:{TIMEWEB_PROFILE:'ru-production',APP_BUILD_SHA:'a'.repeat(40)}}),/deployment target/);await assert.rejects(fs.stat(path.join(temp,'artifact')));}
 finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('actual WebApp Vercel config and npm build commands reject active staging bundle in production',async()=>{
 const temp=await fixture('staging');
 try{
  await fs.copyFile(path.join(root,'webapp/scripts/build-public-config.mjs'),path.join(temp,'webapp/scripts/build-public-config.mjs'));
  await fs.copyFile(path.join(root, 'webapp/scripts/bundle-css.mjs'), path.join(temp, 'webapp/scripts/bundle-css.mjs'));
  await fs.copyFile(path.join(root, 'webapp/index.html'), path.join(temp, 'webapp/index.html'));
  await fs.copyFile(path.join(root, 'webapp/style.css'), path.join(temp, 'webapp/style.css'));
  await fs.cp(path.join(root, 'webapp/vnext/styles'), path.join(temp, 'webapp/vnext/styles'), { recursive: true });
  await fs.copyFile(path.join(root,'webapp/package.json'),path.join(temp,'webapp/package.json'));
  const env={...process.env,VERCEL_ENV:'production',CATALOG_BUILD_TARGET:'production'};delete env.EXPECTED_SUPABASE_URL;
  for(const [command,args] of [[process.execPath,['scripts/build-public-config.mjs']],['npm',['run','build']]])assert.throws(()=>execFileSync(command,args,{cwd:path.join(temp,'webapp'),env,stdio:'pipe'}),error=>/Catalog build mismatch: deployment target/.test(error.stderr?.toString()));
  await assert.rejects(fs.stat(path.join(temp,'webapp/auth/harness-config.js')));
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('actual Astro production build rejects active staging bundle before generating pages',async()=>{
 const temp=await fixture('staging');
 try{
  await fs.copyFile(path.join(root,'landing/astro.config.mjs'),path.join(temp,'landing/astro.config.mjs'));
  await fs.symlink(path.join(root,'landing/node_modules'),path.join(temp,'landing/node_modules'),'dir');
  await fs.mkdir(path.join(temp,'landing/src/pages'),{recursive:true});await fs.writeFile(path.join(temp,'landing/src/pages/index.astro'),'<html><body>test</body></html>');
  await fs.writeFile(path.join(temp,'landing/package.json'),'{"type":"module"}');
  const env={...process.env,VERCEL_ENV:'production',CATALOG_BUILD_TARGET:'production'};delete env.EXPECTED_SUPABASE_URL;
  assert.throws(()=>execFileSync(process.execPath,[path.join(root,'landing/node_modules/astro/bin/astro.mjs'),'build'],{cwd:path.join(temp,'landing'),env,stdio:'pipe'}),error=>/Catalog build mismatch: deployment target/.test(error.stderr?.toString()));
  await assert.rejects(fs.stat(path.join(temp,'landing/dist/index.html')));
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('stale generated primary SKU cannot pass a frontend build even with a valid target/receipt',async()=>{
 const temp=await fixture('production');
 try{
  const file=path.join(temp,'webapp/vnext/catalog-data.mjs');
  const source=await fs.readFile(file,'utf8');
  await fs.writeFile(file,source.replace(/"selectedSkuId": "[^"]+"/,'"selectedSkuId": "unapproved"'));
  assert.throws(()=>assertCatalogBuild({root:temp,env:{VERCEL_ENV:'production'}}),/primary SKU mappings/);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});

for(const explicit of [false,true])test(`staging production slot accepts pinned staging catalog: explicit target=${explicit}`,async()=>{
 const temp=await fixture('staging');
 try{
  await fs.mkdir(path.join(temp,'webapp/auth'));
  await fs.copyFile(path.join(root,'webapp/scripts/build-public-config.mjs'),path.join(temp,'webapp/scripts/build-public-config.mjs'));
  await fs.copyFile(path.join(root, 'webapp/scripts/bundle-css.mjs'), path.join(temp, 'webapp/scripts/bundle-css.mjs'));
  await fs.copyFile(path.join(root, 'webapp/index.html'), path.join(temp, 'webapp/index.html'));
  await fs.copyFile(path.join(root, 'webapp/style.css'), path.join(temp, 'webapp/style.css'));
  await fs.cp(path.join(root, 'webapp/vnext/styles'), path.join(temp, 'webapp/vnext/styles'), { recursive: true });
  const env={...process.env,VERCEL_ENV:'production',EXPECTED_SUPABASE_URL:'https://hnawojlnfoaccinlgjyn.supabase.co',SUPABASE_URL:'https://hnawojlnfoaccinlgjyn.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_test',TURNSTILE_SITE_KEY:'local-test'};
  delete env.TIMEWEB_PROFILE;delete env.TIMEWEB_LANDING_PROFILE;delete env.CATALOG_BUILD_TARGET;
  if(explicit)env.CATALOG_BUILD_TARGET='staging';
  assert.equal(expectedCatalogTarget(env),'staging');assert.equal(assertCatalogBuild({root:temp,env}),'staging');
  execFileSync(process.execPath,['scripts/build-public-config.mjs'],{cwd:path.join(temp,'webapp'),env,stdio:'pipe'});
  const config=await fs.readFile(path.join(temp,'webapp/auth/harness-config.js'),'utf8');
  assert.ok(config.includes('https://hnawojlnfoaccinlgjyn.supabase.co'));assert.ok(!config.includes('qmgyccghsbdpehiybjae'));
  const productionEnv={...env,EXPECTED_SUPABASE_URL:'https://qmgyccghsbdpehiybjae.supabase.co',SUPABASE_URL:'https://qmgyccghsbdpehiybjae.supabase.co',CATALOG_BUILD_TARGET:'production'};
  assert.throws(()=>assertCatalogBuild({root:temp,env:productionEnv}),/deployment target/);
  assert.throws(()=>execFileSync(process.execPath,['scripts/build-public-config.mjs'],{cwd:path.join(temp,'webapp'),env:productionEnv,stdio:'pipe'}),error=>/Catalog build mismatch: deployment target/.test(error.stderr?.toString()));
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
