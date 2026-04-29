import assert from "node:assert/strict";
import test from "node:test";

import { MATERIAL_DISPLAY_NAMES } from "@/constants/materials";
import {
  ONBOARDING_VISIBLE_CATEGORIES,
  formatBirthMonth,
  getAgeMonthsFromBirthMonth,
  getBirthMonthOptions,
  getVisibleMaterialCategories,
} from "@/onboarding/utils";

test("formatBirthMonth는 월을 두 자리로 포맷한다", () => {
  assert.equal(formatBirthMonth(2026 * 12), "2026.01");
  assert.equal(formatBirthMonth(2026 * 12 + 3), "2026.04");
});

test("getAgeMonthsFromBirthMonth는 기준 월 차이를 계산하고 미래 월은 0으로 고정한다", () => {
  const referenceDate = new Date("2026-04-16T00:00:00.000Z");

  assert.equal(getAgeMonthsFromBirthMonth(2024 * 12 + 9, referenceDate), 18);
  assert.equal(getAgeMonthsFromBirthMonth(2026 * 12 + 5, referenceDate), 0);
});

test("getBirthMonthOptions는 19~24개월을 우선 노출하고 전체 49개월 범위를 유지한다", () => {
  const referenceDate = new Date("2026-04-16T00:00:00.000Z");
  const options = getBirthMonthOptions(referenceDate);

  assert.equal(options.length, 49);
  assert.deepEqual(
    options.slice(0, 6).map((option) => option.ageMonths),
    [19, 20, 21, 22, 23, 24],
  );
  assert.equal(options[0]?.monthLabel, "2024.09");
  assert.equal(options[0]?.ageLabel, "19개월");
  assert.equal(new Set(options.map((option) => option.monthIndex)).size, 49);
});

test("getVisibleMaterialCategories는 온보딩 노출 카테고리 순서를 유지한다", () => {
  const categories = getVisibleMaterialCategories();

  assert.deepEqual(
    categories.map((category) => category.name),
    [...ONBOARDING_VISIBLE_CATEGORIES],
  );
  assert.deepEqual(categories.at(-1), {
    name: "도구",
    materials: ["scissors", "tongs", "smartphone", "flashlight", "mat", "shape_ruler"],
  });
  assert.ok(categories.every((category) => category.materials.length > 0));
  assert.ok(
    categories.every((category) =>
      category.materials.every((material) => material in MATERIAL_DISPLAY_NAMES),
    ),
  );
});
