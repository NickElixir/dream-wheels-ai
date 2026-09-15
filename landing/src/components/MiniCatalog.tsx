import { useEffect, useMemo, useState } from 'preact/hooks';
import { getVariant, getVariantsForVehicle, getVehicle, getWheel, vehicles, wheels } from '../data/catalog';
import { trackEvent } from '../lib/analytics';
import { sanitizeFavoriteIds, toggleFavoriteIds } from '../lib/favorites';

const FAVORITES_KEY = 'dreamwheels:landing:favorites:v1';
const FALLBACK_IMAGE = '/assets/mock/vehicle-fallback.svg';

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
    ['R', `R${wheel.diameter}`], ['Ширина', `${wheel.width}J`], ['PCD', wheel.pcd], ['ET', `ET${wheel.et}`], ['DIA', `${wheel.dia}`],
  ], [wheel]);

  return (
    <div class="catalog-shell">
      <div class="catalog-heading">
        <div><span class="eyebrow">ВЫБЕРИТЕ АВТОМОБИЛЬ</span><h2 id="catalog-title">5 популярных дисков для {vehicle.displayName}</h2></div>
        <div class="carousel-controls" aria-label="Навигация по дискам"><button type="button" aria-label="Предыдущие диски">←</button><button type="button" aria-label="Следующие диски">→</button></div>
      </div>

      <div class="catalog-grid">
        <aside class="vehicle-rail" aria-label="Выберите автомобиль">
          {vehicles.map((item, index) => <button key={item.id} type="button" class={`vehicle-row ${item.id === vehicle.id ? 'is-active' : ''}`} aria-pressed={item.id === vehicle.id} onClick={() => selectVehicle(item.id)}>
            <img src={item.image.src} alt="" width="100" height="56" loading="lazy" onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} />
            <span><small>0{index + 1}</small>{item.displayName}</span>
          </button>)}
        </aside>

        <div class="catalog-main">
          <div class="wheel-carousel" aria-label="Выберите диск">
            {wheels.map((item) => <button key={item.id} type="button" class={`wheel-cell ${item.id === wheel.id ? 'is-active' : ''}`} aria-pressed={item.id === wheel.id} aria-label={`${item.brand} ${item.model}, ${item.finish}`} onClick={() => selectWheel(item.id)}>
              <span class="wheel-image"><img src={item.thumbnail.src} alt="" width="640" height="640" loading="lazy" onError={(event) => { event.currentTarget.src = '/assets/mock/wheel-fallback.svg'; }} /></span>
              <span>{item.model}</span>
            </button>)}
          </div>
          <div class="garage-plane" aria-live="polite">
            {variant && <img key={stageKey} class="garage-image" src={variant.image.src} width={variant.image.width} height={variant.image.height} alt={variant.image.alt} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} />}
            <div class="garage-vignette" aria-hidden="true" />
            <div class="garage-label"><span>VISUAL TRY-ON</span><strong>{vehicle.make} {vehicle.model}</strong><small>{vehicle.bodyLabel} / {vehicle.yearLabel}</small></div>
            <span class="mock-note">MOCK ASSET</span>
          </div>
        </div>

        <aside class="spec-rail" aria-label="Параметры выбранного диска">
          <div class="spec-title"><div><span class="spec-kicker">SELECTED WHEEL</span><h3>{wheel.brand}<br />{wheel.model}</h3><p>{wheel.finish}</p></div><button class={`favorite-button ${isFavorite ? 'is-active' : ''}`} type="button" aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'} aria-pressed={isFavorite} onClick={toggleFavorite}>{isFavorite ? '★' : '☆'}</button></div>
          <div class="spec-values">{specs.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
          <div class="compatibility-status"><span class="status-check" aria-hidden="true">✓</span><div><strong>{statusLabel}</strong><span>По проверенным параметрам</span></div><span aria-hidden="true">›</span></div>
          <button type="button" class="button comparison-button action-type" onClick={() => trackEvent('primary_cta_clicked', { source: 'catalog_3d' })}>◉&nbsp; Посмотреть в 3D</button>
          <button type="button" class="compare-link" onClick={() => trackEvent('primary_cta_clicked', { source: 'catalog_compare' })}>□&nbsp; Добавить к сравнению</button>
          <p class="fitment-note">Визуальная примерка не подтверждает техническую совместимость.</p>
        </aside>
      </div>
    </div>
  );
}
