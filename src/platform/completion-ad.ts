export type CompletionRecord = { id: string; playId: string };

export interface CompletionAd {
  start(): () => void;
  saved(record: CompletionRecord): void;
  home(recommendationIds: string[], records: CompletionRecord[]): void;
}

type AdEvent = { type: string };
export interface FullScreenAdBridge {
  isSupported(): boolean;
  load(params: { options: { adGroupId: string }; onEvent(event: AdEvent): void; onError(error: unknown): void }): () => void;
  show(params: { options: { adGroupId: string }; onEvent(event: AdEvent): void; onError(error: unknown): void }): () => void;
}

// Only the ad group is sent to the SDK. Records are compared locally and never persisted here.
export function createCompletionAd(bridge: FullScreenAdBridge, adGroupId: string, canShow: () => boolean): CompletionAd {
  let active = false;
  let ready = false;
  let showing = false;
  let pending: CompletionRecord | null = null;
  let offLoad = () => {};
  let offShow = () => {};

  function load() {
    ready = false;
    offLoad();
    let finished = false;
    let off = () => {};
    const finish = () => { if (finished) return; finished = true; off(); };
    try {
      off = bridge.load({
        options: { adGroupId },
        onEvent(event) {
          if (finished || !active) return;
          if (event.type === "loaded") { ready = true; finish(); }
        },
        onError() { if (!finished) { ready = false; finish(); } },
      });
    } catch { finish(); }
    offLoad = finish;
    if (finished) off();
  }

  return {
    start() {
      active = true;
      try { if (adGroupId && bridge.isSupported()) load(); } catch { /* Ads must not block the app. */ }
      return () => {
        active = false; ready = false; showing = false; pending = null;
        offLoad(); offShow();
      };
    },
    saved(record) { pending = { id: record.id, playId: record.playId }; },
    home(recommendationIds, records) {
      const saved = pending;
      pending = null; // Consume even when unavailable; never show a late ad after navigation.
      if (!active || !ready || showing || !saved || !canShow()) return;
      const ids = new Set(recommendationIds);
      if (ids.size !== 3 || recommendationIds.length !== 3 || !ids.has(saved.playId)) return;
      if (!records.some(record => record.id === saved.id && record.playId === saved.playId)) return;
      const before = new Set(records.filter(record => record.id !== saved.id).map(record => record.playId));
      const after = new Set(records.map(record => record.playId));
      if (![...ids].every(id => after.has(id)) || [...ids].every(id => before.has(id))) return;
      ready = false;
      showing = true;
      let finished = false;
      let off = () => {};
      const finish = (next: boolean) => {
        if (finished) return;
        finished = true; showing = false; off();
        if (next && active) load();
      };
      try {
        off = bridge.show({
          options: { adGroupId },
          onEvent(event) {
            if (event.type === "dismissed") finish(true);
            else if (event.type === "failedToShow") finish(false);
          },
          onError() { finish(false); },
        });
      } catch { finish(false); }
      offShow = () => finish(false);
      if (finished) off();
    },
  };
}
