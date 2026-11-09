import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import registry from '../src/data/catalog-asset-registry.json';
import config from '../src/data/catalog-storage.json';
import { buildUploadPlan, publishCatalog } from './catalog-storage.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);
function flag(name:string,required=false){const i=args.indexOf(name);if(i<0){if(required)throw Error(`Missing ${name}`);return undefined;}if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`Missing value for ${name}`);return args[i+1];}
const target=flag('--target',true);
if(target!=='production'&&target!=='staging')throw Error('Target must be production or staging');
const upload=args.includes('--upload');
if(upload&&flag('--confirm-target',true)!==target)throw Error('Target confirmation does not match');
const receiptOut=upload?flag('--receipt-out',true):undefined;
if(upload&&!(await fs.stat(path.dirname(path.resolve(receiptOut!)))).isDirectory())throw Error('Receipt directory is unavailable');
if(upload&&(!flag('--expected-project-ref')||flag('--confirm-policy-migration')!=='0043'))throw Error('Explicit project and reviewed migration 0043 required');
const plan=await buildUploadPlan(registry,{sourceDir:flag('--source-dir',true),publicDir:path.join(root,'landing/public')});
const result=await publishCatalog(plan,{target:config.targets[target],bucket:config.bucket,upload,
  expectedProjectRef:flag('--expected-project-ref'),confirmedPolicyMigration:flag('--confirm-policy-migration'),
  serviceKey:upload?process.env.CATALOG_STORAGE_SERVICE_ROLE_KEY:undefined});
const report=flag('--report');
if(report)await fs.writeFile(report,JSON.stringify(result,null,2)+'\n');
if(upload){
  // An activation receipt is written only after every object and all four origins were verified.
  await fs.writeFile(receiptOut!,JSON.stringify({version:1,target,publication:result},null,2)+'\n');
}
console.log(JSON.stringify({mode:result.mode,target,objects:result.objectCount,bytes:result.totalBytes,registryDigest:result.registryDigest}));
