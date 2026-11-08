import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const projects = Object.freeze({production:'qmgyccghsbdpehiybjae',staging:'hnawojlnfoaccinlgjyn'});
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function expectedCatalogTarget(env = {}) {
    const required = [];
    if (env.VERCEL_ENV === 'production') required.push('production');
    if (env.VERCEL_ENV === 'preview') required.push('staging');
    if (env.TIMEWEB_PROFILE) {
        if (!['ru-test','ru-production'].includes(env.TIMEWEB_PROFILE)) throw Error('Unknown Timeweb catalog profile');
        // Both RU app profiles currently use production Auth/API/data.
        required.push('production');
    }
    if (env.TIMEWEB_LANDING_PROFILE) {
        if (!['landing-ru-test','landing-ru-production'].includes(env.TIMEWEB_LANDING_PROFILE)) throw Error('Unknown Landing catalog profile');
        required.push(env.TIMEWEB_LANDING_PROFILE === 'landing-ru-production' ? 'production' : 'staging');
    }
    if (env.EXPECTED_SUPABASE_URL) {
        const known = {'https://hnawojlnfoaccinlgjyn.supabase.co':'staging','https://qmgyccghsbdpehiybjae.supabase.co':'production'};
        const target = known[env.EXPECTED_SUPABASE_URL.replace(/\/$/, '')];
        if (!target) throw Error('Unknown catalog deployment project');
        required.push(target);
    }
    if (env.CATALOG_BUILD_TARGET) {
        if (!['staging','production'].includes(env.CATALOG_BUILD_TARGET)) throw Error('Invalid CATALOG_BUILD_TARGET');
        required.push(env.CATALOG_BUILD_TARGET);
    }
    if (new Set(required).size > 1) throw Error('Catalog deployment profiles disagree');
    return required[0] || 'production';
}

export function assertCatalogBuild({env = process.env, root = repository} = {}) {
    const target = expectedCatalogTarget(env);
    const read = name => JSON.parse(fs.readFileSync(path.join(root,'landing/src/data',name),'utf8'));
    const registry = read('catalog-asset-registry.json');
    const config = read('catalog-storage.json');
    const publications = read('catalog-publications.json');
    const expected = {projectRef:projects[target],origin:`https://${projects[target]}.supabase.co`};
    if (config.targets[target]?.projectRef !== expected.projectRef || config.targets[target]?.origin !== expected.origin || config.bucket !== 'catalog-wheels') throw Error('Catalog build destination config is invalid');
    const source = fs.readFileSync(path.join(root,'webapp/vnext/catalog-assets.mjs'),'utf8');
    const generated = name => {
        const match = source.match(new RegExp(`export const ${name} = ([\\s\\S]*?);(?:\\r?\\n|$)`));
        if (!match) throw Error(`Missing generated catalog ${name}`);
        return JSON.parse(match[1]);
    };
    const equal = (actual,expected,label) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error(`Catalog build mismatch: ${label}; regenerate --target ${target}`);
    };
    if (createHash('sha256').update(JSON.stringify(registry.assets)).digest('hex') !== registry.digest) throw Error('Catalog build registry digest mismatch');
    equal(generated('catalogStorageTarget'),config.targets[target],'deployment target');
    equal(generated('catalogBucket'),config.bucket,'bucket');
    equal(generated('catalogAssetRegistry'),registry,'stale registry');
    equal(generated('catalogPublication'),publications[target],'stale publication');
    const receipt = publications[target];
    if (receipt && (receipt.mode !== 'published' || receipt.registryDigest !== registry.digest || receipt.projectRef !== config.targets[target].projectRef || receipt.bucket !== config.bucket || receipt.objectCount !== registry.assets.length * 3)) throw Error('Catalog build publication is invalid');
    const links = read('catalog-reconciliation.json').links;
    const primary = read('catalog-primary-skus.json');
    const data = fs.readFileSync(path.join(root,'webapp/vnext/catalog-data.mjs'),'utf8').match(/export const catalogEntries = ([\s\S]*?);(?:\r?\n|$)/);
    if (!data) throw Error('Missing generated catalog entries');
    const entries = JSON.parse(data[1]);
    const variants = [...new Set(links.map(link=>link.variantId))];
    if (entries.length !== variants.length || new Set(entries.map(entry=>entry.variantId)).size !== variants.length) throw Error('Stale catalog pair mappings');
    for (const id of variants) {
        const rows = links.filter(link=>link.variantId===id);
        const entry = entries.find(item=>item.variantId===id);
        const selected = primary[id] || (rows.length===1 ? rows[0].skuId : null);
        if (!entry || !selected || entry.selectedSkuId !== selected || entry.skus.length !== rows.length || new Set(entry.skus.map(sku=>sku.id)).size !== rows.length) throw Error('Stale catalog primary SKU mappings');
        for (const row of rows) {
            const sku = entry.skus.find(item=>item.id===row.skuId);
            if (!sku || sku.sku !== row.sku || entry.assetId !== row.assetId || entry.designId !== row.designId || entry.vehicleId !== row.vehicleId || Object.keys(row.parameters).some(key=>sku[key]!==row.parameters[key])) throw Error('Stale catalog SKU specifications');
        }
    }
    return target;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    console.log(`Catalog build verified: ${assertCatalogBuild()}`);
}
