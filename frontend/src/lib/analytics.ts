export const GA_MEASUREMENT_ID = "G-BTWQTX0WR8";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Send a page_view to GA4. Safe no-op when the gtag script hasn't loaded. */
export function trackPageview(path: string) {
  if (typeof window.gtag !== "function") return;
  window.gtag("config", GA_MEASUREMENT_ID, { page_path: path });
}
