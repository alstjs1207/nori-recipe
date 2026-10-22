import { inspectRecommendation } from "./recommendation-model";
import { INTENT_LABELS, INTENT_REVIEW_VERSION, getReviewedIntent } from "../../src/engine/intentSignals";
import { COLD_START_WEIGHTS, DEFAULT_WEIGHTS } from "../../src/engine/weights";
import { getMaterialRecommendationNotice } from "../../src/engine/materialFit";
import reviewCatalog from "../../src/engine/intentCatalog.json";
import type { FilterInput, IntentReadiness, Play, PlayIntent } from "../../src/types";
import type { UserStats } from "../../src/engine/types";

type Payload = { plays: Play[]; registry: { categories: Record<string, string[]>; displayNames: Record<string, string> }; revision: string; engineHash: string; generatedAt: string; imageIds: string[] };
const data: Payload = JSON.parse(document.getElementById("recommendation-data")!.textContent!);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const select = (id: string) => $<HTMLSelectElement>(id);
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const name = (slug: string) => data.registry.displayNames[slug] ?? slug;
const names = (slugs: string[]) => slugs.length ? slugs.map(name).join(" · ") : "없음";
const imageIds = new Set(data.imageIds);
const roleLabels: Record<PlayIntent, string> = { ...INTENT_LABELS, cutting: "가위로 자르기" };
const knownMaterials = new Set(Object.values(data.registry.categories).flat());
Object.keys(data.registry.displayNames).forEach((m) => knownMaterials.add(m));
const readinessFields: [keyof IntentReadiness, string][] = [
  ["adultSupervision", "보호자가 곁에서 함께 도움"], ["productsAgeAppropriate", "실제 제품의 사용 연령이 아이에게 맞음"],
  ["noMouthing", "재료를 입에 넣지 않으며 지시에 따라 조작"], ["scissorSnipping", "자르기: 안전 가위로 짧게 자를 준비가 됨"],
  ["tapeSurfaceSafe", "테이프: 피부 대신 안전한 표면에 붙이고 제거"], ["washablePaint", "물감: 연령에 맞는 세척 가능한 제품 사용"],
];
const presets = [
  { label: "가위 + 종이 + 풀", age: 33, materials: ["scissors", "paper", "glue"] },
  { label: "가위 + 종이 (풀 없음)", age: 33, materials: ["scissors", "paper"] },
  { label: "풀 + 종이", age: 33, materials: ["glue", "paper"] },
  { label: "테이프 + 동물장난감", age: 33, materials: ["tape", "animal_toy"] },
  { label: "물감 + 종이 + 테이프", age: 33, materials: ["paint", "paper", "tape"] },
  { label: "투명 컵 + 고무줄 + 빨대", age: 33, materials: ["transparent_cup", "rubber_band", "straw"] },
  { label: "가위 + 종이 + 물감 (모호)", age: 33, materials: ["scissors", "paper", "paint"] },
  { label: "테이프 미술 (필수 6종)", age: 33, materials: ["paper_plate", "tape", "paint", "brush", "water", "cup"] },
];
let materials = new Set<string>(presets[0].materials);
let inspection: ReturnType<typeof inspectRecommendation>;
let age = 33;
const clamp = (v: string | null, fallback: number, min: number, max: number) => v !== null && v.trim() !== "" && Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Math.round(Number(v)))) : fallback;
function restoreQuery() {
  const q = new URLSearchParams(location.search);
  age = clamp(q.get("age"), 33, 0, 48);
  materials = q.has("materials") ? new Set((q.get("materials") ?? "").split(",").filter((m) => knownMaterials.has(m))) : new Set(presets[0].materials);
  input("child-age").value = input("age-range").value = String(age);
  input("minutes").value = String(clamp(q.get("minutes"), 999, 1, 999));
  select("place").value = ["indoor", "outdoor"].includes(q.get("place") ?? "") ? q.get("place")! : "any";
  select("history").value = q.get("history") === "20" ? "20" : "0";
  input("recent-ids").value = (q.get("recent") ?? "").split(",").filter((s) => /^play_\d+$/.test(s)).join(", ");
  const blocked = new Set((q.get("blocked") ?? "").split(","));
  Array.from(select("blocked").options).forEach((o) => { o.selected = blocked.has(o.value); });
  const ready = new Set((q.get("ready") ?? "").split(","));
  readinessFields.forEach(([key]) => { input("ready-" + key).checked = ready.has(key); });
  syncMaterialChecks();
}
function context(atAge = age, confirmed = true): FilterInput {
  const readiness: IntentReadiness = {};
  readinessFields.forEach(([key]) => { readiness[key] = confirmed && input("ready-" + key).checked; });
  return { childAgeMonths: atAge, availableMaterials: [...materials] as FilterInput["availableMaterials"], blockedMaterials: Array.from(select("blocked").selectedOptions).map((o) => o.value) as FilterInput["blockedMaterials"],
    place: select("place").value as FilterInput["place"], availableMinutes: Number(input("minutes").value), intentReadiness: readiness };
}
function stats(): UserStats {
  return { totalPlays: Number(select("history").value), recentCompletedPlayIds: input("recent-ids").value.split(/[\s,]+/).filter((id) => /^play_\d+$/.test(id)) };
}
function syncMaterialChecks() {
  document.querySelectorAll<HTMLInputElement>("input[data-material]").forEach((el) => { el.checked = materials.has(el.value); });
}
function shareQuery() {
  const ctx = context(), q = new URLSearchParams();
  q.set("age", String(age)); q.set("materials", [...materials].sort().join(","));
  if (ctx.place !== "any") q.set("place", ctx.place);
  if (ctx.availableMinutes !== 999) q.set("minutes", String(ctx.availableMinutes));
  if (ctx.blockedMaterials.length) q.set("blocked", ctx.blockedMaterials.sort().join(","));
  const ready = readinessFields.filter(([key]) => ctx.intentReadiness?.[key]).map(([key]) => key);
  if (ready.length) q.set("ready", ready.join(","));
  if (stats().totalPlays) q.set("history", "20");
  if (stats().recentCompletedPlayIds?.length) q.set("recent", stats().recentCompletedPlayIds!.join(","));
  history.replaceState(null, "", location.pathname + "?" + q + location.hash);
}
function shortPlay(play: Play, atAge: number) {
  return `<div class="matrix-play"><a href="/catalog#${esc(play.id)}">${esc(play.name)}</a><small>${play.ageMin}~${play.ageMax}개월${play.ageMin > atAge ? " · 상위 월령 조건부" : ""}</small></div>`;
}
function renderTrace() {
  const query = input("trace-search").value.trim().toLocaleLowerCase(), filter = select("trace-filter").value;
  const rows = inspection.rows.filter((r) => (!query || `${r.play.id} ${r.play.name}`.toLocaleLowerCase().includes(query)) &&
    (filter === "all" || filter === "selected" ? filter === "all" || r.selected : filter === "conditional" ? r.conditionalCandidate : r.play.status === "live"))
    .sort((a, b) => Number(b.selected) - Number(a.selected) || Number(b.conditionalCandidate) - Number(a.conditionalCandidate) || a.play.id.localeCompare(b.play.id));
  $("trace-summary").textContent = `전체 후보의 선정·제외 근거 · ${inspection.counts.total}개`;
  $("trace-body").innerHTML = rows.length ? rows.map((r) => `<tr${r.selected ? ' class="highlight"' : ""}><td><a href="/catalog#${esc(r.play.id)}">${esc(r.play.name)}</a><small>${esc(r.play.id)} · ${r.play.ageMin}~${r.play.ageMax}개월 · ${esc(r.play.status)}</small></td><td>${esc(names(r.play.materials.required))}<small>일치 ${r.fit.matched} / 부족 ${r.fit.missing}</small></td><td>${r.selected ? "최종 선정" : r.conditionalCandidate ? r.conditionalAllowed ? "상위 보충 허용" : "상위 조건 미확인" : r.currentCandidate ? "기본 후보" : "후보 밖"}${r.intentMatch ? " · 의도 일치" : ""}</td><td>${esc(r.reason)}</td><td>${r.score.total}<small>후보 밖 점수는 참고값</small></td></tr>`).join("") : '<tr><td colspan="5">이 조건에 해당하는 후보가 없습니다.</td></tr>';
}
function renderMatrix() {
  const [min, max] = select("matrix-range").value.split("-").map(Number);
  const readyNames = readinessFields.filter(([key]) => input("ready-" + key).checked).map(([, label]) => label);
  $("matrix-caption").textContent = `고정 재료: ${names([...materials])} / 현재 확인란: ${readyNames.length ? readyNames.join(" · ") : "모두 미확인 (양쪽 결과가 같음)"}`;
  const rows: string[] = [];
  for (let atAge = min; atAge <= max; atAge++) {
    const unconfirmed = inspectRecommendation(data.plays, context(atAge, false), stats());
    const current = inspectRecommendation(data.plays, context(atAge), stats());
    rows.push(`<tr${atAge === age ? ' class="highlight"' : ""}><td><button data-age="${atAge}" aria-label="${atAge}개월로 실험">${atAge}개월</button></td><td>${current.counts.currentIntent}<small>상위 검수 후보 ${current.counts.conditional}</small></td><td>${unconfirmed.results.map((p) => shortPlay(p, atAge)).join("") || "추천 없음"}</td><td>${current.results.map((p) => shortPlay(p, atAge)).join("") || "추천 없음"}</td></tr>`);
  }
  $("matrix-body").innerHTML = rows.join("");
}
function renderResults() {
  const ctx = context(); inspection = inspectRecommendation(data.plays, ctx, stats());
  const i = inspection, notice = getMaterialRecommendationNotice(i.results, ctx.availableMaterials);
  $("material-count").textContent = String(materials.size);
  $("selected-materials").innerHTML = [...materials].map((m) => `<span class="pill">${esc(name(m))}</span>`).join("");
  $("result-summary").innerHTML = `<div class="result-status"><strong>${age}개월 · ${i.intent ? esc(INTENT_LABELS[i.intent]) : "의도 추정 없음"} · ${i.results.length}개 추천</strong><p>현재 월령의 준비 완료 의도 후보 ${i.counts.currentIntent}개 · 조건부 후보 ${i.counts.conditional}개 (조건 확인 ${i.counts.allowedConditional}개)</p><p>${esc(notice ?? "현재 입력에서 선정한 새 추천 결과입니다.")}</p></div>`;
  $("recommendation-results").innerHTML = i.results.length ? i.results.map((play, index) => {
    const r = i.rows.find((row) => row.play.id === play.id)!;
    const future = play.ageMin > age;
    const materialTag = r.fit.matched === 0 && materials.size > 0 ? '<span class="tag filler">다른 놀이 보충</span>'
      : r.fit.missing ? '<span class="tag filler">추가 재료 필요</span>' : `<span class="tag">${play.materials.required.length === 0 ? "무재료" : "준비 완료"}</span>`;
    return `<article class="result-card${r.featured ? " featured" : ""}" data-play-id="${esc(play.id)}">${imageIds.has(play.id) && play.imageStatus !== "review" ? `<img class="result-image" src="/images/plays/${esc(play.id)}.jpeg" alt="${esc(play.name)}" loading="lazy">` : '<div class="result-image" aria-hidden="true">✳</div>'}<div><div class="tags"><span class="tag">${index + 1}번 후보</span>${r.featured ? '<span class="tag">홈 대표 추천</span>' : ""}${future ? '<span class="tag future">상위 월령 · 조건 확인</span>' : ""}${materialTag}</div><h3><a href="/catalog#${esc(play.id)}">${esc(play.name)}</a></h3><p>${esc(play.id)} · 원래 ${play.ageMin}~${play.ageMax}개월 · ${play.durationMin}~${play.durationMax}분</p><p><b>${esc(r.reason)}</b></p><p>필수: ${esc(names(play.materials.required))}</p>${r.missing.length ? `<p>추가 필요: ${esc(names(r.missing))}</p>` : ""}<details><summary>점수 및 활동 내용</summary><div class="score-line">총 ${r.score.total} = 재료 ${r.score.breakdown.material} + 발달 ${r.score.breakdown.dev} + 시간 ${r.score.breakdown.time} + 피드백 ${r.score.breakdown.feedback} + 인기 ${r.score.breakdown.popular}</div><p>${esc(play.steps.join(" → "))}</p><p>${esc(play.safetyNotes.join(" · "))}</p></details></div></article>`;
  }).join("") : '<p class="helper">현재 조건에 맞는 공개 후보가 없습니다. 월령·재료·시간·장소·제외 조건을 확인하세요.</p>';
  $("baseline-results").innerHTML = `<b>의도 보완 전 · 기본 추천 경로의 결과</b>${i.baseline.map((p) => esc(p.name)).join(" → ") || "없음"}<p>이 비교도 현재 엔진의 기본 재료 우선순위 규칙을 사용합니다. 과거 버전과의 비교는 아닙니다.</p>`;
  $("conditional-results").innerHTML = `<b>상위 월령 검수 후보</b>${i.conditional.length ? '<ul>' + i.conditional.map((p) => `<li>${esc(p.name)} · 원래 ${p.ageMin}개월부터 · ${i.rows.find((r) => r.play.id === p.id)!.conditionalAllowed ? "준비 조건 확인됨 (실제 선정은 현재 후보 수·최대 1개 규칙 적용)" : "준비 조건 미확인으로 결과에 미포함"}</li>`).join("") + '</ul>' : "필수 재료·월령·의도·제외 조건을 모두 충족한 상위 검수 후보가 없습니다."}`;
  $("flow-filter").textContent = `현재 통과 ${i.counts.hardPass}개 / 공개 ${i.counts.live}개`;
  $("flow-pool").textContent = `기본 후보 풀 ${i.counts.baselinePool}개`;
  $("flow-intent").textContent = i.intent ? `추정: ${INTENT_LABELS[i.intent]}` : "현재 조합은 기본 경로 유지";
  $("flow-current").textContent = `준비 완료 의도 후보 ${i.counts.currentIntent}개`;
  $("flow-future").textContent = `검수 자격 ${i.counts.conditional}개 → 조건 확인 ${i.counts.allowedConditional}개 → 최대 1개`;
  document.querySelectorAll<HTMLButtonElement>("button[data-preset]").forEach((button) => {
    const preset = presets[Number(button.dataset.preset)];
    button.setAttribute("aria-pressed", String(age === preset.age && materials.size === preset.materials.length && preset.materials.every((m) => materials.has(m))));
  });
  renderTrace(); renderMatrix(); shareQuery();
}

function setup() {
  $("snapshot-meta").textContent = `공개 ${data.plays.filter((p) => p.status === "live").length}개 / 전체 ${data.plays.length}개 · 의도 검수 ${INTENT_REVIEW_VERSION} · 소스 ${data.engineHash.slice(0, 12)} · ${new Date(data.generatedAt).toLocaleString("ko-KR")} 기준`;
  $("presets").innerHTML = presets.map((p, n) => `<button data-preset="${n}" aria-pressed="false">${esc(p.label)}</button>`).join("");
  const assigned = new Set<string>();
  const groups = Object.entries(data.registry.categories).map(([category, slugs]) => [category, slugs.filter((m) => { if (assigned.has(m)) return false; assigned.add(m); return true; })] as const);
  const extra = [...knownMaterials].filter((m) => !assigned.has(m));
  if (extra.length) groups.push(["기타", extra]);
  $("material-options").innerHTML = groups.map(([category, slugs]) => `<fieldset class="material-group"><legend>${esc(category)}</legend><div>${slugs.map((m) => `<label class="material-option" data-search="${esc(name(m) + " " + m)}"><input type="checkbox" data-material value="${esc(m)}">${esc(name(m))}</label>`).join("")}</div></fieldset>`).join("");
  select("blocked").innerHTML = [...knownMaterials].sort((a, b) => name(a).localeCompare(name(b), "ko")).map((m) => `<option value="${esc(m)}">${esc(name(m))}</option>`).join("");
  $("readiness").innerHTML = readinessFields.map(([key, label]) => `<label><input type="checkbox" id="ready-${key}">${esc(label)}</label>`).join("");
  $("weights").innerHTML = '<div class="table-scroll"><table><thead><tr><th>사용 상태</th><th>재료</th><th>발달</th><th>인기</th><th>시간</th><th>피드백</th></tr></thead><tbody>' + [["첫 사용", COLD_START_WEIGHTS], ["완료 경험 있음", DEFAULT_WEIGHTS]].map(([label, w]) => { const weight = w as typeof COLD_START_WEIGHTS; return `<tr><td>${label}</td>${[weight.material, weight.dev, weight.popular, weight.time, weight.feedback].map((n) => `<td>${n}</td>`).join("")}</tr>`; }).join("") + '</tbody></table></div>';
  const valid = reviewCatalog.items.filter((row) => { const p = data.plays.find((p) => p.id === row.id); return p && getReviewedIntent(p); });
  $("review-summary").textContent = `검수 기록 ${reviewCatalog.items.length}개 · 현재 서명 유효 ${valid.length}개 · 상위 보충 검수 ${valid.filter((r) => "minSupportedMonths" in r).length}개 (실제 후보는 실험 조건에 따라 결정)`;
  $("review-body").innerHTML = reviewCatalog.items.map((row) => {
    const play = data.plays.find((p) => p.id === row.id), valid = play && getReviewedIntent(play);
    return `<tr><td><a href="/catalog#${esc(row.id)}">${esc(play?.name ?? row.id)}</a><small>${esc(row.id)}</small></td><td>${play ? `${play.ageMin}~${play.ageMax}개월` : "콘텐츠 없음"}</td><td>${esc(row.intents.map((intent) => roleLabels[intent as PlayIntent]).join(" · "))}</td><td>${"minSupportedMonths" in row ? `${row.minSupportedMonths}개월 · +3개월 한도` : "보충 대상 아님"}</td><td>${valid ? "유효" : "불일치 · 의도 반영 중단"}</td></tr>`;
  }).join("");
  const combinationConflicts: string[] = [];
  $("review-combinations").innerHTML = reviewCatalog.items.filter((row) => "minSupportedMonths" in row).map((row) => {
    const play = data.plays.find((p) => p.id === row.id);
    if (!play) return `<tr><td>${esc(row.id)}</td><td colspan="4">현재 콘텐츠 없음</td></tr>`;
    const base: FilterInput = { childAgeMonths: 33, availableMaterials: play.materials.required, blockedMaterials: [], place: "any", availableMinutes: 999,
      intentReadiness: Object.fromEntries(readinessFields.map(([key]) => [key, true])) };
    const example = inspectRecommendation(data.plays, base, { totalPlays: 0 });
    const months: number[] = [];
    for (let month = 0; month < play.ageMin; month++) {
      if (inspectRecommendation(data.plays, { ...base, childAgeMonths: month }).conditional.some((p) => p.id === row.id)) months.push(month);
    }
    const conflict = example.intent !== null && !row.intents.includes(example.intent);
    if (conflict) combinationConflicts.push(play.name);
    return `<tr><td><a href="/catalog#${esc(play.id)}">${esc(play.name)}</a><small>원래 ${play.ageMin}~${play.ageMax}개월</small></td><td>${esc(names(play.materials.required))}</td><td>${example.intent ? esc(INTENT_LABELS[example.intent]) : "추정 없음"}${conflict ? '<small>검수한 행동과 불일치</small>' : ""}</td><td>${months.length ? `${months.join("·")}개월` : "이 조합으로는 진입 불가"}</td><td>${example.results.map((p) => esc(p.name)).join(" → ") || "없음"}<small>${example.results.some((p) => p.id === row.id) ? "해당 검수 놀이 선정됨" : "해당 검수 놀이 미선정"}</small></td></tr>`;
  }).join("");
  $("combination-note").textContent = combinationConflicts.length ? `현재 규칙에서 ${combinationConflicts.map((n) => `‘${n}’`).join(", ")}의 필수 재료는 검수한 행동과 다른 의도로 먼저 해석됩니다. 검수 목록에 있어도 이 조합으로 상위 보충되지는 않습니다. 위 표는 이 우선순위 충돌까지 실제 엔진으로 계산합니다.` : "현재 필수 재료 예시에서 의도 우선순위 충돌은 없습니다.";
  $("review-basis").innerHTML = reviewCatalog.reviewBasis.map((url, n) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(["가위 동작 검토 근거 · NHS", "연령·활동 검토 근거 · ZERO TO THREE", "제품 연령 검토 근거 · CPSC"][n] ?? "검토 근거")}</a>`).join("");
  const sourceMap = [
    ["src/engine/recommend.ts", "전체 파이프라인과 의도 보완 합류"], ["src/engine/hardFilter.ts · fallback.ts", "게시·월령·장소·제외 재료·시간과 후보 보충"],
    ["src/engine/materialFit.ts · diversity.ts", "필수 재료 우선순위, 대표 카드와 다양성"], ["src/engine/softScore.ts · weights.ts", "점수 항목과 사용자 경험별 가중치"],
    ["src/engine/intentSignals.ts · intentCatalog.json", "명확한 조합, 아이 활동 역할, 전체 콘텐츠 서명 검수"], ["src/engine/intentRecommendation.ts", "현재 의도 후보, 상위 보충 자격과 준비 조건"],
    ["HOME_RECOMMENDATION_RULES.md", "고정 3개·완료 상태·재료 편집·확인 철회 운영 규칙"], ["tools/local-review/recommendation-model.ts", "실제 엔진 결과에 읽기 전용 관찰 정보 추가"],
  ];
  $("source-map").innerHTML = sourceMap.map(([file, description]) => `<p><code>${esc(file)}</code>${esc(description)}</p>`).join("");
  restoreQuery(); renderResults();
  $("refresh-data").addEventListener("click", () => location.reload());
  $("copy-scenario").addEventListener("click", async () => { try { await navigator.clipboard.writeText(location.href); $("copy-scenario").textContent = "실험 링크 복사됨"; } catch { $("copy-scenario").textContent = "주소창의 실험 링크를 복사하세요"; } });
  $("presets").addEventListener("click", (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-preset]"); if (!button) return;
    const preset = presets[Number(button.dataset.preset)]; materials = new Set(preset.materials); age = preset.age;
    input("child-age").value = input("age-range").value = String(age); readinessFields.forEach(([key]) => { input("ready-" + key).checked = false; }); syncMaterialChecks(); renderResults(); });
  $("material-options").addEventListener("change", (event) => { const el = event.target as HTMLInputElement; if (!el.matches("input[data-material]")) return;
    if (el.checked) materials.add(el.value); else materials.delete(el.value);
    readinessFields.forEach(([key]) => { input("ready-" + key).checked = false; }); renderResults(); });
  $("clear-materials").addEventListener("click", () => { materials.clear(); syncMaterialChecks(); readinessFields.forEach(([key]) => { input("ready-" + key).checked = false; }); renderResults(); });
  input("material-search").addEventListener("input", () => { const query = input("material-search").value.toLocaleLowerCase(); document.querySelectorAll<HTMLElement>(".material-option").forEach((el) => { el.hidden = !el.dataset.search!.toLocaleLowerCase().includes(query); }); document.querySelectorAll<HTMLElement>(".material-group").forEach((group) => { group.hidden = !group.querySelector(".material-option:not([hidden])"); }); });
  for (const id of ["child-age", "age-range"]) input(id).addEventListener(id === "age-range" ? "input" : "change", () => { age = clamp(input(id).value, age, 0, 48); input("child-age").value = input("age-range").value = String(age); readinessFields.forEach(([key]) => { input("ready-" + key).checked = false; }); renderResults(); });
  for (const id of ["place", "minutes", "history", "recent-ids", "blocked"]) $(id).addEventListener("change", () => { input("minutes").value = String(clamp(input("minutes").value, 999, 1, 999)); if (id === "blocked") readinessFields.forEach(([key]) => { input("ready-" + key).checked = false; }); renderResults(); });
  $("readiness").addEventListener("change", renderResults);
  for (const [id, checked] of [["check-readiness", true], ["clear-readiness", false]] as const) $(id).addEventListener("click", () => { readinessFields.forEach(([key]) => { input("ready-" + key).checked = checked; }); renderResults(); });
  $("matrix-range").addEventListener("change", renderMatrix);
  $("matrix-body").addEventListener("click", (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-age]"); if (!button) return;
    age = Number(button.dataset.age); input("child-age").value = input("age-range").value = String(age); readinessFields.forEach(([key]) => { input("ready-" + key).checked = false; }); renderResults(); $("simulator").scrollIntoView({ behavior: "smooth" }); });
  input("trace-search").addEventListener("input", renderTrace); $("trace-filter").addEventListener("change", renderTrace);
  addEventListener("popstate", () => { restoreQuery(); renderResults(); });
}
setup();
