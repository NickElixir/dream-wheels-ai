import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  getVariant,
  getVariantsForVehicle,
  getVehicle,
  getWheel,
  vehicles,
  wheels,
} from '../data/catalog';
import { trackEvent } from '../lib/analytics';
import { sanitizeFavoriteIds, toggleFavoriteIds } from '../lib/favorites';

const FAVORITES_KEY = 'dreamwheels:landing:favorites:v1';
const FALLBACK_IMAGE = '/assets/mock/vehicle-fallback.svg';

function readFavorites(): string[] {
  try {
    const value = window.localStorage.getItem(FAVORITES_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return sanitizeFavoriteIds(parsed);
  } catch {
    return [];
  }
}

function writeFavorites(ids: string[]) {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // Private browsing and blocked storage are valid no-persistence states.
  }
}

export default function MiniCatalog() {
  const [vehicleId, setVehicleId] = useState(vehicles[0].id);
  const [wheelId, setWheelId] = useState(wheels[0].id);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [stageKey, setStageKey] = useState(`${vehicleId}-${wheelId}`);

  useEffect(() => {
    setFavorites(readFavorites());
  }, []);

  const vehicle = getVehicle(vehicleId) ?? vehicles[0];
  const availableVariants = getVariantsForVehicle(vehicle.id);
  const activeWheelId = availableVariants.some((variant) => variant.wheelId === wheelId)
    ? wheelId
    : availableVariants[0]?.wheelId ?? wheels[0].id;
  const wheel = getWheel(activeWheelId) ?? wheels[0];
  const variant = getVariant(vehicle.id, activeWheelId) ?? availableVariants[0];
  const isFavorite = variant ? favorites.includes(variant.id) : false;

  const statusLabel = variant?.compatibility.status === 'unknown' ? 'Needs review' : 'Preliminary review';
  const statusTone = variant?.compatibility.status === 'unknown' ? 'warning' : 'pending';

  const updateStage = (nextVehicleId: string, nextWheelId: string) => {
    setStageKey(`${nextVehicleId}-${nextWheelId}-${Date.now()}`);
  };

  const selectVehicle = (nextVehicleId: string) => {
    const nextVariant = getVariantsForVehicle(nextVehicleId)[0];
    setVehicleId(nextVehicleId);
    setWheelId(nextVariant?.wheelId ?? wheels[0].id);
    updateStage(nextVehicleId, nextVariant?.wheelId ?? wheels[0].id);
    trackEvent('catalog_vehicle_selected', { vehicle_id: nextVehicleId });
  };

  const selectWheel = (nextWheelId: string) => {
    setWheelId(nextWheelId);
    updateStage(vehicle.id, nextWheelId);
    trackEvent('catalog_wheel_selected', { vehicle_id: vehicle.id, wheel_id: nextWheelId });
  };

  const toggleFavorite = () => {
    if (!variant) return;
    const next = toggleFavoriteIds(favorites, variant.id);
    setFavorites(next);
    writeFavorites(next);
  };

  const specRows = useMemo(
    () => [
      ['Diameter', `R${wheel.diameter}`],
      ['Width', `${wheel.width}"`],
      ['PCD', wheel.pcd],
      ['ET', `ET${wheel.et}`],
      ['DIA', `${wheel.dia} mm`],
    ],
    [wheel],
  );

  return (
    <div class="catalog-shell">
      <div class="catalog-topline">
        <div>
          <span class="section-index">02 / 09</span>
          <h2 id="catalog-title">Choose your style</h2>
        </div>
        <p class="catalog-note">A living preview. Technical compatibility stays a separate question.</p>
      </div>

      <div class="vehicle-selector" aria-label="Choose a vehicle">
        {vehicles.map((item, index) => (
          <button
            key={item.id}
            type="button"
            class={`vehicle-tab ${item.id === vehicle.id ? 'is-active' : ''}`}
            aria-pressed={item.id === vehicle.id}
            onClick={() => selectVehicle(item.id)}
          >
            <span class="vehicle-tab-number">0{index + 1}</span>
            <span>{item.displayName}</span>
          </button>
        ))}
      </div>

      <div class="catalog-workspace">
        <div class="stage-wrap" aria-live="polite">
          <div class="stage-marker stage-marker-top">Dream Wheels / visual try-on</div>
          <div class="automotive-stage">
            {variant && (
              <img
                key={stageKey}
                class="stage-image stage-image-enter"
                src={variant.image.src}
                width={variant.image.width}
                height={variant.image.height}
                alt={variant.image.alt}
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
            )}
            <div class="stage-fade" aria-hidden="true" />
            <div class="stage-caption">
              <span>{vehicle.make}</span>
              <strong>{vehicle.model}</strong>
              <small>{vehicle.bodyLabel}</small>
            </div>
            <span class="mock-stamp">MOCK / UI ONLY</span>
          </div>
          <div class="stage-marker stage-marker-bottom">01 — {vehicle.yearLabel} / {vehicle.generation}</div>
        </div>

        <aside class="catalog-detail" aria-label="Selected wheel details">
          <div class="detail-header">
            <div>
              <span class="detail-kicker">Selected wheel</span>
              <h3>{wheel.model}</h3>
              <p>{wheel.brand} / {wheel.finish}</p>
            </div>
            <button
              type="button"
              class={`favorite-button ${isFavorite ? 'is-active' : ''}`}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorite}
              onClick={toggleFavorite}
            >
              <span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>
            </button>
          </div>

          <div class="wheel-selector" aria-label="Choose a mock wheel">
            {wheels.map((item) => (
              <button
                type="button"
                key={item.id}
                class={`wheel-choice ${item.id === wheel.id ? 'is-active' : ''}`}
                aria-label={`${item.model}, ${item.finish}`}
                aria-pressed={item.id === wheel.id}
                onClick={() => selectWheel(item.id)}
              >
                <img
                  src={item.thumbnail.src}
                  alt=""
                  width={item.thumbnail.width}
                  height={item.thumbnail.height}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src = '/assets/mock/wheel-fallback.svg';
                  }}
                />
                <span>{item.model}</span>
              </button>
            ))}
          </div>

          <div class="compatibility-status" data-tone={statusTone}>
            <span class="status-dot" aria-hidden="true" />
            <div>
              <span>Preliminary compatibility</span>
              <strong>{statusLabel}</strong>
            </div>
          </div>

          <dl class="spec-list">
            {specRows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p class="mock-disclaimer">Mock catalog data. A visual try-on does not prove technical fitment.</p>
        </aside>
      </div>
    </div>
  );
}
