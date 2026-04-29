import { MATERIAL_CATEGORIES, type MaterialSlug } from "@/constants/materials";
import type { FilterInput, UserContext } from "@/types";

const PRIORITY_AGE_MONTHS = [19, 20, 21, 22, 23, 24] as const;
export const ONBOARDING_DEFAULT_MATERIALS: MaterialSlug[] = ["paper", "bowl", "cup", "crayon"];
export const ONBOARDING_VISIBLE_CATEGORIES = [
  "종이류",
  "주방",
  "공작",
  "감각",
  "블록/장난감",
  "조형",
  "도구",
] as const;

export type BirthMonthOption = {
  ageMonths: number;
  monthIndex: number;
  monthLabel: string;
  ageLabel: string;
};

function getMonthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

export function formatBirthMonth(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return `${year}.${String(month).padStart(2, "0")}`;
}

export function getAgeMonthsFromBirthMonth(birthMonth: number, referenceDate = new Date()): number {
  return Math.max(0, getMonthIndex(referenceDate) - birthMonth);
}

export function getBirthMonthOptions(referenceDate = new Date()): BirthMonthOption[] {
  const currentMonthIndex = getMonthIndex(referenceDate);
  const priorityAgeSet = new Set<number>(PRIORITY_AGE_MONTHS);
  const ages = [
    ...PRIORITY_AGE_MONTHS,
    ...Array.from({ length: 49 }, (_, index) => index).filter(
      (ageMonths) => !priorityAgeSet.has(ageMonths),
    ),
  ];

  return ages.map((ageMonths) => {
    const monthIndex = currentMonthIndex - ageMonths;

    return {
      ageMonths,
      monthIndex,
      monthLabel: formatBirthMonth(monthIndex),
      ageLabel: `${ageMonths}개월`,
    };
  });
}

export function getVisibleMaterialCategories() {
  return ONBOARDING_VISIBLE_CATEGORIES.map((category) => ({
    name: category,
    materials: (MATERIAL_CATEGORIES[category] ?? []) as MaterialSlug[],
  }));
}

export function buildOnboardingFilterInput(userContext: UserContext): FilterInput | null {
  if (userContext.childBirthMonth === null) {
    return null;
  }

  return {
    childAgeMonths: getAgeMonthsFromBirthMonth(userContext.childBirthMonth),
    availableMaterials: userContext.ownedMaterials,
    blockedMaterials: userContext.blockedMaterials,
    availableMinutes: 20,
    place: "indoor",
  };
}
