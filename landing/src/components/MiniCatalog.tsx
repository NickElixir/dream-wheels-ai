import { useRef, useState } from 'preact/hooks';
import { getVariant, getVariantsForVehicle, getVehicle, getWheel, vehicles, wheels } from '../data/catalog';
import '../styles/catalog-data.css';
import { catalogHandoffUrl, selectedCatalogSku, catalogThumbnail, isCatalogStorageReady } from '../lib/catalog-handoff';
import { getAppTarget } from '../lib/attribution';
import { trackEvent } from '../lib/analytics';
import { getDictionary } from '../i18n';
import type { Locale } from '../i18n';

const FALLBACK_IMAGE = '/assets/mock/vehicle-fallback.svg';
const PROFILE_AVATARS: Record<string, string> = {
  'zeekr-001': '/assets/mock/vehicle-avatars/zeekr-001-profile.png',
  'bmw-x5': '/assets/mock/vehicle-avatars/bmw-x5-profile.png',
  'mercedes-gle': '/assets/mock/vehicle-avatars/mercedes-gle-profile.png',
  'li-auto-l7': '/assets/mock/vehicle-avatars/li-auto-l7-profile.png',
  'geely-cityray': '/assets/mock/vehicle-avatars/geely-atlas-profile.png',
};

export default function MiniCatalog({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).catalog;
  const [vehicleId, setVehicleId] = useState(vehicles[0].id);
  const [wheelId, setWheelId] = useState(wheels[0].id);
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<'try' | 'pilot'>('try');
  const tryLabel = copy.ui.tryOn;
  const openPreview = (kind: 'try' | 'pilot') => {
    setPreview(kind);
    dialog.current?.showModal();
  };
  const [stageKey, setStageKey] = useState(`${vehicleId}-${wheelId}`);

  const vehicle = getVehicle(vehicleId) ?? vehicles[0];
  const variants = getVariantsForVehicle(vehicle.id);
  const activeWheelId = variants.some((item) => item.wheelId === wheelId) ? wheelId : (variants[0]?.wheelId ?? wheels[0].id);
  const wheel = getWheel(activeWheelId) ?? wheels[0];
  const variant = getVariant(vehicle.id, activeWheelId) ?? variants[0];
  const wheelCells = variants.map((item) => getWheel(item.wheelId)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const sku = variant ? selectedCatalogSku(variant) : null;
  const handoffReady = Boolean(variant && sku && isCatalogStorageReady());
  const tryOn = (source = 'catalog') => {
    if (!variant || !handoffReady) return;
    const target = catalogHandoffUrl(window.location.href, variant, locale, source);
    if (!target) return;
    trackEvent('primary_cta_clicked', { source, vehicle_id: vehicle.id, wheel_id: wheel.id, variant_id: variant.id, sku_id: selectedCatalogSku(variant)?.id });
    window.location.assign(target);
  };
  const selectVehicle = (next: string) => {
    const nextWheel = getVariantsForVehicle(next)[0]?.wheelId ?? wheels[0].id;
    setVehicleId(next); setWheelId(nextWheel); setStageKey(`${next}-${nextWheel}-${Date.now()}`);
    trackEvent('catalog_vehicle_selected', { vehicle_id: next });
  };
  const selectWheel = (next: string) => {
    setWheelId(next); setStageKey(`${vehicle.id}-${next}-${Date.now()}`);
    trackEvent('catalog_wheel_selected', { vehicle_id: vehicle.id, wheel_id: next });
  };
  const number = (value: number | null | undefined, prefix = '', suffix = '') => value == null ? copy.noData : `${prefix}${value}${suffix}`;

  return (
    <div class="catalog-shell">
      <div class="catalog-grid">
        <aside class="vehicle-rail" aria-label={copy.selectVehicle}>
          <span class="vehicle-label">{copy.selectVehicle}</span>
          <div class="vehicle-list">
            {vehicles.map((item) => <button key={item.id} type="button" class={`vehicle-row ${item.id === vehicle.id ? 'is-active' : ''}`} aria-pressed={item.id === vehicle.id} onClick={() => selectVehicle(item.id)}>
              <img class="vehicle-avatar" src={PROFILE_AVATARS[item.id] ?? item.image.src} alt="" width="1672" height="941" loading="lazy" onError={(event) => { event.currentTarget.src = item.image.src || FALLBACK_IMAGE; }} />
              <span>{item.displayName}</span>
            </button>)}
          </div>
          <button class="catalog-missing" type="button" onClick={() => window.location.assign(getAppTarget())}>{copy.ui.missingVehicle}</button>
        </aside>

        <div class="catalog-main">
          <span class="wheel-label">{copy.selectWheels}</span>
          <div class="wheel-carousel" aria-label={copy.selectWheel}>
            {wheelCells.map((item) => {
              const selected = item.id === wheel.id;
              return <button key={item.id} type="button" class={`wheel-cell ${selected ? 'is-active' : ''} ${catalogThumbnail(item).src.endsWith('.jpg') ? 'is-jpeg' : 'is-cutout'}`} aria-pressed={selected} aria-label={item.displayName} onClick={() => selectWheel(item.id)}>
                <span class="wheel-image"><img src={catalogThumbnail(item).src} srcSet={catalogThumbnail(item).srcSet} sizes="(max-width: 900px) calc((100vw - 64px) / 2), 160px" alt={`${copy.ui.wheelImage}: ${item.displayName}`} width="640" height="640" loading="lazy" onError={(event) => { event.currentTarget.src = '/assets/mock/wheel-fallback.svg'; }} /></span>
                <span>{item.displayName}</span>
              </button>;
            })}
          </div>
          <div class="garage-plane" aria-live="polite">
            {variant && <img key={stageKey} class="garage-image" src={variant.image.src} srcSet={variant.image.srcSet} sizes="(max-width: 900px) 100vw, 75vw" width={variant.image.width} height={variant.image.height} alt={`${copy.imageAlt(vehicle.displayName)} — ${wheel.displayName}`} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} />}
          </div>
          <div class="catalog-result-actions">
            <div><h2>{wheel.displayName}</h2></div>
            <div><button class="catalog-primary button-lime" type="button" disabled={!handoffReady} onClick={() => tryOn()}>{tryLabel}</button></div>
          </div>
          <details class="catalog-bottom-specs">
            <summary>{copy.ui.specifications}</summary>
            <div class="catalog-spec-list">
              {sku && <div class="catalog-spec-item" key={sku.id}>
                <div class="catalog-spec-row">
                <dl class="catalog-spec-values">
                  {[[copy.diameter, number(sku.diameter, 'R')], [copy.width, number(sku.width, '', 'J')], ['PCD', sku.pcd ?? copy.noData], [copy.offset, number(sku.et, 'ET')], ['DIA', number(sku.dia)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                </dl>
                </div>
                <p class="catalog-article">{copy.ui.skuPrefix}{sku.sku}</p>
              </div>}
            </div>
          </details>
        </div>
      </div>
      <section class="catalog-pilot">
        <div><h2>{copy.ui.pilotTitle}</h2><p>{copy.ui.pilotDescription}</p></div>
        <div><div class="catalog-demo"><img src={catalogThumbnail(wheel).src} srcSet={catalogThumbnail(wheel).srcSet} sizes="74px" alt="" width="74" height="74" loading="lazy" /><div><p>{wheel.displayName}</p></div><button class="catalog-demo-try" type="button" disabled={!handoffReady} onClick={() => tryOn('catalog-product-card')}>{tryLabel}</button></div></div>
        <form aria-describedby="catalog-pilot-notice" onSubmit={(event) => { event.preventDefault(); openPreview('pilot'); }}>
          <h2>{copy.ui.requestTitle}</h2>
          <p id="catalog-pilot-notice" class="catalog-pilot-notice">{copy.ui.demoNotice}</p>
          <div class="catalog-pilot-fields">
            <input type="url" required aria-label={copy.ui.website} placeholder={copy.ui.website} />
            <input type="tel" required aria-label={copy.ui.phone} placeholder={copy.ui.phone} />
            <button type="submit">{copy.ui.discussPilot}</button>
          </div>
        </form>
      </section>
      <dialog ref={dialog} class="catalog-preview-dialog" aria-labelledby="catalog-preview-title">
        <h2 id="catalog-preview-title">{preview === 'try' ? (copy.ui.tryTitle) : (copy.ui.pilotDialogTitle)}</h2>
        {preview === 'try' && <div class="catalog-demo"><img src={catalogThumbnail(wheel).src} srcSet={catalogThumbnail(wheel).srcSet} sizes="74px" width="74" height="74" alt="" /><strong>{wheel.displayName}</strong></div>}
        <p>{preview === 'try' ? (copy.ui.tryPreview) : (copy.ui.pilotPreview)}</p>
        <form method="dialog"><button>{copy.ui.returnToCatalog}</button></form>
      </dialog>
    </div>
  );
}
