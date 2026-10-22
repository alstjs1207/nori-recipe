import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { sidebar, topbar, backofficeCss } from "../../scripts/review/backoffice-html.mjs";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
// tsx is a declared development dependency; use its compiler rather than a pnpm layout.
const { buildSync } = require(require.resolve("esbuild", { paths: [require.resolve("tsx/package.json")] }));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeJson = (v) => JSON.stringify(v).replace(/[<>&\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
let compiled;
const digest = (files) => {
  const hash = crypto.createHash("sha256");
  for (const file of [...files].sort()) hash.update(file).update(fs.readFileSync(path.resolve(project, file)));
  return hash.digest("hex");
};
function clientBundle() {
  if (compiled && digest(compiled.files) === compiled.hash) return compiled;
  const result = buildSync({ absWorkingDir: project, entryPoints: ["tools/local-review/recommendation-client.ts"],
    bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", metafile: true,
    tsconfig: path.join(project, "tsconfig.json"), logLevel: "silent" });
  const files = Object.keys(result.metafile.inputs);
  compiled = { code: result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"), files, hash: digest(files) };
  return compiled;
}

export function buildRecommendations(root, snapshot) {
  const bundle = clientBundle();
  const payload = { plays: snapshot.bundle.plays, registry: snapshot.registry, revision: snapshot.revision,
    engineHash: bundle.hash, sourceFiles: bundle.files, generatedAt: new Date().toISOString(),
    imageIds: snapshot.bundle.plays.filter((p) => fs.existsSync(path.join(root, "images/plays", p.id + ".jpeg"))).map((p) => p.id) };
  const rules = fs.readFileSync(path.join(project, "HOME_RECOMMENDATION_RULES.md"), "utf8");
  const flow = `<div class="flow-input"><span class="step">INPUT</span><b>월령 · 보유/제외 재료 · 장소 · 시간</b><small>현재 로컬 콘텐츠 전체 + 사용자 발달·피드백·완료 이력</small></div>
    <div class="flow-fork" aria-hidden="true">↙ 기본 추천 경로 <span>활동 의도 보완 경로 ↘</span></div>
    <div class="flow-lanes"><div class="flow-lane">
      <div class="flow-node"><span class="step">01 · HARD FILTER</span><b>공개 · 현재 월령 · 장소 · 제외 재료</b><p>시간 1.3배까지 통과. 시간만 초과한 후보는 보충 단계에 전달.</p><small id="flow-filter"></small></div><div class="flow-arrow" aria-hidden="true">↓</div>
      <div class="flow-node"><span class="step">02 · FALLBACK</span><b>준비 완료 후보를 먼저 확보</b><p>엄격한 시간 안에 관련·준비 완료 후보가 3개면 그 풀을 우선. 그 외에는 전체 엄격 후보를 유지하고, 이 전체 후보도 3개 미만일 때만 시간을 1.5배까지 완화.</p><small id="flow-pool"></small></div><div class="flow-arrow" aria-hidden="true">↓</div>
      <div class="flow-node"><span class="step">03 · RANK & DIVERSITY</span><b>재료 적합도 → 최근 완료 → 점수 → 다양성</b><p>같은 재료·최근 완료 우선순위 안에서 다양성 조정. 기본 최대 3개를 선정.</p></div>
    </div><div class="flow-lane intent-lane">
      <div class="flow-node"><span class="step">A · INFER INTENT</span><b>명확한 재료 조합에서만 활동 추정</b><p>자르기·풀·테이프·물감. 모호한 조합은 의도 보완을 건너뛰고 기본 추천 유지.</p><small id="flow-intent"></small></div><div class="flow-arrow" aria-hidden="true">↓</div>
      <div class="flow-node"><span class="step">B · CURRENT AGE FIRST</span><b>현재 월령의 준비 완료 의도 놀이 우선</b><p>아이가 실제로 하는 활동이 검수된 놀이만 인정. 보호자 준비 도구만으로 의도를 붙이지 않음.</p><small id="flow-current"></small></div><div class="flow-arrow" aria-hidden="true">↓</div>
      <div class="flow-node"><span class="step">C · REVIEWED EXCEPTION</span><b>부족할 때 검수한 상위 월령 최대 1개</b><p>아이보다 최대 3개월 높은 시작 월령 · 검수 최소 월령 충족 · 필수 재료 전부 보유 · 준비 조건 확인. 장소·시간·제외 재료 제약 유지.</p><small id="flow-future"></small></div>
    </div></div><div class="flow-arrow" aria-hidden="true">↘ &nbsp; 합류 &nbsp; ↙</div>
    <div class="flow-output"><span class="step">OUTPUT</span><b>현재 의도 놀이 → 허용된 상위 놀이 1개 → 기본 후보로 최대 3개</b><p>대표 카드는 준비 완료된 현재 의도 놀이, 상위 의도 놀이, 그 외 순서. 관련 후보가 부족하면 무재료·다른 놀이도 보충될 수 있음.</p><small>홈은 선정한 3개를 고정해 완료 표시를 유지. 이 시뮬레이터는 새 추천만 계산하며 홈 저장 상태를 변경하지 않음.</small></div>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>추천 아키텍처 · 노리 스튜디오</title><style>${backofficeCss()}\n${fs.readFileSync(new URL("../../scripts/review/recommendations.css", import.meta.url), "utf8")}</style></head><body>
  ${sidebar({ page: "recommendations", serverUrls: true, catalogLink: "/catalog" })}<div class="admin-workspace">${topbar("추천 아키텍처")}
  <header class="page-header"><div class="page-title-row"><div><p class="eyebrow">RECOMMENDATION LAB</p><h1>추천 아키텍처</h1><p class="subtitle">어떤 재료와 월령에서, 왜 이 놀이가 나올까요?<br>실제 앱 엔진으로 흐름과 추천 결과를 함께 확인하세요.</p></div><div class="page-actions"><span class="badge live">읽기 전용 시뮬레이션</span><button id="refresh-data">최신 파일로 새로고침</button></div></div><div id="snapshot-meta" class="snapshot-meta"></div>
  <nav class="section-nav" aria-label="페이지 목차"><a href="#architecture">구조와 규칙</a><a href="#simulator">추천 실험실</a><a href="#age-matrix">월령별 비교</a><a href="#review-catalog">의도 검수 목록</a><a href="#sources">코드와 문서</a></nav></header>
  <main class="page-main recommendation-page"><noscript><p>시뮬레이션은 JavaScript가 필요합니다. 구조와 규칙 설명은 아래에서 확인할 수 있습니다.</p></noscript>
  <section id="architecture" class="panel"><div class="section-heading"><div><p class="eyebrow">01 / ARCHITECTURE</p><h2>기본 추천에 활동 의도를 더하는 구조</h2></div><span class="pill">규칙 기반 · 외부 AI 호출 없음</span></div><p class="section-description">왼쪽은 기본 추천, 오른쪽은 원본 콘텐츠에서 별도로 확인하는 의도 보완 경로입니다. 숫자는 아래 실험 조건에 맞춰 바뀝니다.</p><div class="architecture" role="group" aria-label="추천 엔진 흐름도">${flow}</div>
  <div class="rule-grid"><article><h3>재료 적합도가 점수보다 먼저</h3><p>필수 재료 전부 보유 → 일부 보유 → 무재료 → 미일치 순입니다. 부족 재료 수, 보유 비율, 일치 개수까지 비교한 뒤 최근 완료와 점수를 봅니다. 선택·대체 재료만의 일치는 활동 관련성으로 세지 않습니다.</p></article><article><h3>의도는 우선순위가 있는 규칙</h3><ol><li>가위 + 종이 → 자르기</li><li>풀 + 종이 또는 박스 → 붙이기</li><li>테이프 + 종이·종이접시·동물장난감 중 하나 → 떼기·붙이기</li><li>물감 + 종이 또는 종이접시 → 표현하기</li></ol><p>자동차·공·책·인형·퍼즐이 하나라도 있거나 가위+종이+물감이 함께 있으면 의도를 추정하지 않습니다. 여러 규칙이 맞으면 위 순서로 하나를 선택합니다.</p></article><article><h3>월령 예외는 개별 검수 대상만</h3><p>현재 등록된 상위 보충 검수는 5개, 시험 최소 월령은 33개월입니다. 36개월 시작 놀이를 33~35개월에서 조건부로 검토합니다. 모든 36개월 놀이를 일괄로 앞당기는 방식이 아닙니다.</p><p>풍선은 상위 보충 제외. 36개월 미만에서는 구슬·비즈·폼폼·워터비즈·플레이콘·슬라임이 필수·선택·대체 재료 어디에 있어도 제외합니다.</p></article><article><h3>홈 화면과 시뮬레이션의 관계</h3><p>엔진은 자격을 충족하는 범위에서 최대 3개를 반환합니다. 의도 보완으로도 부족하면 기존 후보로 채우므로 무관한 놀이가 없어지는 보장은 없습니다. 유효한 후보 자체가 3개 미만이면 결과도 적습니다.</p><p>실제 홈은 이미 고정한 놀이, 사용자 발달·피드백·완료 이력에 따라 다를 수 있습니다. 여기서는 새 추천과 입력한 가정만 사용합니다.</p></article></div>
  <details class="score-details"><summary>점수 가중치와 계산식 확인</summary><div id="weights"></div><p>각 항목의 원점수 × 가중치 ÷ 100의 합. 첫 사용 가중치 합은 90이며 100으로 재정규화하지 않습니다. 인기 항목은 현재 0입니다. 이 화면의 발달·피드백 원점수는 각각 기본값 50이고, 최근 완료 이력은 입력한 ID만 사용합니다. 홈 기본 시간 999분에서는 시간 원점수가 보통 0입니다. 점수만으로 최종 순서를 판단하지 마세요.</p></details></section>
  <section id="simulator" class="panel"><div class="section-heading"><div><p class="eyebrow">02 / LIVE SIMULATOR</p><h2>재료와 월령으로 추천해 보기</h2></div><button id="copy-scenario">실험 조건 링크 복사</button></div><p class="section-description">로컬 콘텐츠와 앱의 <code>recommend()</code>를 직접 사용합니다. 조건 변경은 이 화면과 주소에만 반영됩니다.</p>
  <div id="presets" class="presets"></div><div class="simulator-grid"><div class="controls"><div class="age-control"><label for="child-age">아이 월령</label><div><input id="child-age" type="number" min="0" max="48" value="33"><span>개월</span></div><input id="age-range" aria-label="아이 월령 슬라이더" type="range" min="0" max="48" value="33"></div>
  <div class="material-heading"><h3>보유 재료 <span id="material-count"></span></h3><button id="clear-materials">모두 해제</button></div><input id="material-search" type="search" placeholder="재료명 또는 slug 검색" aria-label="재료 검색"><div id="material-options" class="material-options"></div>
  <details><summary>장소·시간·이력·제외 재료</summary><div class="advanced-controls"><label>장소 <select id="place"><option value="any">어디서나 (홈 기본)</option><option value="indoor">실내</option><option value="outdoor">실외</option></select></label><label>가능한 시간 <input id="minutes" type="number" min="1" max="999" value="999"> 분 (홈 기본 999)</label><label>완료 경험 <select id="history"><option value="0">첫 사용 · 완료 0회</option><option value="20">완료 경험 있음 · 가중치 비교</option></select></label><label>최근 완료 놀이 ID <input id="recent-ids" type="text" placeholder="play_192, play_193"></label><label>제외 재료 (복수 선택)<select id="blocked" multiple size="5"></select></label></div></details>
  <details open><summary>상위 월령 보충의 준비 조건</summary><p class="helper">앞의 3개는 공통 조건입니다. 가위 동작은 자르기 의도일 때, 테이프·물감 조건은 해당 후보가 그 재료를 쓸 때 추가로 필요합니다. 아래는 가정 실험이며 사용자 확인 기록을 저장하지 않습니다.</p><div id="readiness" class="readiness"></div><button id="check-readiness">모든 준비 조건을 충족한 가정</button><button id="clear-readiness">조건 미확인으로</button></details></div>
  <div class="live-results"><div id="result-summary" role="status" aria-live="polite"></div><div id="selected-materials" class="selected-materials"></div><div id="recommendation-results" class="recommendation-results"></div><div id="baseline-results" class="baseline-results"></div><div id="conditional-results" class="conditional-results"></div></div></div>
  <details class="trace-details"><summary id="trace-summary">전체 후보의 선정·제외 근거</summary><div class="toolbar"><input id="trace-search" type="search" placeholder="놀이 이름 또는 ID 검색" aria-label="후보 놀이 검색"><select id="trace-filter" aria-label="후보 표시 범위"><option value="live">공개 놀이 전체</option><option value="selected">최종 선정</option><option value="conditional">조건부 검수 후보</option><option value="all">초안·보관 포함 전체</option></select></div><div class="table-scroll"><table><thead><tr><th>놀이 · 원래 월령</th><th>필수 재료</th><th>자격 / 결과</th><th>판단 근거</th><th>점수</th></tr></thead><tbody id="trace-body"></tbody></table></div></details></section>
  <section id="age-matrix" class="panel"><div class="section-heading"><div><p class="eyebrow">03 / AGE × MATERIALS</p><h2>같은 재료, 다른 월령</h2></div><select id="matrix-range" aria-label="비교 월령 범위"><option value="25-39">25~39개월</option><option value="0-48">0~48개월 전체</option></select></div><p class="section-description">현재 선택한 재료·장소·시간·이력을 고정하고 매월 다시 계산합니다. 왼쪽은 준비 조건 미확인, 오른쪽은 위 확인란의 상태입니다. 월령 버튼을 누르면 실험 조건에 반영됩니다.</p><div id="matrix-caption" class="helper"></div><div class="table-scroll"><table class="matrix-table"><thead><tr><th>월령</th><th>현재 월령<br>준비 완료 의도 후보</th><th>준비 조건 미확인 결과</th><th>현재 확인란 적용 결과</th></tr></thead><tbody id="matrix-body"></tbody></table></div></section>
  <section id="review-catalog" class="panel"><p class="eyebrow">04 / REVIEW CATALOG</p><h2>행동 역할을 검수한 놀이</h2><p class="section-description">재료 이름만으로 판단하지 않고 아이가 하는 활동을 검수합니다. 콘텐츠 전체 서명이 일치해야 유효하며 내용이 바뀌면 재검수 전까지 의도·상위 보충 대상에서 빠집니다.</p><div id="review-summary" class="helper"></div><div class="table-scroll"><table><thead><tr><th>놀이</th><th>원래 월령</th><th>검수한 행동</th><th>상위 보충 최소 월령</th><th>현재 콘텐츠 서명</th></tr></thead><tbody id="review-body"></tbody></table></div><p class="helper">예: 보호자가 머리카락을 붙이는 몬스터 이발 놀이는 자르기 역할만, 보호자가 재료를 자르는 풀 점 찍기는 붙이기 역할만 부여합니다. 위 검수는 모든 아이에게 적합하다는 판정이 아닙니다. 실제 제품의 표시 연령과 준비 조건을 함께 확인합니다.</p><h3>상위 보충 검수 놀이의 실제 재료·월령 조합</h3><p class="helper">각 놀이의 필수 재료만 선택하고 장소 어디서나·시간 999분·첫 사용·최근 완료 없음으로 계산한 예시입니다. 월령은 준비 조건 확인 후 조건부 자격을 얻는 범위이며 최종 선정은 최대 1개 규칙을 따릅니다. 위 실험실의 입력과 별개인 고정 비교입니다.</p><div class="table-scroll"><table><thead><tr><th>검수 놀이</th><th>선택할 필수 재료</th><th>이 조합의 추정 의도</th><th>상위 보충 자격 월령</th><th>33개월 · 준비 조건 모두 확인한 결과</th></tr></thead><tbody id="review-combinations"></tbody></table></div><div id="combination-note" class="helper"></div><div id="review-basis" class="review-basis"></div></section>
  <section id="sources" class="panel"><p class="eyebrow">05 / SOURCE OF TRUTH</p><h2>코드와 운영 규칙</h2><div id="source-map" class="source-map"></div><details><summary>홈 추천 규칙 문서 원문</summary><pre class="rules-document">${esc(rules)}</pre></details><details><summary>이 화면에 포함된 엔진 소스 목록</summary><ul>${bundle.files.filter((f) => f.startsWith("src/")).map((f) => `<li><code>${esc(f)}</code></li>`).join("")}</ul></details><p class="helper">페이지를 새로고침하면 콘텐츠를 다시 읽고 엔진 소스 변경 시 브라우저 번들도 다시 만듭니다. 앱·홈 추천 고정 기록·검수 승인·콘텐츠 파일에는 쓰지 않습니다.</p></section>
  <footer>nori studio · Recommendation architecture & simulator · Local workspace</footer></main></div><script id="recommendation-data" type="application/json">${safeJson(payload)}</script><script>${bundle.code}</script></body></html>`;
}
