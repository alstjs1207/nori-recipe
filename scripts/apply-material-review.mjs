import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createManifest, validateResults, DEFAULT_BATCH } from "./review/review-core.mjs";
import { planMaterialChanges } from "./review/material-review-core.mjs";
import { canonical, sha256, readJson, koreanDate } from "./review/review-shared.mjs";
import { validatePlayBundle } from "./validate-play-content.mjs";

export function applyMaterialReview(root, batchPath, results, { write = false } = {}) {
  const batchFile = path.resolve(root, batchPath);
  const files = [path.join(root, "data/plays.json"), path.join(root, "data/materials.json"), batchFile];
  const original = new Map(files.map((file) => [file, fs.readFileSync(file)]));
  const resultHash = sha256(JSON.stringify(canonical(results)));
  const backupRoot = path.join(root, "results/material-review-backups");
  if (fs.existsSync(backupRoot)) {
    for (const dir of fs.readdirSync(backupRoot)) {
      const receiptFile = path.join(backupRoot, dir, "receipt.json");
      if (!fs.existsSync(receiptFile)) continue;
      const receipt = readJson(receiptFile);
      if (receipt.resultsHash === resultHash && receipt.batchPath === path.relative(root, batchFile) &&
          Object.entries(receipt.afterHashes).every(([relative, hash]) => fs.existsSync(path.join(root, relative)) &&
            sha256(fs.readFileSync(path.join(root, relative))) === hash)) {
        return { mode: write ? "write" : "dry-run", wrote: false, alreadyApplied: true, addedSlugs: [], replacements: [], heldSlugs: [] };
      }
    }
  }
  const [bundle, registry, batch] = files.map((file) => JSON.parse(original.get(file).toString()));
  const manifest = createManifest(root, batch, bundle, registry);
  validateResults(results, manifest);
  const plan = planMaterialChanges(bundle, registry, batch, results.materialRecords);
  if (plan.changedPlayIds.length) plan.nextBundle.updatedAt = koreanDate();
  const validation = validatePlayBundle(plan.nextBundle, plan.nextRegistry);
  if (validation.errors.length) throw new Error("재료 반영 검증 실패:\n" + JSON.stringify(validation.errors, null, 2));
  const summary = { mode: write ? "write" : "dry-run", batchId: batch.batchId,
    addedSlugs: plan.addedSlugs, replacements: plan.replacements, heldSlugs: plan.heldSlugs,
    changedPlayIds: plan.changedPlayIds, warnings: validation.warnings };
  const updates = [plan.nextBundle, plan.nextRegistry, plan.nextBatch].map((value, i) => [files[i], JSON.stringify(value, null, 2) + "\n"])
    .filter(([file, text]) => sha256(text) !== sha256(original.get(file)));
  if (!results.materialRecords.some((r) => r.decision !== "pending") || !write || !updates.length) return { ...summary, wrote: false };
  for (const [file, bytes] of original) if (sha256(fs.readFileSync(file)) !== sha256(bytes)) throw new Error("반영 중 파일이 바뀌었습니다: " + file);
  validateResults(results, createManifest(root, readJson(batchFile), readJson(files[0]), readJson(files[1])));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-") + "-" + crypto.randomUUID().slice(0, 8);
  const backup = path.join(backupRoot, stamp);
  fs.mkdirSync(backup, { recursive: true });
  for (const [file] of updates) fs.writeFileSync(path.join(backup, path.basename(file)), original.get(file));
  const written = [];
  try {
    for (const [file, text] of updates) {
      const temp = file + ".material-review-" + stamp;
      fs.writeFileSync(temp, text);
      fs.renameSync(temp, file);
      written.push(file);
    }
    fs.writeFileSync(path.join(backup, "receipt.json"), JSON.stringify({
      ...summary, resultsHash: resultHash, batchPath: path.relative(root, batchFile), appliedAt: new Date().toISOString(),
      materialRecords: results.materialRecords,
      afterHashes: Object.fromEntries(files.map((file) => [path.relative(root, file), sha256(fs.readFileSync(file))])),
    }, null, 2) + "\n");
  } catch (error) {
    for (const file of written.reverse()) fs.writeFileSync(file, original.get(file));
    for (const [file] of updates) fs.rmSync(file + ".material-review-" + stamp, { force: true });
    throw error;
  }
  return { ...summary, wrote: true, backupDirectory: backup };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const args = process.argv.slice(2);
    let resultPath, batchPath = DEFAULT_BATCH, write = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--write") write = true;
      else if (args[i] === "--dry-run") write = false;
      else if (args[i] === "--batch" && args[i + 1]) batchPath = args[++i];
      else if (args[i].startsWith("-") || resultPath) throw new Error("알 수 없는 인자: " + args[i]);
      else resultPath = args[i];
    }
    if (!resultPath) throw new Error("사용법: pnpm review:materials 결과.json [--write] [--batch 배치.json]");
    console.info(JSON.stringify(applyMaterialReview(root, batchPath, readJson(path.resolve(resultPath)), { write }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
