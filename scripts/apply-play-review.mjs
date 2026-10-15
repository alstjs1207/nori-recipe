import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyApproval, DEFAULT_BATCH, readJson } from "./review/review-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  const args = process.argv.slice(2);
  let resultsPath, batchPath = DEFAULT_BATCH, write = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--write") write = true;
    else if (args[i] === "--batch") {
      batchPath = args[++i];
      if (!batchPath) throw new Error("--batch 다음에 파일 경로가 필요합니다.");
    } else if (args[i] === "--dry-run") write = false;
    else if (args[i].startsWith("-") || resultsPath) throw new Error("알 수 없는 인자: " + args[i]);
    else resultsPath = args[i];
  }
  if (!resultsPath) throw new Error("사용법: pnpm review:apply 검수결과.json [--write] [--batch 배치.json]\n기본값은 변경하지 않는 dry-run입니다.");
  const batch = readJson(path.resolve(root, batchPath));
  const results = readJson(path.resolve(resultsPath));
  console.info(JSON.stringify(applyApproval(root, batch, results, { write }), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
