import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_BATCH, readJson } from "./review/review-core.mjs";
import { applyMaterialReview } from "./review/apply-material.mjs";
export { applyMaterialReview } from "./review/apply-material.mjs";

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
    const results = readJson(path.resolve(resultPath));
    const report = write
      ? await (await import("./review/register-review.mjs")).registerReview(root, batchPath, results, "material")
      : applyMaterialReview(root, batchPath, results);
    console.info(JSON.stringify(report, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
