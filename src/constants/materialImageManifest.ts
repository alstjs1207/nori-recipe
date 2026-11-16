import type { StorageImages } from "./playImageManifest";

export interface MaterialImageManifest {
  schemaVersion: number;
  storage: StorageImages | null;
  entries: Record<string, { version: string; icon: string }>;
}
export function materialImageUrl(manifest: MaterialImageManifest, slug: string, versions: Partial<Record<string, string>> = {}): string {
  if (!/^[a-z][a-z0-9_]*$/.test(slug)) return "/nori-icon.svg";
  if (!manifest.storage) return `/media/materials/${slug}.webp${versions[slug] ? `?v=${versions[slug]}` : ""}`;
  const entry = manifest.entries[slug];
  if (!entry || !/^[a-f0-9]{64}$/.test(entry.version)) return "/nori-icon.svg";
  const {origin,bucket}=manifest.storage;
  const parsed = new URL(origin);
  if (parsed.origin !== origin || (!origin.startsWith("https://") && !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(bucket)) return "/nori-icon.svg";
  const expected=`${origin}/storage/v1/object/public/${bucket}/materials/${slug}/${entry.version}/icon.webp`;
  return entry.icon===expected ? expected : "/nori-icon.svg";
}
