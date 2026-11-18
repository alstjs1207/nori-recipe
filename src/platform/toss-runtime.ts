import type { AppRuntime, Insets, KeyValueStorage } from "./contract";

export interface TossBridge {
  storage: KeyValueStorage;
  identify(): Promise<{ type: string; hash: string }>;
  createLink(options: { path: string }): Promise<string>;
  share(options: { message: string }): Promise<void>;
  copy(text: string): Promise<void>;
  close(): Promise<void>;
  openExternal(url: string): Promise<void>;
  configureNavigation(): Promise<void>;
  onNavigation(event: "backEvent" | "homeEvent", onEvent: () => void, onError: () => void): () => void;
  getInsets(): Insets;
  onInsets(onChange: (insets: Insets) => void): () => void;
}

export function playDeepLink(appName: string, playId: string): string {
  if (!/^[a-z][a-z0-9-]{0,49}$/.test(appName) || !/^play_\d{3,6}$/.test(playId)) {
    throw new Error("공유할 놀이 주소를 확인해 주세요.");
  }
  return `intoss://${appName}/play/${playId}`;
}

// SDK details stay outside this module so failure, isolation and re-entry can be tested.
export function createTossRuntime(bridge: TossBridge, appName: string): AppRuntime {
  let identity: string | null = null;
  let pending: Promise<void> | null = null;
  let changed = false;
  async function identify() {
    if (changed) throw new Error("토스 사용자가 바뀌었어요. 미니앱을 다시 열어주세요.");
    if (pending) return pending;
    pending = (async () => {
      const result = await bridge.identify();
      if (result?.type !== "HASH" || typeof result.hash !== "string" || !result.hash.trim()) {
        throw new Error("토스 사용자 정보를 확인하지 못했어요. 토스앱을 업데이트하고 다시 시도해 주세요.");
      }
      if (identity !== null && identity !== result.hash) {
        changed = true;
        throw new Error("토스 사용자가 바뀌었어요. 미니앱을 다시 열어주세요.");
      }
      identity = result.hash;
    })();
    try { await pending; } finally { pending = null; }
  }
  async function scopedKey(key: string) {
    if (pending) await pending;
    if (changed) throw new Error("토스 사용자가 바뀌었어요. 미니앱을 다시 열어주세요.");
    if (identity === null) await identify();
    return `nori-recipe/toss/v1/${encodeURIComponent(identity!)}/${key}`;
  }
  return {
    target: "toss",
    storage: {
      async getItem(key) { return bridge.storage.getItem(await scopedKey(key)); },
      async setItem(key, value) { await bridge.storage.setItem(await scopedKey(key), value); },
      async removeItem(key) { await bridge.storage.removeItem(await scopedKey(key)); },
    },
    async initialize() { if (identity === null) await identify(); },
    async checkIdentity() {
      try { await identify(); return true; } catch { return false; }
    },
    createPlayLink(playId) { return bridge.createLink({ path: playDeepLink(appName, playId) }); },
    shareMessage(message) { return bridge.share({ message }); },
    copyText(text) { return bridge.copy(text); },
    close() { return bridge.close(); },
    openExternal(url) {
      if (!["https://toss.im/privacy-policy", "https://supabase.com/privacy", "https://policies.google.com/privacy"].includes(url)) return Promise.reject(new Error("허용되지 않은 외부 주소예요."));
      return bridge.openExternal(url);
    },
    navigation(onBack, onHome, onError) {
      const offBack = bridge.onNavigation("backEvent", onBack, onError);
      let offHome: (() => void) | undefined;
      try {
        offHome = bridge.onNavigation("homeEvent", onHome, onError);
        void bridge.configureNavigation().catch(onError);
      } catch (error) { offBack(); throw error; }
      return () => { offBack(); offHome?.(); };
    },
    safeArea(onChange) {
      onChange(bridge.getInsets());
      return bridge.onInsets(onChange);
    },
  };
}
