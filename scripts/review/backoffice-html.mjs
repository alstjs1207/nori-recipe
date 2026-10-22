import fs from "node:fs";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shapes = {
  library: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  materials: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  review: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4V2h6v2M9 12l2 2 4-4"/>',
  architecture: '<rect x="8" y="2" width="8" height="5" rx="1"/><path d="M12 7v5M5 12h14M5 12v4m14-4v4"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4"/>',
};
export const icon = (name, className = "") => '<svg class="ui-icon ' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + shapes[name] + '</svg>';
export const backofficeCss = () => fs.readFileSync(new URL("./backoffice.css", import.meta.url), "utf8");

export function sidebar({ page, catalogLink = "play-catalog.html", serverUrls = false, initialView = "plays", plays = 0, materials = 0, batches = 0, registered = 0, total = 0 }) {
  const link = esc(catalogLink);
  const catalog = page === "catalog";
  const current = page === "recommendations" ? "recommendations" : catalog ? initialView : "reviews";
  const item = (id, view, href, glyph, label, count) => {
    const button = catalog && !serverUrls && view !== "reviews";
    const tag = button ? "button" : "a";
    const attributes = button ? ' type="button" aria-pressed="' + (current === view) + '"'
      : ' href="' + esc(href) + '"' + (current === view ? ' aria-current="page"' : '');
    return '<' + tag + ' class="side-link"' + (catalog || view === "reviews" || view === "recommendations" ? ' id="' + id + '"' : '') + attributes + '>' + icon(glyph) + '<span>' + label + '</span>' + (count === null ? '' : '<small>' + count + '</small>') + '</' + tag + '>';
  };
  const navigation = item("plays-tab", "plays", catalogLink, "library", "놀이 라이브러리", catalog ? plays : null) +
    item("materials-tab", "materials", serverUrls ? "/materials" : catalogLink + "#materials", "materials", "재료 라이브러리", catalog ? materials : null);
  const review = item("reviews-nav", "reviews", serverUrls ? "/reviews" : (catalog ? "" : catalogLink) + "#review-batches", "review", "수집 건별 검수", catalog ? batches : null);
  const recommendations = serverUrls ? '<p class="nav-label review-nav-label">추천 엔진</p>' + item("recommendations-nav", "recommendations", "/recommendations", "architecture", "추천 아키텍처", null) : '';
  const progress = !catalog && total ? '<div class="sidebar-progress"><span>이번 수집 건</span><div><strong>' + registered + '</strong><small> / ' + total + '개 등록</small></div><div class="progress-track"><span style="width:' + Math.round(registered / total * 100) + '%"></span></div><p>' + (total - registered ? total - registered + '개 항목을 검수하고 있어요.' : '모든 항목이 등록되었어요.') + '</p></div>' : '';
  return '<aside class="admin-sidebar" aria-label="백오피스 메뉴"><a class="brand" href="' + link + '"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span><b>nori<span class="brand-dot">.</span></b><small>콘텐츠 스튜디오</small></span></a><div class="workspace-switch"><span class="workspace-monogram">N</span><span><b>놀이 레시피</b><small>콘텐츠 워크스페이스</small></span></div><nav aria-label="현황 메뉴"><p class="nav-label">라이브러리</p>' + navigation + '<p class="nav-label review-nav-label">검수</p>' + review + recommendations + '</nav>' + progress + '<div class="sidebar-bottom"><span class="local-dot"></span><span>로컬 워크스페이스<small>승인한 콘텐츠를 차곡차곡</small></span></div></aside>';
}

export const topbar = (section) => '<div class="app-topbar"><div class="breadcrumbs"><span>워크스페이스</span>' + icon("chevron") + '<b id="workspace-current">' + esc(section) + '</b></div><span class="workspace-badge"><i class="local-dot"></i>로컬 모드</span></div>';
