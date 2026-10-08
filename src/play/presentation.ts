import { DEV_AREA_LABELS } from "@/constants/devAreas";
import type { MaterialSlug } from "@/constants/materials";
import type { Play } from "@/types";

export type PlayCategory = "all" | "sensory" | "art" | "physical" | "language";
export type PlaySituation = "quiet" | "active" | "no-materials" | "bedtime";

export const PLAY_CATEGORIES: { value: PlayCategory; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "sensory", label: "감각" },
  { value: "art", label: "미술" },
  { value: "physical", label: "신체" },
  { value: "language", label: "언어" },
];

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
  if (category === "all") return true;
  if (category === "sensory") return play.devAreas.includes("sensory");
  if (category === "physical") return play.devAreas.includes("gross_motor");
  if (category === "language") return play.devAreas.includes("language");
  return (
    ["crayon", "paint", "clay", "glue", "sticker", "shape_ruler"].some(
      (material) =>
        [...play.materials.required, ...play.materials.optional].includes(
          material as MaterialSlug,
        ),
    ) || /그림|그리기|미술|끼적|색칠|꾸미|만들기/.test(play.name)
  );
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
  const category = ["art", "physical", "sensory", "language"].find((value) =>
    matchesCategory(play, value as PlayCategory),
  );
  const label = PLAY_CATEGORIES.find((item) => item.value === category)?.label;
  const area = DEV_AREA_LABELS[play.devAreas[0] ?? "cognitive"];
  return label && label !== area ? `${label} · ${area} 놀이` : `${area} 놀이`;
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
