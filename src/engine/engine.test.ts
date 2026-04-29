import assert from "node:assert/strict";
import test from "node:test";

import { MATERIAL_SLUGS } from "@/constants/materials";
import { pickTop3 } from "@/engine/diversity";
import { recommend } from "@/engine/recommend";
import type { ScoredPlay } from "@/engine/types";
import { COLD_START_WEIGHTS, DEFAULT_WEIGHTS } from "@/engine/weights";
import { loadLivePlays } from "@/data/content";
import type { Play, FilterInput } from "@/types";

function createPlay(overrides: Partial<Play> & Pick<Play, "id" | "name">): Play {
  const defaults: Play = {
    ageMin: 12,
    ageMax: 36,
    place: "indoor",
    durationMin: 15,
    durationMax: 25,
    prepTime: 5,
    difficulty: 1,
    devAreas: ["fine_motor"],
    materials: {
      required: ["paper"],
      optional: [],
      substitutes: [],
    },
    steps: ["준비", "놀이"],
    safetyNotes: [],
    educationalEffects: ["소근육 발달"],
    tags: ["실내"],
    source: {
      type: "manual",
      url: null,
      instagramAccount: null,
    },
    status: "live",
    id: "play-default",
    name: "기본 놀이",
  };

  return {
    ...defaults,
    ...overrides,
  };
}

function createFilterInput(overrides: Partial<FilterInput> = {}): FilterInput {
  return {
    childAgeMonths: 24,
    availableMaterials: ["paper", "bowl", "cup"],
    blockedMaterials: [],
    availableMinutes: 20,
    place: "indoor",
    devGaps: {
      fine_motor: 90,
      cognitive: 80,
      social: 70,
      language: 60,
    },
    userFeedback: {
      fine_motor: 80,
      cognitive: 70,
      social: 60,
      language: 50,
    },
    ...overrides,
  };
}

test("현재 plays 번들 기준으로 추천 결과 3개를 반환한다", () => {
  const result = recommend(loadLivePlays(), createFilterInput({ availableMaterials: MATERIAL_SLUGS }), {
    totalPlays: 5,
  });

  assert.equal(result.results.length, 3);
  assert.deepEqual(result.appliedWeights, DEFAULT_WEIGHTS);
});

test("재료가 부족하면 폴백을 적용해 후보를 확장한다", () => {
  const plays = [
    createPlay({ id: "play-1", name: "종이 놀이", materials: { required: ["paper"], optional: [], substitutes: [] } }),
    createPlay({ id: "play-2", name: "그릇 놀이", materials: { required: ["bowl"], optional: [], substitutes: [] }, devAreas: ["cognitive"] }),
    createPlay({ id: "play-3", name: "컵 놀이", materials: { required: ["cup"], optional: [], substitutes: [] }, devAreas: ["social"] }),
  ];

  const result = recommend(plays, createFilterInput({ availableMaterials: ["paper"] }), {
    totalPlays: 4,
  });

  assert.equal(result.usedFallback, true);
  assert.equal(result.results.length, 3);
});

test("콜드 스타트에서는 콜드 스타트 가중치를 사용한다", () => {
  const plays = [
    createPlay({ id: "play-1", name: "종이 놀이" }),
    createPlay({ id: "play-2", name: "인지 놀이", devAreas: ["cognitive"] }),
    createPlay({ id: "play-3", name: "사회성 놀이", devAreas: ["social"] }),
  ];

  const result = recommend(plays, createFilterInput(), {
    totalPlays: 0,
  });

  assert.deepEqual(result.appliedWeights, COLD_START_WEIGHTS);
  assert.equal(result.results.length, 3);
});

test("최근 완료한 추천은 대체 후보가 있으면 홈에서 우선 제외한다", () => {
  const plays = [
    createPlay({ id: "play-1", name: "최근 완료 A", devAreas: ["fine_motor"] }),
    createPlay({ id: "play-2", name: "최근 완료 B", devAreas: ["cognitive"] }),
    createPlay({ id: "play-3", name: "최근 완료 C", devAreas: ["social"] }),
    createPlay({ id: "play-4", name: "새 추천 D", devAreas: ["language"] }),
    createPlay({ id: "play-5", name: "새 추천 E", devAreas: ["emotional"] }),
    createPlay({ id: "play-6", name: "새 추천 F", devAreas: ["gross_motor"] }),
  ];

  const result = recommend(plays, createFilterInput(), {
    totalPlays: 5,
    recentCompletedPlayIds: ["play-1", "play-2", "play-3"],
  });

  assert.deepEqual(result.results.map((play) => play.id), ["play-4", "play-5", "play-6"]);
});

test("대체 후보가 부족하면 최근 완료한 추천도 보충 후보로 다시 포함한다", () => {
  const plays = [
    createPlay({ id: "play-1", name: "최근 완료 A", devAreas: ["fine_motor"] }),
    createPlay({ id: "play-2", name: "최근 완료 B", devAreas: ["cognitive"] }),
    createPlay({ id: "play-3", name: "새 추천 C", devAreas: ["social"] }),
  ];

  const result = recommend(plays, createFilterInput(), {
    totalPlays: 5,
    recentCompletedPlayIds: ["play-1", "play-2"],
  });

  assert.deepEqual(result.results.map((play) => play.id), ["play-3", "play-1", "play-2"]);
});

test("pickTop3는 발달 영역 다양성을 우선한다", () => {
  const candidates: ScoredPlay[] = [
    { play: createPlay({ id: "play-1", name: "소근육 A", devAreas: ["fine_motor"] }), total: 95, breakdown: { material: 30, dev: 30, popular: 0, time: 10, feedback: 25 } },
    { play: createPlay({ id: "play-2", name: "소근육 B", devAreas: ["fine_motor"] }), total: 94, breakdown: { material: 30, dev: 29, popular: 0, time: 10, feedback: 25 } },
    { play: createPlay({ id: "play-3", name: "인지 놀이", devAreas: ["cognitive"] }), total: 90, breakdown: { material: 30, dev: 25, popular: 0, time: 10, feedback: 25 } },
    { play: createPlay({ id: "play-4", name: "사회성 놀이", devAreas: ["social"] }), total: 88, breakdown: { material: 28, dev: 25, popular: 0, time: 10, feedback: 25 } },
  ];

  const top3 = pickTop3(candidates, createFilterInput({ availableMaterials: ["paper", "bowl", "cup"] }));

  assert.deepEqual(
    top3.map((play) => play.id),
    ["play-1", "play-3", "play-4"],
  );
});

test("재료를 3개 이상 고르면 무재료 놀이는 최대 1개까지만 포함한다", () => {
  const candidates: ScoredPlay[] = [
    { play: createPlay({ id: "play-1", name: "정확 일치 놀이", materials: { required: ["paper"], optional: [], substitutes: [] }, devAreas: ["fine_motor"] }), total: 95, breakdown: { material: 35, dev: 25, popular: 0, time: 10, feedback: 25 } },
    { play: createPlay({ id: "play-2", name: "무재료 A", materials: { required: [], optional: [], substitutes: [] }, devAreas: ["social"] }), total: 90, breakdown: { material: 35, dev: 20, popular: 0, time: 10, feedback: 25 } },
    { play: createPlay({ id: "play-3", name: "무재료 B", materials: { required: [], optional: [], substitutes: [] }, devAreas: ["language"] }), total: 89, breakdown: { material: 35, dev: 19, popular: 0, time: 10, feedback: 25 } },
    { play: createPlay({ id: "play-4", name: "부분 일치 놀이", materials: { required: ["paper", "straw"], optional: [], substitutes: [] }, devAreas: ["cognitive"] }), total: 70, breakdown: { material: 8, dev: 27, popular: 0, time: 10, feedback: 25 } },
  ];

  const top3 = pickTop3(candidates, createFilterInput({ availableMaterials: ["paper", "bowl", "cup"] }));

  assert.deepEqual(
    top3.map((play) => play.id),
    ["play-1", "play-4", "play-2"],
  );
});

test("재료 의도가 강하면 부분 일치 재료가 무재료 놀이보다 우선한다", () => {
  const exact = createPlay({
    id: "play-1",
    name: "정확 일치 놀이",
    materials: { required: ["paper", "bowl"], optional: [], substitutes: [] },
  });
  const partial = createPlay({
    id: "play-2",
    name: "부분 일치 놀이",
    materials: { required: ["paper", "straw"], optional: [], substitutes: [] },
    devAreas: ["social"],
  });
  const noMaterials = createPlay({
    id: "play-3",
    name: "무재료 놀이",
    materials: { required: [], optional: [], substitutes: [] },
    devAreas: ["language"],
  });

  const result = recommend([exact, partial, noMaterials], createFilterInput({ availableMaterials: ["paper", "bowl", "cup"] }), {
    totalPlays: 5,
  });

  assert.deepEqual(result.results.map((play) => play.id), ["play-1", "play-2", "play-3"]);
});

test("place가 any면 실내와 실외 놀이를 모두 후보로 본다", () => {
  const indoor = createPlay({
    id: "play-1",
    name: "실내 놀이",
    place: "indoor",
  });
  const outdoor = createPlay({
    id: "play-2",
    name: "실외 놀이",
    place: "outdoor",
    devAreas: ["gross_motor"],
  });
  const anyPlace = createPlay({
    id: "play-3",
    name: "어디서나 놀이",
    place: "any",
    devAreas: ["social"],
  });

  const result = recommend(
    [indoor, outdoor, anyPlace],
    createFilterInput({ place: "any" }),
    { totalPlays: 5 },
  );

  assert.equal(result.results.length, 3);
  assert.deepEqual(
    [...result.results.map((play) => play.id)].sort(),
    ["play-1", "play-2", "play-3"],
  );
});

test("조건을 만족하는 놀이가 없으면 빈 결과를 반환한다", () => {
  const plays = [createPlay({ id: "play-1", name: "실내 놀이", ageMin: 30, ageMax: 36 })];

  const result = recommend(plays, createFilterInput({ childAgeMonths: 12 }), {
    totalPlays: 5,
  });

  assert.deepEqual(result.results, []);
  assert.equal(result.usedFallback, true);
});
