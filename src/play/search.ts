import { DEV_AREA_LABELS } from "@/constants/devAreas";
import { MATERIAL_DISPLAY_NAMES } from "@/constants/materials";
import type { Play, PlayPlace } from "@/types";
import type { MaterialSlug } from "@/constants/materials";
import {
  matchesCategory,
  matchesSituation,
  type PlayCategory,
  type PlaySituation,
} from "@/play/presentation";

type SearchPlaysOptions = {
  ageMonths: number | null;
  limit?: number;
  place: PlayPlace | null;
  query: string;
  durationMax?: number | null;
  category?: PlayCategory;
  situation?: PlaySituation | null;
  availableMaterials?: readonly MaterialSlug[];
  readyOnly?: boolean;
  blockedMaterials?: readonly MaterialSlug[];
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
      ...materials.flatMap((material) => [
        material,
        MATERIAL_DISPLAY_NAMES[material],
      ]),
      ...PLACE_SEARCH_LABELS[play.place],
    ].join(" "),
  );
}

export function searchPlays(
  plays: Play[],
  options: SearchPlaysOptions,
): Play[] {
  const normalizedQuery = normalizeSearchText(options.query);
  const limit = options.limit ?? (normalizedQuery.length === 0 ? 24 : 30);

  return plays
    .filter((play) => play.status === "live")
    .filter((play) => matchesPlace(play, options.place))
    .filter(
      (play) =>
        options.durationMax == null || play.durationMax <= options.durationMax,
    )
    .filter((play) => matchesCategory(play, options.category ?? "all"))
    .filter((play) => matchesSituation(play, options.situation))
    .filter(
      (play) =>
        !options.readyOnly ||
        play.materials.required.every((material) =>
          options.availableMaterials?.includes(material),
        ),
    )
    .filter(
      (play) =>
        ![
          ...play.materials.required,
          ...play.materials.optional,
          ...play.materials.substitutes,
        ].some((material) => options.blockedMaterials?.includes(material)),
    )
    .filter(
      (play) =>
        options.ageMonths === null ||
        (play.ageMin <= options.ageMonths && play.ageMax >= options.ageMonths),
    )
    .filter(
      (play) =>
        normalizedQuery.length === 0 ||
        buildSearchTarget(play).includes(normalizedQuery),
    )
    .slice(0, limit);
}
