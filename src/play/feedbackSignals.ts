import type { ChildReaction } from "@/constants/feedback";
import type { DevArea } from "@/constants/devAreas";
import type { AreaScoreMap, UserContext } from "@/types";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function adjustAreaScores(
  currentScores: AreaScoreMap,
  devAreas: DevArea[],
  delta: number,
): AreaScoreMap {
  if (delta === 0 || devAreas.length === 0) {
    return currentScores;
  }

  const nextScores = { ...currentScores };

  for (const devArea of devAreas) {
    nextScores[devArea] = clampScore((nextScores[devArea] ?? 50) + delta);
  }

  return nextScores;
}

export function applyFeedbackToUserContext(
  currentContext: UserContext,
  devAreas: DevArea[],
  rating: number | null,
  reactions: ChildReaction[],
): UserContext {
  let userFeedback = currentContext.userFeedback;
  let devGaps = currentContext.devGaps;

  if (typeof rating === "number") {
    if (rating >= 4) {
      userFeedback = adjustAreaScores(userFeedback, devAreas, 10);
    } else if (rating <= 2) {
      userFeedback = adjustAreaScores(userFeedback, devAreas, -15);
    }
  }

  if (
    reactions.includes("더 하고 싶어했어요") ||
    reactions.includes("집중했어요") ||
    reactions.includes("스스로 했어요")
  ) {
    devGaps = adjustAreaScores(devGaps, devAreas, -10);
  }

  if (reactions.includes("도움이 필요했어요") || reactions.includes("어려워했어요")) {
    devGaps = adjustAreaScores(devGaps, devAreas, 10);
  }

  if (reactions.includes("흥미가 적었어요") || reactions.includes("별로였어요")) {
    userFeedback = adjustAreaScores(userFeedback, devAreas, -10);
  }

  return {
    ...currentContext,
    devGaps,
    userFeedback,
  };
}
