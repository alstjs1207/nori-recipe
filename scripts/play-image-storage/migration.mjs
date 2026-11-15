import fs from "node:fs";
import { contentHash } from "../review/review-core.mjs";
import { createFile, errorCode, fail, locked, readOptional, safePath, sha256, writeJson } from "./files.mjs";
import { currentEntry, decodeOriginal, emptyPublic, inputs, isPublic, planHash, publicEntry, selected, validatePlan, validatePublic } from "./manifest.mjs";

export const DEFAULT_STATE = "generated/play-image-storage/state.json";
export const DEFAULT_PUBLIC = "generated/play-image-storage/public-candidate.json";
export function outputPath(relative) {
  if (typeof relative !== "string" || !relative.startsWith("generated/play-image-storage/") || !relative.endsWith(".json")) fail("UNSAFE_PATH");
  return relative;
}
const optionalJson = (root, relative) => {
  const bytes = readOptional(safePath(root, outputPath(relative)));
  return bytes ? JSON.parse(bytes) : null;
};
const verify = (bytes, asset) => {
  if (!bytes) fail("MISSING");
  if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) fail("INTEGRITY");
};

function stateFor(root, plan, store, statePath) {
  const state = optionalJson(root, statePath);
  if (state && (state.schemaVersion !== 1 || state.store !== store.identity ||
      JSON.stringify(state.buckets) !== JSON.stringify(plan.buckets))) fail("CONFLICT");
  return { schemaVersion: 1, store: store.identity, buckets: { ...plan.buckets }, planHash: planHash(plan),
    objects: state?.objects ?? {}, cleanup: state?.cleanup ?? [], results: state?.results ?? [], restoreResults: state?.restoreResults ?? [] };
}

function queueCleanup(state, id, bucket, asset, reason) {
  if (!state.cleanup.some((item) => item.bucket === bucket && item.path === asset.path)) {
    state.cleanup.push({ id, bucket, path: asset.path, sha256: asset.sha256, reason });
  }
}

function cleanupEntry(state, id, bucket, entry, reason) {
  for (const kind of ["detail", "thumbnail"]) {
    queueCleanup(state, id, bucket, entry[kind], reason);
  }
}

function prune(root, manifest, state) {
  const { bundle, registry } = inputs(root);
  const reasonFor = (id, entry) => {
    const play = bundle.plays.find((item) => item.id === id);
    if (!isPublic(play)) return "not-public";
    if (contentHash(play, registry) !== entry.contentHash) return "content-changed";
    const original = readOptional(safePath(root, `images/plays/${id}.jpeg`));
    return !original ? "missing-source" : sha256(original) !== entry.sourceHash ? "source-changed" : null;
  };
  for (const [id, entry] of Object.entries(manifest.entries)) {
    const reason = reasonFor(id, entry);
    if (reason) { cleanupEntry(state, id, manifest.bucket, entry, reason); delete manifest.entries[id]; }
  }
  // Also account for a public detail uploaded just before a concurrent revocation,
  // even though that partially transferred ID never reached the public manifest.
  for (const [key, object] of Object.entries(state.objects)) {
    if (!key.startsWith(`${manifest.bucket}/`)) continue;
    const reason = reasonFor(object.id, object);
    if (reason) queueCleanup(state, object.id, manifest.bucket, object, reason);
  }
}

async function ensureObject(store, bucket, asset, bytes, contentType, progress) {
  verify(bytes, asset);
  // Record intent before IO: a server may create an object but lose its response.
  progress({ sha256: asset.sha256, verified: false, attempted: true });
  let found = await store.get(bucket, asset.path);
  if (found === null) {
    const created = await store.create(bucket, asset.path, bytes, contentType);
    progress({ sha256: asset.sha256, verified: false, created });
    found = await store.get(bucket, asset.path);
  }
  verify(found, asset);
  progress({ sha256: asset.sha256, verified: true });
}

// CON-004/CON-005: only a complete verified ID is promoted to the public candidate.
export async function migrate(root, plan, store, { write = false, statePath = DEFAULT_STATE, publicPath = DEFAULT_PUBLIC } = {}) {
  validatePlan(plan);
  outputPath(statePath); outputPath(publicPath);
  if (statePath === publicPath) fail("INVALID_INPUT");
  const run = async () => {
    const state = stateFor(root, plan, store, statePath);
    state.results = [];
    const manifest = validatePublic(optionalJson(root, publicPath) ?? emptyPublic(plan.buckets.public), plan.buckets.public);
    prune(root, manifest, state);
    const persist = () => {
      const active = new Set(Object.values(manifest.entries).flatMap((entry) => [entry.detail.path, entry.thumbnail.path]));
      state.cleanup = state.cleanup.filter((item) => item.bucket !== manifest.bucket || !active.has(item.path));
      if (write) { writeJson(root, statePath, state); writeJson(root, publicPath, manifest); }
    };
    // Revocations persist even if a later transfer fails. No remote deletion occurs.
    persist();
    for (const entry of plan.entries) {
      try {
        const bytes = await currentEntry(root, plan, entry);
        if (!write) {
          state.results.push({ id: entry.id, status: "planned", public: isPublic(entry) });
          continue;
        }
        const transfer = (kind, bucket) => ensureObject(store, bucket, entry[kind], bytes[kind], kind === "original" ? "image/jpeg" : "image/webp",
          (result) => { state.objects[`${bucket}/${entry[kind].path}`] = { ...result, id: entry.id, path: entry[kind].path,
            sourceHash: entry.original.sha256, contentHash: entry.contentHash }; writeJson(root, statePath, state); });
        await transfer("original", plan.buckets.original);
        if (isPublic(entry)) {
          for (const kind of ["detail", "thumbnail"]) {
            await currentEntry(root, plan, entry);
            await transfer(kind, plan.buckets.public);
          }
          // A source or review change during IO cannot activate a stale version.
          await currentEntry(root, plan, entry);
          const previous = manifest.entries[entry.id];
          if (previous && previous.version !== entry.version) cleanupEntry(state, entry.id, manifest.bucket, previous, "superseded");
          manifest.entries[entry.id] = publicEntry(entry);
        }
        state.results.push({ id: entry.id, status: "verified", public: isPublic(entry) });
      } catch (error) {
        const code = errorCode(error);
        if (code === "INTEGRITY" && manifest.entries[entry.id]?.version === entry.version) {
          cleanupEntry(state, entry.id, manifest.bucket, manifest.entries[entry.id], "integrity-failed");
          delete manifest.entries[entry.id];
        }
        state.results.push({ id: entry.id, status: "failed", code });
      }
      // Re-read publication states after awaited IO, including failures.
      prune(root, manifest, state);
      persist();
    }
    manifest.entries = Object.fromEntries(Object.entries(manifest.entries).sort(([a], [b]) => a.localeCompare(b)));
    persist();
    return { mode: write ? "write" : "dry-run", results: state.results, cleanup: state.cleanup, publicManifest: manifest };
  };
  return write ? locked(root, statePath, run) : run();
}

// Restore only creates absent files after download verification. Existing bytes win.
export async function restore(root, plan, store, { ids = plan.entries.map((entry) => entry.id), write = false, statePath = DEFAULT_STATE } = {}) {
  validatePlan(plan); outputPath(statePath);
  const { bundle } = inputs(root);
  selected(bundle.plays, ids);
  if (ids.some((id) => !plan.entries.some((entry) => entry.id === id))) fail("INVALID_INPUT");
  const run = async () => {
    const state = stateFor(root, plan, store, statePath), results = [];
    for (const id of ids) {
      try {
        const entry = plan.entries.find((item) => item.id === id);
        const target = safePath(root, `images/plays/${id}.jpeg`);
        const existing = readOptional(target);
        if (existing && sha256(existing) !== entry.original.sha256) fail("CONFLICT");
        if (!write) { results.push({ id, status: "planned" }); continue; }
        const bytes = await store.get(plan.buckets.original, entry.original.path);
        verify(bytes, entry.original);
        await decodeOriginal(bytes);
        // Recheck the path after network IO; createFile is exclusive, not overwrite.
        safePath(root, `images/plays/${id}.jpeg`);
        const created = createFile(target, bytes);
        verify(fs.readFileSync(target), entry.original);
        results.push({ id, status: created ? "restored" : "reused" });
      } catch (error) { results.push({ id, status: "failed", code: errorCode(error) }); }
      if (write) { state.restoreResults = results; writeJson(root, statePath, state); }
    }
    return { mode: write ? "write" : "dry-run", results };
  };
  return write ? locked(root, statePath, run) : run();
}
