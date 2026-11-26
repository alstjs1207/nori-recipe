import type { KeyValueStorage } from "./contract";

export const AD_SHOWN_AT_KEY = "nori-recipe/next-round-ad-shown-at-v1";
export const AD_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const AD_REQUEST_TIMEOUT_MS = 5000;
export const AD_CLOSE_TIMEOUT_MS = 60000;

export interface RecommendationAd {
  start(): () => void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): boolean;
  beforeNext(): Promise<boolean>;
  background(): void;
  resume(): void;
  reset(): Promise<void>;
}

type AdEvent = { type: string };
export interface FullScreenAdBridge {
  isSupported(): boolean;
  load(params: { options: { adGroupId: string }; onEvent(event: AdEvent): void; onError(error: unknown): void }): () => void;
  show(params: { options: { adGroupId: string }; onEvent(event: AdEvent): void; onError(error: unknown): void }): () => void;
}

// Only the group goes to the SDK. The timestamp uses the runtime's user-scoped storage.
export function createRecommendationAd(bridge: FullScreenAdBridge, adGroupId: string, canShow: () => boolean, storage: KeyValueStorage): RecommendationAd {
  let active = false, supported = false, hydrated = false, ready = false, loading = false;
  let generation = 0;
  let shownAt: number | null = null;
  let displayed = false, leftAd = false;
  let offLoad = () => {};
  let offShow = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<boolean> | null = null;
  let settle: ((proceed: boolean) => void) | null = null;
  let writes = Promise.resolve();
  const listeners = new Set<() => void>();
  const due = () => active && supported && hydrated && (shownAt === null || Date.now() - shownAt >= AD_COOLDOWN_MS);
  const notify = () => { for (const listener of listeners) listener(); };
  function scheduleExpiry() {
    clearTimeout(expiry);
    if (shownAt !== null) {
      const remaining = shownAt + AD_COOLDOWN_MS - Date.now();
      // Future timestamps (clock rollback) also suppress ads, with a bounded timer.
      if (remaining > 0) expiry = setTimeout(() => { notify(); scheduleExpiry(); }, Math.min(remaining, AD_COOLDOWN_MS));
    }
    notify();
  }
  function load() {
    if (!active || !supported || loading || ready) return;
    loading = true;
    let finished = false;
    let off = () => {};
    const finish = () => { if (finished) return; finished = true; loading = false; off(); };
    offLoad = finish;
    try {
      off = bridge.load({
        options: { adGroupId },
        onEvent(event) {
          if (finished || !active) return;
          if (event.type === "loaded") { ready = true; finish(); }
        },
        onError() { finish(); },
      });
    } catch { finish(); }
    if (finished) off();
  }
  function finish(proceed: boolean) {
    if (!pending) return;
    clearTimeout(timer);
    offShow(); offShow = () => {};
    const resolve = settle;
    pending = null; settle = null;
    displayed = false; leftAd = false;
    resolve?.(proceed);
    // Prepare only; a late loaded event can never trigger a show.
    if (active) load();
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: due,
    start() {
      active = true;
      const current = ++generation;
      hydrated = false;
      try { supported = Boolean(adGroupId) && bridge.isSupported(); } catch { supported = false; }
      if (supported) {
        load();
        void writes.then(() => storage.getItem(AD_SHOWN_AT_KEY)).then(value => {
          if (!active || generation !== current) return;
          const timestamp = value === null ? null : Number(value);
          // Corrupt storage fails open for content, without risking repeated ads.
          if (value !== null && (!value.trim() || !Number.isFinite(timestamp) || timestamp! <= 0)) return;
          shownAt = timestamp;
          hydrated = true;
          scheduleExpiry();
        }).catch(() => { /* Skip ads when their cooldown cannot be restored. */ });
      }
      notify();
      return () => {
        active = false; generation++;
        ready = false; hydrated = false;
        offLoad(); finish(false);
        clearTimeout(expiry);
        notify();
      };
    },
    beforeNext() {
      if (pending) return pending;
      if (!due() || !canShow()) return Promise.resolve(true);
      if (!ready) { load(); return Promise.resolve(true); }
      ready = false;
      pending = new Promise<boolean>(resolve => { settle = resolve; });
      const result = pending;
      let finished = false;
      let off = () => {};
      offShow = () => { finished = true; off(); };
      // This advances content only; it never closes or manipulates the SDK ad.
      // Native ad content can remain above the prepared next round.
      timer = setTimeout(() => finish(true), AD_REQUEST_TIMEOUT_MS);
      try {
        off = bridge.show({
          options: { adGroupId },
          onEvent(event) {
            if (finished || !active) return;
            if (event.type === "show" && !displayed) {
              displayed = true;
              shownAt = Date.now();
              const timestamp = shownAt;
              writes = writes.then(() => storage.setItem(AD_SHOWN_AT_KEY, String(timestamp))).catch(() => {});
              scheduleExpiry();
              clearTimeout(timer);
              timer = setTimeout(() => finish(true), AD_CLOSE_TIMEOUT_MS);
            } else if (event.type === "dismissed" || event.type === "failedToShow") finish(true);
          },
          onError() { if (!finished) finish(true); },
        });
      } catch { finish(true); }
      if (finished) off();
      return result;
    },
    background() { if (pending && displayed) leftAd = true; },
    resume() { if (pending && displayed && leftAd && canShow()) finish(true); },
    async reset() {
      generation++;
      hydrated = false;
      finish(false);
      await writes;
      await storage.removeItem(AD_SHOWN_AT_KEY);
      shownAt = null;
      hydrated = supported;
      scheduleExpiry();
    },
  };
}
