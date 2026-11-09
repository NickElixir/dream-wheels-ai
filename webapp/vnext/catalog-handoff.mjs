import { catalogEntries } from './catalog-data.mjs';
import { resolveCatalogImage, isCatalogStorageReady, verifyCatalogImage } from './catalog-images.mjs';
export const HANDOFF_KEY = 'dreamWheelsCatalogHandoff:v1';
const TTL = 24 * 60 * 60 * 1000;
const keys = ['catalog_variant', 'catalog_sku', 'catalog_locale', 'catalog_source'];
const sources = new Set(['catalog', 'catalog-product-card']);
const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

export function resolveCatalogSelection(value) {
    const entry = catalogEntries.find(item => item.variantId === value?.variantId);
    const sku = entry?.skus.find(item => item.id === value?.skuId);
    // A link cannot select a different execution of a design than the approved pair mapping.
    if (!sku || sku.id !== entry.selectedSkuId) return null;
    const imageAsset = resolveCatalogImage(entry.assetId);
    if (!imageAsset) return null;
    return { ...entry, sku, skuId: sku.id, imageAsset, image: imageAsset.image, thumbnail: imageAsset.thumbnail };
}

export function readCatalogHandoff(storage, now = Date.now()) {
    try {
        const value = JSON.parse(storage.getItem(HANDOFF_KEY));
        if (value?.version !== 1 || !Number.isFinite(value.createdAt) || value.createdAt > now || now - value.createdAt > TTL
            || !['ru', 'en'].includes(value.locale) || !sources.has(value.source) || !resolveCatalogSelection(value)) {
            storage.removeItem(HANDOFF_KEY);
            return null;
        }
        return value;
    } catch { return null; }
}

export function captureCatalogHandoff(url, storage, now = Date.now()) {
    if (!['/new', '/new/', '/app/new', '/app/new/'].includes(url.pathname) || !url.searchParams.has('catalog_variant')) return null;
    const value = { version: 1, variantId: url.searchParams.get('catalog_variant'), skuId: url.searchParams.get('catalog_sku'),
        locale: url.searchParams.get('catalog_locale'), source: url.searchParams.get('catalog_source'), createdAt: now,
        utm: Object.fromEntries(utmKeys.filter(key => url.searchParams.has(key)).map(key => [key, url.searchParams.get(key).slice(0, 200)])) };
    if (!resolveCatalogSelection(value) || !['ru', 'en'].includes(value.locale) || !sources.has(value.source)) {
        try { storage.removeItem(HANDOFF_KEY); } catch { /* An invalid link never revives an older choice. */ }
        return { error: 'invalid' };
    }
    try { storage.setItem(HANDOFF_KEY, JSON.stringify(value)); }
    catch { return { error: 'storage', value }; }
    keys.forEach(key => url.searchParams.delete(key));
    return { value, cleanUrl: url.pathname + url.search + url.hash };
}

export function catalogRimProposal(value) {
    const entry = resolveCatalogSelection(value);
    if (!entry) return {};
    const [boltCount, pcd] = (entry.sku.pcd || '').split('×').map(Number);
    return { brand: entry.brand, model: entry.model, sku: entry.sku.sku,
        wheel_diameter_in: entry.sku.diameter, wheel_width_j: entry.sku.width,
        bolt_count: boltCount || null, pcd_mm: pcd || null, center_bore_mm: entry.sku.dia,
        offset_et_mm: entry.sku.et, confidence: 0, source: 'user_input' };
}

// Owns only the incoming choice. The application owns photos, auth and durable draft transactions.
export class CatalogHandoffController {
    constructor({ storage, current, persist, apply, publish, fetchImage = (...args) => globalThis.fetch(...args), now = Date.now, isReady = isCatalogStorageReady, verifyImage = verifyCatalogImage }) {
        Object.assign(this, { storage, current, persist, apply, publish, fetchImage, now, isReady, verifyImage });
        this.pending = null;
        this.busy = false;
        this.error = '';
        this.operation = null;
    }
    snapshot() {
        return { selection: resolveCatalogSelection(this.pending), busy: this.busy, error: this.error };
    }
    cancel() {
        this.operation?.controller.abort();
        try { this.operation?.abortDraft?.(); } catch { /* A transaction may already have completed. */ }
        this.operation = null;
        this.busy = false;
    }
    async resume() {
        if (!this.current().authenticated) return;
        this.pending = readCatalogHandoff(this.storage, this.now());
        if (!this.pending) return;
        const context = { ...this.current() };
        const owner = context.account || context.owner;
        if (this.pending.account && this.pending.account !== owner) { this.dismiss(); return; }
        this.pending.account = owner;
        try { this.storage.setItem(HANDOFF_KEY, JSON.stringify(this.pending)); }
        catch { this.error = 'storage'; this.publish(); return; }
        if (context.catalog?.variantId === this.pending.variantId && context.catalog?.skuId === this.pending.skuId && context.wheel) {
            this.dismiss();
        } else if (!context.wheel) {
            await this.accept();
        } else this.publish();
    }
    dismiss() {
        if (this.busy) return;
        // Remove the durable intent before hiding it so reload cannot reapply a declined choice.
        try { this.storage.removeItem(HANDOFF_KEY); }
        catch { this.error = 'storage'; this.publish(); return; }
        this.pending = null;
        this.error = '';
        this.publish();
    }
    async accept() {
        if (this.busy || !this.pending || !this.current().authenticated) return;
        const selection = resolveCatalogSelection(this.pending);
        if (!selection || this.now() - this.pending.createdAt > TTL) { this.dismiss(); return; }
        if (!this.isReady()) { this.error = 'unavailable'; this.publish(); return; }
        const context = { ...this.current() };
        const pending = this.pending;
        const operation = { controller: new AbortController(), abortDraft: null };
        const ownsContext = () => this.operation === operation && this.pending === pending
            && this.current().authenticated && this.current().owner === context.owner
            && this.current().version === context.version && this.current().wheel === context.wheel;
        const isCurrent = () => ownsContext() && !operation.controller.signal.aborted;
        this.operation = operation;
        this.busy = true;
        this.error = '';
        this.publish();
        let stage = 'image';
        const timer = setTimeout(() => {
            if (!ownsContext()) return;
            this.error = 'timeout';
            this.cancel();
            this.publish();
        }, 12000);
        try {
            const response = await this.fetchImage(selection.image, { signal: operation.controller.signal, credentials: 'omit', mode: 'cors', redirect: 'error' });
            if (!response.ok) throw Error('image');
            const blob = await response.blob();
            if (!['image/webp', 'image/png', 'image/jpeg'].includes(blob.type) || !blob.size || blob.size > 8 * 1024 * 1024 || !await this.verifyImage(blob, selection)) throw Error('image');
            if (!isCurrent() || operation.controller.signal.aborted) return;
            const file = { blob, name: selection.imageAsset.source.fileName, size: blob.size, type: blob.type };
            const metadata = { ...pending, owner: context.owner };
            stage = 'storage';
            await this.persist(file, metadata, { isCurrent, operation });
            if (!isCurrent() || operation.controller.signal.aborted) return;
            this.apply(file, metadata);
            // A persisted matching wheel also suppresses replay if storage removal fails.
            try { this.storage.removeItem(HANDOFF_KEY); } catch { /* durable draft resolves replay */ }
            this.pending = null;
        } catch {
            if (ownsContext()) this.error = stage;
        } finally {
            clearTimeout(timer);
            if (this.operation === operation) { this.operation = null; this.busy = false; this.publish(); }
        }
    }
}
