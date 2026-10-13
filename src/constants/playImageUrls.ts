import playImageVersions from "./playImageVersions.json";

const versions: Partial<Record<string, string>> = playImageVersions;

export function getPlayImageUrl(
  playId: string,
  size: "detail" | "thumbnail" = "detail",
): string {
  const version = versions[playId];
  const directory = size === "thumbnail" ? "thumbs" : "plays";
  return `/media/${directory}/${encodeURIComponent(playId)}.webp${version ? `?v=${version}` : ""}`;
}
