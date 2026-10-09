import type { ImageSourcePropType } from "react-native";
import { MATERIAL_SLUGS, type MaterialSlug } from "@/constants/materials";
import { getMaterialImageUrl } from "./materialImageUrls";

export const MATERIAL_IMAGES = Object.fromEntries(
  MATERIAL_SLUGS.map((slug) => [slug, { uri: getMaterialImageUrl(slug) }]),
) as Record<MaterialSlug, ImageSourcePropType>;
