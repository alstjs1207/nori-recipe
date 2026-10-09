import type { MaterialSlug } from "./materials";
import materialImageVersions from "./materialImageVersions.json";

const versions: Partial<Record<MaterialSlug, string>> = materialImageVersions;

export function getMaterialImageUrl(material: MaterialSlug): string {
  const version = versions[material];
  return `/media/materials/${material}.webp${version ? `?v=${version}` : ""}`;
}
