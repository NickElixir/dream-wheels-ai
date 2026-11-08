import { catalogAssetRegistry, catalogStorageTarget, catalogPublication, catalogBucket } from './catalog-assets.mjs';

export function catalogPublicImageUrl(target, bucket, objectPath) {
    const origin = new URL(target.origin);
    if (origin.protocol !== 'https:' || origin.hostname !== `${target.projectRef}.supabase.co`
        || origin.username || origin.password || origin.port || origin.pathname !== '/' || origin.search || origin.hash
        || bucket !== 'catalog-wheels' || !/^wheels\/\d{8,16}\/[a-f0-9]{64}\/(?:source\.jpg|preview-(?:320|640)-[a-f0-9]{64}\.webp)$/.test(objectPath)) {
        throw new Error('Invalid catalog Storage destination');
    }
    return `${origin.origin}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export function isCatalogPublicationReady(registry, target, bucket, publication) {
    return Boolean(publication && publication.mode === 'published' && publication.registryDigest === registry.digest
        && publication.projectRef === target.projectRef && publication.bucket === bucket
        && publication.objectCount === registry.assets.length * 3);
}

export function isCatalogStorageReady() {
    return isCatalogPublicationReady(catalogAssetRegistry, catalogStorageTarget, catalogBucket, catalogPublication);
}

export function resolveCatalogImage(assetId) {
    const asset = catalogAssetRegistry.assets.find(item => item.id === assetId);
    if (!asset) return null;
    return { ...asset, image: catalogPublicImageUrl(catalogStorageTarget, catalogBucket, asset.source.objectPath),
        thumbnail: catalogPublicImageUrl(catalogStorageTarget, catalogBucket, asset.previews['640'].objectPath),
        preview320: catalogPublicImageUrl(catalogStorageTarget, catalogBucket, asset.previews['320'].objectPath),
        storageReady: isCatalogStorageReady() };
}

export async function verifyCatalogImage(blob, selection) {
    const expected = selection.imageAsset?.source;
    if (!expected || blob.size !== expected.sizeBytes || blob.type !== expected.contentType) return false;
    const bytes = await blob.arrayBuffer();
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return hash === expected.sha256;
}
