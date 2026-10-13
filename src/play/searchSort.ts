import type { MaterialSlug } from "@/constants/materials";
import type { Play } from "@/types";
import { isNewPlay } from "@/play/newPlay";

export type SearchSort = "new-first" | "recommended" | "shortest" | "preparation";
export const DEFAULT_SEARCH_SORT: SearchSort = "new-first";
export const SEARCH_SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: "new-first", label: "새 놀이 우선" },
  { value: "recommended", label: "맞춤순" },
  { value: "shortest", label: "짧은 놀이순" },
  { value: "preparation", label: "준비 시간순" },
];

export function readSearchSort(value: string): SearchSort {
  return SEARCH_SORT_OPTIONS.find((option) => option.value === value)?.value ?? DEFAULT_SEARCH_SORT;
}

export function sortSearchPlays(
  plays: readonly Play[],
  options: {
    sort?: SearchSort;
    availableMaterials?: readonly MaterialSlug[];
    now?: Date;
  } = {},
): Play[] {
  const sort = options.sort ?? DEFAULT_SEARCH_SORT;
  const now = options.now ?? new Date();
  const materials = options.availableMaterials ?? [];
  const ranked = plays.map((play) => ({
    play,
    isNew: isNewPlay(play.createdAt, now),
    missing: play.materials.required.filter((material) => !materials.includes(material)).length,
  }));

  return ranked.sort((left, right) => {
    if (sort === "new-first") {
      const newFirst = Number(right.isNew) - Number(left.isNew);
      if (newFirst !== 0) return newFirst;
      if (left.isNew && right.isNew) {
        const latestFirst = (right.play.createdAt ?? "").localeCompare(left.play.createdAt ?? "");
        if (latestFirst !== 0) return latestFirst;
      }
    }
    if (sort === "shortest") {
      return left.play.durationMax - right.play.durationMax || left.play.prepTime - right.play.prepTime;
    }
    if (sort === "preparation") {
      return left.play.prepTime - right.play.prepTime || left.play.durationMax - right.play.durationMax;
    }
    return left.missing - right.missing || left.play.prepTime - right.play.prepTime;
  }).map(({ play }) => play);
}
