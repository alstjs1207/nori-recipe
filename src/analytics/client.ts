import {
  ANALYTICS_CONSENT_VERSION, type AnalyticsConfig, type AnalyticsConsent, type AnalyticsEvent,
  type AnalyticsPage, type AnalyticsParams, getAnalyticsPage, sanitizeAnalyticsEvent, sanitizeReferrer,
} from "./policy";

export type AnalyticsTransport = {
  send: (name: string, params: AnalyticsParams) => void;
  disable: () => void;
};
export type AnalyticsEnvironment = {
  config: AnalyticsConfig | null;
  origin: () => string;
  online: () => boolean;
  readConsent: () => string | null;
  writeConsent: (value: string | null) => void;
  referrer: () => string;
  load: (page: AnalyticsParams) => Promise<AnalyticsTransport | null>;
  clearCookies: () => void;
};

export function createAnalyticsClient(environment: AnalyticsEnvironment) {
  const { config } = environment;
  const enabled = Boolean(config && environment.origin() === config.origin);
  let consent: AnalyticsConsent = "unknown";
  if (enabled) {
    try {
      const record = JSON.parse(environment.readConsent() ?? "null") as { version?: unknown; scope?: unknown; value?: unknown } | null;
      if (record?.version === ANALYTICS_CONSENT_VERSION && record.scope === `${config!.measurementId}@${config!.origin}` &&
        (record.value === "granted" || record.value === "denied")) consent = record.value;
    } catch { /* Unavailable or old storage requires a new choice. */ }
  }
  const listeners = new Set<() => void>();
  let revision = 0;
  let transport: AnalyticsTransport | null = null;
  let loading: Promise<AnalyticsTransport | null> | null = null;
  let page: AnalyticsPage | null = null;
  let previousLocation = enabled ? sanitizeReferrer(environment.referrer(), config!.origin) : "";
  let lastPageKey: string | null = null;
  let pageParams: AnalyticsParams = {};
  const canCollect = () => enabled && consent === "granted" && environment.online() && environment.origin() === config!.origin;
  const publish = () => listeners.forEach((listener) => listener());

  async function send(name: string, params: AnalyticsParams): Promise<boolean> {
    if (!canCollect() || !page) return false;
    const currentRevision = revision;
    const payload = { ...pageParams, ...params };
    try {
      if (!transport) {
        loading ??= environment.load(pageParams).catch(() => null);
        transport = await loading;
        if (!transport) loading = null;
      }
      if (!transport || currentRevision !== revision || !canCollect()) return false;
      transport.send(name, payload);
      return true;
    } catch { return false; }
  }

  function setConsent(value: AnalyticsConsent): void {
    if (!enabled) return;
    revision += 1;
    consent = value;
    lastPageKey = null;
    if (value !== "granted") {
      transport?.disable();
      environment.clearCookies();
    }
    try {
      environment.writeConsent(value === "unknown" ? null : JSON.stringify({
        version: ANALYTICS_CONSENT_VERSION, scope: `${config!.measurementId}@${config!.origin}`, value,
      }));
    } catch { /* Apply the choice to this visit even if storage is unavailable. */ }
    publish();
  }

  function trackPage(nextPage: AnalyticsPage): void {
    nextPage = getAnalyticsPage(nextPage.path, nextPage.screen === "home");
    page = nextPage;
    if (!enabled) return;
    const key = `${nextPage.screen}:${nextPage.path}`;
    if (!canCollect() || key === lastPageKey) return;
    const location = `${config!.origin}${nextPage.path}`;
    pageParams = { page_location: location, page_referrer: previousLocation, page_title: nextPage.title, screen_name: nextPage.screen };
    lastPageKey = key;
    previousLocation = location;
    void send("page_view", {}).then((sent) => { if (!sent && lastPageKey === key) lastPageKey = null; });
  }

  return {
    enabled,
    getConsent: () => consent,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setConsent,
    trackPage,
    track: (event: AnalyticsEvent) => {
      const params = sanitizeAnalyticsEvent(event);
      return params === null ? Promise.resolve(false) : send(event.name, params);
    },
  };
}
export type AnalyticsClient = ReturnType<typeof createAnalyticsClient>;
