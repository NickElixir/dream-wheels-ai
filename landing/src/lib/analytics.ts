export type LandingEvent =
  | 'landing_viewed'
  | 'catalog_vehicle_selected'
  | 'catalog_wheel_selected'
  | 'before_after_used'
  | 'demo_video_started'
  | 'demo_video_completed'
  | 'primary_cta_clicked'
  | 'catalog_clicked'
  | 'login_clicked'
  | 'social_clicked'
  | 'faq_clicked'
  | 'faq_opened'
  | 'support_clicked'
  | 'contact_clicked';

export function trackEvent(name: LandingEvent, payload: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('dreamwheels:analytics', { detail: { name, ...payload } }));
  const analyticsWindow = window as Window & { ym?: (...args: unknown[]) => void };
  if (typeof analyticsWindow.ym === 'function') {
    analyticsWindow.ym('reachGoal', name, payload);
  }
}
