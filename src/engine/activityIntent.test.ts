import assert from "node:assert/strict";
import test from "node:test";
import { loadLivePlays } from "@/data/content";
import { recommend } from "@/engine/recommend";
import { getMaterialFit, pickFeaturedPlay } from "@/engine/materialFit";
import { getReviewedIntent, inferPlayIntent, playMatchesIntent } from "@/engine/intentSignals";
import { getConditionalIntentCandidates, getConditionalRecommendationNotice, getIntentConfirmationKey, isAllowedConditionalPlay, isEligibleHomeRecommendation, parseIntentConfirmation } from "@/engine/intentRecommendation";
import type { FilterInput, IntentReadiness, Play } from "@/types";

const plays = loadLivePlays();
const ready: IntentReadiness = { adultSupervision: true, productsAgeAppropriate: true, noMouthing: true, scissorSnipping: true, tapeSurfaceSafe: true, washablePaint: true };
const ctx = (materials: FilterInput["availableMaterials"], age = 33, changes: Partial<FilterInput> = {}): FilterInput => ({ childAgeMonths: age, availableMaterials: materials, blockedMaterials: [], availableMinutes: 999, place: "any", ...changes });
const cut = ["scissors", "paper", "glue"] as FilterInput["availableMaterials"];
function find(id: string): Play { const p = plays.find((p) => p.id === id); assert.ok(p); return p; }

test("도구와 작업 재료의 조합으로 4가지 활동 의도를 구분한다", () => {
  assert.equal(inferPlayIntent(cut), "cutting");
  assert.equal(inferPlayIntent(["glue", "cardboard"]), "gluing");
  assert.equal(inferPlayIntent(["tape", "animal_toy"]), "tape");
  assert.equal(inferPlayIntent(["paint", "paper"]), "painting");
});
test("정의하지 않았거나 경쟁 활동이 섞이면 의도 추정을 보류한다", () => {
  for (const materials of [[], ["paper"], ["scissors"], ["tape"], ["transparent_cup", "rubber_band", "straw"], ["scissors", "paper", "paint"], ["scissors", "paper", "car_toy"]]) assert.equal(inferPlayIntent(materials), null);
});
test("보호자 준비용 가위·테이프는 아이의 자르기·테이프 조작이 아니다", () => {
  assert.equal(playMatchesIntent(find("play_219"), "cutting"), false);
  assert.equal(playMatchesIntent(find("play_225"), "cutting"), false);
  assert.equal(playMatchesIntent(find("play_166"), "tape"), false);
  assert.equal(playMatchesIntent(find("play_194"), "cutting"), false);
});
test("조건 미확인 시 월령 밖 후보를 자동으로 추천하지 않는다", () => {
  const r = recommend(plays, ctx(cut), { totalPlays: 0 });
  assert.equal(r.results.length, 3);
  assert.ok(r.results.every((p) => p.ageMin <= 33));
});
test("33개월의 준비 완료 가위 조합은 확인 후 괴물 미용실을 상단에 보충한다", () => {
  const c = ctx(cut, 33, { intentReadiness: ready });
  const r = recommend(plays, c, { totalPlays: 0 });
  assert.equal(r.results[0].id, "play_192");
  assert.equal(pickFeaturedPlay(r.results, cut, 33)?.id, "play_192");
  assert.equal(r.results[0].ageMin, 36);
  assert.equal(r.results.length, 3);
  assert.match(getConditionalRecommendationNotice(r.results, cut, 33) ?? "", /기본 36개월/);
});
test("추가 필수 재료가 한 종이라도 부족하면 상위 후보로 승격하지 않는다", () => {
  const c = ctx(["scissors", "paper"], 33, { intentReadiness: ready });
  assert.equal(getConditionalIntentCandidates(plays, c).length, 0);
  assert.ok(recommend(plays, c, { totalPlays: 0 }).results.every((p) => p.ageMin <= 33));
});
test("감독·제품 연령·입 탐색·가위 준비 조건 각각이 필요하다", () => {
  for (const key of ["adultSupervision", "productsAgeAppropriate", "noMouthing", "scissorSnipping"] as const) {
    const c = ctx(cut, 33, { intentReadiness: { ...ready, [key]: false } });
    assert.ok(recommend(plays, c, { totalPlays: 0 }).results.every((p) => p.ageMin <= 33));
  }
});
test("+3개월 범위를 넘기거나 이미 지난 월령의 놀이를 되살리지 않는다", () => {
  for (const age of [31, 32]) assert.equal(getConditionalIntentCandidates(plays, ctx(cut, age)).length, 0);
  for (const age of [33, 34, 35]) assert.ok(getConditionalIntentCandidates(plays, ctx(cut, age)).some((p) => p.id === "play_192"));
  assert.equal(getConditionalIntentCandidates(plays, ctx(cut, 36)).length, 0);
  const old = find("play_216");
  assert.equal(isEligibleHomeRecommendation(old, ctx(old.materials.required, 33, { intentReadiness: ready })), false);
});
test("같은 가위 자르기 두 종류로 여러 자리를 채우지 않는다", () => {
  const c = ctx(["scissors", "paper", "glue", "cardboard", "crayon"], 33, { intentReadiness: ready });
  const r = recommend(plays, c, { totalPlays: 20 });
  assert.equal(r.results.filter((p) => p.ageMin > 33).length, 1);
  assert.equal(new Set(r.results.map((p) => p.id)).size, 3);
});
test("테이프 의도는 걷기 대신 장난감 테이프 떼기에 연결한다", () => {
  const c = ctx(["tape", "animal_toy"], 33, { intentReadiness: ready });
  const r = recommend(plays, c, { totalPlays: 0 });
  assert.equal(r.results[0].id, "play_196");
  assert.equal(isAllowedConditionalPlay(find("play_166"), c), false);
  assert.equal(isAllowedConditionalPlay(find("play_196"), { ...c, intentReadiness: { ...ready, tapeSurfaceSafe: false } }), false);
});
test("테이프 미술에는 물감 조건 확인도 필요하다", () => {
  const p = find("play_198"), c = ctx(p.materials.required, 33, { intentReadiness: ready });
  assert.equal(isAllowedConditionalPlay(p, c), true);
  assert.equal(isAllowedConditionalPlay(p, { ...c, intentReadiness: { ...ready, washablePaint: false } }), false);
});
test("조건부 경로도 제외 재료·장소·시간 제한을 보존한다", () => {
  for (const changes of [{ blockedMaterials: ["glue"] as FilterInput["blockedMaterials"] }, { place: "outdoor" as const }, { availableMinutes: 1 }]) {
    assert.equal(getConditionalIntentCandidates(plays, ctx(cut, 33, changes)).length, 0);
  }
});
test("검수 후 본문·준비물·월령·게시 상태가 바뀌면 조건부 자격이 해제된다", () => {
  const p = find("play_192"), c = ctx(cut, 33, { intentReadiness: ready });
  for (const changes of [{ steps: [...p.steps, "새 동작"] }, { ageMin: 34 }, { status: "draft" as const }, { materials: { ...p.materials, optional: ["ball"] as Play["materials"]["optional"] } }]) assert.equal(isAllowedConditionalPlay({ ...p, ...changes }, c), false);
  const original = p.tip;
  try { p.tip = "내용 수정"; assert.equal(getReviewedIntent(p), null); }
  finally { p.tip = original; }
  assert.ok(getReviewedIntent(p));
});
test("작은 부품·풍선·미검수 상위 놀이는 카테고리만으로 확장하지 않는다", () => {
  for (const id of ["play_197", "play_018", "play_199", "play_113"]) {
    const p = find(id);
    assert.equal(isAllowedConditionalPlay(p, ctx(p.materials.required, 33, { intentReadiness: ready })), false);
  }
});
test("고정 추천 복원에서도 확인 철회·콘텐츠 수정은 상위 자격을 해제한다", () => {
  const p = find("play_192");
  assert.equal(isEligibleHomeRecommendation(p, ctx(cut, 33, { intentReadiness: ready })), true);
  assert.equal(isEligibleHomeRecommendation(p, ctx(cut)), false);
  assert.equal(isEligibleHomeRecommendation({ ...p, steps: [] }, ctx(cut, 33, { intentReadiness: ready })), false);
});
test("저장된 확인은 월령·재료·제외 재료 범위에만 재사용한다", () => {
  const c = ctx(cut), key = getIntentConfirmationKey(c);
  assert.equal(getIntentConfirmationKey({ ...c, availableMaterials: [...cut].reverse() }), key);
  assert.notEqual(getIntentConfirmationKey({ ...c, childAgeMonths: 34 }), key);
  assert.notEqual(getIntentConfirmationKey({ ...c, blockedMaterials: ["glue"] }), key);
  assert.notEqual(getIntentConfirmationKey(ctx(["paper", "glue"])), key);
});
test("저장값 파싱은 문자열 true나 손상된 값을 준비 완료로 간주하지 않는다", () => {
  assert.equal(parseIntentConfirmation("bad json"), null);
  assert.equal(parseIntentConfirmation('{"key":4,"readiness":{}}'), null);
  assert.equal(parseIntentConfirmation('{"key":"x","readiness":{"adultSupervision":"true"}}')?.readiness.adultSupervision, false);
  assert.deepEqual(parseIntentConfirmation(JSON.stringify({ key: "x", readiness: ready })), { key: "x", readiness: ready });
});
test("원래 컵 조합은 미판별 상태로 기존 추천을 유지한다", () => {
  const c = ctx(["transparent_cup", "rubber_band", "straw"], 33, { intentReadiness: ready });
  assert.deepEqual(recommend(plays, c, { totalPlays: 0 }).results.map((p) => p.id), ["play_159", "play_151", "play_158"]);
});
test("준비 완료 의도 승격은 준비물 전체가 있는 활동으로 한정한다", () => {
  const selected: FilterInput["availableMaterials"] = ["paper", "glue"];
  const r = recommend(plays, ctx(selected, 36, { intentReadiness: ready }), { totalPlays: 0 });
  assert.equal(r.results.some((p) => p.id === "play_195"), false);
  assert.ok(getMaterialFit(find("play_195"), new Set(selected)).missing > 1);
});
test("조건부 추천은 원본 콘텐츠의 월령과 동작을 바꾸지 않는다", () => {
  const before = JSON.stringify(plays);
  recommend(plays, ctx(cut, 33, { intentReadiness: ready }), { totalPlays: 0 });
  assert.equal(JSON.stringify(plays), before);
});
