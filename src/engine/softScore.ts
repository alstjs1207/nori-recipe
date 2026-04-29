import type { AreaScoreMap, ScoreBreakdown, Weights } from "@/engine/types";
import type { Play, FilterInput } from "@/types";

type SoftScoreResult = {
  total: number;
  breakdown: ScoreBreakdown;
};

function averageAreaScore(devAreas: Play["devAreas"], scoreMap: AreaScoreMap | undefined, fallback: number) {
  if (devAreas.length === 0) {
    return fallback;
  }

  const total = devAreas.reduce((sum, devArea) => sum + (scoreMap?.[devArea] ?? fallback), 0);
  return total / devAreas.length;
}

function getMaterialScore(play: Play, availableMaterials: Set<string>): number {
  const requiredMaterials = play.materials.required;
  const hasMaterialIntent = availableMaterials.size >= 3;

  if (requiredMaterials.length === 0) {
    return hasMaterialIntent ? 20 : 100;
  }

  const ownedCount = requiredMaterials.filter((material) => availableMaterials.has(material)).length;
  const coverage = ownedCount / requiredMaterials.length;

  if (coverage === 1) {
    return 100;
  }

  if (!hasMaterialIntent) {
    return coverage * 100;
  }

  if (coverage === 0) {
    return 0;
  }

  return 35 + coverage * 45;
}

function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

export function softScore(play: Play, ctx: FilterInput, weights: Weights): SoftScoreResult {
  const availableMaterials = new Set(ctx.availableMaterials);
  const rawMaterial = getMaterialScore(play, availableMaterials);
  const rawDev = averageAreaScore(play.devAreas, ctx.devGaps, 50);
  const rawPopular = 0;
  const rawTime = Math.max(0, 100 - Math.abs(play.durationMin - ctx.availableMinutes) * 2);
  const rawFeedback = averageAreaScore(play.devAreas, ctx.userFeedback, 50);

  const breakdown = {
    material: roundToHundredths((rawMaterial * weights.material) / 100),
    dev: roundToHundredths((rawDev * weights.dev) / 100),
    popular: roundToHundredths((rawPopular * weights.popular) / 100),
    time: roundToHundredths((rawTime * weights.time) / 100),
    feedback: roundToHundredths((rawFeedback * weights.feedback) / 100),
  };

  return {
    total: roundToHundredths(
      breakdown.material +
        breakdown.dev +
        breakdown.popular +
        breakdown.time +
        breakdown.feedback,
    ),
    breakdown,
  };
}
