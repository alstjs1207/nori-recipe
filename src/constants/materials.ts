import materialsData from "../../data/materials.json";

export type MaterialSlug = keyof typeof materialsData.displayNames;

const pendingReview = new Set<string>(materialsData.reviewPending);
export const MATERIAL_CATEGORIES = Object.fromEntries(
  Object.entries(materialsData.categories).map(([category, slugs]) => [
    category, slugs.filter((slug) => !pendingReview.has(slug)),
  ]),
) as typeof materialsData.categories;
export const MATERIAL_DISPLAY_NAMES = materialsData.displayNames as Record<MaterialSlug, string>;
export const MATERIAL_REMOVED_MAP = materialsData.removed;
export const MATERIAL_SLUGS = Object.keys(MATERIAL_DISPLAY_NAMES)
  .filter((slug) => !pendingReview.has(slug)) as MaterialSlug[];
