import { apiFetch } from './api';

export type ConsentStatus = 'granted' | 'denied';

export const CONSENT_STORAGE_KEY = 'pawnder_cookie_consent';

export function getCookieConsent(): ConsentStatus | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (val === 'granted' || val === 'denied') return val;
  } catch {
    // LocalStorage blocked
  }
  return null;
}

export function setCookieConsent(status: ConsentStatus) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, status);
  } catch {
    // LocalStorage blocked
  }

  const win = window as any;

  // 1. Google Consent Mode v2 update
  if (typeof win.gtag === 'function') {
    try {
      win.gtag('consent', 'update', {
        analytics_storage: status,
        ad_storage: status,
        ad_user_data: status,
        ad_personalization: status,
      });
    } catch {
      // Ignore
    }
  }

  // 2. GTM dataLayer update
  win.dataLayer = win.dataLayer || [];
  win.dataLayer.push({
    event: status === 'granted' ? 'consent_accepted' : 'consent_denied',
    cookie_consent: status,
  });

  // 3. Dispatch custom event
  window.dispatchEvent(
    new CustomEvent('pawnder_consent_change', { detail: status }),
  );
}

export function trackEvent(
  eventName: string,
  properties?: Record<string, any>,
) {
  if (typeof window === 'undefined') return;

  const win = window as any;
  win.dataLayer = win.dataLayer || [];

  // 1. GTM dataLayer push
  win.dataLayer.push({
    event: eventName,
    ...properties,
  });

  // 2. Google Analytics 4 gtag event
  if (typeof win.gtag === 'function') {
    try {
      win.gtag('event', eventName, properties);
    } catch {
      // Ignore
    }
  }

  // 3. Internal backend analytics logging
  try {
    apiFetch('/analytics/event', {
      method: 'POST',
      body: JSON.stringify({ eventName, properties }),
    }).catch(() => {});
  } catch {
    // Ignore
  }
}

export function trackPageView(pagePath: string, pageTitle?: string) {
  trackEvent('page_view', {
    page_path: pagePath,
    page_title:
      pageTitle || (typeof document !== 'undefined' ? document.title : ''),
    page_location: typeof window !== 'undefined' ? window.location.href : '',
  });
}

