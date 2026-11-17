import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyApproval } from "./review-core.mjs";
import { applyMaterialReview } from "./apply-material.mjs";
import { materialImageInfo, materialSourcesPath } from "./material-images.mjs";
import { bytesAt, fileAt, walk } from "../../tools/local-review/files.mjs";
import { publishApprovedImages } from "./image-publication.mjs";

// Existing approval code runs in a scratch copy. Only its validated output is committed
// under a checked, recoverable transaction in the actual repository.
export async function stageApplication(root, snapshot, results, intent, storage = {}) {
  const staged = fs.mkdtempSync(path.join(os.tmpdir(), "nori-review-apply-"));
  try {
    const inputs = ["data/plays.json", "data/materials.json", "src/constants/playImages.ts", snapshot.selected.batchPath,
      ...snapshot.manifest.entries.map((e) => "images/plays/" + e.id + ".jpeg"), materialSourcesPath,
      ...snapshot.manifest.materialEntries.map((e) => materialImageInfo(root, e.slug).path),
      ...walk(root, "results/material-review-backups", p => p.endsWith("/receipt.json"))];
    for (const p of inputs) {
      const bytes = bytesAt(root, p);
      if (bytes === null) continue;
      const target = fileAt(staged, p);
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
    }
    const scoped = structuredClone(results);
    scoped.records = scoped.records.map((r) => ({ ...r, decision: intent.type === "play" && (!intent.id || r.id === intent.id) ? r.decision
      : r.decision === "approved" || r.decision === "changes_requested" && !r.comment.trim() ? "pending" : r.decision }));
    scoped.materialRecords = scoped.materialRecords.map((r) => ({ ...r, decision: intent.type === "material" && (!intent.id || r.slug === intent.id) ? r.decision : "pending" }));
    const summary = intent.type === "play"
      ? applyApproval(staged, snapshot.selected.batch, scoped, { write: true })
      : applyMaterialReview(staged, snapshot.selected.batchPath, scoped, { write: true });
    const updates = new Map();
    for (const p of inputs.slice(0, 4)) {
      const after = bytesAt(staged, p);
      if (after && !after.equals(bytesAt(root, p))) updates.set(p, after);
    }
    for (const p of [...walk(staged, "results/review-backups"), ...walk(staged, "results/material-review-backups")]) updates.set(p, bytesAt(staged, p));
    const published = await publishApprovedImages(root, staged, {
      ...storage,
      playIds: intent.type === "play" ? summary.approvedIds : [],
      materialSlugs: intent.type === "material" ? summary.addedSlugs : [],
    });
    for (const [file, bytes] of published.updates) updates.set(file, bytes);
    for (const [file, bytes] of updates) if (bytesAt(root, file)?.equals(bytes)) updates.delete(file);
    return { summary: { ...summary, images: published.verified, ...(summary.backupDirectory ? { backupDirectory: path.relative(staged, summary.backupDirectory) } : {}) }, updates };
  } finally { fs.rmSync(staged, { recursive: true, force: true }); }
}
