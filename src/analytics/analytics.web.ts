import { createAnalyticsClient, type AnalyticsTransport } from "./client";
import { ANALYTICS_CONSENT_KEY, parseAnalyticsConfig, type AnalyticsEntryPoint, type AnalyticsEvent, type AnalyticsParams } from "./policy";

type GoogleTag = (...args: unknown[]) => void;
declare global {
  interface Window { dataLayer?: unknown[]; gtag?: GoogleTag }
}

const config = process.env.EXPO_PUBLIC_GA_ENABLED === "true"
  ? parseAnalyticsConfig(process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID, process.env.EXPO_PUBLIC_ANALYTICS_ORIGIN)
  : null;
let ready = false;
let configured = false;
let initialized = false;
let failed = false;

function disableTag() {
  if (config) Reflect.set(window, `ga-disable-${config.measurementId}`, true);
  configured = false;
}

function clearCookies() {
  if (!config) return;
  disableTag();
  for (const name of ["nori_ga", `nori_ga_${config.measurementId.slice(2)}`, `_ga_${config.measurementId.slice(2)}`]) {
    for (const domain of ["", `; Domain=${window.location.hostname}`]) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax; Secure`;
    }
  }
  // Discard queued commands on withdrawal while a blocked tag is still loading.
  if (!ready && window.dataLayer) window.dataLayer.length = 0;
}

async function loadTag(_page: AnalyticsParams): Promise<AnalyticsTransport | null> {
  if (!config || failed) return null;
  Reflect.set(window, `ga-disable-${config.measurementId}`, false);
  const transport: AnalyticsTransport = {
    send(name, params) {
      Reflect.set(window, `ga-disable-${config.measurementId}`, false);
      const { page_location, page_referrer, page_title, screen_name } = params;
      const page = { page_location, page_referrer, page_title, screen_name };
      if (!initialized) {
        window.gtag?.("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      }
      window.gtag?.("consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      if (!initialized) {
        window.gtag?.("js", new Date());
        initialized = true;
      }
      if (!configured) {
        window.gtag?.("config", config.measurementId, {
          ...page, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
          cookie_prefix: "nori", cookie_domain: window.location.hostname, cookie_expires: 60 * 60 * 24 * 30,
          cookie_flags: "SameSite=Lax;Secure",
        });
        configured = true;
      } else {
        window.gtag?.("config", config.measurementId, { ...page, update: true, send_page_view: false });
      }
      window.gtag?.("set", page);
      window.gtag?.("event", name, { ...params, send_to: config.measurementId });
    },
    disable: disableTag,
  };
  if (ready) return transport;
  window.dataLayer ??= [];
  window.gtag = function (..._args: unknown[]) { window.dataLayer!.push(arguments); };
  return new Promise((resolve) => {
    document.getElementById("nori-google-tag")?.remove();
    const script = document.createElement("script");
    script.id = "nori-google-tag";
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.measurementId)}`;
    const timer = window.setTimeout(() => finish(false), 5000);
    function finish(success: boolean) {
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (success) ready = true;
      else { failed = true; disableTag(); script.remove(); window.dataLayer!.length = 0; }
      resolve(success ? transport : null);
    }
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });
}

export const webAnalytics = createAnalyticsClient({
  config,
  origin: () => typeof window === "undefined" ? "" : window.location.origin,
  online: () => typeof navigator !== "undefined" && navigator.onLine,
  referrer: () => typeof document === "undefined" ? "" : document.referrer,
  readConsent: () => window.localStorage.getItem(ANALYTICS_CONSENT_KEY),
  writeConsent: (value) => value === null ? window.localStorage.removeItem(ANALYTICS_CONSENT_KEY) : window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value),
  load: loadTag,
  clearCookies,
});

export function trackAnalytics(event: AnalyticsEvent): void { void webAnalytics.track(event); }
export function resetAnalyticsConsent(): void { webAnalytics.setConsent("unknown"); }

let pendingEntry: { playId: string; entryPoint: AnalyticsEntryPoint; at: number } | null = null;
export function rememberPlayEntry(playId: string, entryPoint: AnalyticsEntryPoint): void { pendingEntry = { playId, entryPoint, at: Date.now() }; }
export function consumePlayEntry(playId: string): AnalyticsEntryPoint {
  const result = pendingEntry?.playId === playId && Date.now() - pendingEntry.at < 60_000 ? pendingEntry.entryPoint : "direct_link";
  pendingEntry = null;
  return result;
}
