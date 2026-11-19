type CompletionRecord = { id: string; playId: string };

// A successful save creates a one-use event. Existing completion history alone
// must never start a celebration on navigation, remount, or application reload.
export function createHomeCompletionCelebration() {
  let pending: { guestId: string; record: CompletionRecord; ids: string[]; roundId: string | null } | null = null;

  return {
    saved(guestId: string, record: CompletionRecord, recommendationIds: readonly string[], roundId: string | null) {
      pending = { guestId, record: { id: record.id, playId: record.playId }, ids: [...recommendationIds], roundId };
    },
    consume(guestId: string, recommendationIds: readonly string[], records: readonly CompletionRecord[], roundId: string | null): boolean {
      const event = pending;
      pending = null;
      if (!event || event.guestId !== guestId || !roundId || event.roundId !== roundId) return false;
      const ids = new Set(recommendationIds);
      if (recommendationIds.length !== 3 || ids.size !== 3 || event.ids.length !== 3 ||
          new Set(event.ids).size !== 3 || !event.ids.every(id => ids.has(id)) ||
          !ids.has(event.record.playId)) return false;
      if (!records.some(record => record.id === event.record.id && record.playId === event.record.playId)) return false;
      const before = new Set(records.filter(record => record.id !== event.record.id).map(record => record.playId));
      const after = new Set(records.map(record => record.playId));
      return [...ids].every(id => after.has(id)) && ![...ids].every(id => before.has(id));
    },
  };
}

export const homeCompletionCelebration = createHomeCompletionCelebration();
