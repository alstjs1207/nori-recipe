import { create } from "zustand";

export const HOME_ROUND_STORAGE_KEY = "nori-recipe/home-recommendation-round-v1";
export type RoundRecord = { id: string; playId: string };
export type HomeRecommendationRound = {
  version: 1;
  id: string;
  guestId: string;
  key: string | null;
  ids: string[];
  records: RoundRecord[];
};
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };

export function parseHomeRound(value: string | null, guestId: string): HomeRecommendationRound | null {
  if (!value) return null;
  try {
    const r = JSON.parse(value);
    if (r?.version !== 1 || typeof r.id !== "string" || !r.id || r.guestId !== guestId ||
        (r.key !== null && typeof r.key !== "string") || !Array.isArray(r.ids) ||
        r.ids.length > 3 || !r.ids.every((id: unknown) => typeof id === "string") ||
        new Set(r.ids).size !== r.ids.length || !Array.isArray(r.records) ||
        !r.records.every((entry: RoundRecord) => entry && typeof entry.id === "string" &&
          typeof entry.playId === "string" && r.ids.includes(entry.playId))) return null;
    return r;
  } catch { return null; }
}

// A staged reference is not a completion: only records actually present in the
// activity database count. This also recovers a save interrupted before return.
export function getHomeRoundRecords<T extends RoundRecord & { guestId: string }>(
  round: HomeRecommendationRound | null, guestId: string | null, records: readonly T[],
): T[] {
  if (!round || round.guestId !== guestId) return [];
  const assigned = new Map(round.records.map(record => [record.id, record.playId]));
  return records.filter(record => record.guestId === guestId &&
    assigned.get(record.id) === record.playId && round.ids.includes(record.playId));
}

type RoundStore = {
  round: HomeRecommendationRound | null;
  hydrate(guestId: string, legacy: { ids: string[]; key: string | null; records: RoundRecord[] }): Promise<void>;
  restart(guestId: string): Promise<void>;
  pin(guestId: string, expectedRoundId: string | null, ids: string[], key: string): Promise<void>;
  stage(guestId: string, expectedRoundId: string | null, record: RoundRecord): Promise<void>;
};

export function createHomeRecommendationStore(storage: Storage, makeId: () => string) {
  // Serialize storage writes; a stale screen cannot put an old round back after
  // a material edit or a newer recommendation request.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = (work: () => Promise<void>) => {
    const result = queue.then(work);
    queue = result.catch(() => {});
    return result;
  };
  return create<RoundStore>((set, get) => {
    const persist = async (round: HomeRecommendationRound) => {
      await storage.setItem(HOME_ROUND_STORAGE_KEY, JSON.stringify(round));
      set({ round });
    };
    const fresh = (guestId: string): HomeRecommendationRound => ({ version: 1, id: makeId(), guestId, key: null, ids: [], records: [] });
    return {
      round: null,
      hydrate: (guestId, legacy) => serial(async () => {
        const restored = parseHomeRound(await storage.getItem(HOME_ROUND_STORAGE_KEY), guestId);
        if (restored) { set({ round: restored }); return; }
        const round = fresh(guestId);
        round.ids = [...new Set(legacy.ids)].slice(0, 3);
        round.key = legacy.key;
        round.records = legacy.records.filter(record => round.ids.includes(record.playId))
          .map(record => ({ id: record.id, playId: record.playId }));
        await persist(round);
      }),
      restart: guestId => serial(async () => { await persist(fresh(guestId)); }),
      pin: (guestId, expectedRoundId, ids, key) => serial(async () => {
        const round = get().round;
        if (!round || round.guestId !== guestId || round.id !== expectedRoundId) return;
        const nextIds = [...new Set(ids)].slice(0, 3);
        if (round.key === key && JSON.stringify(round.ids) === JSON.stringify(nextIds)) return;
        await persist({ ...round, ids: nextIds, key, records: round.records.filter(record => nextIds.includes(record.playId)) });
      }),
      stage: (guestId, expectedRoundId, record) => serial(async () => {
        const round = get().round;
        if (!round || round.guestId !== guestId || round.id !== expectedRoundId || !round.ids.includes(record.playId)) return;
        if (round.records.some(entry => entry.id === record.id)) return;
        await persist({ ...round, records: [...round.records, { id: record.id, playId: record.playId }] });
      }),
    };
  });
}
