import type { ImageSourcePropType } from "react-native";
import { loadLivePlays } from "@/data/content";

const playIds = new Set(
  loadLivePlays().filter((play) => play.imageStatus !== "review").map((play) => play.id),
);

export function getPlayImageSource(playId: string): ImageSourcePropType | null {
  return playIds.has(playId) ? { uri: `/media/plays/${playId}.webp` } : null;
}

export function getPlayThumbnailSource(playId: string): ImageSourcePropType | null {
  return playIds.has(playId) ? { uri: `/media/thumbs/${playId}.webp` } : null;
}
