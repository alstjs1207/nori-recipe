import assert from "node:assert/strict";
import test from "node:test";

import { buildOnboardingFilterInput } from "@/onboarding/utils";
import type { UserContext } from "@/types";

function createUserContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    childBirthMonth: 24299,
    ownedMaterials: ["paper", "cup"],
    blockedMaterials: [],
    preferredDevAreas: [],
    devGaps: {},
    userFeedback: {},
    ...overrides,
  };
}

test("buildOnboardingFilterInput keeps an explicitly empty materials selection", () => {
  const filterInput = buildOnboardingFilterInput(
    createUserContext({
      ownedMaterials: [],
    }),
  );

  assert.deepEqual(filterInput?.availableMaterials, []);
});

test("buildOnboardingFilterInput returns null when birth month is missing", () => {
  const filterInput = buildOnboardingFilterInput(
    createUserContext({
      childBirthMonth: null,
    }),
  );

  assert.equal(filterInput, null);
});
