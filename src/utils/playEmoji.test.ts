import assert from "node:assert/strict";
import test from "node:test";

import type { Play } from "@/types";
import { getPlayRepresentativeEmoji } from "@/utils/playEmoji";

function createPlay(overrides: Partial<Play> & Pick<Play, "id" | "name">): Play {
  const defaults: Play = {
    ageMin: 12,
    ageMax: 24,
    place: "indoor",
    durationMin: 10,
    durationMax: 15,
    prepTime: 3,
    difficulty: 1,
    devAreas: ["cognitive"],
    materials: {
      required: [],
      optional: [],
      substitutes: [],
    },
    steps: ["준비", "놀이"],
    safetyNotes: [],
    educationalEffects: ["집중력 향상"],
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

test("놀이 이름 키워드로 대표 이모지를 선택한다", () => {
  assert.equal(
    getPlayRepresentativeEmoji(createPlay({ id: "wind", name: "바람 불기 놀이 (종이배·바람개비)" })),
    "🌬️",
  );
  assert.equal(
    getPlayRepresentativeEmoji(createPlay({ id: "story", name: "스토리텔링 (자기 전 이야기 들려주기)" })),
    "📖",
  );
  assert.equal(
    getPlayRepresentativeEmoji(createPlay({ id: "pillow", name: "베개 쿠션 요새 놀이" })),
    "🛏️",
  );
});

test("이름 매칭이 없으면 준비물 이모지를 사용한다", () => {
  const emoji = getPlayRepresentativeEmoji(
    createPlay({
      id: "mirror",
      name: "반짝반짝 탐색 놀이",
      materials: {
        required: ["mirror"],
        optional: [],
        substitutes: [],
      },
    }),
  );

  assert.equal(emoji, "🪞");
});

test("이름과 준비물 매칭이 모두 없으면 발달영역 이모지로 fallback 한다", () => {
  const emoji = getPlayRepresentativeEmoji(
    createPlay({
      id: "fallback",
      name: "새로운 놀이",
      devAreas: ["social"],
    }),
  );

  assert.equal(emoji, "🤝");
});
