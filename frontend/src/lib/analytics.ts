export const GA_MEASUREMENT_ID = "G-BTWQTX0WR8";
export const GTM_CONTAINER_ID = "GTM-T4BR5X6M";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

/**
 * SPA pageview for GA4-through-GTM. Pushes a `virtual_pageview` event to the
 * dataLayer; the matching GA4 Event tag in GTM (trigger: Custom Event
 * `virtual_pageview`) forwards it with the page_path parameter.
 * Safe no-op when GTM hasn't loaded.
 */
export function trackPageview(path: string) {
  if (!Array.isArray(window.dataLayer)) return;
  window.dataLayer.push({ event: "virtual_pageview", page_path: path });
}
