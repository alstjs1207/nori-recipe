import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256, DEFAULT_BATCH } from "./review/review-core.mjs";
import { sidebar, topbar, icon, backofficeCss } from "./review/backoffice-html.mjs";
import { materialImageInfo } from "./review/material-images.mjs";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const list = (values = [], ordered = false) => `<${ordered ? "ol" : "ul"}>${values.map((v) => `<li>${esc(v)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;
const states = { live: "등록", draft: "초안", archived: "보관" };
const areas = { fine_motor: "소근육", gross_motor: "대근육", cognitive: "인지", language: "언어", emotional: "정서", social: "사회성", sensory: "감각" };

export function buildCatalog(root = project, outputPath = "results/play-catalog.html", { write = true, serverUrls = false, initialView = "plays" } = {}) {
  const bundle = readJson(path.join(root, "data/plays.json"));
  const registry = readJson(path.join(root, "data/materials.json"));
  const output = path.resolve(root, outputPath);
  const relative = (file) => (serverUrls ? "/" : "") + path.relative(serverUrls ? root : path.dirname(output), file).split(path.sep).join("/");
  const asset = (file) => fs.existsSync(file) ? relative(file) + "?v=" + sha256(fs.readFileSync(file)).slice(0, 12) : null;
  const batchDir = path.join(root, "data/review-batches");
  const warnings = [], batches = [], sourceBatches = [];
  if (fs.existsSync(batchDir)) for (const file of fs.readdirSync(batchDir).filter((f) => f.endsWith(".json"))) {
    try {
      const batch = readJson(path.join(batchDir, file));
      if (!Array.isArray(batch.playIds) || !/^[a-z0-9-]+$/.test(batch.batchId ?? "")) throw new Error("배치 형식 확인 필요");
      sourceBatches.push(batch);
      const reviewFile = batch.reviewOutput ?? (path.join(batchDir, file) === path.join(root, DEFAULT_BATCH) ? "results/play-image-audit.html" : `results/reviews/${batch.batchId}.html`);
      const registered = batch.playIds.filter((id) => bundle.plays.some((p) => p.id === id && p.status === "live" && p.imageStatus !== "review")).length;
      batches.push({ title: batch.title, count: batch.playIds.length, registered, file: serverUrls ? "/reviews/" + encodeURIComponent(batch.batchId) : relative(path.resolve(root, reviewFile)), ready: !write || fs.existsSync(path.resolve(root, reviewFile)) });
    } catch (error) { warnings.push(file + ": " + error.message); }
  }
  const unapproved = new Set(registry.reviewPending ?? []);
  const usedMaterials = new Set(bundle.plays.flatMap((p) => [...p.materials.required, ...p.materials.optional]));
  const replaced = new Map();
  for (const batch of sourceBatches) for (const [slug, decision] of Object.entries(batch.appliedMaterialDecisions ?? {})) {
    if (unapproved.has(slug) && !usedMaterials.has(slug) && decision.decision === "replace" && decision.confirmed &&
        registry.displayNames[decision.replacementSlug] && !unapproved.has(decision.replacementSlug)) replaced.set(slug, decision.replacementSlug);
  }
  const pending = new Set([...unapproved].filter((slug) => !replaced.has(slug)));
  const materialNames = (slugs) => slugs.map((s) => registry.displayNames[s] ?? s).join(" · ") || "없음";
  const materialImages = {};
  for (const slug of Object.keys(registry.displayNames)) {
    const image = materialImageInfo(root, slug);
    if (image.hash) materialImages[slug] = asset(path.join(root, image.path));
  }
  const picture = (src, alt, className = "") => src
    ? `<img class="${className}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`
    : `<span class="missing ${className}">이미지 준비 중</span>`;
  const cards = bundle.plays.map((p) => {
    const src = asset(path.join(root, "images/plays", p.id + ".jpeg"));
    const slugs = [...p.materials.required, ...p.materials.optional];
    const search = [p.id, p.name, materialNames(slugs), ...p.tags, ...p.steps].join(" ").toLocaleLowerCase();
    const href = p.source.url && /^https?:\/\//.test(p.source.url) ? p.source.url : null;
    return `<details class="play" id="${esc(p.id)}" data-status="${esc(p.status)}" data-age-min="${p.ageMin}" data-age-max="${p.ageMax}" data-areas="${esc(p.devAreas.join(","))}" data-search="${esc(search)}"><summary>${picture(src, p.name, "thumb")}<span class="summary-text"><b>${esc(p.name)}</b><small>${esc(p.id)} · ${p.ageMin}~${p.ageMax}개월</small></span><span class="age-cell">${p.ageMin}~${p.ageMax}개월</span><span class="area-cell">${p.devAreas.map((a) => `<span class="area-tag">${areas[a]}</span>`).join("")}</span><span class="time-cell">${p.durationMin}~${p.durationMax}분</span><span class="badge ${esc(p.status)}">${states[p.status]}</span>${icon("chevron", "row-chevron")}</summary><div class="play-body"><div>${picture(src, p.name, "detail-image")}</div><div class="play-detail-copy"><div class="play-facts"><span>${p.place === "indoor" ? "실내" : p.place === "outdoor" ? "실외" : "실내·실외"}</span><span>준비 ${p.prepTime}분</span><span>난이도 ${p.difficulty}</span></div><h3>필수 준비물</h3><p>${esc(materialNames(p.materials.required))}</p><h3>선택 준비물</h3><p>${esc(materialNames(p.materials.optional))}</p>${p.preparationNotes?.length ? "<h3>시작 전 준비</h3>" + list(p.preparationNotes) : ""}<h3>놀이 순서</h3>${list(p.steps, true)}<h3>주의사항</h3>${list(p.safetyNotes)}${p.tip ? "<h3>놀이 팁</h3><p>" + esc(p.tip) + "</p>" : ""}<h3>경험하는 활동</h3>${list(p.educationalEffects)}<p class="muted">${esc(p.tags.join(" · "))}${p.createdAt ? " · 최초 등록 " + esc(p.createdAt) : ""}</p>${p.imageStatus === "review" ? '<p class="review-note">대표 이미지 검수 대기</p>' : ""}${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>` : ""}</div></div></details>`;
  }).join("\n");
  const materialCards = Object.entries(registry.displayNames).map(([slug, name]) => {
    const category = Object.keys(registry.categories).find((c) => registry.categories[c].includes(slug));
    const uses = bundle.plays.filter((p) => [...p.materials.required, ...p.materials.optional].includes(slug));
    const state = replaced.has(slug) ? "replaced" : pending.has(slug) ? "pending" : "registered";
    const label = { replaced: "대체 완료", pending: "검수 대기", registered: "등록" }[state];
    return `<article class="material" id="material-${esc(slug)}" data-state="${state}" data-search="${esc([name, slug, category].join(" ").toLocaleLowerCase())}">${picture(materialImages[slug], name, "material-image")}<small>${esc(category)} · ${esc(slug)}</small><h3>${esc(name)}</h3><span class="badge ${state === "pending" ? "draft" : state === "replaced" ? "archived" : "live"}">${label}</span>${state === "replaced" ? `<p class="muted">대체 재료: ${esc(registry.displayNames[replaced.get(slug)])}</p>` : ""}<details><summary>사용 놀이 ${uses.length}개</summary>${uses.map((p) => `<a class="play-link" href="${serverUrls ? "/catalog" : ""}#${esc(p.id)}" data-id="${esc(p.id)}">${esc(p.name)} <small>${states[p.status]}</small></a>`).join("") || '<p class="muted">사용 중인 놀이가 없습니다.</p>'}</details></article>`;
  }).join("\n");
  const counts = Object.fromEntries(Object.keys(states).map((status) => [status, bundle.plays.filter((p) => p.status === status).length]));
  const css = backofficeCss() + fs.readFileSync(new URL("./review/catalog.css", import.meta.url), "utf8");
  const client = fs.readFileSync(new URL("./review/catalog-client.js", import.meta.url), "utf8");
  const materialCount = Object.keys(registry.displayNames).length;
  const unresolved = batches.reduce((sum, b) => sum + b.count - b.registered, 0);
  const initialTitle = { plays: "놀이·재료 현황", materials: "재료 라이브러리", reviews: "수집 건별 검수" }[initialView];
  const stat = (label, count, hint, glyph, tone, attribute) => `<button type="button" class="stat-card ${tone}" ${attribute} aria-pressed="false"><span>${label}</span><i class="stat-icon">${icon(glyph)}</i><strong>${count}</strong><small>${hint}</small></button>`;
  const collections = `<details class="batch-list" id="review-batches" hidden><summary>${icon("review")}<strong>수집 건별 검수<small>${batches.length}건</small></strong><span class="batch-state">${unresolved ? unresolved + "개 항목 검수 중" : "모든 검수 완료"}</span>${icon("chevron", "batch-chevron")}</summary><div class="batch-rows">${batches.map((b) => `<div class="batch-row"><div class="batch-row-title">${b.ready ? `<a href="${esc(b.file)}">${esc(b.title)}</a>` : esc(b.title) + " · 검수 화면 생성 전"}<small>등록 ${b.registered} / 전체 ${b.count}개</small></div><div class="batch-progress"><small>${b.registered} / ${b.count} 등록 완료</small><div class="progress-track"><span style="width:${b.count ? Math.round(b.registered / b.count * 100) : 0}%"></span></div></div>${b.ready ? `<a class="batch-open" href="${esc(b.file)}">검수 ${b.registered < b.count ? "이어하기" : "확인하기"}${icon("arrow")}</a>` : ""}</div>`).join("") || '<p class="muted">아직 생성한 검수 화면이 없습니다.</p>'}${warnings.map((w) => `<p class="review-note">${esc(w)}</p>`).join("")}</div></details>`;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(initialTitle)} · nori studio</title><style>${css}</style></head><body class="admin-page catalog-page" data-server-urls="${serverUrls}" data-catalog-view="${esc(initialView)}">${sidebar({ page: "catalog", catalogLink: serverUrls ? "/catalog" : relative(output), serverUrls, initialView, plays: bundle.plays.length, materials: materialCount, batches: batches.length })}<div class="admin-workspace">${topbar(initialView === "plays" ? "놀이 라이브러리" : initialTitle)}
    <header class="page-header"><div class="page-title-row"><div><p class="eyebrow">CONTENT LIBRARY</p><h1 id="page-title">놀이·재료 현황</h1><p class="subtitle" id="page-description">좋은 놀이를 모으고, 살펴보고, 차곡차곡 관리하세요.</p></div><div class="page-actions" data-refresh-slot><div class="page-meta"><span class="updated-label">데이터 기준 ${esc(bundle.updatedAt)}</span><span class="save-status" id="save-status" role="status">로컬 콘텐츠</span></div></div></div>
    <section class="stat-grid" aria-label="콘텐츠 현황">${stat("전체 놀이", bundle.plays.length, "개의 콘텐츠", "library", "", 'data-catalog-status="all"')}${stat("등록된 놀이", counts.live, "개 등록 완료", "check", "green", 'data-catalog-status="live"')}${stat("초안·검수 대기", counts.draft, "개 검수 중", "review", "amber", 'data-catalog-status="draft"')}${stat("재료 검수 대기", pending.size, "개 / 전체 " + materialCount + "개", "materials", "violet", 'data-catalog-material="pending"')}</section><div id="notice" class="notice" role="status" aria-live="polite"></div></header>
    <main class="page-main">${collections}<section class="library-panel" id="library-panel"><div class="library-heading"><div><h2 id="library-title">놀이 라이브러리</h2><p id="count" role="status"></p></div><span class="library-tip">항목을 눌러 자세히 살펴보세요</span></div>
    <div class="toolbar catalog-toolbar"><label class="search-field">${icon("search")}<input id="q" type="search" aria-label="목록 검색" placeholder="놀이명, 준비물, ID로 검색"></label><select id="status" aria-label="놀이 등록 상태"><option value="live">등록 ${counts.live}</option><option value="draft">초안 ${counts.draft}</option><option value="archived">보관 ${counts.archived}</option><option value="all">전체 ${bundle.plays.length}</option></select><select id="age" aria-label="월령"><option value="">전체 월령</option>${Array.from({ length: 49 }, (_, i) => `<option value="${i}">${i}개월</option>`).join("")}</select><select id="area" aria-label="발달영역"><option value="">전체 발달영역</option>${Object.entries(areas).map(([v, label]) => `<option value="${v}">${label}</option>`).join("")}</select><select id="material-state" aria-label="재료 등록 상태" hidden><option value="registered">등록 재료</option><option value="pending">검수 대기 재료</option><option value="replaced">대체 완료 재료</option><option value="all">전체 재료</option></select><button class="reset-button" id="reset">초기화</button></div>
    <section id="plays-panel"><div class="list-columns" aria-hidden="true"><span>놀이 정보</span><span>대상 월령</span><span class="area-column">발달 영역</span><span class="time-column">놀이 시간</span><span>상태</span><span></span></div><section id="play-list" class="plays" aria-label="현재 놀이 목록">${cards}</section></section><section id="materials-panel" hidden><section id="material-list" class="materials" aria-label="현재 재료 목록">${materialCards}</section></section><p id="empty" hidden>조건에 맞는 항목이 없습니다. 검색어나 필터를 바꿔 보세요.</p></section><footer>놀이 레시피 콘텐츠 스튜디오 · 새로 수집한 놀이는 수집 건별 검수에서 확인하세요.</footer></main></div><script>${client}</script></body></html>`;
  if (write) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, html);
  }
  return { output, plays: bundle.plays.length, statuses: counts, materials: Object.keys(registry.displayNames).length, pendingMaterials: pending.size, batches: batches.length, warnings,
    ...(!write ? { html } : {}) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== "--output")) throw new Error("사용법: pnpm catalog:build [--output 현황.html]");
    console.info(JSON.stringify(buildCatalog(project, args[1]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
