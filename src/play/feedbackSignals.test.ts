import assert from "node:assert/strict";
import test from "node:test";

import { applyFeedbackToUserContext } from "@/play/feedbackSignals";
import { DEFAULT_USER_CONTEXT } from "@/types";

test("높은 만족도와 긍정 반응을 추천 신호에 반영한다", () => {
  const result = applyFeedbackToUserContext(
    DEFAULT_USER_CONTEXT,
    ["fine_motor"],
    5,
    ["집중했어요"],
  );

  assert.equal(result.userFeedback.fine_motor, 60);
  assert.equal(result.devGaps.fine_motor, 40);
});

test("낮은 만족도와 어려운 반응을 추천 신호에 반영한다", () => {
  const result = applyFeedbackToUserContext(
    DEFAULT_USER_CONTEXT,
    ["language"],
    1,
    ["어려워했어요"],
  );

  assert.equal(result.userFeedback.language, 35);
  assert.equal(result.devGaps.language, 60);
});

test("추천 점수는 0에서 100 사이로 제한한다", () => {
  const result = applyFeedbackToUserContext(
    {
      ...DEFAULT_USER_CONTEXT,
      userFeedback: { fine_motor: 98 },
      devGaps: { fine_motor: 4 },
    },
    ["fine_motor"],
    5,
    ["집중했어요"],
  );

  assert.equal(result.userFeedback.fine_motor, 100);
  assert.equal(result.devGaps.fine_motor, 0);
});
