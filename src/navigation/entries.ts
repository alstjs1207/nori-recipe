// Keep repeated tab visits so browser/native back returns to the immediate source.
export const SCREEN_BACK_BEHAVIOR = "fullHistory" as const;

export type EntryKind = "new" | "back";
export type ScreenEntry = { version: number; kind: EntryKind; path: string; scrollY: number };
export type RouteShape = { key: string; name: string; params?: object };
export type StateShape = { index?: number; routes: readonly RouteShape[]; history?: readonly unknown[] };

export function routePath(route: Pick<RouteShape, "name" | "params">): string {
  return normalizePath(route.name.replace(/\[([^\]]+)\]/g, (_, key: string) => String((route.params as Record<string, unknown> | undefined)?.[key] ?? key)));
}
export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\([^/]+\)\/?/g, "").replace(/\/index$/, "");
  return `/${clean.replace(/^\/+|\/+$/g, "")}`.replace(/^\/index$/, "/");
}
export function hrefPath(href: string | { pathname: string; params?: object }): string | null {
  if (typeof href === "string") return /^(?:[a-z]+:|\/\/|#)/i.test(href) ? null : normalizePath(href);
  return routePath({ name: href.pathname, params: href.params as Record<string, unknown> });
}
export function historyKeys(state: StateShape): string[] {
  return state.history?.filter((item): item is { type: "route"; key: string } =>
    typeof item === "object" && item !== null && "type" in item && item.type === "route" && "key" in item && typeof item.key === "string"
  ).map(item => item.key) ?? state.routes.slice(0, (state.index ?? 0) + 1).map(route => route.key);
}
export function isHistoryReturn(previous: readonly string[], next: readonly string[]): boolean {
  return next.length > 0 && next.length < previous.length && next.every((key, index) => previous[index] === key);
}

// App-session state only: no URLs, positions or draft identifiers are sent to analytics.
export function createScreenEntries() {
  let serial = 0;
  let active: { key: string; path: string } | undefined;
  let history: string[] = [];
  let pending: { kind: EntryKind; path?: string } | undefined;
  const records = new Map<string, ScreenEntry>();
  const positions = new Map<string, number>();
  const listeners = new Set<() => void>();
  const notify = () => [...listeners].forEach(listener => listener());
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    forward(path: string | null) {
      if (!path) return;
      pending = { kind: "new", path };
      notify();
    },
    back() { pending = { kind: "back" }; },
    current() { return active ? records.get(active.key) : undefined; },
    enter(key: string, path: string, nextHistory: string[]): ScreenEntry {
      const requested = pending && (!pending.path || pending.path === path);
      const changed = active?.key !== key || active.path !== path;
      if (!changed && !requested) return records.get(key)!;
      const kind = requested ? pending!.kind : isHistoryReturn(history, nextHistory) ? "back" : "new";
      if (requested) pending = undefined;
      const entry = { version: ++serial, kind, path, scrollY: kind === "back" ? positions.get(path) ?? 0 : 0 };
      records.set(key, entry);
      active = { key, path };
      history = nextHistory;
      return entry;
    },
    save(path: string, scrollY: number) { positions.set(path, Math.max(0, scrollY)); },
  };
}
export const screenEntries = createScreenEntries();
