import type { ImageSourcePropType } from "react-native";
import { loadLivePlays } from "@/data/content";
import { getPlayImageUrl } from "./playImageUrls";

const playIds = new Set(
  loadLivePlays().filter((play) => play.imageStatus !== "review").map((play) => play.id),
);

export function getPlayImageSource(playId: string): ImageSourcePropType | null {
  return playIds.has(playId) ? { uri: getPlayImageUrl(playId) } : null;
}

export function getPlayThumbnailSource(playId: string): ImageSourcePropType | null {
  return playIds.has(playId) ? { uri: getPlayImageUrl(playId, "thumbnail") } : null;
}
