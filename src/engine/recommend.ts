import { pickTop3 } from "@/engine/diversity";
import { applyFallback } from "@/engine/fallback";
import { hardFilter } from "@/engine/hardFilter";
import { softScore } from "@/engine/softScore";
import type { RecommendResult, ScoredPlay, UserStats } from "@/engine/types";
import { COLD_START_WEIGHTS, DEFAULT_WEIGHTS } from "@/engine/weights";
import type { Play, FilterInput } from "@/types";

function mergePreferredResults(preferred: Play[], fallback: Play[]): Play[] {
  const merged = [...preferred];

  for (const play of fallback) {
    if (merged.some((candidate) => candidate.id === play.id)) {
      continue;
    }

    merged.push(play);

    if (merged.length === 3) {
      break;
    }
  }

  return merged;
}

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
  const preferredCandidates =
    recentCompletedPlayIds.size === 0
      ? scoredCandidates
      : scoredCandidates.filter(({ play }) => !recentCompletedPlayIds.has(play.id));
  const preferredResults = pickTop3(preferredCandidates, ctx);
  const results =
    recentCompletedPlayIds.size === 0 || preferredResults.length === 3
      ? preferredResults
      : mergePreferredResults(preferredResults, pickTop3(scoredCandidates, ctx));

  return {
    results,
    usedFallback,
    appliedWeights,
  };
}
