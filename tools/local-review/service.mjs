import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createManifest, validateResults, applyApproval, DEFAULT_BATCH, canonical, koreanDate } from "../../scripts/review/review-core.mjs";
import { reviewDefaults } from "../../scripts/review/review-history.mjs";
import { applyMaterialReview } from "../../scripts/apply-material-review.mjs";
import { materialImageInfo, materialSourcesPath } from "../../scripts/review/material-images.mjs";
import { STATE, ReviewError, fileAt, bytesAt, readAt, walk, fingerprint, revisionOf, commitTransaction, json, pendingTransactions, hash } from "./files.mjs";

export const isRegistered = (entry) => entry.status === "live" && entry.imageStatus === null;
export function discoverBatches(root) {
  const seen = new Set(), outputs = new Set(["results/play-catalog.html"]);
  return walk(root, "data/review-batches", (p) => p.endsWith(".json")).map((batchPath) => {
    const batch = readAt(root, batchPath);
    if (!batch || !/^[a-z0-9-]+$/.test(batch.batchId ?? "") || seen.has(batch.batchId)) throw new ReviewError(400, "검수 배치 ID가 잘못되었거나 중복됩니다.");
    seen.add(batch.batchId);
    const output = batch.reviewOutput ?? (batchPath === DEFAULT_BATCH ? "results/play-image-audit.html" : "results/reviews/" + batch.batchId + ".html");
    fileAt(root, output);
    if (!output.startsWith("results/") || !output.endsWith(".html") || outputs.has(output) || output.startsWith("results/local-review/")) throw new ReviewError(400, "검수 HTML 경로가 잘못되었거나 중복됩니다.");
    outputs.add(output);
    return { batch, batchPath, output };
  });
}

function loadState(root) {
  const state = readAt(root, STATE);
  if (state === null) return { schemaVersion: 1, batches: {} };
  if (state.schemaVersion !== 1 || !state.batches || typeof state.batches !== "object" || Array.isArray(state.batches)) throw new ReviewError(500, "서버 저장 파일을 읽을 수 없습니다. 거래 백업으로 복구해 주세요.");
  return state;
}
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const fields = (record) => ({ decision: record.decision, comment: record.comment,
  contentReviewed: record.contentReviewed, imageReviewed: record.imageReviewed, updatedAt: record.updatedAt ?? null });
const materialFields = (record) => ({ decision: record.decision, comment: record.comment,
  confirmed: record.confirmed, replacementSlug: record.replacementSlug, updatedAt: record.updatedAt ?? null });

// Keep opinions, invalidate confirmations whenever their reviewed inputs change.
export function reconcile(root, manifest, stored) {
  const defaults = new Map(reviewDefaults(root, manifest).map((r) => [r.id, r]));
  const previous = stored?.results;
  const images = previous ? materialImages(root) : null;
  const records = manifest.entries.map((entry) => {
    const baseline = { ...entry, decision: "pending", comment: "", contentReviewed: false, imageReviewed: false, updatedAt: null, ...defaults.get(entry.id) };
    const old = previous?.records?.find((r) => r.id === entry.id);
    const history = defaults.get(entry.id);
    if (!old || (history?.historyAppliedAt ?? history?.updatedAt) > stored.savedAt) return baseline;
    const unchanged = ["contentHash", "imageHash", "status", "imageStatus"].every((k) => entry[k] === old[k]);
    if (unchanged) {
      Object.assign(baseline, fields(old));
      if (baseline.decision === "approved" && (entry.unapprovedMaterials.length || entry.replacementReviewRequired)) baseline.decision = "pending";
    } else baseline.comment = old.comment;
    return baseline;
  });
  const materialRecords = manifest.materialEntries.map((entry) => {
    const applied = entry.appliedDecision;
    const baseline = { slug: entry.slug, materialHash: entry.materialHash, state: entry.state,
      decision: applied?.decision ?? "pending", replacementSlug: applied?.replacementSlug ?? null,
      comment: applied?.comment ?? "", confirmed: applied?.confirmed ?? false, updatedAt: null };
    const old = previous?.materialRecords?.find((r) => r.slug === entry.slug);
    if (!old) return baseline;
    const sameImage = same(stored.materialImages, images);
    const sameTarget = !old.replacementSlug || same(stored.manifest.existingMaterials.find((m) => m.slug === old.replacementSlug),
      manifest.existingMaterials.find((m) => m.slug === old.replacementSlug));
    if (old.materialHash === entry.materialHash && old.state === entry.state && sameImage && sameTarget) Object.assign(baseline, materialFields(old));
    else if (!sameImage || !sameTarget || !applied || !same(applied, { decision: old.decision, replacementSlug: old.replacementSlug, comment: old.comment, confirmed: old.confirmed })) {
      Object.assign(baseline, { decision: "pending", confirmed: false, replacementSlug: null, comment: old.comment });
    }
    return baseline;
  });
  for (const record of records) {
    const entry = manifest.entries.find((e) => e.id === record.id);
    if (record.decision === "approved" && materialRecords.some((m) => ["held", "replace"].includes(m.decision) && entry.materialSlugs.includes(m.slug))) record.decision = "pending";
  }
  const results = { schemaVersion: 2, batchId: manifest.batchId, batchHash: manifest.batchHash, records, materialRecords };
  validateResults(results, manifest, { allowIncomplete: true });
  return results;
}

function materialImages(root) {
  return Object.fromEntries(["src/constants/materialImageSources.ts", ...walk(root, "images/material")].map((p) => [p, hash(bytesAt(root, p) ?? Buffer.alloc(0))]));
}

export function readSnapshot(root, batchId) {
  const before = fingerprint(root);
  const batches = discoverBatches(root);
  const bundle = readAt(root, "data/plays.json"), registry = readAt(root, "data/materials.json"), state = loadState(root);
  const selected = batchId ? batches.find((b) => b.batch.batchId === batchId) : null;
  if (batchId && !selected) throw new ReviewError(404, "검수 배치를 찾을 수 없습니다.");
  const manifest = selected ? createManifest(root, selected.batch, bundle, registry) : null;
  const results = manifest ? reconcile(root, manifest, Object.hasOwn(state.batches, batchId) ? state.batches[batchId] : null) : null;
  const files = fingerprint(root);
  if (revisionOf(before) !== revisionOf(files)) throw new ReviewError(409, "파일을 읽는 중 내용이 변경되었습니다. 다시 불러와 주세요.");
  return { revision: revisionOf(files), files, batches, bundle, registry, state, selected, manifest, results, recovery: pendingTransactions(root) };
}

function cleanResults(results, manifest) {
  validateResults(results, manifest, { allowIncomplete: true });
  return { schemaVersion: 2, batchId: manifest.batchId, batchHash: manifest.batchHash,
    records: manifest.entries.map((entry) => ({ ...entry, ...fields(results.records.find((r) => r.id === entry.id)), updatedAt: new Date().toISOString() })),
    materialRecords: manifest.materialEntries.map((entry) => ({ slug: entry.slug, materialHash: entry.materialHash, state: entry.state,
      ...materialFields(results.materialRecords.find((r) => r.slug === entry.slug)), updatedAt: new Date().toISOString() })) };
}

// Existing approval code runs in a scratch copy. Only its validated output is committed
// under a checked, recoverable transaction in the actual repository.
function stageApplication(root, snapshot, results, intent) {
  const staged = fs.mkdtempSync(path.join(os.tmpdir(), "nori-review-apply-"));
  try {
    const inputs = ["data/plays.json", "data/materials.json", "src/constants/playImages.ts", snapshot.selected.batchPath,
      ...snapshot.manifest.entries.map((e) => "images/plays/" + e.id + ".jpeg"), materialSourcesPath,
      ...snapshot.manifest.materialEntries.map((e) => materialImageInfo(root, e.slug).path)];
    for (const p of inputs) {
      const bytes = bytesAt(root, p);
      if (bytes === null) continue;
      const target = fileAt(staged, p);
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
    }
    const scoped = structuredClone(results);
    scoped.records = scoped.records.map((r) => ({ ...r, decision: intent.type === "play" && r.id === intent.id ? r.decision
      : r.decision === "approved" || r.decision === "changes_requested" && !r.comment.trim() ? "pending" : r.decision }));
    scoped.materialRecords = scoped.materialRecords.map((r) => ({ ...r, decision: intent.type === "material" && r.slug === intent.id ? r.decision : "pending" }));
    const summary = intent.type === "play"
      ? applyApproval(staged, snapshot.selected.batch, scoped, { write: true })
      : applyMaterialReview(staged, snapshot.selected.batchPath, scoped, { write: true });
    const updates = new Map();
    for (const p of inputs.slice(0, 4)) {
      const after = bytesAt(staged, p);
      if (after && !after.equals(bytesAt(root, p))) updates.set(p, after);
    }
    for (const p of [...walk(staged, "results/review-backups"), ...walk(staged, "results/material-review-backups")]) updates.set(p, bytesAt(staged, p));
    return { summary: { ...summary, ...(summary.backupDirectory ? { backupDirectory: path.relative(staged, summary.backupDirectory) } : {}) }, updates };
  } finally { fs.rmSync(staged, { recursive: true, force: true }); }
}

// Remove active content everywhere it is linked; the transaction keeps recoverable originals.
function removePlay(root, snapshot, id) {
  const bundle = structuredClone(snapshot.bundle);
  bundle.plays = bundle.plays.filter((p) => p.id !== id);
  bundle.updatedAt = koreanDate();
  const updates = new Map([["data/plays.json", json(bundle)]]);
  const native = bytesAt(root, "src/constants/playImages.ts").toString();
  updates.set("src/constants/playImages.ts", Buffer.from(native.replace(new RegExp("^ *" + id + ":.*\\n?", "m"), "")));
  updates.set("images/plays/" + id + ".jpeg", null);
  for (const { batch, batchPath } of snapshot.batches) {
    if (!batch.playIds.includes(id)) continue;
    const next = structuredClone(batch);
    next.playIds = next.playIds.filter((value) => value !== id);
    if (next.entries) next.entries = next.entries.filter((entry) => entry.id !== id);
    for (const proposal of next.materialProposals ?? []) {
      if (proposal.usages) proposal.usages = proposal.usages.filter((usage) => usage.id !== id);
    }
    updates.set(batchPath, json(next));
  }
  return { updates, summary: { removedIds: [id] } };
}

export function createService(root) {
  let queue = Promise.resolve();
  function mutate(batchId, body, intent) {
    const operation = queue.then(() => {
      const snapshot = readSnapshot(root, batchId);
      if (snapshot.recovery.length) throw new ReviewError(423, "중단된 저장을 먼저 --recover로 복구해 주세요: " + snapshot.recovery.join(", "));
      if (!/^[a-f0-9]{64}$/.test(body?.revision ?? "") || body.revision !== snapshot.revision) throw new ReviewError(409, "다른 화면 또는 수집 도구가 파일을 변경했습니다. 의견을 JSON으로 보관하고 최신 화면을 열어 주세요.");
      const results = cleanResults(body.results, snapshot.manifest);
      let updates = new Map(), summary = null;
      if (intent) {
        if (intent.type === "unused") {
          if (!snapshot.manifest.entries.some((e) => e.id === intent.id)) throw new ReviewError(400, "이 검수 배치의 놀이만 사용안함으로 처리할 수 있습니다.");
          ({ updates, summary } = removePlay(root, snapshot, intent.id));
        } else if (intent.type === "play") {
          const record = results.records.find((r) => r.id === intent.id);
          const entry = snapshot.manifest.entries.find((e) => e.id === intent.id);
          if (!record || record.decision !== "approved" || isRegistered(entry)) throw new ReviewError(400, "이번 화면에서 승인한 미등록 놀이 한 개를 지정하세요.");
        } else if (!results.materialRecords.some((m) => m.slug === intent.id && m.decision !== "pending")) throw new ReviewError(400, "반영할 재료 결정을 지정하세요.");
        if (intent.type !== "unused") ({ updates, summary } = stageApplication(root, snapshot, results, intent));
      }
      const stored = { savedAt: new Date().toISOString(), manifest: snapshot.manifest, results, materialImages: materialImages(root) };
      const state = structuredClone({ ...snapshot.state, batches: { ...snapshot.state.batches, [batchId]: stored } });
      if (intent?.type === "unused") {
        for (const saved of Object.values(state.batches)) {
          saved.results.records = saved.results.records.filter((r) => r.id !== intent.id);
          saved.manifest.entries = saved.manifest.entries.filter((e) => e.id !== intent.id);
        }
      }
      updates.set(STATE, json(state));
      const transactionId = commitTransaction(root, updates, snapshot.files);
      const current = readSnapshot(root, batchId);
      return { revision: current.revision, transactionId, summary, results: current.results, manifest: current.manifest };
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return { read: (batchId) => readSnapshot(root, batchId), mutate };
}
