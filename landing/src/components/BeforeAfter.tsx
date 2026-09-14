import { useState } from 'preact/hooks';
import { trackEvent } from '../lib/analytics';

export default function BeforeAfter() {
  const [position, setPosition] = useState(52);

  const update = (value: number) => {
    setPosition(value);
    trackEvent('before_after_used', { position: value });
  };

  return (
    <div class="before-after" style={{ '--split': `${position}%` }}>
      <div class="before-after-media before-media">
        <img src="/assets/mock/before.webp" width="960" height="640" alt="Mock before image of a car" loading="lazy" />
        <span>Before</span>
      </div>
      <div class="before-after-media after-media">
        <img src="/assets/mock/after.webp" width="960" height="640" alt="Mock after image with a selected wheel" loading="lazy" />
        <span>After</span>
      </div>
      <label class="before-after-control" aria-label="Compare before and after">
        <input type="range" min="0" max="100" value={position} onInput={(event) => update(Number(event.currentTarget.value))} />
        <span class="before-after-handle" aria-hidden="true"><span /></span>
      </label>
    </div>
  );
}
