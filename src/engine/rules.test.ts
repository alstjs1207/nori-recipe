import assert from "node:assert/strict";
import test from "node:test";

import { applyFallback } from "@/engine/fallback";
import { hardFilter } from "@/engine/hardFilter";
import { softScore } from "@/engine/softScore";
import { DEFAULT_WEIGHTS } from "@/engine/weights";
import type { FilterInput, Play } from "@/types";

function createPlay(overrides: Partial<Play> & Pick<Play, "id" | "name">): Play {
  const defaults: Play = {
    ageMin: 12,
    ageMax: 36,
    place: "indoor",
    durationMin: 15,
    durationMax: 20,
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
    tags: [],
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
    availableMaterials: ["paper", "bowl"],
    blockedMaterials: [],
    availableMinutes: 20,
    place: "indoor",
    devGaps: {
      fine_motor: 80,
      cognitive: 60,
    },
    userFeedback: {
      fine_motor: 90,
      cognitive: 70,
    },
    ...overrides,
  };
}

test("hardFilter는 optional/substitutes에 포함된 금지 재료도 제외한다", () => {
  const play = createPlay({
    id: "blocked",
    name: "금지 재료 테스트",
    materials: {
      required: ["paper"],
      optional: ["cup"],
      substitutes: ["straw"],
    },
  });

  const result = hardFilter(
    play,
    createFilterInput({
      blockedMaterials: ["straw"],
    }),
  );

  assert.deepEqual(result, { pass: false, reason: "blocked_material" });
});

test("hardFilter는 시간 제한 1.3배까지는 허용하고 초과하면 제외한다", () => {
  const boundaryPlay = createPlay({
    id: "boundary",
    name: "경계 시간 놀이",
    durationMin: 26,
  });
  const overtimePlay = createPlay({
    id: "overtime",
    name: "초과 시간 놀이",
    durationMin: 27,
  });
  const ctx = createFilterInput({
    availableMinutes: 20,
  });

  assert.deepEqual(hardFilter(boundaryPlay, ctx), { pass: true });
  assert.deepEqual(hardFilter(overtimePlay, ctx), { pass: false, reason: "time" });
});

test("softScore는 재료 선택 의도가 약하면 무재료 놀이를 불이익 없이 본다", () => {
  const play = createPlay({
    id: "material-free",
    name: "무재료 놀이",
    materials: {
      required: [],
      optional: [],
      substitutes: [],
    },
  });

  const result = softScore(
    play,
    createFilterInput({
      availableMaterials: ["paper", "bowl"],
    }),
    DEFAULT_WEIGHTS,
  );

  assert.equal(result.breakdown.material, 35);
  assert.equal(result.total, 90.5);
});

test("softScore는 재료 선택 의도가 강하면 무재료 놀이 점수를 낮춘다", () => {
  const play = createPlay({
    id: "material-free",
    name: "무재료 놀이",
    materials: {
      required: [],
      optional: [],
      substitutes: [],
    },
  });

  const result = softScore(
    play,
    createFilterInput({
      availableMaterials: ["paper", "bowl", "cup"],
    }),
    DEFAULT_WEIGHTS,
  );

  assert.equal(result.breakdown.material, 7);
  assert.equal(result.total, 62.5);
});

test("softScore는 강한 재료 의도에서 부분 일치를 0점보다 높게 보상한다", () => {
  const partialMatch = createPlay({
    id: "partial",
    name: "부분 일치 놀이",
    materials: {
      required: ["paper", "straw"],
      optional: [],
      substitutes: [],
    },
  });
  const noMatch = createPlay({
    id: "none",
    name: "불일치 놀이",
    materials: {
      required: ["ball", "string"],
      optional: [],
      substitutes: [],
    },
  });
  const ctx = createFilterInput({
    availableMaterials: ["paper", "bowl", "cup"],
  });

  const partialResult = softScore(partialMatch, ctx, DEFAULT_WEIGHTS);
  const noMatchResult = softScore(noMatch, ctx, DEFAULT_WEIGHTS);

  assert.equal(partialResult.breakdown.material, 20.13);
  assert.equal(noMatchResult.breakdown.material, 0);
  assert.ok(partialResult.total > noMatchResult.total);
});

test("applyFallback는 완전 일치가 3개 이상이면 fallback 없이 그 풀만 유지한다", () => {
  const plays = [
    createPlay({ id: "full-1", name: "완전 일치 1", materials: { required: ["paper"], optional: [], substitutes: [] } }),
    createPlay({ id: "full-2", name: "완전 일치 2", materials: { required: ["bowl"], optional: [], substitutes: [] }, devAreas: ["cognitive"] }),
    createPlay({ id: "full-3", name: "완전 일치 3", materials: { required: [], optional: [], substitutes: [] }, devAreas: ["social"] }),
    createPlay({ id: "partial", name: "부분 일치", materials: { required: ["paper", "straw"], optional: [], substitutes: [] } }),
  ];

  const result = applyFallback(
    createFilterInput({
      availableMaterials: ["paper", "bowl"],
    }),
    plays,
  );

  assert.equal(result.usedFallback, false);
  assert.deepEqual(result.plays.map((play) => play.id), ["full-1", "full-2", "full-3"]);
});

test("applyFallback는 strict 후보가 3개 이상이면 완전 일치 후 부분 일치, 불일치 순으로 확장한다", () => {
  const plays = [
    createPlay({ id: "full", name: "완전 일치", materials: { required: ["paper"], optional: [], substitutes: [] } }),
    createPlay({ id: "partial", name: "부분 일치", materials: { required: ["paper", "straw"], optional: [], substitutes: [] }, devAreas: ["cognitive"] }),
    createPlay({ id: "none", name: "불일치", materials: { required: ["ball"], optional: [], substitutes: [] }, devAreas: ["social"] }),
  ];

  const result = applyFallback(
    createFilterInput({
      availableMaterials: ["paper"],
    }),
    plays,
  );

  assert.equal(result.usedFallback, true);
  assert.deepEqual(result.plays.map((play) => play.id), ["full", "partial", "none"]);
});

test("applyFallback는 strict 후보가 부족하면 시간 범위를 1.5배까지 넓힌다", () => {
  const plays = [
    createPlay({ id: "strict", name: "기준 시간", durationMin: 20, materials: { required: ["paper"], optional: [], substitutes: [] } }),
    createPlay({ id: "extended", name: "확장 시간", durationMin: 30, materials: { required: ["bowl"], optional: [], substitutes: [] }, devAreas: ["cognitive"] }),
    createPlay({ id: "too-long", name: "너무 긴 놀이", durationMin: 31, materials: { required: ["cup"], optional: [], substitutes: [] }, devAreas: ["social"] }),
  ];

  const result = applyFallback(
    createFilterInput({
      availableMinutes: 20,
      availableMaterials: ["paper", "bowl", "cup"],
    }),
    plays,
  );

  assert.equal(result.usedFallback, true);
  assert.deepEqual(result.plays.map((play) => play.id), ["strict", "extended"]);
});
