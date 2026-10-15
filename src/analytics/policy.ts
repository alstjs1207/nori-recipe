import { DEV_AREA_SLUGS } from "@/constants/devAreas";
import { CHILD_REACTION_PARSE_OPTIONS, type ChildReaction } from "@/constants/feedback";

export type AnalyticsConsent = "unknown" | "granted" | "denied";
export const ANALYTICS_CONSENT_VERSION = 3;
export const ANALYTICS_CONSENT_KEY = "nori-recipe/analytics-consent";
export const ANALYTICS_PREVIEW_CONSENT_KEY = "nori-recipe/analytics-consent-preview";

export type AnalyticsConfig = { measurementId: string; origin: string };
export type AnalyticsEntryPoint = "home_recommendation" | "home_discover" | "welcome" | "search" | "favorites" | "direct_link" | "other";
export type AnalyticsScreen = "welcome" | "home" | "search" | "play" | "feedback" | "favorites" | "record" | "settings" | "not_found";
export type AnalyticsParams = Record<string, string | number>;

export type AnalyticsEvent =
  | { name: "tutorial_complete"; params?: undefined }
  | { name: "recommendation_impression" | "recommendation_click"; params: { play_id: string; position: number; is_new: number } }
  | { name: "play_view"; params: { play_id: string; entry_point: AnalyticsEntryPoint; is_new: number } }
  | { name: "favorite_add" | "favorite_remove"; params: { play_id: string } }
  | { name: "play_feedback_saved" | "play_feedback_imported"; params: { play_id: string; rating: number; reactions: readonly ChildReaction[] } }
  | { name: "search_results"; params: { result_count: number; has_query: number; category: string } }
  | { name: "share"; params: { item_id: string; method: "copy_link" | "native_share"; content_type: "play" } };

export type AnalyticsPage = { path: string; screen: AnalyticsScreen; title: string };
const SCREEN_TITLES: Record<AnalyticsScreen, string> = {
  welcome: "시작 · 노리 레시피", home: "발견 · 노리 레시피", search: "탐색 · 노리 레시피",
  play: "놀이 상세 · 노리 레시피", feedback: "놀이 기록 남기기 · 노리 레시피", favorites: "저장 · 노리 레시피",
  record: "기록 · 노리 레시피", settings: "설정 · 노리 레시피", not_found: "없는 화면 · 노리 레시피",
};
const ENTRY_POINTS: readonly string[] = ["home_recommendation", "home_discover", "welcome", "search", "favorites", "direct_link", "other"];
const PLAY_ID = /^play_\d{3,6}$/;

export const ANALYTICS_REACTION_PARAMS = {
  "집중했어요": "reaction_focused",
  "스스로 했어요": "reaction_independent",
  "도움이 필요했어요": "reaction_needs_help",
  "흥미가 적었어요": "reaction_low_interest",
  "좋아했어요": "reaction_legacy_liked",
  "별로였어요": "reaction_legacy_disliked",
  "어려워했어요": "reaction_legacy_difficult",
  "더 하고 싶어했어요": "reaction_legacy_wants_more",
} as const satisfies Record<ChildReaction, string>;

export function parseAnalyticsConfig(measurementId?: string, origin?: string): AnalyticsConfig | null {
  if (!measurementId || !/^G-[A-Z0-9]{6,20}$/.test(measurementId) || !origin) return null;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      !host.includes(".") || /^[\d.]+$/.test(host) || /(?:^|\.)(?:localhost|local|test|invalid)$/.test(host)) return null;
    return { measurementId, origin: url.origin };
  } catch { return null; }
}

export function getAnalyticsPage(pathname: string, main = false): AnalyticsPage {
  let path = pathname.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  let screen: AnalyticsScreen = "not_found";
  if (path === "/") screen = main ? "home" : "welcome";
  else if (path === "/start") screen = "welcome";
  else if (/^\/play\/play_\d{3,6}$/.test(path)) screen = "play";
  else if (/^\/feedback\/play_\d{3,6}$/.test(path)) screen = "feedback";
  else if (path === "/search") screen = "search";
  else if (path === "/favorites") screen = "favorites";
  else if (path === "/record" || path === "/history") screen = "record";
  else if (path === "/settings" || path === "/mypage") screen = "settings";
  else path = "/not-found";
  return { path, screen, title: SCREEN_TITLES[screen] };
}

export function sanitizeReferrer(referrer: string, origin: string): string {
  try {
    const url = new URL(referrer);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return "";
    return url.origin === origin ? `${origin}${getAnalyticsPage(url.pathname).path}` : `${url.origin}/`;
  } catch { return ""; }
}

/** Rebuild each payload from an allowlist; never spread profile, form or URL data. */
export function sanitizeAnalyticsEvent(event: AnalyticsEvent): AnalyticsParams | null {
  const params = event.params as Record<string, unknown> | undefined;
  const playId = (value: unknown) => typeof value === "string" && PLAY_ID.test(value);
  const integer = (value: unknown, max: number) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
  switch (event.name) {
    case "tutorial_complete": return {};
    case "recommendation_impression":
    case "recommendation_click":
      return params && playId(params.play_id) && integer(params.position, 100) && integer(params.is_new, 1)
        ? { play_id: params.play_id as string, position: params.position as number, is_new: params.is_new as number } : null;
    case "play_view":
      return params && playId(params.play_id) && ENTRY_POINTS.includes(params.entry_point as string) && integer(params.is_new, 1)
        ? { play_id: params.play_id as string, entry_point: params.entry_point as string, is_new: params.is_new as number } : null;
    case "favorite_add":
    case "favorite_remove":
      return params && playId(params.play_id) ? { play_id: params.play_id as string } : null;
    case "play_feedback_saved":
    case "play_feedback_imported": {
      if (!params || !playId(params.play_id) || !integer(params.rating, 5) || params.rating === 0 ||
        !Array.isArray(params.reactions) || params.reactions.length > CHILD_REACTION_PARSE_OPTIONS.length ||
        !params.reactions.every((value: unknown) => CHILD_REACTION_PARSE_OPTIONS.includes(value as ChildReaction))) return null;
      const selected = new Set<ChildReaction>(params.reactions);
      // GA4 does not allow one parameter to be registered as both a dimension and a metric.
      const result: AnalyticsParams = { play_id: params.play_id as string, rating: params.rating as number, rating_value: params.rating as number, reaction_count: selected.size };
      for (const reaction of CHILD_REACTION_PARSE_OPTIONS) result[ANALYTICS_REACTION_PARAMS[reaction]] = Number(selected.has(reaction));
      return result;
    }
    case "search_results":
      return params && integer(params.result_count, 100_000) && integer(params.has_query, 1) &&
        (params.category === "all" || DEV_AREA_SLUGS.some((area) => area === params.category))
        ? { result_count: params.result_count as number, has_query: params.has_query as number, category: params.category as string } : null;
    case "share":
      return params && playId(params.item_id) && ["copy_link", "native_share"].includes(params.method as string) && params.content_type === "play"
        ? { item_id: params.item_id as string, method: params.method as string, content_type: "play" } : null;
    default: return null;
  }
}
