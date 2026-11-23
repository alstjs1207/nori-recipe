import { recommend } from "./recommend";
import { isEligibleHomeRecommendation } from "./intentRecommendation";
import type { FilterInput, Play } from "@/types";
import type { UserStats } from "./types";

export function getHomeRecommendationKey(ctx: FilterInput, playCount: number, confirmationKey?: string) {
  return JSON.stringify({ childAgeMonths: ctx.childAgeMonths, selectedMaterials: ctx.availableMaterials, blockedMaterials: ctx.blockedMaterials, playCount, ...(ctx.intentReadiness ? { intentConfirmation: confirmationKey } : {}) });
}

// A new round exhausts eligible alternatives before reusing the completed round.
export function recommendNextHomeRound(plays: Play[], ctx: FilterInput, stats: UserStats, previousIds: readonly string[]): string[] {
  const previous = new Set(previousIds);
  const alternatives = recommend(plays.filter(play => !previous.has(play.id)), ctx, stats).results;
  if (alternatives.length === 3) return alternatives.map(play => play.id);

  const hasConditionalPlay = alternatives.some(play => play.ageMin > ctx.childAgeMonths);
  const repeats = recommend(plays.filter(play => previous.has(play.id) && (!hasConditionalPlay || play.ageMin <= ctx.childAgeMonths)), ctx, stats).results;
  return [...alternatives, ...repeats].slice(0, 3).map(play => play.id);
}
// Completed slots keep their positions. Rank the remaining pool without their IDs,
// so already completed plays cannot consume one of the three candidate positions.
export function replacePendingHomeRecommendations(plays: Play[], ctx: FilterInput, stats: UserStats, previousIds: readonly string[], completedIds: ReadonlySet<string>): string[] {
  const pool = plays.filter(play => !completedIds.has(play.id));
  const candidates = recommend(pool, ctx, stats).results.map(play => play.id);
  for (const id of previousIds) {
    if (!completedIds.has(id) && !candidates.includes(id) && pool.some(play => play.id === id && isEligibleHomeRecommendation(play, ctx))) candidates.push(id);
  }
  const result: string[] = [];
  for (const id of previousIds) {
    if (completedIds.has(id)) result.push(id);
    else if (candidates.length) result.push(candidates.shift()!);
  }
  while (result.length < 3 && candidates.length) result.push(candidates.shift()!);
  return [...new Set(result)].slice(0, 3);
}
