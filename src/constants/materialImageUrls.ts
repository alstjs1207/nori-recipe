import type { MaterialSlug } from "./materials";
import materialImageVersions from "./materialImageVersions.json";

import manifest from "./materialImageWebManifest.json";
import { materialImageUrl } from "./materialImageManifest";

const versions: Partial<Record<MaterialSlug, string>> = materialImageVersions;

export function getMaterialImageUrl(material: MaterialSlug): string {
  return materialImageUrl(manifest, material, versions);
}
