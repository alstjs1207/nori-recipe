import type { Play, FilterInput } from "@/types";

type FallbackResult = {
  plays: Play[];
  usedFallback: boolean;
};

function hasAllRequiredMaterials(play: Play, availableMaterials: Set<string>): boolean {
  return play.materials.required.every((material) => availableMaterials.has(material));
}

function hasAnyRequiredMaterials(play: Play, availableMaterials: Set<string>): boolean {
  return play.materials.required.some((material) => availableMaterials.has(material));
}

function withinTime(play: Play, availableMinutes: number, multiplier: number): boolean {
  return play.durationMin <= availableMinutes * multiplier;
}

export function applyFallback(ctx: FilterInput, pool: Play[]): FallbackResult {
  const availableMaterials = new Set(ctx.availableMaterials);
  const strictTimePool = pool.filter((play) => withinTime(play, ctx.availableMinutes, 1.3));
  const fullyOwnedPool = strictTimePool.filter((play) =>
    hasAllRequiredMaterials(play, availableMaterials),
  );
  const partiallyOwnedPool = strictTimePool.filter((play) =>
    !hasAllRequiredMaterials(play, availableMaterials) &&
    hasAnyRequiredMaterials(play, availableMaterials),
  );
  const unmatchedPool = strictTimePool.filter((play) =>
    !hasAllRequiredMaterials(play, availableMaterials) &&
    !hasAnyRequiredMaterials(play, availableMaterials),
  );

  if (fullyOwnedPool.length >= 3) {
    return {
      plays: fullyOwnedPool,
      usedFallback: false,
    };
  }

  if (strictTimePool.length >= 3) {
    return {
      plays: [...fullyOwnedPool, ...partiallyOwnedPool, ...unmatchedPool],
      usedFallback: true,
    };
  }

  const extendedTimePool = pool.filter((play) => withinTime(play, ctx.availableMinutes, 1.5));
  const extendedFullMatches = extendedTimePool.filter((play) =>
    hasAllRequiredMaterials(play, availableMaterials),
  );
  const extendedPartialMatches = extendedTimePool.filter((play) =>
    !hasAllRequiredMaterials(play, availableMaterials) &&
    hasAnyRequiredMaterials(play, availableMaterials),
  );
  const extendedUnmatched = extendedTimePool.filter((play) =>
    !hasAllRequiredMaterials(play, availableMaterials) &&
    !hasAnyRequiredMaterials(play, availableMaterials),
  );

  return {
    plays: [...extendedFullMatches, ...extendedPartialMatches, ...extendedUnmatched],
    usedFallback: true,
  };
}
