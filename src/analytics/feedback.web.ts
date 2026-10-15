import { webAnalytics } from "./analytics.web";
import { createFeedbackCollector, FEEDBACK_ANALYTICS_RECEIPT_PREFIX, type FeedbackAnalyticsRecord } from "./feedback";
import { getPlayLogs } from "@/db/queries";

const collectors = new Map<string, ReturnType<typeof createFeedbackCollector>>();

function collector(guestId: string) {
  let instance = collectors.get(guestId);
  if (instance) return instance;
  const scope = `${process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID}@${window.location.origin}/${guestId}/`;
  const key = (id: string) => `${FEEDBACK_ANALYTICS_RECEIPT_PREFIX}${scope}${id}`;
  instance = createFeedbackCollector({
    client: webAnalytics,
    active: () => webAnalytics.enabled && webAnalytics.getConsent() === "granted" && navigator.onLine &&
      localStorage.getItem("nori-recipe/guest-id") === guestId,
    readReceipt: (id) => localStorage.getItem(key(id)) === "dispatched",
    writeReceipt: (id) => localStorage.setItem(key(id), "dispatched"),
    storageAvailable: () => {
      const probe = key("storage-check");
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return true;
    },
    exclusive: async (work) => {
      if (navigator.locks) await navigator.locks.request(`${FEEDBACK_ANALYTICS_RECEIPT_PREFIX}${scope}`, async () => { await work(); });
      else await work();
    },
  });
  collectors.set(guestId, instance);
  return instance;
}

export function trackSavedFeedback(guestId: string, record: FeedbackAnalyticsRecord): void {
  try { void collector(guestId).collect([record], "play_feedback_saved"); }
  catch { /* Analytics cannot turn a successful local save into a form error. */ }
}

export async function importFeedbackAnalytics(guestId: string): Promise<void> {
  if (!webAnalytics.enabled || webAnalytics.getConsent() !== "granted" || !navigator.onLine) return;
  try {
    const records = await getPlayLogs(guestId, Number.MAX_SAFE_INTEGER);
    await collector(guestId).collect(records, "play_feedback_imported");
  } catch { /* Local data remains available when reading or analytics fails. */ }
}
