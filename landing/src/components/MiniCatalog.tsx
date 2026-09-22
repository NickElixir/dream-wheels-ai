import { useEffect, useMemo, useState } from 'preact/hooks';
import { getVariant, getVariantsForVehicle, getVehicle, getWheel, vehicles, wheels } from '../data/catalog';
import { trackEvent } from '../lib/analytics';
import { sanitizeFavoriteIds, toggleFavoriteIds } from '../lib/favorites';

const FAVORITES_KEY = 'dreamwheels:landing:favorites:v1';
const FALLBACK_IMAGE = '/assets/mock/vehicle-fallback.svg';
const QA_WHEEL_CELLS = [
  { id: 'qa-wheel-04', model: 'RepliKey', thumbnail: { src: '/assets/mock/wheel-audition-replikey.png', width: 1254, height: 1254, alt: 'RepliKey transparent wheel example' } },
  { id: 'qa-wheel-05', model: 'SKAD', thumbnail: { src: '/assets/mock/wheel-audition-skad.png', width: 1254, height: 1254, alt: 'SKAD transparent wheel example' } },
];
const PROFILE_AVATARS: Record<string, string> = {
  'zeekr-001': '/assets/mock/vehicle-avatars/zeekr-001-profile.png',
  'bmw-x5': '/assets/mock/vehicle-avatars/bmw-x5-profile.png',
  'mercedes-gle': '/assets/mock/vehicle-avatars/mercedes-gle-profile.png',
  'li-auto-l7': '/assets/mock/vehicle-avatars/li-auto-l7-profile.png',
  'geely-cityray': '/assets/mock/vehicle-avatars/geely-atlas-profile.png',
};

function readFavorites(): string[] {
  try { return sanitizeFavoriteIds(JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]')); } catch { return []; }
}

export default function MiniCatalog() {
  const [vehicleId, setVehicleId] = useState(vehicles[0].id);
  const [wheelId, setWheelId] = useState(wheels[0].id);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [stageKey, setStageKey] = useState(`${vehicleId}-${wheelId}`);
  useEffect(() => setFavorites(readFavorites()), []);

  const vehicle = getVehicle(vehicleId) ?? vehicles[0];
  const variants = getVariantsForVehicle(vehicle.id);
  const activeWheelId = variants.some((item) => item.wheelId === wheelId) ? wheelId : (variants[0]?.wheelId ?? wheels[0].id);
  const wheel = getWheel(activeWheelId) ?? wheels[0];
  const variant = getVariant(vehicle.id, activeWheelId) ?? variants[0];
  const isFavorite = variant ? favorites.includes(variant.id) : false;
  const statusLabel = variant?.compatibility.status === 'unknown' ? 'Требует проверки' : 'Предварительно совместим';
  const wheelCells = [...wheels, ...QA_WHEEL_CELLS];

  const selectVehicle = (next: string) => {
    const nextWheel = getVariantsForVehicle(next)[0]?.wheelId ?? wheels[0].id;
    setVehicleId(next); setWheelId(nextWheel); setStageKey(`${next}-${nextWheel}-${Date.now()}`);
    trackEvent('catalog_vehicle_selected', { vehicle_id: next });
  };
  const selectWheel = (next: string) => {
    setWheelId(next); setStageKey(`${vehicle.id}-${next}-${Date.now()}`);
    trackEvent('catalog_wheel_selected', { vehicle_id: vehicle.id, wheel_id: next });
  };
  const toggleFavorite = () => {
    if (!variant) return;
    const next = toggleFavoriteIds(favorites, variant.id);
    setFavorites(next);
    try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* optional persistence */ }
  };
  const specs = useMemo(() => [
    ['Диаметр', `R${wheel.diameter}`], ['Ширина', `${wheel.width}J`], ['PCD', wheel.pcd], ['Вылет', `ET${wheel.et}`], ['DIA', `${wheel.dia}`],
  ], [wheel]);

  return (
    <div class="catalog-shell">
      <div class="catalog-grid">
        <aside class="vehicle-rail" aria-label="Выберите автомобиль">
          <span class="vehicle-label">Выберите автомобиль</span>
          <div class="vehicle-list">
            {vehicles.map((item) => <button key={item.id} type="button" class={`vehicle-row ${item.id === vehicle.id ? 'is-active' : ''}`} aria-pressed={item.id === vehicle.id} onClick={() => selectVehicle(item.id)}>
              <img class="vehicle-avatar" src={PROFILE_AVATARS[item.id] ?? item.image.src} alt="" width="1672" height="941" loading="lazy" onError={(event) => { event.currentTarget.src = item.image.src || FALLBACK_IMAGE; }} />
              <span>{item.displayName}</span>
            </button>)}
          </div>
        </aside>

        <div class="catalog-main">
          <span class="wheel-label">Выберите диски</span>
          <div class="wheel-carousel" aria-label="Выберите диск">
            {wheelCells.map((item, index) => {
              const isQaPreview = index >= wheels.length;
              const selected = !isQaPreview && item.id === wheel.id;
              return <button key={item.id} type="button" disabled={isQaPreview} class={`wheel-cell ${selected ? 'is-active' : ''} ${isQaPreview ? 'is-qa-preview' : ''} ${item.thumbnail.src.endsWith('.jpg') ? 'is-jpeg' : 'is-cutout'}`} aria-pressed={selected} aria-label={isQaPreview ? `${item.model}, preview` : `${item.model}, ${getWheel(item.id)?.finish ?? ''}`} onClick={() => !isQaPreview && selectWheel(item.id)}>
                <span class="wheel-image"><img src={item.thumbnail.src} alt="" width="640" height="640" loading="lazy" onError={(event) => { event.currentTarget.src = '/assets/mock/wheel-fallback.svg'; }} /></span>
                <span>{item.model}</span>
              </button>;
            })}
          </div>
          <div class="garage-plane" aria-live="polite">
            {variant && <img key={stageKey} class="garage-image" src={variant.image.src} width={variant.image.width} height={variant.image.height} alt={variant.image.alt} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} />}
          </div>
          <section class="catalog-bottom-specs" aria-label="Параметры выбранного диска">
            <div class="catalog-bottom-spec-title">
              <div><h3>OZ<br />Superturismo</h3><p>A motorsport classic.</p></div>
              <button class={`favorite-button ${isFavorite ? 'is-active' : ''}`} type="button" aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'} aria-pressed={isFavorite} onClick={toggleFavorite}>{isFavorite ? '★' : '☆'}</button>
            </div>
            <div class="catalog-bottom-spec-strip">
              {specs.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
            </div>
            <div class="catalog-bottom-compatibility"><span class="status-check" aria-hidden="true">✓</span><div><strong>{statusLabel}</strong></div></div>
            <p class="catalog-bottom-note">Визуальная примерка не подтверждает техническую совместимость.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
