import fs from "node:fs";
import path from "node:path";

// Restore decisions that still describe the exact draft. Published status is
// displayed separately; a receipt never supplies a new approval automatically.
export function reviewDefaults(root, manifest) {
  const directory = path.join(root, "results/review-backups");
  if (!fs.existsSync(directory)) return [];
  const defaults = new Map();
  for (const name of fs.readdirSync(directory).sort().reverse()) {
    const file = path.join(directory, name, "receipt.json");
    if (!fs.existsSync(file)) continue;
    let receipt;
    try { receipt = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    if (receipt.batchId !== manifest.batchId || !Array.isArray(receipt.records)) continue;
    for (const entry of manifest.entries) {
      if (defaults.has(entry.id) || entry.status === "live" && entry.imageStatus === null) continue;
      const record = receipt.records.find((r) => r.id === entry.id);
      if (!record || record.contentHash !== entry.contentHash || record.imageHash !== entry.imageHash ||
          record.status !== entry.status || record.imageStatus !== entry.imageStatus ||
          !["pending", "held", "changes_requested"].includes(record.decision) ||
          typeof record.comment !== "string" || record.comment.length > 10000 ||
          typeof record.contentReviewed !== "boolean" || typeof record.imageReviewed !== "boolean" ||
          record.decision === "changes_requested" && !record.comment.trim()) continue;
      defaults.set(entry.id, { ...entry, decision: record.decision, comment: record.comment,
        contentReviewed: record.contentReviewed, imageReviewed: Boolean(record.imageReviewed && entry.imageHash),
        updatedAt: record.updatedAt ?? receipt.appliedAt ?? null,
        historyAppliedAt: receipt.appliedAt ?? record.updatedAt ?? null });
    }
  }
  return [...defaults.values()];
}
