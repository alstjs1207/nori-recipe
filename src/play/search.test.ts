import assert from "node:assert/strict";
import test from "node:test";

import { searchPlays } from "@/play/search";
import { getPlayCategoryLabel, readPlayCategory } from "@/play/presentation";
import { sortSearchPlays } from "@/play/searchSort";
import type { Play } from "@/types";

function createPlay(overrides: Partial<Play> & Pick<Play, "id" | "name">): Play {
  return {
    ageMin: 12,
    ageMax: 36,
    place: "indoor",
    durationMin: 10,
    durationMax: 20,
    prepTime: 5,
    difficulty: 1,
    devAreas: ["fine_motor"],
    materials: { required: ["paper"], optional: [], substitutes: [] },
    steps: ["함께 놀이해요"],
    safetyNotes: [],
    educationalEffects: [],
    tags: [],
    source: { type: "manual", url: null, instagramAccount: null },
    status: "live",
    ...overrides,
    id: overrides.id,
    name: overrides.name,
  };
}

test("실내·실외 필터에는 어디서나 놀이도 포함한다", () => {
  const plays = [
    createPlay({ id: "indoor", name: "실내", place: "indoor" }),
    createPlay({ id: "outdoor", name: "실외", place: "outdoor" }),
    createPlay({ id: "any", name: "어디서나", place: "any" }),
  ];

  assert.deepEqual(
    searchPlays(plays, { ageMonths: 24, place: "indoor", query: "" }).map((play) => play.id),
    ["indoor", "any"],
  );
  assert.deepEqual(
    searchPlays(plays, { ageMonths: 24, place: "outdoor", query: "" }).map((play) => play.id),
    ["outdoor", "any"],
  );
});

test("어디서나 필터는 모든 장소를 검색한다", () => {
  const plays = [
    createPlay({ id: "indoor", name: "실내", place: "indoor" }),
    createPlay({ id: "outdoor", name: "실외", place: "outdoor" }),
    createPlay({ id: "any", name: "어디서나", place: "any" }),
  ];

  assert.deepEqual(
    searchPlays(plays, { ageMonths: 24, place: "any", query: "" }).map((play) => play.id),
    ["indoor", "outdoor", "any"],
  );
});

test("재료 표시명과 발달 영역 이름으로 검색한다", () => {
  const plays = [
    createPlay({ id: "paint", name: "그림 놀이", devAreas: ["cognitive"], materials: { required: ["paint"], optional: [], substitutes: [] } }),
    createPlay({ id: "motor", name: "손 놀이", devAreas: ["fine_motor"], materials: { required: [], optional: [], substitutes: [] } }),
  ];

  assert.deepEqual(
    searchPlays(plays, { ageMonths: 24, place: null, query: "물감" }).map((play) => play.id),
    ["paint"],
  );
  assert.deepEqual(
    searchPlays(plays, { ageMonths: 24, place: null, query: "소근육" }).map((play) => play.id),
    ["motor"],
  );
});

test("출시 상태와 월령 범위를 적용한다", () => {
  const plays = [
    createPlay({ id: "live", name: "현재 놀이" }),
    createPlay({ id: "draft", name: "초안", status: "draft" }),
    createPlay({ id: "older", name: "형님 놀이", ageMin: 37, ageMax: 48 }),
  ];

  assert.deepEqual(
    searchPlays(plays, { ageMonths: 24, place: null, query: "" }).map((play) => play.id),
    ["live"],
  );
});

test("시간 상한은 놀이의 최대 시간에 적용하고 결과 수를 임의로 줄이지 않는다", () => {
  const plays = [
    createPlay({ id: "short", name: "짧은 놀이", durationMin: 10, durationMax: 20 }),
    createPlay({ id: "long", name: "긴 놀이", durationMin: 15, durationMax: 30 }),
    ...Array.from({ length: 30 }, (_, index) => createPlay({ id: `play-${index}`, name: "놀이" })),
  ];
  const results = searchPlays(plays, { ageMonths: 24, place: null, query: "", durationMax: 20, limit: Number.MAX_SAFE_INTEGER });
  assert.equal(results.length, 31);
  assert.ok(results.every((play) => play.durationMax <= 20));
  assert.ok(!results.some((play) => play.id === "long"));
});

test("필수 준비물이 없는 놀이와 보유 재료 조건은 선택 재료를 요구하지 않는다", () => {
  const plays = [
    createPlay({ id: "no-required", name: "맨손 놀이", materials: { required: [], optional: ["ball"], substitutes: [] } }),
    createPlay({ id: "ready", name: "종이 놀이", materials: { required: ["paper"], optional: ["paint"], substitutes: [] } }),
    createPlay({ id: "missing", name: "물감 놀이", materials: { required: ["paint"], optional: [], substitutes: [] } }),
  ];
  const base = { ageMonths: 24, place: null, query: "" };
  assert.deepEqual(searchPlays(plays, { ...base, situation: "no-materials" }).map((play) => play.id), ["no-required"]);
  assert.deepEqual(searchPlays(plays, { ...base, readyOnly: true, availableMaterials: ["paper"] }).map((play) => play.id), ["no-required", "ready"]);
  assert.deepEqual(searchPlays(plays, { ...base, blockedMaterials: ["paint"] }).map((play) => play.id), ["no-required"]);
});

test("분류와 상황 조건을 월령·시간 조건과 함께 적용한다", () => {
  const plays = [
    createPlay({ id: "active", name: "뛰기", devAreas: ["gross_motor"] }),
    createPlay({ id: "bedtime", name: "이야기", prepTime: 0, devAreas: ["language", "emotional"] }),
    createPlay({ id: "outside", name: "산책 이야기", place: "outdoor", prepTime: 0, devAreas: ["language"] }),
  ];
  const base = { ageMonths: 24, place: null, query: "", durationMax: 20 };
  assert.deepEqual(searchPlays(plays, { ...base, situation: "bedtime", category: "language" }).map((play) => play.id), ["bedtime"]);
  assert.deepEqual(searchPlays(plays, { ...base, situation: "active", category: "gross_motor" }).map((play) => play.id), ["active"]);
});

test("발달 영역은 두 번째 태그에도 일치하고 본문에만 언급된 영역은 포함하지 않는다", () => {
  const plays = [
    createPlay({ id: "social", name: "함께 그리기", devAreas: ["fine_motor", "social"] }),
    createPlay({ id: "language", name: "이야기", devAreas: ["language"], steps: ["사회성에도 도움이 되는 설명"] }),
    createPlay({ id: "draft", name: "미공개", devAreas: ["social"], status: "draft" }),
  ];
  const results = searchPlays(plays, { ageMonths: 24, place: null, query: "", category: "social" });
  assert.deepEqual(results.map((play) => play.id), ["social"]);
  assert.equal(getPlayCategoryLabel(plays[0]), "소근육 · 사회성 놀이");
});

test("기록에서 전달한 영역을 읽고 잘못된 영역은 전체로 되돌린다", () => {
  assert.equal(readPlayCategory("social"), "social");
  assert.equal(readPlayCategory(["gross_motor", "language"]), "gross_motor");
  for (const value of [undefined, "unknown", "art", "physical", "toString", []]) {
    assert.equal(readPlayCategory(value), "all");
  }
});

test("미술 유형은 선택 재료·그림책·일반 만들기에 끌려가지 않고 영역과 함께 걸러진다", () => {
  const plays = [
    createPlay({ id: "jump", name: "두 발 모아 점프 놀이", devAreas: ["gross_motor"], materials: { required: [], optional: ["sticker"], substitutes: [] } }),
    createPlay({ id: "book", name: "감정 그림책 읽기", devAreas: ["language"] }),
    createPlay({ id: "story", name: "이야기 이어 만들기", devAreas: ["language"] }),
    createPlay({ id: "drawing", name: "함께 그리기", devAreas: ["fine_motor", "social"] }),
    createPlay({ id: "origami", name: "색종이 접기", devAreas: ["fine_motor"] }),
    createPlay({ id: "art", name: "손끝 자국", devAreas: ["sensory"], tags: ["미술놀이"] }),
  ];
  const base = { ageMonths: 24, place: null, query: "" };
  assert.deepEqual(searchPlays(plays, { ...base, playType: "art" }).map((play) => play.id), ["drawing", "origami", "art"]);
  assert.deepEqual(searchPlays(plays, { ...base, category: "social", playType: "art" }).map((play) => play.id), ["drawing"]);
  assert.equal(getPlayCategoryLabel(plays[0]), "대근육 놀이");
});

test("새 놀이를 먼저 표시하고 NEW 안에서는 등록일·재료 충족도·준비 시간순을 따른다", () => {
  const plays = [
    createPlay({ id: "old-ready", name: "기존 놀이", prepTime: 0 }),
    createPlay({ id: "older-new", name: "먼저 등록한 NEW", createdAt: "2026-10-09", prepTime: 0, materials: { required: [], optional: [], substitutes: [] } }),
    createPlay({ id: "newest-missing", name: "최신 NEW 재료 부족", createdAt: "2026-10-10", prepTime: 0, materials: { required: ["paint"], optional: [], substitutes: [] } }),
    createPlay({ id: "newest-ready", name: "최신 NEW 준비 가능", createdAt: "2026-10-10", prepTime: 5 }),
    createPlay({ id: "newest-fast", name: "최신 NEW 빠른 준비", createdAt: "2026-10-10", prepTime: 2 }),
  ];
  const originalOrder = plays.map((play) => play.id);
  const result = sortSearchPlays(plays, { availableMaterials: ["paper"], now: new Date("2026-10-12T12:00:00+09:00") });
  assert.deepEqual(result.map((play) => play.id), ["newest-fast", "newest-ready", "newest-missing", "older-new", "old-ready"]);
  assert.deepEqual(plays.map((play) => play.id), originalOrder);
});

test("NEW 종료 시각부터 맞춤 기준으로 돌아가며 미래·잘못된 생성일은 우선 표시하지 않는다", () => {
  const missing: Play["materials"] = { required: ["paint"], optional: [], substitutes: [] };
  const plays = [
    createPlay({ id: "future", name: "미래 등록일", createdAt: "2026-11-10", materials: missing, prepTime: 0 }),
    createPlay({ id: "invalid", name: "잘못된 등록일", createdAt: "2026-02-30", materials: missing, prepTime: 0 }),
    createPlay({ id: "new", name: "기간 종료 NEW", createdAt: "2026-10-09", materials: missing, prepTime: 0 }),
    createPlay({ id: "old-ready", name: "준비 가능한 기존 놀이" }),
  ];
  const base = { availableMaterials: ["paper"] as const };
  assert.equal(sortSearchPlays(plays, { ...base, now: new Date("2026-11-08T23:59:59.999+09:00") })[0].id, "new");
  assert.deepEqual(sortSearchPlays(plays, { ...base, now: new Date("2026-11-09T00:00:00+09:00") }).map((play) => play.id), ["old-ready", "future", "invalid", "new"]);
});

test("선택한 맞춤순·놀이 시간순·준비 시간순은 NEW보다 해당 기준을 먼저 적용한다", () => {
  const plays = [
    createPlay({ id: "new-long", name: "새 긴 놀이", createdAt: "2026-10-09", durationMax: 30, prepTime: 10, materials: { required: ["paint"], optional: [], substitutes: [] } }),
    createPlay({ id: "old-short", name: "기존 짧은 놀이", durationMin: 5, durationMax: 5, prepTime: 0, materials: { required: ["paint"], optional: [], substitutes: [] } }),
    createPlay({ id: "old-ready", name: "기존 준비 가능한 놀이", durationMax: 10, prepTime: 5 }),
  ];
  const base = { availableMaterials: ["paper"] as const, now: new Date("2026-10-12T12:00:00+09:00") };
  assert.deepEqual(sortSearchPlays(plays, { ...base, sort: "recommended" }).map((play) => play.id), ["old-ready", "old-short", "new-long"]);
  assert.deepEqual(sortSearchPlays(plays, { ...base, sort: "shortest" }).map((play) => play.id), ["old-short", "old-ready", "new-long"]);
  assert.deepEqual(sortSearchPlays(plays, { ...base, sort: "preparation" }).map((play) => play.id), ["old-short", "old-ready", "new-long"]);
});

test("필터와 결과 수 제한 사이에서 정렬하여 뒤에 등록된 NEW도 첫 결과에 포함한다", () => {
  const now = new Date("2026-10-12T12:00:00+09:00");
  const newPlay = { createdAt: "2026-10-09", ageMin: 36, ageMax: 48 };
  const plays = [
    ...Array.from({ length: 25 }, (_, index) => createPlay({ id: `old-${index}`, name: "기존 놀이" })),
    createPlay({ ...newPlay, id: "wrong-age", name: "월령 제외", ageMin: 0, ageMax: 6 }),
    createPlay({ ...newPlay, id: "wrong-area", name: "영역 제외", devAreas: ["social"] }),
    createPlay({ ...newPlay, id: "blocked", name: "재료 제외", materials: { required: ["paint"], optional: [], substitutes: [] } }),
    createPlay({ ...newPlay, id: "draft", name: "미공개", status: "draft" }),
    createPlay({ ...newPlay, id: "eligible-new", name: "조건에 맞는 새 놀이" }),
  ];
  const base = { ageMonths: 36, place: null, query: "", category: "fine_motor" as const, blockedMaterials: ["paint"] as const, limit: 1, now };
  assert.deepEqual(searchPlays(plays, base).map((play) => play.id), ["eligible-new"]);
  assert.deepEqual(searchPlays(plays, { ...base, ageMonths: 24 }).map((play) => play.id), ["old-0"]);
});
