import { DEV_AREA_LABELS } from "@/constants/devAreas";
import { MATERIAL_DISPLAY_NAMES } from "@/constants/materials";
import type { Play, PlayPlace } from "@/types";

type SearchPlaysOptions = {
  ageMonths: number | null;
  limit?: number;
  place: PlayPlace | null;
  query: string;
};

const PLACE_SEARCH_LABELS: Record<PlayPlace, string[]> = {
  indoor: ["실내", "집", "집콕"],
  outdoor: ["실외", "야외", "밖"],
  any: ["어디서나"],
};

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ko-KR");
}

function matchesPlace(play: Play, place: PlayPlace | null): boolean {
  if (place === null || place === "any") {
    return true;
  }

  return play.place === "any" || play.place === place;
}

function buildSearchTarget(play: Play): string {
  const materials = [
    ...play.materials.required,
    ...play.materials.optional,
    ...play.materials.substitutes,
  ];

  return normalizeSearchText(
    [
      play.name,
      ...play.tags,
      ...play.steps,
      ...play.educationalEffects,
      play.tip ?? "",
      ...play.devAreas.flatMap((area) => [area, DEV_AREA_LABELS[area]]),
      ...materials.flatMap((material) => [material, MATERIAL_DISPLAY_NAMES[material]]),
      ...PLACE_SEARCH_LABELS[play.place],
    ].join(" "),
  );
}

export function searchPlays(plays: Play[], options: SearchPlaysOptions): Play[] {
  const normalizedQuery = normalizeSearchText(options.query);
  const limit = options.limit ?? (normalizedQuery.length === 0 ? 24 : 30);

  return plays
    .filter((play) => play.status === "live")
    .filter((play) => matchesPlace(play, options.place))
    .filter(
      (play) =>
        options.ageMonths === null ||
        (play.ageMin <= options.ageMonths && play.ageMax >= options.ageMonths),
    )
    .filter((play) => normalizedQuery.length === 0 || buildSearchTarget(play).includes(normalizedQuery))
    .slice(0, limit);
}
