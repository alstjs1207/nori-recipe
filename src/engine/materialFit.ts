import type { Play } from "@/types";
import { isReadyIntentMatch } from "@/engine/intentSignals";

export function getMaterialFit(play: Play, selectedMaterials: ReadonlySet<string>) {
  const required = play.materials.required;
  const matched = required.filter((material) => selectedMaterials.has(material)).length;
  const missing = required.length - matched;

  return {
    // Optional supplies can be cleanup tools, so they do not establish play intent.
    tier: matched > 0 ? (missing === 0 ? 0 : 1) : required.length === 0 ? 2 : 3,
    matched,
    missing,
    coverage: required.length === 0 ? 1 : matched / required.length,
  };
}

export function createMaterialComparator(selectedMaterials: readonly string[]) {
  const selected = new Set(selectedMaterials);
  const cache = new Map<Play, ReturnType<typeof getMaterialFit>>();
  const fit = (play: Play) => {
    let result = cache.get(play);
    if (!result) {
      result = getMaterialFit(play, selected);
      cache.set(play, result);
    }
    return result;
  };

  return (left: Play, right: Play): number => {
    const a = fit(left);
    const b = fit(right);
    return a.tier - b.tier || a.missing - b.missing || b.coverage - a.coverage || b.matched - a.matched;
  };
}

export function pickFeaturedPlay(plays: Play[], selectedMaterials: readonly string[], childAgeMonths?: number): Play | null {
  const compareMaterials = createMaterialComparator(selectedMaterials);
  const intentPriority = (play: Play) => !isReadyIntentMatch(play, selectedMaterials) ? 2 : childAgeMonths !== undefined && play.ageMin > childAgeMonths ? 1 : 0;
  const compare = (a: Play, b: Play) => intentPriority(a) - intentPriority(b) || compareMaterials(a, b);
  return plays.reduce<Play | null>((best, play) =>
    best === null || compare(play, best) < 0 ? play : best,
  null);
}

export function getMaterialRecommendationNotice(plays: Play[], selectedMaterials: readonly string[]): string | null {
  if (selectedMaterials.length === 0 || plays.length === 0) return null;
  const selected = new Set(selectedMaterials);
  const matchedCount = plays.filter((play) => getMaterialFit(play, selected).matched > 0).length;
  if (matchedCount === 0) return "선택한 재료를 활용하는 놀이가 부족해 다른 놀이를 추천해요.";
  if (matchedCount < plays.length) {
    return `이번 추천에는 선택 재료를 활용한 놀이 ${matchedCount}개와 다른 놀이를 함께 담았어요.`;
  }
  if (plays.some((play) => getMaterialFit(play, selected).missing > 0)) {
    return "선택한 재료를 활용하는 놀이예요. 추가 준비물은 각 놀이에서 확인해 주세요.";
  }
  return null;
}
