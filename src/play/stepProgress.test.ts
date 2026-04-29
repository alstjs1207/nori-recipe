import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceAutoProgress,
  completeStep,
  getNextIncompleteStepIndex,
} from "@/play/stepProgress";

test("getNextIncompleteStepIndex는 가장 앞의 미완료 단계를 찾는다", () => {
  assert.equal(getNextIncompleteStepIndex(4, []), 0);
  assert.equal(getNextIncompleteStepIndex(4, [0, 2]), 1);
  assert.equal(getNextIncompleteStepIndex(4, [0, 1, 2, 3]), -1);
});

test("completeStep은 단계를 중복 없이 정렬된 상태로 추가한다", () => {
  assert.deepEqual(completeStep([2], 1), [1, 2]);
  assert.deepEqual(completeStep([0, 1], 1), [0, 1]);
  assert.deepEqual(completeStep([0, 1], -1), [0, 1]);
});

test("advanceAutoProgress는 한 번 호출할 때마다 다음 단계 하나만 순서대로 완료한다", () => {
  const firstTick = advanceAutoProgress(3, []);
  assert.deepEqual(firstTick.completedSteps, [0]);
  assert.equal(firstTick.nextIncompleteStepIndex, 1);
  assert.equal(firstTick.allStepsCompleted, false);

  const secondTick = advanceAutoProgress(3, firstTick.completedSteps);
  assert.deepEqual(secondTick.completedSteps, [0, 1]);
  assert.equal(secondTick.nextIncompleteStepIndex, 2);
  assert.equal(secondTick.allStepsCompleted, false);

  const thirdTick = advanceAutoProgress(3, secondTick.completedSteps);
  assert.deepEqual(thirdTick.completedSteps, [0, 1, 2]);
  assert.equal(thirdTick.nextIncompleteStepIndex, -1);
  assert.equal(thirdTick.allStepsCompleted, true);
});

test("advanceAutoProgress는 일부 단계가 이미 완료된 상태에서도 남은 단계를 이어서 완료한다", () => {
  const result = advanceAutoProgress(4, [0, 2]);

  assert.deepEqual(result.completedSteps, [0, 1, 2]);
  assert.equal(result.nextIncompleteStepIndex, 3);
  assert.equal(result.allStepsCompleted, false);
});

test("advanceAutoProgress는 모든 단계가 완료된 뒤에는 상태를 그대로 유지한다", () => {
  const result = advanceAutoProgress(2, [0, 1]);

  assert.deepEqual(result.completedSteps, [0, 1]);
  assert.equal(result.nextIncompleteStepIndex, -1);
  assert.equal(result.allStepsCompleted, true);
});
