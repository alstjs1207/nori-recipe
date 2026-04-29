import type { DevArea } from "@/constants/devAreas";
import type { MaterialSlug } from "@/constants/materials";

export type AreaScoreMap = Partial<Record<DevArea, number>>;

export type UserContext = {
  childBirthMonth: number | null;
  ownedMaterials: MaterialSlug[];
  blockedMaterials: MaterialSlug[];
  preferredDevAreas: DevArea[];
  devGaps: AreaScoreMap;
  userFeedback: AreaScoreMap;
};

export const DEFAULT_USER_CONTEXT: UserContext = {
  childBirthMonth: null,
  ownedMaterials: [],
  blockedMaterials: [],
  preferredDevAreas: [],
  devGaps: {},
  userFeedback: {},
};

export type FilterInput = {
  childAgeMonths: number;
  availableMaterials: MaterialSlug[];
  blockedMaterials: MaterialSlug[];
  availableMinutes: number;
  place: "indoor" | "outdoor" | "any";
  devGaps?: AreaScoreMap;
  userFeedback?: AreaScoreMap;
};
