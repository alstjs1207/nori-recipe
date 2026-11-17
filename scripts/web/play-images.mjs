import fs from "node:fs";
import { contentHash } from "../review/review-core.mjs";
import { validatePublic } from "../play-image-storage/manifest.mjs";
import { locked, safePath } from "../play-image-storage/files.mjs";
import { localWebImages, publicPlayImage, storageImages } from "../../src/constants/playImageManifest.ts";
import { publicationManifest } from "../review/image-publication.mjs";

// Public candidate only: never load admin plans or credentials into the web build.
export function publicImageInput({ root, plays, registry, env = process.env }) {
  const file = env.PLAY_IMAGE_PUBLIC_MANIFEST;
  const origin = env.PLAY_IMAGE_PUBLIC_ORIGIN;
  const bucket = env.PLAY_IMAGE_PUBLIC_BUCKET;
  if (!file && !origin && !bucket && !env.PLAY_IMAGE_PUBLIC_ASSET_DIR) return null;
  if (!file || !origin || !bucket) throw new Error("Public image manifest, origin and bucket must be configured together");
  const storage = storageImages({ origin, bucket });
  let candidate;
  try { candidate = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { throw new Error("Invalid public image manifest"); }
  const manifest = validatePublic(candidate, bucket);
  Object.assign(manifest.entries, publicationManifest(root, "play", storage.origin, bucket)?.entries);
  const entries = {};
  const assets = [];
  for (const play of plays.filter(publicPlayImage)) {
    const entry = manifest.entries[play.id];
    if (!entry) throw new Error(`${play.id}: missing required public image`);
    if (entry.contentHash !== contentHash(play, registry)) throw new Error(`${play.id}: stale public image content hash`);
    entries[play.id] = { version: entry.version,
      detail: `${storage.origin}/storage/v1/object/public/${bucket}/${entry.detail.path}`,
      thumbnail: `${storage.origin}/storage/v1/object/public/${bucket}/${entry.thumbnail.path}` };
    for (const kind of ["detail", "thumbnail"]) assets.push({ id: play.id, kind, bucket, ...entry[kind], url: entries[play.id][kind] });
  }
  return { manifest: { schemaVersion: 1, storage, entries }, assets, directory: env.PLAY_IMAGE_PUBLIC_ASSET_DIR || null };
}

export function webPlayImages(options) {
  return publicImageInput(options)?.manifest ?? localWebImages(options.plays, options.versions);
}

// Expo needs a static JSON import. Only the sanitized public snapshot is injected,
// with the original source restored even if export fails. No network IO occurs.
export async function withWebImageManifest(root, manifest, exportApp) {
  return locked(root, "generated/play-image-storage/web-build", async () => {
    const file = safePath(root, "src/constants/playImageWebManifest.json");
    const original = fs.readFileSync(file);
    try { fs.writeFileSync(file, JSON.stringify(manifest)); return await exportApp(); }
    finally { fs.writeFileSync(file, original); }
  });
}
