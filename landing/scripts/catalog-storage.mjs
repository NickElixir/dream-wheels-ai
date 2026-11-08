import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { catalogPublicImageUrl } from '../../webapp/vnext/catalog-images.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
const expectedBytes = 8 * 1024 * 1024;
const approvedOrigins = ['https://www.dream-wheels.ru','https://dreamwheels.pro','https://app.dream-wheels.ru','https://app.dreamwheels.pro'];

async function readBoundedFile(directory, relative, metadata) {
    const root = await fs.realpath(directory);
    const file = await fs.realpath(path.resolve(root, relative));
    if (!file.startsWith(root + path.sep)) throw Error('Catalog source escapes its directory');
    const stat = await fs.stat(file);
    if (stat.size !== metadata.sizeBytes || stat.size > expectedBytes) throw Error(`Catalog size mismatch: ${metadata.fileName}`);
    const bytes = await fs.readFile(file);
    if (hash(bytes) !== metadata.sha256) throw Error(`Catalog checksum mismatch: ${metadata.fileName}`);
    return bytes;
}

export async function buildUploadPlan(registry, {sourceDir, publicDir}) {
    if (registry.version !== 1 || hash(JSON.stringify(registry.assets)) !== registry.digest) throw Error('Catalog registry digest mismatch');
    const entries=[];
    for(const asset of registry.assets) {
        if (asset.id !== `wheel-image-${asset.barcode}`) throw Error('Invalid catalog asset identity');
        const source=asset.source;
        if (!new RegExp(`^${asset.barcode}_\\d+\\.jpg$`).test(source.fileName)) throw Error('Invalid catalog source filename');
        entries.push({...source,assetId:asset.id,bytes:await readBoundedFile(sourceDir,source.fileName,source)});
        for(const size of ['320','640']) {
            const preview=asset.previews[size];
            if(preview.landingPath!==`/assets/catalog/cutouts-v1/reference-${asset.barcode}-${size}.webp`)throw Error('Invalid preview mapping');
            entries.push({...preview,assetId:asset.id,bytes:await readBoundedFile(publicDir,preview.landingPath.slice(1),preview)});
        }
    }
    if(new Set(entries.map(x=>x.objectPath)).size!==entries.length)throw Error('Duplicate catalog object path');
    return {registryDigest:registry.digest,entries};
}

async function readPublicObject(entry,target,bucket,fetchImpl,origin) {
    const url=catalogPublicImageUrl(target,bucket,entry.objectPath);
    const response=await fetchImpl(url,{redirect:'error',credentials:'omit',signal:AbortSignal.timeout(30000),headers:origin?{Origin:origin}:{}});
    if(response.status===404)return false;
    // Hosted Storage can wrap a missing object (404/NoSuchKey) in HTTP 400.
    if(response.status===400) {
        const error=await response.json().catch(()=>null);
        if(String(error?.statusCode)==='404'&&error?.code==='NoSuchKey'&&error?.error==='not_found')return false;
    }
    if(!response.ok) {
        const error=Error(`Catalog read failed (${response.status}): ${entry.objectPath}`);
        error.retryable=response.status===429||response.status>=500;
        throw error;
    }
    if((response.headers.get('content-type')||'').split(';')[0]!==entry.contentType)throw Error('Catalog remote content type mismatch');
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length!==entry.sizeBytes||hash(bytes)!==entry.sha256)throw Error(`Catalog remote checksum mismatch: ${entry.objectPath}`);
    if(origin&&!['*',origin].includes(response.headers.get('access-control-allow-origin')))throw Error(`Catalog CORS failed for ${origin}`);
    return true;
}

export async function verifyPublicObject(entry,target,bucket,fetchImpl=fetch,origin) {
    for(let attempt=0;attempt<3;attempt++) {
        try {return await readPublicObject(entry,target,bucket,fetchImpl,origin);}
        catch(error) {
            const transient=error.retryable||error.name==='TimeoutError'||error instanceof TypeError;
            if(!transient||attempt===2)throw error;
            await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
        }
    }
}

export async function publishCatalog(plan,{target,bucket,upload=false,expectedProjectRef,confirmedPolicyMigration,serviceKey,fetchImpl=fetch}) {
    if(!plan.entries.length)throw Error('Empty catalog publication');
    plan.entries.forEach(entry=>catalogPublicImageUrl(target,bucket,entry.objectPath));
    const summary={registryDigest:plan.registryDigest,projectRef:target.projectRef,bucket,objectCount:plan.entries.length,totalBytes:plan.entries.reduce((n,x)=>n+x.sizeBytes,0)};
    // Dry run performs no network requests and never reads credentials.
    if(!upload)return {...summary,mode:'dry-run',objects:plan.entries.map(({objectPath,sizeBytes,sha256,contentType})=>({objectPath,sizeBytes,sha256,contentType}))};
    if(expectedProjectRef!==target.projectRef||confirmedPolicyMigration!=='0043')throw Error('Explicit target and policy migration confirmation required');
    if(!serviceKey)throw Error('CATALOG_STORAGE_SERVICE_ROLE_KEY is required for publication');
    const headers={Authorization:`Bearer ${serviceKey}`,apikey:serviceKey};
    const bucketResponse=await fetchImpl(`${target.origin}/storage/v1/bucket/${bucket}`,{headers,redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!bucketResponse.ok)throw Error(`Catalog bucket is unavailable (${bucketResponse.status}); apply migration 0043 first`);
    const config=await bucketResponse.json();
    if(config.id!==bucket||config.public!==true||config.file_size_limit!==expectedBytes||!['image/jpeg','image/png','image/webp'].every(type=>config.allowed_mime_types?.includes(type)))throw Error('Catalog bucket configuration mismatch');
    let uploaded=0;
    for(const entry of plan.entries) {
        if(await verifyPublicObject(entry,target,bucket,fetchImpl))continue;
        const response=await fetchImpl(`${target.origin}/storage/v1/object/${bucket}/${entry.objectPath}`,{
            method:'POST',headers:{...headers,'Content-Type':entry.contentType,'x-upsert':'false','cache-control':'max-age=31536000'},
            body:entry.bytes,redirect:'error',signal:AbortSignal.timeout(30000)});
        // A concurrent publisher may have created the immutable object. Its bytes still must match.
        if(!response.ok&&![400,409].includes(response.status))throw Error(`Catalog upload failed (${response.status}): ${entry.objectPath}`);
        if(!await verifyPublicObject(entry,target,bucket,fetchImpl))throw Error('Catalog object was not publicly verified after upload');
        uploaded++;
    }
    for(const origin of approvedOrigins)if(!await verifyPublicObject(plan.entries[0],target,bucket,fetchImpl,origin))throw Error('Catalog CORS verification object is missing');
    return {...summary,mode:'published',uploaded,verifiedAt:new Date().toISOString(),corsOrigins:approvedOrigins};
}
