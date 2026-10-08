import assert from "node:assert/strict";
import test from "node:test";

import { searchPlays } from "@/play/search";
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
  assert.deepEqual(searchPlays(plays, { ...base, situation: "active", category: "physical" }).map((play) => play.id), ["active"]);
});
