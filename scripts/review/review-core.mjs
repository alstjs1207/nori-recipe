import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validatePlayBundle } from "../validate-play-content.mjs";
import { canonical, sha256, readJson, koreanDate } from "./review-shared.mjs";
import { describeMaterials, replacementPending, validateMaterialRecords } from "./material-review-core.mjs";
export { canonical, sha256, readJson, koreanDate } from "./review-shared.mjs";

export const DECISIONS = ["pending", "approved", "changes_requested", "held"];
export const DEFAULT_BATCH = "data/review-batches/instagram-14-20261014.json";
export const manifestHash = (manifest) => sha256(JSON.stringify(canonical({
  entries: manifest.entries, materialEntries: manifest.materialEntries, existingMaterials: manifest.existingMaterials,
})));

export function contentHash(play, registry) {
  const { status, imageStatus, ...content } = play;
  const materials = [...play.materials.required, ...play.materials.optional].sort().map((slug) => ({
    slug, name: registry.displayNames[slug],
    category: Object.keys(registry.categories).find((key) => registry.categories[key].includes(slug)),
  }));
  return sha256(JSON.stringify(canonical({ content, materials })));
}

export function imageInfo(root, id) {
  if (!/^play_\d{3,}$/.test(id)) throw new Error("잘못된 놀이 ID: " + id);
  const relativePath = "images/plays/" + id + ".jpeg";
  const file = path.join(root, relativePath);
  try {
    const bytes = fs.readFileSync(file);
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw new Error(id + ": 대표 이미지는 JPEG 파일이어야 합니다.");
    }
    return { path: relativePath, hash: sha256(bytes) };
  } catch (error) {
    if (error.code === "ENOENT") return { path: relativePath, hash: null };
    throw error;
  }
}

export function createManifest(root, batch, bundle, registry) {
  if (!batch || batch.schemaVersion !== 1 || !/^[a-z0-9-]+$/.test(batch.batchId ?? "") ||
      !Array.isArray(batch.playIds) || !batch.playIds.length ||
      new Set(batch.playIds).size !== batch.playIds.length) throw new Error("잘못된 검수 배치입니다.");
  const entries = batch.playIds.map((id) => {
    const play = bundle.plays.find((item) => item.id === id);
    if (!play) throw new Error("배치의 놀이를 찾을 수 없습니다: " + id);
    return { id, contentHash: contentHash(play, registry), imageHash: imageInfo(root, id).hash,
      status: play.status, imageStatus: play.imageStatus ?? null,
      materialSlugs: [...play.materials.required, ...play.materials.optional],
      unapprovedMaterials: [...play.materials.required, ...play.materials.optional].filter((slug) => (registry.reviewPending ?? []).includes(slug)),
      replacementReviewRequired: replacementPending(play, batch.entries?.find((extra) => extra.id === id)) };
  });
  const manifest = { schemaVersion: 2, batchId: batch.batchId, entries, ...describeMaterials(batch, registry, root) };
  return { ...manifest, batchHash: manifestHash(manifest) };
}

export function validateResults(results, manifest, { allowIncomplete = false } = {}) {
  if (results?.schemaVersion !== 2 || results.batchId !== manifest.batchId ||
      results.batchHash !== manifest.batchHash) throw new Error("검수 화면과 결과 JSON의 버전이 다릅니다. 화면을 다시 생성하고 검수해 주세요.");
  if (!Array.isArray(results.records) || results.records.length !== manifest.entries.length) {
    throw new Error("검수 배치의 모든 놀이가 결과에 한 번씩 포함되어야 합니다.");
  }
  validateMaterialRecords(results.materialRecords, manifest, { allowIncomplete });
  const expected = new Map(manifest.entries.map((entry) => [entry.id, entry]));
  const seen = new Set();
  for (const record of results.records) {
    const entry = expected.get(record.id);
    if (!entry || seen.has(record.id)) throw new Error("배치 밖의 ID 또는 중복 ID: " + record.id);
    seen.add(record.id);
    if (record.contentHash !== entry.contentHash || record.imageHash !== entry.imageHash ||
        record.status !== entry.status || record.imageStatus !== entry.imageStatus) {
      throw new Error(record.id + ": 내용 또는 이미지가 변경되었습니다. 다시 검수해 주세요.");
    }
    if (!DECISIONS.includes(record.decision) || typeof record.comment !== "string" ||
        record.comment.length > 10000 || typeof record.contentReviewed !== "boolean" ||
        typeof record.imageReviewed !== "boolean") throw new Error(record.id + ": 잘못된 검수 기록입니다.");
    if (!allowIncomplete && record.decision === "changes_requested" && !record.comment.trim()) {
      throw new Error(record.id + ": 수정 요청에는 의견이 필요합니다.");
    }
    if (record.decision === "approved" &&
        (!record.contentReviewed || !record.imageReviewed || !entry.imageHash)) {
      throw new Error(record.id + ": 내용과 실제 대표 이미지 확인을 모두 마쳐야 승인할 수 있습니다.");
    }
    if (record.imageReviewed && !entry.imageHash) throw new Error(record.id + ": 대표 이미지가 없습니다.");
    if (record.decision === "approved" && (entry.unapprovedMaterials.length || entry.replacementReviewRequired ||
        results.materialRecords.some((material) => ["held", "replace"].includes(material.decision) && entry.materialSlugs.includes(material.slug)))) {
      throw new Error(record.id + ": 재료 검수 결과를 먼저 반영하고 대체된 방법·주의사항을 다시 검수해 주세요.");
    }
  }
}

export function addNativeImageMappings(source, ids) {
  const start = source.indexOf("const PLAY_IMAGE_SOURCES:");
  const end = source.indexOf("\n};", start);
  if (start < 0 || end < 0) throw new Error("앱 이미지 매핑 구조를 확인할 수 없습니다.");
  let result = source;
  const additions = [];
  for (const id of ids) {
    const expected = '  ' + id + ': require("../../images/plays/' + id + '.jpeg"),';
    const existing = new RegExp("^\\s*" + id + ":.*$", "m");
    if (existing.test(result)) result = result.replace(existing, expected);
    else additions.push(expected);
  }
  const finalEnd = result.indexOf("\n};", result.indexOf("const PLAY_IMAGE_SOURCES:"));
  return result.slice(0, finalEnd) + (additions.length ? "\n" + additions.join("\n") : "") + result.slice(finalEnd);
}

export function planApproval(root, batch, results) {
  if (!Array.isArray(results?.records)) throw new Error("검수 결과에 records 배열이 필요합니다.");
  const bundle = readJson(path.join(root, "data/plays.json"));
  const registry = readJson(path.join(root, "data/materials.json"));
  const currentManifest = createManifest(root, batch, bundle, registry);
  // An unchanged, already-published item may be replayed. Reopened review states
  // must use a new export, even when the image bytes and content are unchanged.
  const entries = currentManifest.entries.map((entry) => {
    const record = results?.records?.find((item) => item.id === entry.id);
    if (record?.decision === "approved" && entry.status === "live" && entry.imageStatus === null &&
        record.contentHash === entry.contentHash && record.imageHash === entry.imageHash &&
        ["draft", "live"].includes(record.status) && [null, "review"].includes(record.imageStatus)) {
      return { ...entry, status: record.status, imageStatus: record.imageStatus };
    }
    return entry;
  });
  const manifest = { ...currentManifest, entries };
  manifest.batchHash = manifestHash(manifest);
  validateResults(results, manifest);
  const nextBundle = structuredClone(bundle);
  const changedIds = [], approvedIds = [], skippedIds = [], alreadyLiveIds = [];
  for (const record of results.records) {
    if (record.decision !== "approved") { skippedIds.push(record.id); continue; }
    const play = nextBundle.plays.find((item) => item.id === record.id);
    if (!["draft", "live"].includes(play.status)) throw new Error(record.id + ": 보관한 놀이를 자동 게시할 수 없습니다.");
    approvedIds.push(play.id);
    if (play.status === "live" && play.imageStatus === undefined) {
      alreadyLiveIds.push(play.id);
      continue;
    }
    play.status = "live";
    delete play.imageStatus;
    changedIds.push(play.id);
  }
  const validation = validatePlayBundle(nextBundle, registry);
  if (validation.errors.length) throw new Error("게시 검증 실패:\n" + JSON.stringify(validation.errors, null, 2));
  const nativePath = "src/constants/playImages.ts";
  const nativeBefore = fs.readFileSync(path.join(root, nativePath), "utf8");
  const nativeAfter = approvedIds.length ? addNativeImageMappings(nativeBefore, approvedIds) : nativeBefore;
  if (changedIds.length) nextBundle.updatedAt = koreanDate();
  return { manifest, bundle, nextBundle, nativePath, nativeBefore, nativeAfter,
    approvedIds, changedIds, skippedIds, alreadyLiveIds, warnings: validation.warnings };
}

// No writes until every approval, fingerprint and resulting bundle has passed.
export function applyApproval(root, batch, results, { write = false } = {}) {
  const masterPath = path.join(root, "data/plays.json");
  const nativePath = path.join(root, "src/constants/playImages.ts");
  const registryPath = path.join(root, "data/materials.json");
  const originals = new Map([masterPath, nativePath, registryPath].map((p) => [p, fs.readFileSync(p)]));
  const plan = planApproval(root, batch, results);
  const summary = { mode: write ? "write" : "dry-run", batchId: batch.batchId,
    approvedIds: plan.approvedIds, changedIds: plan.changedIds,
    alreadyLiveIds: plan.alreadyLiveIds, skippedIds: plan.skippedIds, warnings: plan.warnings };
  const updates = [];
  if (plan.changedIds.length) updates.push([masterPath, JSON.stringify(plan.nextBundle, null, 2) + "\n"]);
  if (plan.nativeAfter !== plan.nativeBefore) updates.push([nativePath, plan.nativeAfter]);
  if (!write || !updates.length) return { ...summary, wrote: false };
  for (const [file, bytes] of originals) {
    if (sha256(fs.readFileSync(file)) !== sha256(bytes)) throw new Error("검수 반영 중 파일이 변경되었습니다. 다시 실행해 주세요: " + file);
  }
  const freshPlan = planApproval(root, batch, results);
  if (freshPlan.manifest.batchHash !== plan.manifest.batchHash ||
      JSON.stringify(freshPlan.changedIds) !== JSON.stringify(plan.changedIds)) throw new Error("검수 반영 중 상태가 바뀌었습니다.");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-") + "-" + crypto.randomUUID().slice(0, 8);
  const backupDirectory = path.join(root, "results/review-backups", stamp);
  fs.mkdirSync(backupDirectory, { recursive: true });
  for (const [file] of updates) fs.writeFileSync(path.join(backupDirectory, path.basename(file)), originals.get(file));
  const written = [];
  try {
    for (const [file, value] of updates) {
      const temp = file + ".review-" + stamp;
      fs.writeFileSync(temp, value);
      fs.renameSync(temp, file);
      written.push(file);
    }
    fs.writeFileSync(path.join(backupDirectory, "receipt.json"), JSON.stringify({
      ...summary, appliedAt: new Date().toISOString(), resultsHash: sha256(JSON.stringify(canonical(results))),
      records: results.records,
    }, null, 2) + "\n");
  } catch (error) {
    for (const file of written.reverse()) fs.writeFileSync(file, originals.get(file));
    for (const [file] of updates) fs.rmSync(file + ".review-" + stamp, { force: true });
    throw error;
  }
  return { ...summary, wrote: true, backupDirectory };
}
