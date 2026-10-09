import assert from "node:assert/strict";
import test from "node:test";

import { getPlaySafetyNotes } from "@/play/safety";
import type { Play } from "@/types";

function createPlay(overrides: Partial<Play> = {}): Play {
  return {
    id: "play-test",
    name: "테스트 놀이",
    ageMin: 12,
    ageMax: 24,
    place: "indoor",
    durationMin: 10,
    durationMax: 15,
    prepTime: 5,
    difficulty: 1,
    devAreas: ["sensory"],
    materials: { required: [], optional: [], substitutes: [] },
    steps: ["놀이해요"],
    safetyNotes: [],
    educationalEffects: [],
    tags: [],
    source: { type: "manual", url: null, instagramAccount: null },
    status: "live",
    ...overrides,
  };
}

test("등록된 주의사항이 없어도 보호자 감독 안내를 제공한다", () => {
  const notes = getPlaySafetyNotes(createPlay());

  assert.equal(notes.length, 1);
  assert.match(notes[0], /보호자/);
});

test("작은 재료에는 삼킴·질식 경고를 추가한다", () => {
  for (const slug of ["marble", "pom_pom"] as const) {
    const notes = getPlaySafetyNotes(
      createPlay({ materials: { required: [slug], optional: [], substitutes: [] } }),
    );
    assert.ok(notes.some((note) => note.includes("질식")), slug);
    assert.ok(notes.some((note) => note.includes("3세 미만에게 제공하지")), slug);
  }
});

test("생가루 금지 안내와 이미 적합한 식재료의 탐색 안내를 구분한다", () => {
  const flour = getPlaySafetyNotes(createPlay({ materials: { required: ["flour"], optional: [], substitutes: [] } }));
  const food = getPlaySafetyNotes(createPlay({ materials: { required: ["soft_food"], optional: [], substitutes: [] } }));

  assert.ok(flour.some((note) => note.includes("놀이로 제공하지")));
  assert.ok(food.some((note) => note.includes("알레르기")));
  assert.ok(food.every((note) => !note.includes("생밀가루")));
});

test("무독성 미술 재료에도 사용 연령과 비식용 안내를 제공한다", () => {
  const notes = getPlaySafetyNotes(createPlay({ materials: { required: ["paint"], optional: [], substitutes: [] } }));

  assert.ok(notes.some((note) => note.includes("사용 연령")));
  assert.ok(notes.some((note) => note.includes("먹어도 된다는 뜻이 아니")));
});

test("콘텐츠 주의사항을 유지하면서 재료별 안내를 보완한다", () => {
  const notes = getPlaySafetyNotes(
    createPlay({
      materials: { required: ["water"], optional: [], substitutes: [] },
      safetyNotes: ["욕실 문을 열어 둡니다."],
    }),
  );

  assert.equal(notes[0], "욕실 문을 열어 둡니다.");
  assert.ok(notes.some((note) => note.includes("미끄럼")));
});
