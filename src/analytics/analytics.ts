import type { AnalyticsEntryPoint, AnalyticsEvent } from "./policy";

// Native analytics remains off until a Firebase native integration is configured.
export function trackAnalytics(_event: AnalyticsEvent): void {}
export function resetAnalyticsConsent(): void {}
export function rememberPlayEntry(_playId: string, _entryPoint: AnalyticsEntryPoint): void {}
export function consumePlayEntry(_playId: string): AnalyticsEntryPoint { return "direct_link"; }
