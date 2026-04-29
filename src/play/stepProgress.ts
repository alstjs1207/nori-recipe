export function getNextIncompleteStepIndex(
  totalStepCount: number,
  completedSteps: number[],
): number {
  for (let index = 0; index < totalStepCount; index += 1) {
    if (!completedSteps.includes(index)) {
      return index;
    }
  }

  return -1;
}

export function completeStep(
  completedSteps: number[],
  stepIndex: number,
): number[] {
  if (stepIndex < 0 || completedSteps.includes(stepIndex)) {
    return completedSteps;
  }

  return [...completedSteps, stepIndex].sort((left, right) => left - right);
}

export function advanceAutoProgress(
  totalStepCount: number,
  completedSteps: number[],
): {
  completedSteps: number[];
  nextIncompleteStepIndex: number;
  allStepsCompleted: boolean;
} {
  const nextIncompleteStepIndex = getNextIncompleteStepIndex(
    totalStepCount,
    completedSteps,
  );

  if (nextIncompleteStepIndex < 0) {
    return {
      completedSteps,
      nextIncompleteStepIndex,
      allStepsCompleted: totalStepCount > 0,
    };
  }

  const nextCompletedSteps = completeStep(completedSteps, nextIncompleteStepIndex);

  return {
    completedSteps: nextCompletedSteps,
    nextIncompleteStepIndex: getNextIncompleteStepIndex(
      totalStepCount,
      nextCompletedSteps,
    ),
    allStepsCompleted: nextCompletedSteps.length === totalStepCount && totalStepCount > 0,
  };
}
