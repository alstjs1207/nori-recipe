import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createManifest, DEFAULT_BATCH, imageInfo, readJson, sha256 } from "./review/review-core.mjs";
import { renderMaterialReview } from "./review/material-review-html.mjs";
import { reviewDefaults } from "./review/review-history.mjs";
import { sidebar, topbar, icon, backofficeCss } from "./review/backoffice-html.mjs";
import { materialImageInfo } from "./review/material-images.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const list = (values, ordered = false) => "<" + (ordered ? "ol" : "ul") + ">" +
  values.map((value) => "<li>" + esc(value) + "</li>").join("") + "</" + (ordered ? "ol" : "ul") + ">";

export function buildReview(root, batchPath = DEFAULT_BATCH, outputPath = "results/play-image-audit.html", { write = true, serverUrls = false } = {}) {
  const batch = readJson(path.resolve(root, batchPath));
  const bundle = readJson(path.join(root, "data/plays.json"));
  const registry = readJson(path.join(root, "data/materials.json"));
  const manifest = createManifest(root, batch, bundle, registry);
  const output = path.resolve(root, outputPath);
  const relative = (file) => (serverUrls ? "/" : "") + path.relative(serverUrls ? root : path.dirname(output), file).split(path.sep).join("/");
  const catalogLink = serverUrls ? "/catalog" : relative(path.join(root, "results/play-catalog.html"));
  const batchArgument = esc(path.relative(root, path.resolve(root, batchPath)).split(path.sep).join("/"));
  const prepareCommand = "pnpm review:prepare --batch " + batchArgument;
  const applyCommand = "pnpm review:apply /path/to/검수결과.json --batch " + batchArgument;
  const materialsCommand = "pnpm review:materials /path/to/검수결과.json --batch " + batchArgument;
  const materialImages = {};
  for (const { slug } of [...manifest.materialEntries, ...manifest.existingMaterials]) {
    const image = materialImageInfo(root, slug);
    if (image.hash) materialImages[slug] = relative(path.join(root, image.path)) + "?v=" + image.hash.slice(0, 12);
  }
  const materials = (slugs) => slugs.length ? slugs.map((slug) => esc(registry.displayNames[slug]) +
    '<span class="material-slug">(' + esc(slug) + ")</span>").join(" · ") : "없음";
  const cards = batch.playIds.map((id) => {
    const p = bundle.plays.find((item) => item.id === id);
    const extra = batch.entries?.find((item) => item.id === id) ?? {};
    const image = imageInfo(root, id);
    const review = manifest.entries.find((entry) => entry.id === id);
    const blocked = review.unapprovedMaterials.length > 0 || review.replacementReviewRequired;
    const registered = p.status === "live" && p.imageStatus !== "review";
    const imageUrl = relative(path.join(root, image.path));
    const picture = image.hash
      ? '<img class="representative-image" src="' + esc(imageUrl) + "?v=" + image.hash.slice(0, 12) + '" alt="' + esc(p.name) + ' 대표 이미지">'
      : '<div class="image-placeholder" role="img" aria-label="대표 이미지 생성 대기"><span class="placeholder-symbol">□</span><span>대표 이미지 생성 대기</span></div>';
    const sourceUrl = p.source.url && /^https?:\/\//.test(p.source.url) ? p.source.url : null;
    return '<article class="card" id="' + id + '" data-registered="' + registered + '" data-decision="pending" data-search="' +
      esc([id, p.name, extra.origin ?? "", ...p.materials.required.map((s) => registry.displayNames[s]), ...p.tags].join(" ").toLocaleLowerCase()) + '">' +
      '<div class="card-top"><div><div class="id-line">' + [id, extra.origin, p.ageMin + "~" + p.ageMax + "개월", p.status].filter(Boolean).map(esc).join(" · ") +
      '</div><h2>' + esc(p.name) + '</h2></div><span class="decision-label">' + (registered ? "등록 완료" : "미검수") + '</span></div>' +
      '<div class="review-copy"><div class="media">' + picture + '<div class="facts"><p class="image-state">' +
      (registered ? "등록된 대표 이미지" : image.hash ? "대표 이미지 검수 대기" : "대표 이미지 미생성") + "</p><p>놀이 " + p.durationMin + "~" + p.durationMax +
      "분 · 준비 " + p.prepTime + '분</p><p>난이도 ' + p.difficulty + " · " + esc(p.place === "indoor" ? "실내" : p.place === "outdoor" ? "실외" : "실내·실외") +
      "</p>" + (extra.views ? "<p>원문 조회 " + esc(extra.views) + "</p>" : "") +
      (sourceUrl ? '<p><a href="' + esc(sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + (p.source.type === "instagram" ? "인스타 원문 보기 ↗" : "원문 보기 ↗") + "</a></p>" : "") + "</div></div>" +
      '<div class="body"><h3>필수 준비물</h3><p>' + materials(p.materials.required) +
      "</p><h3>선택 준비물</h3><p>" + materials(p.materials.optional) +
      "</p>" + (p.preparationNotes?.length ? "<h3>시작 전 준비 조건</h3>" + list(p.preparationNotes) : "") +
      (blocked ? '<p class="material-review-warning">' + (review.unapprovedMaterials.length
        ? "재료 검수 대기: " + review.unapprovedMaterials.map((slug) => esc(registry.displayNames[slug])).join(" · ") + " — 재료 검수 화면에서 먼저 결정해 주세요."
        : "재료 대체가 반영되었습니다. 방법·준비 조건·주의사항을 수정하고 이미지를 다시 검수해야 승인할 수 있습니다.") + "</p>" : "") +
      "<details open><summary>놀이 순서</summary>" + list(p.steps, true) +
      "</details><details open><summary>주의사항</summary>" + list(p.safetyNotes) +
      "</details><details><summary>팁·효과·검토 근거</summary>" + (p.tip ? "<p>" + esc(p.tip) + "</p>" : "") +
      list(p.educationalEffects) + (extra.ageBasis ? "<p><b>대상 월령 근거</b> " + esc(extra.ageBasis) + "</p>" : "") +
      (extra.normalizationNotes?.length ? list(extra.normalizationNotes) : "") + "</details></div></div>" +
      (registered ? '<p class="registered-note">' + icon("check") + '<span>등록이 완료된 놀이입니다.<br>다시 승인하지 않아도 됩니다.</span></p>' : "") +
      '<div class="review-controls"' + (registered ? " hidden" : "") + '><p class="control-title">검수 체크리스트</p><div class="checks"><label><input type="checkbox" data-field="contentReviewed">본문·재료·주의사항 확인</label>' +
      '<label><input type="checkbox" data-field="imageReviewed"' + (!image.hash ? " disabled" : "") + ">대표 이미지 확인" +
      (!image.hash ? " (생성 대기)" : "") + '</label></div><label class="opinion-label" for="opinion-' + id +
      '">검수 의견</label><textarea id="opinion-' + id + '" maxlength="10000" placeholder="수정할 부분이나 보류 이유를 남겨 주세요."></textarea>' +
      '<div class="actions"><button type="button" data-decision="approved"' + (!image.hash || blocked ? " disabled" : "") +
      '>승인</button><button type="button" data-decision="changes_requested">수정 요청</button><button type="button" data-decision="held">보류</button>' +
      '<button type="button" class="reset" data-decision="pending">미검수로 되돌리기</button></div><p class="control-note">내용과 실제 이미지를 모두 확인한 뒤 승인해 주세요. 보류한 항목은 초안으로 유지됩니다.</p></div></article>';
  }).join("\n");
  const css = backofficeCss() + fs.readFileSync(path.join(root, "scripts/review/review.css"), "utf8");
  const client = fs.readFileSync(path.join(root, "scripts/review/review-client.js"), "utf8");
  const materialClient = fs.readFileSync(path.join(root, "scripts/review/material-review-client.js"), "utf8");
  const json = JSON.stringify({ manifest, initialRecords: reviewDefaults(root, manifest) }).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  const registeredCount = manifest.entries.filter((entry) => entry.status === "live" && entry.imageStatus === null).length;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(batch.title)} · nori studio</title><style>${css}</style></head>
    <body class="admin-page review-page">${sidebar({ page: "review", catalogLink, serverUrls, registered: registeredCount, total: batch.playIds.length })}<div class="admin-workspace">${topbar("수집 건별 검수")}
    <header class="page-header" id="review-header"><div class="page-title-row"><div><p class="eyebrow">REVIEW WORKSPACE</p><div class="heading-row"><h1>${esc(batch.title)}</h1><span class="visible-count" id="visible-count"></span></div></div><div class="page-actions" data-refresh-slot><label class="file-button" for="import">${icon("upload")}결과 가져오기</label><input id="import" type="file" accept=".json,application/json"><button class="primary" id="export" aria-label="검수 결과 JSON 내보내기">${icon("download")}JSON 내보내기</button>${serverUrls ? `<button id="codex-request" class="codex-request" type="button" disabled aria-describedby="codex-request-status" title="이 수집 건의 검수 결과를 저장하고 새 Codex 채팅을 만들어 요청합니다.">${icon("review")}<span>Codex에 검수 요청</span></button>` : ""}</div></div>
    ${serverUrls ? '<p id="codex-request-status" class="codex-request-status" role="status" aria-live="polite"></p>' : ""}
    <p class="subtitle"><a href="${esc(catalogLink)}">전체 놀이·재료 현황</a> · 놀이·재료 검수 상태와 의견은 이 브라우저에 자동 저장됩니다.</p>
    <div class="review-tabs-row"><nav class="review-tabs" role="tablist" aria-label="검수 화면"><button id="plays-tab" role="tab" aria-selected="true" aria-controls="plays-panel">놀이 검수 <span>${batch.playIds.length}</span></button><button id="materials-tab" role="tab" aria-selected="false" aria-controls="materials-panel">재료 검수 <span>${manifest.materialEntries.length}</span></button></nav><span id="save-status" class="save-status" role="status">저장 대기</span></div>
    <div class="counters"><span><b data-registered-count>0</b>등록 완료</span><span><b data-count="pending">0</b>미검수</span><span><b data-count="approved">0</b>승인 선택</span><span><b data-count="changes_requested">0</b>수정 요청</span><span><b data-count="held">0</b>보류</span></div><div id="notice" class="notice" role="status" aria-live="polite"></div></header>
    <main class="page-main"><div class="toolbar play-filter-toolbar"><label class="search-field">${icon("search")}<input type="search" id="q" aria-label="놀이 검색" placeholder="ID, 놀이명, 재료, 태그 검색"></label><select id="filter" aria-label="검수 상태 필터"><option value="all">전체 상태</option><option value="pending">미검수</option><option value="approved">승인 선택</option><option value="changes_requested">수정 요청</option><option value="held">보류</option><option value="registered">등록 완료</option></select><button class="reset-button" id="clear-search">검색 초기화</button></div>
    <section id="plays-panel" class="review-panel" role="tabpanel" aria-labelledby="plays-tab"><div class="hint">${icon("info")}<div><p>재료·내용·대표 이미지를 모두 확인한 항목만 승인할 수 있습니다. 수정 요청에는 의견을 남겨 주세요.</p><p>내보낸 결과는 승인된 항목만 반영하며, 수정 요청·보류·미검수 항목은 현재 등록 상태를 유지합니다.</p>${batch.metricNotes ? `<details class="review-context"><summary>수집 메모 보기</summary><p>${esc(batch.metricNotes)}</p></details>` : ""}</div></div>
    <section class="grid" id="grid" aria-label="놀이 검수 목록">${cards}</section><p id="empty" hidden>조건에 맞는 놀이가 없습니다. 검색어나 필터를 바꿔 보세요.</p></section>
    ${renderMaterialReview(manifest, materialImages)}<a href="#review-header" class="review-menu-link">검수 메뉴 ↑</a>
    <footer><details><summary>파일 검수와 CLI 반영 방법</summary><p>이미지 추가나 내용 수정 후 <code>${prepareCommand}</code>로 화면을 다시 생성하세요. 변경된 항목은 다시 검수해야 합니다.</p><p><code>${applyCommand}</code>으로 반영할 승인 항목을 확인하고, <code>--write</code>를 붙여 적용합니다. 배포는 실행하지 않습니다.</p><p>재료는 먼저 <code>${materialsCommand}</code>으로 확인하고 <code>--write</code>로 반영합니다. 이후 <code>${prepareCommand}</code>로 화면을 다시 생성하고 놀이를 검수합니다.</p><p>브라우저 기록은 같은 브라우저·파일 위치에서 유지됩니다. 다른 기기에서 이어갈 때는 내보내기와 가져오기를 사용하세요.</p></details></footer></main></div>
    <script type="application/json" id="review-data">${json}</script><script>${materialClient}</script><script>${client}</script></body></html>`;
  if (write) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, html);
  }
  return { output, count: batch.playIds.length, imagesReady: manifest.entries.filter((p) => p.imageHash).length, batchHash: manifest.batchHash,
    ...(!write ? { html } : {}) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2);
    let batchPath = DEFAULT_BATCH, outputPath = "results/play-image-audit.html";
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--batch" && args[i + 1]) batchPath = args[++i];
      else if (args[i] === "--output" && args[i + 1]) outputPath = args[++i];
      else throw new Error("사용법: pnpm review:build [--batch 배치.json] [--output 검수.html]");
    }
    console.info(JSON.stringify(buildReview(root, batchPath, outputPath), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
