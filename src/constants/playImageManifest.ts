export const DEFAULT_PLAY_IMAGE = "/nori-icon.svg";
export const DEFAULT_PLAY_SHARE_IMAGE = "/og/nori-recipe-20261105-v2.jpg";
export type StorageImages = { origin: string; bucket: string };
export type WebImageManifest = {
  schemaVersion: 1;
  storage: StorageImages | null;
  entries: Record<string, { version: string; detail: string; thumbnail: string }>;
};
type PlayImagePolicy = { id: string; status?: string; imageStatus?: string | null };
export const publicPlayImage = (play: PlayImagePolicy) => play.status === "live" && play.imageStatus !== "review" && /^play_\d{3,}$/.test(play.id);

export function storageImages(value: StorageImages | null): StorageImages | null {
  if (value === null) return null;
  const url = new URL(value.origin);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      !/^[a-z0-9][a-z0-9-]{0,62}$/.test(value.bucket)) throw new Error("Invalid public image storage configuration");
  return { origin: url.origin, bucket: value.bucket };
}

export function localWebImages(plays: PlayImagePolicy[], versions: Partial<Record<string, string>> = {}): WebImageManifest {
  return { schemaVersion: 1, storage: null, entries: Object.fromEntries(plays.filter(publicPlayImage).map((play) => {
    const version = versions[play.id] ?? "";
    const query = version ? `?v=${encodeURIComponent(version)}` : "";
    return [play.id, { version, detail: `/media/plays/${play.id}.webp${query}`, thumbnail: `/media/thumbs/${play.id}.webp${query}` }];
  })) };
}

export function playImageUrl(manifest: WebImageManifest, id: string, size: "detail" | "thumbnail" = "detail"): string {
  if (!/^play_\d{3,}$/.test(id) || !Object.hasOwn(manifest.entries, id)) return DEFAULT_PLAY_IMAGE;
  const entry = manifest.entries[id];
  const candidate = entry[size];
  if (!manifest.storage) {
    const directory = size === "thumbnail" ? "thumbs" : "plays";
    const expected = `/media/${directory}/${id}.webp${entry.version ? `?v=${encodeURIComponent(entry.version)}` : ""}`;
    return candidate === expected ? candidate : DEFAULT_PLAY_IMAGE;
  }
  const { origin, bucket } = storageImages(manifest.storage)!;
  const expected = `${origin}/storage/v1/object/public/${bucket}/${id}/${entry.version}/${size}.webp`;
  return /^[a-f0-9]{64}$/.test(entry.version) && candidate === expected ? candidate : DEFAULT_PLAY_IMAGE;
}

export function visibleWebImages(manifest: WebImageManifest, plays: PlayImagePolicy[], versions: Partial<Record<string, string>>): WebImageManifest {
  if (!manifest.storage) return localWebImages(plays, versions);
  return { schemaVersion: 1, storage: storageImages(manifest.storage), entries: Object.fromEntries(
    plays.filter(publicPlayImage).filter((play) => Object.hasOwn(manifest.entries, play.id)).map((play) => [play.id, manifest.entries[play.id]])) };
}
