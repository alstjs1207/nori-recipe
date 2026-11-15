import playImageVersions from "./playImageVersions.json";
import prepared from "./playImageWebManifest.json";
import { loadPlaysBundle } from "@/data/content";
import { playImageUrl, visibleWebImages, type WebImageManifest } from "./playImageManifest";

const manifest = visibleWebImages(prepared as WebImageManifest, loadPlaysBundle().plays, playImageVersions);

export function getPlayImageUrl(
  playId: string,
  size: "detail" | "thumbnail" = "detail",
): string {
  return playImageUrl(manifest, playId, size);
}
