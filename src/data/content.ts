import materialsBundle from "../../data/materials.json";
import playsBundle from "../../data/plays.json";

import { MATERIAL_SLUGS } from "@/constants/materials";
import type { Play, PlaysBundle } from "@/types";

const typedPlaysBundle = playsBundle as PlaysBundle;

export function loadPlaysBundle(): PlaysBundle {
  return typedPlaysBundle;
}

export function loadLivePlays(): Play[] {
  return typedPlaysBundle.plays.filter((play) => play.status === "live");
}

export function loadMaterialsBundle() {
  return {
    ...materialsBundle,
    materialSlugs: MATERIAL_SLUGS,
  };
}
