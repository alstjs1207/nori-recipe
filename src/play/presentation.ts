import { DEV_AREA_LABELS, DEV_AREA_SLUGS, type DevArea } from "@/constants/devAreas";
import type { MaterialSlug } from "@/constants/materials";
import type { Play } from "@/types";

export type PlayCategory = "all" | DevArea;
export type PlayType = "all" | "art";
export type PlaySituation = "quiet" | "active" | "no-materials" | "bedtime";

export const PLAY_CATEGORIES: { value: PlayCategory; label: string }[] = [
  { value: "all", label: "전체" },
  ...DEV_AREA_SLUGS.map((value) => ({ value, label: DEV_AREA_LABELS[value] })),
];

export function readPlayCategory(value: string | string[] | undefined): PlayCategory {
  const candidate = Array.isArray(value) ? value[0] : value;
  return PLAY_CATEGORIES.find((item) => item.value === candidate)?.value ?? "all";
}

export function formatAge(play: Pick<Play, "ageMin" | "ageMax">): string {
  return play.ageMin === play.ageMax
    ? `${play.ageMin}개월`
    : `${play.ageMin}–${play.ageMax}개월`;
}

export function formatDuration(
  play: Pick<Play, "durationMin" | "durationMax">,
): string {
  if (play.durationMin === 0 && play.durationMax === 0) return "틈틈이";
  return play.durationMin === play.durationMax
    ? `${play.durationMin}분`
    : `${play.durationMin}–${play.durationMax}분`;
}

export function formatPreparation(play: Pick<Play, "prepTime">): string {
  return play.prepTime === 0 ? "준비 없이" : `준비 ${play.prepTime}분`;
}

export function matchesCategory(play: Play, category: PlayCategory): boolean {
  return category === "all" || play.devAreas.includes(category);
}

export function matchesPlayType(play: Play, playType: PlayType): boolean {
  if (playType === "all") return true;
  // Art describes the activity, rather than the presence of an optional supply.
  return play.tags.some((tag) => /미술|창작놀이/.test(tag)) ||
    /그리기|끼적|색칠|꾸미|콜라주|도장|(?:종이|색종이)\s*접기/.test(play.name);
}

export function matchesSituation(
  play: Play,
  situation?: PlaySituation | null,
): boolean {
  if (!situation) return true;
  if (situation === "no-materials") return play.materials.required.length === 0;
  if (situation === "active") return play.devAreas.includes("gross_motor");
  const indoors = play.place !== "outdoor";
  if (situation === "quiet")
    return indoors && !play.devAreas.includes("gross_motor");
  return (
    indoors &&
    play.durationMax <= 20 &&
    play.prepTime <= 3 &&
    !play.devAreas.includes("gross_motor") &&
    (play.devAreas.includes("emotional") || play.devAreas.includes("language"))
  );
}

export function getPlayCategoryLabel(play: Play): string {
  const areas = play.devAreas.map((area) => DEV_AREA_LABELS[area]).join(" · ");
  return areas ? `${areas} 놀이` : "놀이";
}

export function getMaterialStatus(
  play: Play,
  materials: readonly MaterialSlug[],
) {
  const missing = play.materials.required.filter(
    (material) => !materials.includes(material),
  );
  if (play.materials.required.length === 0)
    return { label: "필수 준비물 없이", ready: true };
  return missing.length === 0
    ? { label: "우리 집 재료로 가능", ready: true }
    : { label: `필수 재료 ${missing.length}개 필요`, ready: false };
}
