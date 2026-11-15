import fs from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { contentHash } from "../review/review-core.mjs";
import { validatePlayBundle } from "../validate-play-content.mjs";
import { canonical, fail, readOptional, safePath, sha256 } from "./files.mjs";

export const TRANSFORM = "webp-detail-960-inside-q72-thumb-320-cover-q66-v1";
const hashPattern = /^[a-f0-9]{64}$/;
export const validId = (id) => typeof id === "string" && /^play_\d{3,}$/.test(id);
export const validBucket = (name) => typeof name === "string" && /^[a-z0-9][a-z0-9-]{0,62}$/.test(name);
export const isPublic = (play) => play?.status === "live" && play.imageStatus !== "review";
export const readJson = (root, relative) => JSON.parse(fs.readFileSync(safePath(root, relative), "utf8"));

export function inputs(root) {
  const bundle = readJson(root, "data/plays.json"), registry = readJson(root, "data/materials.json");
  if (validatePlayBundle(bundle, registry).errors.length) fail("INVALID_INPUT");
  return { bundle, registry };
}

export function selected(plays, ids = plays.map((play) => play.id)) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some((id) => !validId(id))) fail("INVALID_INPUT");
  return [...ids].sort().map((id) => {
    const play = plays.find((item) => item.id === id);
    if (!play) fail("INVALID_INPUT");
    return play;
  });
}

export async function decodeOriginal(bytes) {
  if (!bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) fail("CORRUPT_IMAGE");
  try {
    const image = sharp(bytes, { failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== "jpeg" || (metadata.pages ?? 1) !== 1) fail("CORRUPT_IMAGE");
    await image.raw().toBuffer();
  } catch { fail("CORRUPT_IMAGE"); }
}

export async function derivatives(bytes) {
  await decodeOriginal(bytes);
  const detail = await sharp(bytes).rotate().resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
  const thumbnail = await sharp(bytes).rotate().resize({ width: 320, height: 320, fit: "cover", withoutEnlargement: true }).webp({ quality: 66 }).toBuffer();
  return { detail, thumbnail };
}

const descriptor = (bytes, objectPath) => ({ path: objectPath, sha256: sha256(bytes), bytes: bytes.length });
const versionOf = (sourceHash, detailHash, thumbnailHash) => sha256(JSON.stringify([TRANSFORM, sourceHash, detailHash, thumbnailHash]));

function gitRead(root, commit, relative) {
  try { return execFileSync("git", ["show", `${commit}:${relative}`], { cwd: root, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 }); }
  catch { fail("REVIEW_REQUIRED"); }
}

// The selected immutable commit is the existing published baseline, not a new approval.
export function baseline(root, ref = "HEAD") {
  let commit;
  if (typeof ref !== "string" || !/^[a-zA-Z0-9_./-]+$/.test(ref) || ref.startsWith("-")) fail("INVALID_INPUT");
  try { commit = execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch { fail("INVALID_INPUT"); }
  return { commit, bundle: JSON.parse(gitRead(root, commit, "data/plays.json")), registry: JSON.parse(gitRead(root, commit, "data/materials.json")),
    image: (id) => gitRead(root, commit, `images/plays/${id}.jpeg`) };
}

export async function planMigration(root, { ids, baselineRef = "HEAD", originalBucket, publicBucket } = {}) {
  if (!validBucket(originalBucket) || !validBucket(publicBucket) || originalBucket === publicBucket) fail("INVALID_INPUT");
  const { bundle, registry } = inputs(root), approved = baseline(root, baselineRef);
  const entries = [];
  for (const play of selected(bundle.plays, ids)) {
    const original = readOptional(safePath(root, `images/plays/${play.id}.jpeg`));
    if (!original) fail("MISSING");
    const transformed = await derivatives(original), sourceHash = sha256(original);
    const currentHash = contentHash(play, registry);
    const published = approved.bundle.plays.find((item) => item.id === play.id);
    let approval = null;
    if (isPublic(play)) {
      if (!isPublic(published) || contentHash(published, approved.registry) !== currentHash || sha256(approved.image(play.id)) !== sourceHash) fail("REVIEW_REQUIRED");
      approval = { commit: approved.commit, contentHash: currentHash, imageHash: sourceHash };
    }
    const version = versionOf(sourceHash, sha256(transformed.detail), sha256(transformed.thumbnail));
    entries.push({ id: play.id, contentHash: currentHash, status: play.status, imageStatus: play.imageStatus ?? null, approval, version,
      original: descriptor(original, `${play.id}/${sourceHash}/original.jpeg`),
      detail: descriptor(transformed.detail, `${play.id}/${version}/detail.webp`),
      thumbnail: descriptor(transformed.thumbnail, `${play.id}/${version}/thumbnail.webp`) });
  }
  return { schemaVersion: 1, transform: TRANSFORM, baselineCommit: approved.commit, buckets: { original: originalBucket, public: publicBucket }, entries };
}

export function validatePlan(plan) {
  if (plan?.schemaVersion !== 1 || plan.transform !== TRANSFORM || !/^[a-f0-9]{40}$/.test(plan.baselineCommit ?? "") ||
      !validBucket(plan.buckets?.original) || !validBucket(plan.buckets?.public) || plan.buckets.original === plan.buckets.public ||
      !Array.isArray(plan.entries) || !plan.entries.length || new Set(plan.entries.map((entry) => entry.id)).size !== plan.entries.length) fail("INVALID_INPUT");
  for (const entry of plan.entries) {
    if (!validId(entry.id) || !hashPattern.test(entry.contentHash ?? "") || !["live", "draft", "archived"].includes(entry.status) ||
        ![null, "review"].includes(entry.imageStatus)) fail("INVALID_INPUT");
    for (const kind of ["original", "detail", "thumbnail"]) {
      const asset = entry[kind];
      if (!hashPattern.test(asset?.sha256 ?? "") || !Number.isSafeInteger(asset.bytes) || asset.bytes < 1) fail("INVALID_INPUT");
    }
    if (entry.version !== versionOf(entry.original.sha256, entry.detail.sha256, entry.thumbnail.sha256) ||
        entry.original.path !== `${entry.id}/${entry.original.sha256}/original.jpeg` ||
        entry.detail.path !== `${entry.id}/${entry.version}/detail.webp` || entry.thumbnail.path !== `${entry.id}/${entry.version}/thumbnail.webp`) fail("INVALID_INPUT");
    if (entry.approval !== null && (entry.approval?.commit !== plan.baselineCommit || entry.approval.contentHash !== entry.contentHash || entry.approval.imageHash !== entry.original.sha256)) fail("INVALID_INPUT");
    if (isPublic(entry) && !entry.approval) fail("REVIEW_REQUIRED");
  }
  return plan;
}

export const planHash = (plan) => sha256(JSON.stringify(canonical(validatePlan(plan))));

// Re-plan from source + the original baseline, never trust a forged approval in JSON.
export async function currentEntry(root, plan, entry) {
  const fresh = await planMigration(root, { ids: [entry.id], baselineRef: plan.baselineCommit,
    originalBucket: plan.buckets.original, publicBucket: plan.buckets.public });
  if (JSON.stringify(canonical(fresh.entries[0])) !== JSON.stringify(canonical(entry))) fail("SOURCE_CHANGED");
  const original = fs.readFileSync(safePath(root, `images/plays/${entry.id}.jpeg`));
  if (sha256(original) !== entry.original.sha256) fail("SOURCE_CHANGED");
  return { original, ...await derivatives(original) };
}

export function publicEntry(entry) {
  const asset = ({ path, sha256, bytes }) => ({ path, sha256, bytes });
  return { sourceHash: entry.original.sha256, contentHash: entry.contentHash, version: entry.version,
    detail: asset(entry.detail), thumbnail: asset(entry.thumbnail) };
}

export function emptyPublic(bucket) { return { schemaVersion: 1, bucket, entries: {} }; }

export function validatePublic(manifest, bucket) {
  if (manifest?.schemaVersion !== 1 || manifest.bucket !== bucket || !manifest.entries || Array.isArray(manifest.entries)) fail("INVALID_INPUT");
  for (const [id, entry] of Object.entries(manifest.entries)) {
    if (!validId(id) || !hashPattern.test(entry?.sourceHash ?? "") || !hashPattern.test(entry.contentHash ?? "") || !hashPattern.test(entry.version ?? "")) fail("INVALID_INPUT");
    for (const kind of ["detail", "thumbnail"]) {
      const asset = entry[kind];
      if (!hashPattern.test(asset?.sha256 ?? "") || !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.path !== `${id}/${entry.version}/${kind}.webp`) fail("INVALID_INPUT");
    }
    if (entry.version !== versionOf(entry.sourceHash, entry.detail.sha256, entry.thumbnail.sha256)) fail("INVALID_INPUT");
  }
  // Whitelist fields instead of propagating arbitrary administrative JSON keys.
  return { schemaVersion: 1, bucket, entries: Object.fromEntries(Object.entries(manifest.entries).map(([id, entry]) => [id,
    publicEntry({ original: { sha256: entry.sourceHash }, contentHash: entry.contentHash, version: entry.version,
      detail: entry.detail, thumbnail: entry.thumbnail })])) };
}
