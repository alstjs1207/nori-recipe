import { contentHash } from "./review-core.mjs";
import { materialDefinitionHash, materialImageInfo } from "./material-images.mjs";
import { derivatives, publicEntry as playEntry, validatePublic as validatePlays, TRANSFORM as PLAY_TRANSFORM } from "../play-image-storage/manifest.mjs";
import { iconBytes, versionOf, publicEntry as materialEntry, validatePublic as validateMaterials, TRANSFORM as MATERIAL_TRANSFORM } from "../material-image-storage/manifest.mjs";
import { supabaseStore as playStore } from "../play-image-storage/stores.mjs";
import { supabaseStore as materialStore } from "../material-image-storage/stores.mjs";
import { bytesAt, readAt, json, hash, ReviewError, IMAGE_PUBLICATIONS } from "../../tools/local-review/files.mjs";

export const PUBLICATIONS = IMAGE_PUBLICATIONS;
export const STORAGE_ORIGIN = "https://clqthwgsmumiwnnqjtbe.supabase.co";
const buckets = { play: { original: "play-originals", public: "play-assets" }, material: { original: "material-originals", public: "material-assets" } };
const validator = { play: validatePlays, material: validateMaterials };

// Additive, public-only registrations overlay the immutable migration evidence.
// Build-time callers still validate content/source hashes and filter visibility.
export function publicationManifest(root, kind, origin, bucket) {
  const bytes = root ? bytesAt(root, PUBLICATIONS[kind]) : null;
  if (bytes === null) return null;
  const saved = JSON.parse(bytes);
  if (saved?.origin !== origin) throw new Error("Image publication origin mismatch");
  return { ...validator[kind](saved, bucket), origin };
}

function remoteStore(kind, env) {
  const prefix = kind === "play" ? "PLAY" : "MATERIAL";
  const url = env[`${prefix}_IMAGE_STORAGE_URL`];
  const key = env[`${prefix}_IMAGE_STORAGE_SERVICE_ROLE_KEY`];
  if (url !== STORAGE_ORIGIN || !key) throw new ReviewError(400, `${prefix}_IMAGE_STORAGE_URL과 ${prefix}_IMAGE_STORAGE_SERVICE_ROLE_KEY를 로컬 서버 환경에 설정한 뒤 다시 승인해 주세요.`);
  const store = (kind === "play" ? playStore : materialStore)({ url, serviceRoleKey: key });
  // Anonymous reads prove that the derivative can actually be used by the app.
  store.getPublic = async (bucket, object) => {
    const response = await fetch(`${STORAGE_ORIGIN}/storage/v1/object/public/${bucket}/${object}`, { redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("PUBLIC_READ_FAILED");
    return Buffer.from(await response.arrayBuffer());
  };
  return store;
}

const descriptor = (bytes, path) => ({ path, sha256: hash(bytes), bytes: bytes.length });
function verify(bytes, asset) {
  if (!bytes || bytes.length !== asset.bytes || hash(bytes) !== asset.sha256) throw new Error("INTEGRITY");
}
async function upload(store, bucket, asset, bytes, publicAsset = false) {
  verify(bytes, asset);
  let found = await store.get(bucket, asset.path);
  if (found === null) {
    await store.create(bucket, asset.path, bytes, publicAsset ? "image/webp" : "image/jpeg");
    found = await store.get(bucket, asset.path);
  }
  verify(found, asset);
  if (publicAsset) verify(await store.getPublic(bucket, asset.path), asset);
}

// Only called after the existing approval evaluator has validated and staged the
// user's exact decisions. Returns transaction inputs; never changes local state.
export async function publishApprovedImages(root, staged, { playIds = [], materialSlugs = [], env = process.env, stores = {} } = {}) {
  const updates = new Map(), verified = [];
  const sourceHashes = readAt(root, "src/constants/materialImageSourceHashes.json") ?? {};
  const bundle = readAt(staged, "data/plays.json"), registry = readAt(staged, "data/materials.json");
  for (const [kind, ids] of [["play", playIds], ["material", materialSlugs]]) {
    if (!ids.length) continue;
    try {
      const bucket = buckets[kind];
      const previous = publicationManifest(root, kind, STORAGE_ORIGIN, bucket.public);
      const manifest = previous ?? { schemaVersion: 1, origin: STORAGE_ORIGIN, bucket: bucket.public,
        ...(kind === "material" ? { transform: MATERIAL_TRANSFORM } : {}), entries: {} };
      const store = stores[kind] ?? remoteStore(kind, env);
      for (const id of ids) {
        let entry, original, assets;
        if (kind === "play") {
          const play = bundle.plays.find(p => p.id === id);
          if (play?.status !== "live" || play.imageStatus === "review") throw new Error("REVIEW_REQUIRED");
          original = bytesAt(staged, `images/plays/${id}.jpeg`);
          const transformed = await derivatives(original), sourceHash = hash(original);
          const version = hash(JSON.stringify([PLAY_TRANSFORM, sourceHash, hash(transformed.detail), hash(transformed.thumbnail)]));
          entry = { contentHash: contentHash(play, registry), version,
            original: descriptor(original, `${id}/${sourceHash}/original.jpeg`),
            detail: descriptor(transformed.detail, `${id}/${version}/detail.webp`),
            thumbnail: descriptor(transformed.thumbnail, `${id}/${version}/thumbnail.webp`) };
          assets = [[entry.detail, transformed.detail], [entry.thumbnail, transformed.thumbnail]];
        } else {
          const info = materialImageInfo(staged, id);
          if ((registry.reviewPending ?? []).includes(id) || !info.hash || !info.mapped) throw new Error("REVIEW_REQUIRED");
          original = bytesAt(staged, info.path);
          const icon = await iconBytes(original), sourceHash = hash(original), version = versionOf(sourceHash, hash(icon));
          entry = { sourceHash, contentHash: materialDefinitionHash(registry, id), version,
            original: descriptor(original, `originals/${sourceHash}/original.jpeg`),
            icon: descriptor(icon, `materials/${id}/${version}/icon.webp`) };
          assets = [[entry.icon, icon]];
          sourceHashes[id] = { sourceHash, mappingHash: hash(info.path) };
        }
        await upload(store, bucket.original, entry.original, original);
        for (const [asset, bytes] of assets) await upload(store, bucket.public, asset, bytes, true);
        manifest.entries[id] = kind === "play" ? playEntry(entry) : materialEntry(entry);
        verified.push({ kind, id, version: entry.version });
      }
      manifest.entries = Object.fromEntries(Object.entries(manifest.entries).sort(([a], [b]) => a.localeCompare(b)));
      updates.set(PUBLICATIONS[kind], json({ ...validator[kind](manifest, bucket.public), origin: STORAGE_ORIGIN }));
      if (kind === "material") updates.set("src/constants/materialImageSourceHashes.json", json(sourceHashes));
    } catch (error) {
      if (error instanceof ReviewError) throw error;
      // Never propagate provider responses, URLs containing credentials or raw IO errors.
      throw new ReviewError(400, "Supabase 이미지 업로드·다운로드 검증에 실패했습니다. 등록은 반영하지 않았습니다. 연결·권한·원본 파일을 확인하고 다시 승인해 주세요.");
    }
  }
  return { updates, verified };
}
