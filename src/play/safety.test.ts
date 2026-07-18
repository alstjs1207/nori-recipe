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
  const notes = getPlaySafetyNotes(
    createPlay({ materials: { required: ["marble"], optional: [], substitutes: [] } }),
  );

  assert.ok(notes.some((note) => note.includes("질식")));
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
