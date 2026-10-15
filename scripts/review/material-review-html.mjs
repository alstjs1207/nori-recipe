import { icon } from "./backoffice-html.mjs";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const states = { pending: "검수 대기", added: "신규 추가 반영됨", replaced: "대체 반영됨", held: "보류", reopened: "재검수 대기" };
export function renderMaterialReview(manifest, materialImages = {}) {
  const countState = (state) => manifest.materialEntries.filter((m) => m.state === state).length;
  const appliedSummary = "반영 상태: 신규 추가 " + countState("added") + "종 · 대체 " + countState("replaced") +
    "종 · 보류 " + countState("held") + "종 · 검수 대기 " +
    (countState("pending") + countState("reopened")) + "종. 승인된 신규 재료는 아래 기존 목록에 포함됩니다.";
  const groups = [...new Set(manifest.existingMaterials.map((m) => m.category))];
  const catalog = groups.map((category) => '<section class="catalog-category"><h3>' + esc(category) + '</h3><div class="catalog-items">' +
    manifest.existingMaterials.filter((m) => m.category === category).map((m) =>
      '<span class="catalog-item" data-search="' + esc((m.name + " " + m.slug).toLocaleLowerCase()) + '">' +
      esc(m.name) + '<small>' + esc(m.slug) + "</small></span>").join("") + "</div></section>").join("");
  const cards = manifest.materialEntries.map((m) => {
    const options = manifest.existingMaterials.filter((target) => target.slug !== m.slug)
      .map((target) => '<option value="' + esc(target.slug) + '">' + esc(target.name) + " · " + esc(target.slug) + "</option>").join("");
    const similar = (m.similar ?? []).map((slug) => manifest.existingMaterials.find((item) => item.slug === slug)).filter(Boolean)
      .map((target) => esc(target.name) + " (" + esc(target.slug) + ")").join(" · ");
    return '<article class="material-card" id="material-' + esc(m.slug) + '" data-search="' +
      esc([m.slug, m.name, m.purpose, ...(m.originalNames ?? [])].join(" ").toLocaleLowerCase()) + '">' +
      '<div class="material-top"><div class="material-identity">' +
      (materialImages[m.slug] ? '<img class="material-image" src="' + esc(materialImages[m.slug]) +
        '" alt="' + esc(m.name) + ' 재료 이미지" loading="lazy">' : '') +
      '<div><small>' + esc(m.category) + " · " + esc(m.slug) + "</small><h3>" + esc(m.name) +
      '</h3></div></div><span class="material-decision-label">미검수</span></div><div class="material-card-content">' +
      '<p class="material-state">현재 상태: ' + esc(states[m.state]) +
      "</p><p><b>수집된 표현</b> " + (m.originalNames ?? []).map(esc).join(" · ") + "</p><p><b>사용 목적</b> " + esc(m.purpose) +
      "</p><p><b>비교할 기존 분류</b> " + (similar || "동일한 기존 분류가 없습니다.") + '</p><p class="material-reason">' + esc(m.reason) +
      '</p><p class="material-usages"><b>사용 놀이</b> ' + (m.usages ?? []).map((usage) =>
        '<a class="usage-link" data-play-id="' + esc(usage.id) + '" href="#' + esc(usage.id) + '">' + esc(usage.id) +
        " " + esc(usage.name) + " (" + (usage.role === "optional" ? "선택" : "필수") + ")</a>").join(" · ") + "</p>" +
      '<div class="material-review-form"><label class="material-confirm"><input type="checkbox" data-material-field="confirmed">기존 목록과 재료의 용도·형태·이미지를 확인했습니다.</label>' +
      '<label for="replacement-' + esc(m.slug) + '">대체할 기존 재료</label><select id="replacement-' + esc(m.slug) +
      '" data-material-field="replacementSlug"><option value="">기존 재료 선택</option>' + options + "</select>" +
      '<label for="material-opinion-' + esc(m.slug) + '">검토 의견 · 대체 이유</label><textarea id="material-opinion-' +
      esc(m.slug) + '" data-material-field="comment" maxlength="10000" placeholder="대체할 때는 이유와 필요한 방법 수정을 남겨 주세요."></textarea>' +
      '<div class="material-actions"><button data-material-decision="add"' + (Object.hasOwn(m, "imageHash") && !m.imageHash ? ' disabled title="재료 이미지 생성이 필요합니다."' : '') + '>신규 추가</button><button data-material-decision="replace">대체</button>' +
      '<button data-material-decision="held">보류</button><button data-material-decision="pending">미검수로</button></div></div></div></article>';
  }).join("");
  return '<section id="materials-panel" class="review-panel" role="tabpanel" aria-labelledby="materials-tab" hidden>' +
    '<div class="hint">' + icon("info") + '<div><p>' + appliedSummary + '</p><details class="review-context"><summary>재료 검수 안내 보기</summary><p>대체·보류·검수 대기 상태의 신규 제안은 일반 준비물 목록에 표시하지 않습니다.</p>' +
    "<p>신규 추가는 비교 확인 후 선택하고, 대체는 기존 재료와 이유를 함께 남겨 주세요. 대체 반영 후 방법·주의사항과 이미지를 다시 검수합니다.</p>" +
    '<p>재료 결과를 먼저 반영한 뒤 놀이를 승인합니다. 보류하거나 아직 승인하지 않은 재료를 사용하는 놀이는 게시할 수 없습니다.</p></details></div></div>' +
    '<div class="material-toolbar"><label class="search-field">' + icon("search") + '<input type="search" id="material-q" aria-label="재료 검색" placeholder="기존·신규 재료명 또는 slug 검색"></label>' +
    '<select id="material-filter" aria-label="재료 검수 필터"><option value="all">신규 제안 전체</option><option value="pending">미검수</option>' +
    '<option value="add">신규 추가</option><option value="replace">대체</option><option value="held">보류</option></select></div>' +
    '<details class="catalog"><summary>기존 재료 목록 ' + manifest.existingMaterials.length + "종 · 펼쳐서 비교하기</summary>" + catalog + "</details>" +
    '<div class="material-section-heading"><h2 class="section-heading">이번 놀이의 신규 제안 ' + manifest.materialEntries.length + '종</h2>' +
    '<div class="material-counts"><span><b data-material-count="pending">0</b> 미검수</span><span><b data-material-count="add">0</b> 신규 추가</span>' +
    '<span><b data-material-count="replace">0</b> 대체</span><span><b data-material-count="held">0</b> 보류</span></div></div>' +
    '<section id="material-grid" class="material-grid" aria-label="신규 재료 검수 목록">' + cards + "</section></section>";
}
