import path from "node:path";
import { readSnapshot } from "../../tools/local-review/service.mjs";
import { commitTransaction, pendingTransactions, readAt, ReviewError } from "../../tools/local-review/files.mjs";
import { stageApplication } from "./stage-application.mjs";

// CLI and Studio share the same evaluator, transfer and recoverable transaction.
export async function registerReview(root, batchPath, results, type, { storage } = {}) {
  if (!["play", "material"].includes(type)) throw new Error("Invalid registration type");
  if (pendingTransactions(root).length) throw new ReviewError(423, "중단된 저장을 먼저 --recover로 복구해 주세요.");
  const relative = path.relative(root, path.resolve(root, batchPath)).split(path.sep).join("/");
  const batch = readAt(root, relative), snapshot = readSnapshot(root, batch.batchId);
  if (snapshot.selected.batchPath !== relative) throw new Error("검수 배치 경로가 일치하지 않습니다.");
  const { updates, summary } = await stageApplication(root, snapshot, results, { type }, storage);
  if (!updates.size) return { ...summary, wrote: false, transactionId: null };
  const transactionId = commitTransaction(root, updates, snapshot.files);
  return { ...summary, wrote: updates.size > 0, transactionId };
}
