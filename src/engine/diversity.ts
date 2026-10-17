import type { DevArea } from "@/constants/devAreas";
import { createMaterialComparator } from "@/engine/materialFit";
import type { ScoredPlay } from "@/engine/types";
import type { FilterInput, Play } from "@/types";

export function pickTop3(
  candidates: ScoredPlay[],
  ctx: FilterInput,
  recentCompletedPlayIds: ReadonlySet<string> = new Set(),
): Play[] {
  const compareMaterials = createMaterialComparator(ctx.availableMaterials);
  const comparePriority = (left: ScoredPlay, right: ScoredPlay) =>
    compareMaterials(left.play, right.play) ||
    Number(recentCompletedPlayIds.has(left.play.id)) - Number(recentCompletedPlayIds.has(right.play.id));
  const sorted = [...candidates].sort((left, right) =>
    comparePriority(left, right) || right.total - left.total || left.play.name.localeCompare(right.play.name, "ko"),
  );
  const selected: Play[] = [];
  const selectedIds = new Set<string>();
  const selectedAreas = new Set<DevArea>();
  const add = ({ play }: ScoredPlay) => {
    if (selected.length < 3 && !selectedIds.has(play.id)) {
      selected.push(play);
      selectedIds.add(play.id);
      play.devAreas.forEach((area) => selectedAreas.add(area));
    }
  };

  // Diversity and freshness must not displace a better material match.
  for (let start = 0; start < sorted.length && selected.length < 3;) {
    let end = start + 1;
    while (end < sorted.length && comparePriority(sorted[start], sorted[end]) === 0) end += 1;
    const group = sorted.slice(start, end);
    for (const candidate of group) {
      if (selected.length === 0 || !candidate.play.devAreas.some((area) => selectedAreas.has(area))) add(candidate);
    }
    group.forEach(add);
    start = end;
  }
  return selected;
}
