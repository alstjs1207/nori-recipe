import type { DevArea } from "@/constants/devAreas";
import type { ScoredPlay } from "@/engine/types";
import type { FilterInput, Play } from "@/types";

function sortCandidates(candidates: ScoredPlay[]): ScoredPlay[] {
  return [...candidates].sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total;
    }

    return left.play.name.localeCompare(right.play.name, "ko");
  });
}

function addAreas(target: Set<DevArea>, play: Play) {
  play.devAreas.forEach((devArea) => target.add(devArea));
}

function hasAllRequiredMaterials(play: Play, availableMaterials: Set<string>) {
  return play.materials.required.every((material) => availableMaterials.has(material));
}

function hasAnyRequiredMaterials(play: Play, availableMaterials: Set<string>) {
  return play.materials.required.some((material) => availableMaterials.has(material));
}

function isMaterialFree(play: Play) {
  return play.materials.required.length === 0;
}

function selectWithDiversity(
  selected: ScoredPlay[],
  selectedAreas: Set<DevArea>,
  source: ScoredPlay[],
  limit: number,
  options: {
    materialIntent: boolean;
    zeroRequiredSelected: { count: number };
  },
) {
  for (const candidate of source) {
    if (selected.length === limit) {
      break;
    }

    if (selected.some((selectedPlay) => selectedPlay.play.id === candidate.play.id)) {
      continue;
    }

    if (options.materialIntent && options.zeroRequiredSelected.count >= 1 && isMaterialFree(candidate.play)) {
      continue;
    }

    const overlapsSelectedAreas = candidate.play.devAreas.some((devArea) => selectedAreas.has(devArea));
    if (selected.length === 0 || !overlapsSelectedAreas) {
      selected.push(candidate);
      addAreas(selectedAreas, candidate.play);

      if (isMaterialFree(candidate.play)) {
        options.zeroRequiredSelected.count += 1;
      }
    }
  }
}

function fillRemaining(
  selected: ScoredPlay[],
  source: ScoredPlay[],
  limit: number,
  options: {
    materialIntent: boolean;
    zeroRequiredSelected: { count: number };
  },
) {
  for (const candidate of source) {
    if (selected.length === limit) {
      break;
    }

    if (selected.some((selectedPlay) => selectedPlay.play.id === candidate.play.id)) {
      continue;
    }

    if (options.materialIntent && options.zeroRequiredSelected.count >= 1 && isMaterialFree(candidate.play)) {
      continue;
    }

    selected.push(candidate);
    if (isMaterialFree(candidate.play)) {
      options.zeroRequiredSelected.count += 1;
    }
  }
}

export function pickTop3(candidates: ScoredPlay[], ctx: FilterInput): Play[] {
  const sorted = sortCandidates(candidates);
  const availableMaterials = new Set(ctx.availableMaterials);
  const materialIntent = ctx.availableMaterials.length >= 3;
  const exactMatches = sorted.filter((candidate) =>
    candidate.play.materials.required.length > 0 &&
    hasAllRequiredMaterials(candidate.play, availableMaterials),
  );
  const partialMatches = sorted.filter((candidate) =>
    candidate.play.materials.required.length > 0 &&
    !hasAllRequiredMaterials(candidate.play, availableMaterials) &&
    hasAnyRequiredMaterials(candidate.play, availableMaterials),
  );
  const materialFreeMatches = sorted.filter((candidate) =>
    isMaterialFree(candidate.play),
  );
  const unmatchedMatches = sorted.filter((candidate) =>
    candidate.play.materials.required.length > 0 &&
    !hasAnyRequiredMaterials(candidate.play, availableMaterials),
  );
  const selected: ScoredPlay[] = [];
  const selectedAreas = new Set<DevArea>();
  const zeroRequiredSelected = { count: 0 };

  selectWithDiversity(selected, selectedAreas, exactMatches, 3, {
    materialIntent,
    zeroRequiredSelected,
  });
  fillRemaining(selected, exactMatches, 3, {
    materialIntent,
    zeroRequiredSelected,
  });
  selectWithDiversity(selected, selectedAreas, partialMatches, 3, {
    materialIntent,
    zeroRequiredSelected,
  });
  fillRemaining(selected, partialMatches, 3, {
    materialIntent,
    zeroRequiredSelected,
  });
  selectWithDiversity(selected, selectedAreas, materialFreeMatches, 3, {
    materialIntent,
    zeroRequiredSelected,
  });
  fillRemaining(selected, materialFreeMatches, 3, {
    materialIntent,
    zeroRequiredSelected,
  });
  selectWithDiversity(selected, selectedAreas, unmatchedMatches, 3, {
    materialIntent,
    zeroRequiredSelected,
  });
  fillRemaining(selected, unmatchedMatches, 3, {
    materialIntent,
    zeroRequiredSelected,
  });
  fillRemaining(selected, sorted, 3, {
    materialIntent: false,
    zeroRequiredSelected,
  });

  return selected.map((candidate) => candidate.play);
}
