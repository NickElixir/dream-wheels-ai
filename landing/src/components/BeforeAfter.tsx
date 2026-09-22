import { useRef, useState } from 'preact/hooks';
import { getAppTarget } from '../lib/attribution';
import { trackEvent } from '../lib/analytics';

const initialPosition = 50;

export default function BeforeAfter() {
  const [position, setPosition] = useState(initialPosition);
  const hasTrackedInteraction = useRef(false);
  const isDragging = useRef(false);

  const update = (value: number) => {
    const nextPosition = Math.min(100, Math.max(0, value));
    setPosition(nextPosition);
    if (!hasTrackedInteraction.current) {
      hasTrackedInteraction.current = true;
      trackEvent('before_after_used', { position: Math.round(nextPosition) });
    }
  };

  const updateFromPointer = (event: PointerEvent) => {
    const slider = event.currentTarget as HTMLDivElement;
    const bounds = slider.getBoundingClientRect();
    update(((event.clientX - bounds.left) / bounds.width) * 100);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowLeft: -2, ArrowDown: -2, ArrowRight: 2, ArrowUp: 2, Home: -100, End: 100 };
    if (!(event.key in steps)) return;
    event.preventDefault();
    update(event.key === 'Home' ? 0 : event.key === 'End' ? 100 : position + steps[event.key]);
  };

  return (
    <section class="before-after-section" id="monjaro-comparison" aria-labelledby="monjaro-comparison-title">
      <div
        class="before-after-slider"
        style={{ '--split': `${position}%` }}
        role="slider"
        aria-label="Сравнение исходных и выбранных дисков"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)}%: до слева, после справа`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          event.preventDefault();
          isDragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (isDragging.current) {
            event.preventDefault();
            updateFromPointer(event);
          }
        }}
        onPointerUp={(event) => {
          isDragging.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { isDragging.current = false; }}
        onDragStart={(event) => event.preventDefault()}
      >
        <img class="before-after-image" src="/assets/mock/after.webp" width="1672" height="941" alt="Geely Monjaro с дисками X'trike X-141" loading="lazy" decoding="async" draggable={false} />
        <div class="before-after-before" aria-hidden="true">
          <img class="before-after-image" src="/assets/mock/before.webp" width="1672" height="941" alt="" loading="lazy" decoding="async" draggable={false} />
        </div>
        <div class="before-after-overlay" aria-hidden="true"></div>
        <header class="before-after-heading">
          <p>ПРИМЕР ВИЗУАЛИЗАЦИИ</p>
          <h2 id="monjaro-comparison-title">Geely Monjaro</h2>
        </header>
        <div class="before-after-labels" aria-hidden="true">
          <div class="before-after-label before-after-label--before">
            <span class="before-after-label__state">ДО</span>
            <strong>Geely Monjaro <span class="before-after-label__mobile-break">Exclusive OEM</span></strong>
            <small>8/20&quot; 5x108 ET52 DIA63,4</small>
          </div>
          <div class="before-after-label before-after-label--after">
            <span class="before-after-label__state">ПОСЛЕ</span>
            <strong>X&apos;trike X-141</strong>
            <small>8/20&quot; 5x108 ET52 DIA63,35</small>
          </div>
        </div>
        <div class="before-after-divider" aria-hidden="true"><span class="before-after-handle"><i>‹</i><i>›</i></span></div>
      </div>
      <div class="before-after-actions">
        <a class="button button-lime button-tactile before-after-primary" href={getAppTarget()} data-app-target onClick={() => trackEvent('primary_cta_clicked', { source: 'monjaro_slider' })}>Попробовать на своей машине</a>
        <a class="before-after-catalog-link" href="/catalog" onClick={() => trackEvent('catalog_clicked', { source: 'monjaro_slider' })}>Смотреть каталог дисков <span aria-hidden="true">→</span></a>
      </div>
    </section>
  );
}
