import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256, createManifest, DEFAULT_BATCH } from "./review/review-core.mjs";
import { buildReview } from "./build-play-review.mjs";
import { buildCatalog } from "./build-play-catalog.mjs";
import { validatePlayBundle } from "./validate-play-content.mjs";
import { requirePreparedImages } from "./prepare-review-images.mjs";
import { requireMaterialImages } from "./prepare-material-images.mjs";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function prepareReview(root = project, { batchPath, ids, sourcePath, title, batchId } = {}) {
  const bundle = readJson(path.join(root, "data/plays.json"));
  const registry = readJson(path.join(root, "data/materials.json"));
  const validation = validatePlayBundle(bundle, registry);
  if (validation.errors.length) throw new Error("놀이 데이터 검증 실패:\n" + JSON.stringify(validation.errors, null, 2));
  if (batchPath && (ids || sourcePath || title || batchId)) throw new Error("--batch는 새 배치 옵션과 함께 사용할 수 없습니다.");
  let batch, file, reused = false;
  if (batchPath) {
    file = path.resolve(root, batchPath);
    batch = readJson(file);
    reused = true;
  } else {
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some((id) => !/^play_\d{3,}$/.test(id))) {
      throw new Error("--ids에 이번에 임포트한 놀이 ID를 중복 없이 지정하세요.");
    }
    const plays = ids.map((id) => {
      const play = bundle.plays.find((p) => p.id === id);
      if (!play) throw new Error("등록된 초안을 찾을 수 없습니다: " + id);
      return play;
    });
    const sourceFile = sourcePath ? path.resolve(root, sourcePath) : null;
    const source = sourceFile ? readJson(sourceFile) : {};
    const relativeSource = sourceFile ? path.relative(root, sourceFile).split(path.sep).join("/") : null;
    const key = batchId ?? "collection-" + sha256(JSON.stringify({ ids: [...ids].sort(), source: relativeSource })).slice(0, 12);
    if (!/^[a-z0-9-]+$/.test(key)) throw new Error("배치 ID는 영문 소문자·숫자·하이픈으로 작성하세요.");
    file = path.join(root, "data/review-batches", key + ".json");
    if (fs.existsSync(file)) {
      batch = readJson(file);
      if (JSON.stringify([...batch.playIds].sort()) !== JSON.stringify([...ids].sort()) || (batch.sourceFile ?? null) !== relativeSource) {
        throw new Error("같은 배치 ID의 대상이 다릅니다. 기존 배치를 보존하고 다른 ID를 사용하세요.");
      }
      reused = true;
    } else {
      requirePreparedImages(root, ids);
      requireMaterialImages(root, ids);
      const used = new Set(plays.flatMap((p) => [...p.materials.required, ...p.materials.optional]));
      const proposals = source.meta?.materialProposals ?? source.meta?.normalization?.materialProposals ?? [];
      if (!Array.isArray(proposals)) throw new Error("meta.materialProposals는 배열이어야 합니다.");
      const proposalSlugs = new Set([...registry.reviewPending.filter((s) => used.has(s)), ...proposals.filter((p) => used.has(p.slug)).map((p) => p.slug)]);
      const materialProposals = [...proposalSlugs].map((slug) => {
        if (!registry.displayNames[slug]) throw new Error("신규 재료의 임시 정의를 먼저 준비하세요: " + slug);
        const detail = proposals.find((p) => p.slug === slug) ?? {};
        return {
          slug, originalNames: detail.originalNames ?? [registry.displayNames[slug]],
          usages: plays.filter((p) => [...p.materials.required, ...p.materials.optional].includes(slug)).map((p) => ({
            id: p.id, name: p.name, role: p.materials.required.includes(slug) ? "required" : "optional",
          })),
          similar: (detail.similar ?? []).filter((s) => s !== slug && registry.displayNames[s] && !registry.reviewPending.includes(s)),
          purpose: detail.purpose ?? "이번 놀이의 실제 준비물입니다. 본문에서 쓰임을 확인해 주세요.",
          reason: detail.reason ?? "기존 분류와 용도·형태를 비교한 뒤 신규 추가·대체·보류를 선택해 주세요.",
        };
      });
      batch = { schemaVersion: 1, materialImagesRequired: true, batchId: key, title: title ?? "수집 놀이 " + ids.length + "개 검수",
        playIds: ids, sourceFile: relativeSource, entries: plays.map((p) => {
          const review = (source.meta?.activityReviews ?? []).find((r) => r.id === p.id || r.name === p.name || r.source?.url && r.source.url === p.source.url);
          return { id: p.id, ...(review?.ageBasis ? { ageBasis: review.ageBasis } : {}),
            ...(review?.normalizationNotes ? { normalizationNotes: review.normalizationNotes } : {}) };
        }), materialProposals, appliedMaterialDecisions: {} };
    }
  }
  createManifest(root, batch, bundle, registry);
  const relativeBatch = path.relative(root, file).split(path.sep).join("/");
  batch.reviewOutput ??= relativeBatch === DEFAULT_BATCH ? "results/play-image-audit.html" : "results/reviews/" + batch.batchId + ".html";
  const reviewOutput = path.resolve(root, batch.reviewOutput);
  if (!reviewOutput.startsWith(path.join(root, "results") + path.sep) || path.extname(reviewOutput) !== ".html") {
    throw new Error("검수 화면은 프로젝트 results/ 안의 HTML 파일로 저장하세요.");
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = JSON.stringify(batch, null, 2) + "\n";
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) fs.writeFileSync(file, text);
  const review = buildReview(root, relativeBatch, batch.reviewOutput);
  const catalog = buildCatalog(root);
  return { batchId: batch.batchId, batchPath: file, reused, review: review.output, imagesReady: review.imagesReady,
    count: review.count, catalog: catalog.output, approvalCommand: "pnpm review:apply 결과.json --batch " + relativeBatch,
    materialCommand: "pnpm review:materials 결과.json --batch " + relativeBatch };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const options = {}, args = process.argv.slice(2);
    const flags = { "--batch": "batchPath", "--source": "sourcePath", "--title": "title", "--batch-id": "batchId" };
    for (let i = 0; i < args.length; i++) {
      const flag = args[i], value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(flag + " 다음에 값이 필요합니다.");
      if (flag === "--ids") options.ids = value.split(",").map((id) => id.trim());
      else if (flags[flag]) options[flags[flag]] = value;
      else throw new Error("알 수 없는 옵션: " + flag);
    }
    if (!args.length) throw new Error("사용법: pnpm review:prepare --ids play_218,play_219 [--source 정규화.json] [--title 제목]\n기존 배치 갱신: pnpm review:prepare --batch 배치.json");
    console.info(JSON.stringify(prepareReview(project, options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
