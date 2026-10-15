import type { AnalyticsClient } from "./client";
import { sanitizeAnalyticsEvent, type AnalyticsEvent } from "./policy";
import type { PlayLogRecord } from "@/types/db";

export type FeedbackAnalyticsRecord = Pick<PlayLogRecord, "id" | "playId" | "starRating" | "childReaction">;
type FeedbackEventName = "play_feedback_saved" | "play_feedback_imported";
export const FEEDBACK_ANALYTICS_RECEIPT_PREFIX = "nori-recipe/feedback-analytics/";

/** IDs are only local receipts, never event parameters. The transport confirms dispatch, not GA ingestion. */
export function createFeedbackCollector(environment: {
  client: AnalyticsClient;
  active: () => boolean;
  readReceipt: (id: string) => boolean;
  writeReceipt: (id: string) => void;
  storageAvailable: () => boolean;
  exclusive: (work: () => Promise<void>) => Promise<void>;
}) {
  let queue = Promise.resolve();
  const dispatched = new Set<string>();
  return {
    collect(records: readonly FeedbackAnalyticsRecord[], name: FeedbackEventName): Promise<void> {
      const run = async () => {
        if (!environment.active()) return;
        await environment.exclusive(async () => {
          if (!environment.active() || !environment.storageAvailable()) return;
          for (const record of records) {
            if (!environment.active()) break;
            if (dispatched.has(record.id) || environment.readReceipt(record.id)) continue;
            if (record.starRating === null) continue;
            const event: AnalyticsEvent = { name, params: { play_id: record.playId, rating: record.starRating, reactions: record.childReaction } };
            if (sanitizeAnalyticsEvent(event) === null) continue;
            if (!await environment.client.track(event)) break;
            dispatched.add(record.id);
            environment.writeReceipt(record.id);
          }
        });
      };
      queue = queue.then(run).catch(() => { /* Analytics must never affect local feedback saving. */ });
      return queue;
    },
  };
}
