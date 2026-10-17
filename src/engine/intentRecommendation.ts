import { hardFilter } from "@/engine/hardFilter";
import { createMaterialComparator } from "@/engine/materialFit";
import { getReviewedIntent, inferPlayIntent, INTENT_LABELS, INTENT_REVIEW_VERSION, playMatchesIntent } from "@/engine/intentSignals";
import { softScore } from "@/engine/softScore";
import { COLD_START_WEIGHTS, DEFAULT_WEIGHTS } from "@/engine/weights";
import type { UserStats } from "@/engine/types";
import type { FilterInput, IntentReadiness, Play } from "@/types";

const UNDER_THREE_EXCLUDED = ["marble", "bead", "pom_pom", "water_beads", "play_corn", "slime"];

function fitsNonAgeConditions(play: Play, ctx: FilterInput): boolean {
  const result = hardFilter(play, { ...ctx, childAgeMonths: play.ageMin });
  return result.pass || (result.reason === "time" && play.durationMin <= ctx.availableMinutes * 1.5);
}

export function getConditionalIntentCandidates(plays: Play[], ctx: FilterInput): Play[] {
  const intent = inferPlayIntent(ctx.availableMaterials);
  if (intent === null) return [];
  return plays.filter((play) => {
    const review = getReviewedIntent(play);
    if (!review || !("minSupportedMonths" in review) || typeof review.minSupportedMonths !== "number") return false;
    if (ctx.childAgeMonths < review.minSupportedMonths || play.ageMin <= ctx.childAgeMonths || play.ageMin > ctx.childAgeMonths + 3 || play.ageMax < ctx.childAgeMonths) return false;
    if (!playMatchesIntent(play, intent) || !play.materials.required.every((m) => ctx.availableMaterials.includes(m))) return false;
    const all = [...play.materials.required, ...play.materials.optional, ...play.materials.substitutes];
    if (all.includes("balloon") || (ctx.childAgeMonths < 36 && all.some((m) => UNDER_THREE_EXCLUDED.includes(m)))) return false;
    return fitsNonAgeConditions(play, ctx);
  }).sort(createMaterialComparator(ctx.availableMaterials));
}

export function readinessAllowsPlay(play: Play, ctx: FilterInput): boolean {
  const ready = ctx.intentReadiness;
  if (!ready?.adultSupervision || !ready.productsAgeAppropriate || !ready.noMouthing) return false;
  const intent = inferPlayIntent(ctx.availableMaterials);
  if (intent === "cutting" && !ready.scissorSnipping) return false;
  const all = [...play.materials.required, ...play.materials.optional];
  if (all.includes("tape") && !ready.tapeSurfaceSafe) return false;
  if (all.includes("paint") && !ready.washablePaint) return false;
  return true;
}

export function isAllowedConditionalPlay(play: Play, ctx: FilterInput): boolean {
  return getConditionalIntentCandidates([play], ctx).length === 1 && readinessAllowsPlay(play, ctx);
}

export function isEligibleHomeRecommendation(play: Play, ctx: FilterInput): boolean {
  const result = hardFilter(play, ctx);
  return result.pass || (result.reason === "time" && play.durationMin <= ctx.availableMinutes * 1.5) || isAllowedConditionalPlay(play, ctx);
}

function rank(plays: Play[], ctx: FilterInput, stats: UserStats): Play[] {
  const compare = createMaterialComparator(ctx.availableMaterials);
  const recent = new Set(stats.recentCompletedPlayIds ?? []);
  const weights = stats.totalPlays === 0 ? COLD_START_WEIGHTS : DEFAULT_WEIGHTS;
  const scores = new Map(plays.map((p) => [p.id, softScore(p, ctx, weights).total]));
  return [...plays].sort((a, b) => compare(a, b) || Number(recent.has(a.id)) - Number(recent.has(b.id)) || scores.get(b.id)! - scores.get(a.id)! || a.name.localeCompare(b.name, "ko"));
}

export function applyIntentRecommendation(plays: Play[], ctx: FilterInput, stats: UserStats, baseline: Play[]): Play[] {
  const intent = inferPlayIntent(ctx.availableMaterials);
  if (intent === null) return baseline;
  const pool = plays.filter((play) => {
    const result = hardFilter(play, ctx);
    return result.pass || (result.reason === "time" && play.durationMin <= ctx.availableMinutes * 1.5);
  });
  const strict = pool.filter((p) => p.durationMin <= ctx.availableMinutes * 1.3);
  const candidates = strict.length >= 3 ? strict : pool;
  const selected = rank(candidates.filter((p) => playMatchesIntent(p, intent) && p.materials.required.every((m) => ctx.availableMaterials.includes(m))), ctx, stats).slice(0, 3);
  if (selected.length < 3) {
    const future = rank(getConditionalIntentCandidates(plays, ctx).filter((p) => readinessAllowsPlay(p, ctx)), ctx, stats);
    if (future[0]) selected.push(future[0]);
  }
  for (const play of [...baseline, ...rank(candidates, ctx, stats)]) {
    if (selected.length >= 3) break;
    if (!selected.some((p) => p.id === play.id)) selected.push(play);
  }
  return selected;
}

export function getConditionalRecommendationNotice(plays: Play[], materials: readonly string[], age: number): string | null {
  const future = plays.find((p) => p.ageMin > age);
  if (!future) return null;
  const intent = inferPlayIntent(materials);
  return `선택한 재료로 ${intent ? INTENT_LABELS[intent] : "놀이"}를 해볼 수 있어요. ‘${future.name}’는 기본 ${future.ageMin}개월부터인 놀이예요. 확인한 준비 조건에 맞춰 보호자가 곁에서 도와주세요.`;
}

export function getIntentConfirmationKey(ctx: Pick<FilterInput, "childAgeMonths" | "availableMaterials" | "blockedMaterials">): string {
  return JSON.stringify({ version: INTENT_REVIEW_VERSION, age: ctx.childAgeMonths, materials: [...ctx.availableMaterials].sort(), blocked: [...ctx.blockedMaterials].sort() });
}

export function parseIntentConfirmation(value: string | null): { key: string; readiness: IntentReadiness } | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || !("key" in parsed) || typeof parsed.key !== "string" || !("readiness" in parsed) || !parsed.readiness || typeof parsed.readiness !== "object") return null;
    const fields = ["adultSupervision", "productsAgeAppropriate", "noMouthing", "scissorSnipping", "tapeSurfaceSafe", "washablePaint"] as const;
    const readiness: IntentReadiness = {};
    for (const field of fields) readiness[field] = field in parsed.readiness && Reflect.get(parsed.readiness, field) === true;
    return { key: parsed.key, readiness };
  } catch { return null; }
}
