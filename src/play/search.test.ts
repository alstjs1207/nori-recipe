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
