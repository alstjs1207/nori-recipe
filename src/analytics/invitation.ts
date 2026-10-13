import { ANALYTICS_CONSENT_VERSION } from "./policy";

export const ANALYTICS_INVITATION_SESSION_KEY = `nori-recipe/analytics-invitation-v${ANALYTICS_CONSENT_VERSION}`;
export const ANALYTICS_INVITATION_RESET_EVENT = "nori:reset-analytics-invitation";
export const ANALYTICS_READING_TIME_MS = 20_000;

/** Only an in-memory eligibility flag; no reading history or analytics events. */
export function createAnalyticsReadingProgress(now: () => number) {
  let elapsed = 0;
  let startedAt: number | null = null;
  let scrolledHalfway = false;
  const visibleElapsed = () => elapsed + (startedAt === null ? 0 : Math.max(0, now() - startedAt));
  return {
    resume() { startedAt ??= now(); },
    pause() { elapsed = visibleElapsed(); startedAt = null; },
    scroll(progress: number) {
      if (startedAt !== null && Number.isFinite(progress) && progress >= 0.5) scrolledHalfway = true;
    },
    remaining: () => Math.max(0, ANALYTICS_READING_TIME_MS - visibleElapsed()),
    isReady: () => scrolledHalfway || visibleElapsed() >= ANALYTICS_READING_TIME_MS,
  };
}
