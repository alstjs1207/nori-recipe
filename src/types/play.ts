import type { DevArea } from "@/constants/devAreas";
import type { MaterialSlug } from "@/constants/materials";

export type PlayPlace = "indoor" | "outdoor" | "any";
export type PlayDifficulty = 1 | 2 | 3;
export type PlayStatus = "live" | "draft" | "archived";
export type PlaySourceType =
  | "youtube"
  | "instagram"
  | "naver_blog"
  | "chaisplay"
  | "tistory"
  | "brunch"
  | "manual";

export type PlayMaterials = {
  required: MaterialSlug[];
  optional: MaterialSlug[];
  substitutes: MaterialSlug[];
};

export type PlaySource = {
  type: PlaySourceType;
  url: string | null;
  instagramAccount: string | null;
};

export type Play = {
  id: string;
  name: string;
  ageMin: number;
  ageMax: number;
  place: PlayPlace;
  durationMin: number;
  durationMax: number;
  prepTime: number;
  difficulty: PlayDifficulty;
  devAreas: DevArea[];
  materials: PlayMaterials;
  steps: string[];
  tip?: string;
  safetyNotes: string[];
  educationalEffects: string[];
  tags: string[];
  source: PlaySource;
  status: PlayStatus;
};

export type PlaysBundle = {
  version: string;
  updatedAt: string;
  importedFiles: string[];
  plays: Play[];
};
