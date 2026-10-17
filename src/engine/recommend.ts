import { pickTop3 } from "@/engine/diversity";
import { applyFallback } from "@/engine/fallback";
import { hardFilter } from "@/engine/hardFilter";
import { applyIntentRecommendation } from "@/engine/intentRecommendation";
import { softScore } from "@/engine/softScore";
import type { RecommendResult, ScoredPlay, UserStats } from "@/engine/types";
import { COLD_START_WEIGHTS, DEFAULT_WEIGHTS } from "@/engine/weights";
import type { Play, FilterInput } from "@/types";

export function recommend(
  plays: Play[],
  ctx: FilterInput,
  userStats: UserStats,
): RecommendResult {
  const appliedWeights = userStats.totalPlays === 0 ? COLD_START_WEIGHTS : DEFAULT_WEIGHTS;

  const fallbackPool = plays
    .map((play) => ({
      play,
      result: hardFilter(play, ctx),
    }))
    .filter(({ result }) => result.pass || result.reason === "time")
    .map(({ play }) => play);

  const { plays: candidatePool, usedFallback } = applyFallback(ctx, fallbackPool);

  const scoredCandidates: ScoredPlay[] = candidatePool.map((play) => {
    const score = softScore(play, ctx, appliedWeights);

    return {
      play,
      total: score.total,
      breakdown: score.breakdown,
    };
  });
  const recentCompletedPlayIds = new Set(userStats.recentCompletedPlayIds ?? []);
  const baseline = pickTop3(scoredCandidates, ctx, recentCompletedPlayIds);
  const results = applyIntentRecommendation(plays, ctx, userStats, baseline);

  return {
    results,
    usedFallback: usedFallback || results.some((play) => play.ageMin > ctx.childAgeMonths),
    appliedWeights,
  };
}
