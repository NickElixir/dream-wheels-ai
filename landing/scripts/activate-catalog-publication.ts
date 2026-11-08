import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import registry from '../src/data/catalog-asset-registry.json';
import config from '../src/data/catalog-storage.json';
import { isCatalogPublicationReady } from '../../webapp/vnext/catalog-images.mjs';
import { verifyPublicObject } from './catalog-storage.mjs';
const args=process.argv.slice(2);
const flag=(key:string)=>{const i=args.indexOf(key);if(i<0||!args[i+1])throw Error(`Missing ${key}`);return args[i+1];};
const target=flag('--target');
if(target!=='production'&&target!=='staging')throw Error('Invalid catalog target');
const receipt=JSON.parse(await fs.readFile(flag('--receipt'),'utf8'));
if(receipt.version!==1||receipt.target!==target||createHash('sha256').update(JSON.stringify(registry.assets)).digest('hex')!==registry.digest
  ||!isCatalogPublicationReady(registry,config.targets[target],config.bucket,receipt.publication))throw Error('Publication receipt does not match the reviewed target/registry');
const entries=registry.assets.flatMap(asset=>[asset.source,asset.previews['320'],asset.previews['640']]);
for(const entry of entries)if(!await verifyPublicObject(entry,config.targets[target],config.bucket))throw Error('A published image is missing');
for(const origin of ['https://www.dream-wheels.ru','https://dreamwheels.pro','https://app.dream-wheels.ru','https://app.dreamwheels.pro'])
  if(!await verifyPublicObject(entries[0],config.targets[target],config.bucket,fetch,origin))throw Error('Catalog CORS probe failed');
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/data/catalog-publications.json');
const existing=JSON.parse(await fs.readFile(file,'utf8'));
existing[target]=receipt.publication;
await fs.writeFile(file,JSON.stringify(existing,null,2)+'\n');
console.log(`Verified catalog publication activated locally for ${target}; regenerate with build-handoff.ts --target ${target}`);
