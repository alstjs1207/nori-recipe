import { createMaterialComparator } from "@/engine/materialFit";
import type { Play, FilterInput } from "@/types";

type FallbackResult = { plays: Play[]; usedFallback: boolean };

export function applyFallback(ctx: FilterInput, pool: Play[]): FallbackResult {
  const available = new Set(ctx.availableMaterials);
  const strictTimePool = pool.filter((play) => play.durationMin <= ctx.availableMinutes * 1.3);
  const readyMatches = strictTimePool.filter((play) =>
    (available.size === 0 || play.materials.required.length > 0) &&
    play.materials.required.every((material) => available.has(material)),
  );
  if (readyMatches.length >= 3) return { plays: readyMatches, usedFallback: false };

  const candidates = strictTimePool.length >= 3
    ? strictTimePool
    : pool.filter((play) => play.durationMin <= ctx.availableMinutes * 1.5);
  // Keep partial material matches even when three material-free plays are ready.
  return {
    plays: [...candidates].sort(createMaterialComparator(ctx.availableMaterials)),
    usedFallback: true,
  };
}
