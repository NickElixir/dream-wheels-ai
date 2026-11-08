import { isCatalogStorageReady, resolveCatalogImage } from '../../../webapp/vnext/catalog-images.mjs';
import { getWheelSku, type ShowcaseVariant } from '../data/catalog';
import primarySkus from '../data/catalog-primary-skus.json';
import { getAppTargetFromUrl } from './attribution';
import type { Locale } from '../i18n';

export function selectedCatalogSku(variant: ShowcaseVariant) {
  const id = (primarySkus as Record<string, string>)[variant.id] ?? (variant.skuIds.length === 1 ? variant.skuIds[0] : null);
  return id && variant.skuIds.includes(id) ? getWheelSku(id) : null;
}

export function catalogHandoffUrl(currentUrl: string, variant: ShowcaseVariant, locale: Locale, source = 'catalog') {
  const sku = selectedCatalogSku(variant);
  if (!sku) return null;
  // Language determines the product destination, independently of the current preview hostname.
  const origin = locale === 'ru' ? 'https://app.dream-wheels.ru' : 'https://app.dreamwheels.pro';
  const inherited = new URL(getAppTargetFromUrl(currentUrl));
  const target = new URL('/new', origin);
  inherited.searchParams.forEach((value, key) => target.searchParams.set(key, value.slice(0, 200)));
  target.searchParams.set('catalog_variant', variant.id);
  target.searchParams.set('catalog_sku', sku.id);
  target.searchParams.set('catalog_locale', locale);
  target.searchParams.set('catalog_source', source);
  return target.toString();
}

export { isCatalogStorageReady };

export function catalogThumbnail(wheel: { referenceBarcode: string; thumbnail: {src:string;srcSet?:string;width:number;height:number;alt:string} }) {
  const asset = resolveCatalogImage(`wheel-image-${wheel.referenceBarcode}`);
  if (!asset || !isCatalogStorageReady()) return wheel.thumbnail;
  return {...wheel.thumbnail,src:asset.thumbnail,srcSet:`${asset.preview320} 320w, ${asset.thumbnail} 640w`};
}
