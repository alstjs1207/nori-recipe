import materialsData from "../../data/materials.json";

export type MaterialSlug = keyof typeof materialsData.displayNames;

export const MATERIAL_CATEGORIES = materialsData.categories;
export const MATERIAL_DISPLAY_NAMES = materialsData.displayNames as Record<MaterialSlug, string>;
export const MATERIAL_REMOVED_MAP = materialsData.removed;
export const MATERIAL_SLUGS = Object.keys(MATERIAL_DISPLAY_NAMES) as MaterialSlug[];
