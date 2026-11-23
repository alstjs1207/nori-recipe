import { create } from "zustand";
import type { MaterialSlug } from "@/constants/materials";
import type { HomeIntentConfirmation } from "@/types";

export const HOME_ROUND_STORAGE_KEY = "nori-recipe/home-recommendation-round-v1";
export type RoundRecord = { id: string; playId: string };
export type HomeRoundSnapshot = { id: string; ids: string[]; records: RoundRecord[] };
export type HomeRoundContext = { materials: MaterialSlug[] | null; confirmation: HomeIntentConfirmation | null };
export type HomeRecommendationRound = HomeRoundSnapshot & {
  version: 1;
  guestId: string;
  key: string | null;
  revision?: number;
  context?: HomeRoundContext;
  archives?: HomeRoundSnapshot[];
};
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
function validSnapshot(r: HomeRoundSnapshot) {
  return r && typeof r.id === "string" && !!r.id && Array.isArray(r.ids) && r.ids.length <= 3 &&
    r.ids.every(id => typeof id === "string") && new Set(r.ids).size === r.ids.length && Array.isArray(r.records) &&
    r.records.every(entry => entry && typeof entry.id === "string" && typeof entry.playId === "string" && r.ids.includes(entry.playId));
}
export function parseHomeRound(value: string | null, guestId: string): HomeRecommendationRound | null {
  if (!value) return null;
  try {
    const r = JSON.parse(value);
    if (r?.version !== 1 || r.guestId !== guestId || !validSnapshot(r) ||
      (r.key !== null && typeof r.key !== "string") ||
      (r.revision !== undefined && (!Number.isInteger(r.revision) || r.revision < 0)) ||
      (r.archives !== undefined && (!Array.isArray(r.archives) || !r.archives.every(validSnapshot))) ||
      (r.context !== undefined && (!r.context || (r.context.materials !== null && (!Array.isArray(r.context.materials) || !r.context.materials.every((m: unknown) => typeof m === "string")))))) return null;
    return r;
  } catch { return null; }
}

// Staging alone never counts: every reference must match a live activity row.
export function getHomeRoundRecords<T extends RoundRecord & { guestId: string }>(
  round: HomeRecommendationRound | null, guestId: string | null, records: readonly T[],
): T[] {
  if (!round || round.guestId !== guestId) return [];
  const assigned = new Map(round.records.map(record => [record.id, record.playId]));
  return records.filter(record => record.guestId === guestId && assigned.get(record.id) === record.playId && round.ids.includes(record.playId));
}
export type CompletedHomeBundle = { id: string; ids: string[]; completedAt: string };
export function getCompletedHomeBundles<T extends RoundRecord & { guestId: string; completedAt: string }>(
  round: HomeRecommendationRound | null, guestId: string | null, records: readonly T[],
): CompletedHomeBundle[] {
  if (!round || round.guestId !== guestId) return [];
  const snapshots = new Map((round.archives ?? []).map(item => [item.id, item]));
  if (round.ids.length === 3 && round.ids.every(id => round.records.some(r => r.playId === id))) snapshots.set(round.id, round);
  const logMap = new Map(records.filter(r => r.guestId === guestId).map(r => [r.id, r]));
  const result: CompletedHomeBundle[] = [];
  for (const snapshot of snapshots.values()) {
    if (snapshot.ids.length !== 3) continue;
    const completed = snapshot.ids.map(id => snapshot.records.map(ref => { const log = logMap.get(ref.id); return log?.playId === ref.playId ? log : undefined; }).find(log => log?.playId === id));
    if (completed.every((log): log is T => !!log)) result.push({ id: snapshot.id, ids: [...snapshot.ids], completedAt: completed.map(log => log.completedAt).sort().at(-1)! });
  }
  return result.sort((a, b) => b.completedAt.localeCompare(a.completedAt) || b.id.localeCompare(a.id));
}
function archiveCandidate(round: HomeRecommendationRound): HomeRecommendationRound {
  if (round.ids.length !== 3 || !round.ids.every(id => round.records.some(record => record.playId === id))) return round;
  const snapshot = { id: round.id, ids: [...round.ids], records: [...round.records] };
  return { ...round, archives: [...(round.archives ?? []).filter(a => a.id !== round.id), snapshot] };
}
type RoundStore = {
  round: HomeRecommendationRound | null;
  hydrate(guestId: string, legacy: { ids: string[]; key: string | null; records: RoundRecord[] }): Promise<void>;
  restart(guestId: string): Promise<void>;
  edit(guestId: string, prepare: (round: HomeRecommendationRound) => Promise<{ ids: string[]; key: string; records: RoundRecord[]; context: HomeRoundContext; startNew: boolean }>): Promise<HomeRecommendationRound | null>;
  pin(guestId: string, expectedRoundId: string | null, ids: string[], key: string, expectedRevision?: number): Promise<void>;
  stage(guestId: string, expectedRoundId: string | null, record: RoundRecord, expectedRevision?: number): Promise<void>;
};
export function createHomeRecommendationStore(storage: Storage, makeId: () => string) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T,>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work); queue = result.catch(() => {}); return result;
  };
  return create<RoundStore>((set, get) => {
    const persist = async (round: HomeRecommendationRound) => { await storage.setItem(HOME_ROUND_STORAGE_KEY, JSON.stringify(round)); set({ round }); return round; };
    const fresh = (guestId: string): HomeRecommendationRound => ({ version: 1, id: makeId(), guestId, key: null, ids: [], records: [], revision: 0 });
    return {
      round: null,
      hydrate: (guestId, legacy) => serial(async () => {
        const restored = parseHomeRound(await storage.getItem(HOME_ROUND_STORAGE_KEY), guestId);
        if (restored) { set({ round: archiveCandidate(restored) }); return; }
        const round = fresh(guestId); round.ids = [...new Set(legacy.ids)].slice(0, 3); round.key = legacy.key;
        round.records = legacy.records.filter(record => round.ids.includes(record.playId)).map(record => ({ id: record.id, playId: record.playId }));
        await persist(archiveCandidate(round));
      }),
      restart: guestId => serial(async () => {
        const previous = get().round;
        await persist({ ...fresh(guestId), ...(previous?.guestId === guestId ? { archives: archiveCandidate(previous).archives, context: previous.context ? { ...previous.context, confirmation: null } : undefined } : {}) });
      }),
      edit: (guestId, prepare) => serial(async () => {
        const previous = get().round;
        if (!previous || previous.guestId !== guestId) return null;
        const next = await prepare(previous);
        if (get().round !== previous) return null;
        const base = next.startNew ? { ...fresh(guestId), archives: archiveCandidate(previous).archives } : previous;
        return persist({ ...base, ids: [...new Set(next.ids)].slice(0, 3), key: next.key, records: next.records.filter(r => next.ids.includes(r.playId)), context: next.context, revision: (previous.revision ?? 0) + 1 });
      }),
      pin: (guestId, expectedRoundId, ids, key, expectedRevision) => serial(async () => {
        const round = get().round;
        if (!round || round.guestId !== guestId || round.id !== expectedRoundId || (expectedRevision !== undefined && (round.revision ?? 0) !== expectedRevision)) return;
        const nextIds = [...new Set(ids)].slice(0, 3);
        if (round.key === key && JSON.stringify(round.ids) === JSON.stringify(nextIds)) return;
        await persist({ ...round, ids: nextIds, key, records: round.records.filter(record => nextIds.includes(record.playId)) });
      }),
      stage: (guestId, expectedRoundId, record, expectedRevision) => serial(async () => {
        const round = get().round;
        if (!round || round.guestId !== guestId || round.id !== expectedRoundId || !round.ids.includes(record.playId) || (expectedRevision !== undefined && (round.revision ?? 0) !== expectedRevision)) return;
        if (round.records.some(entry => entry.id === record.id)) return;
        await persist(archiveCandidate({ ...round, records: [...round.records, { id: record.id, playId: record.playId }] }));
      }),
    };
  });
}
