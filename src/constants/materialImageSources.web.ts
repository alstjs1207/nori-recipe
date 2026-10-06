import type { ImageSourcePropType } from "react-native";
import { MATERIAL_SLUGS, type MaterialSlug } from "@/constants/materials";

export const MATERIAL_IMAGES = Object.fromEntries(
  MATERIAL_SLUGS.map((slug) => [slug, { uri: `/media/materials/${slug}.webp` }]),
) as Record<MaterialSlug, ImageSourcePropType>;
