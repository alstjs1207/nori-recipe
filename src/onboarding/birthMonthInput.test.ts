import assert from "node:assert/strict";
import test from "node:test";
import { formatBirthMonthInput, getBirthMonthInputError, parseBirthMonthInput } from "./birthMonthInput";
import { getAgeMonthsFromBirthMonth } from "./utils";

const now = new Date(2026, 0, 31, 12);

test("생년월은 연도 경계를 포함해 기존 출생월 인덱스와 왕복한다", () => {
  for (const month of [2026 * 12, 2025 * 12 + 11, 2022 * 12]) {
    assert.equal(parseBirthMonthInput(formatBirthMonthInput(month)), month);
  }
  assert.equal(getAgeMonthsFromBirthMonth(parseBirthMonthInput("2025-12")!, now), 1);
  assert.equal(getBirthMonthInputError("2026-01", null, now), null);
  assert.equal(getBirthMonthInputError("2022-01", null, now), null);
});

test("빈 값·잘못된 형식·미래·49개월 이상 신규 생년월을 거부한다", () => {
  for (const value of ["", "2026-00", "2026-13", "0000-01", "2026-1", "2026-01-01", "2026-02", "2021-12"]) {
    assert.ok(getBirthMonthInputError(value, null, now), value);
  }
  for (const value of ["2026-00", "2026-13", "2026-01-01", "2026-1"]) {
    assert.equal(parseBirthMonthInput(value), null);
  }
});

test("48개월을 넘은 저장 생년월은 보존하되 다른 범위 밖 입력을 허용하지 않는다", () => {
  const saved = parseBirthMonthInput("2021-12")!;
  assert.equal(getBirthMonthInputError("2021-12", saved, now), null);
  assert.equal(getAgeMonthsFromBirthMonth(saved, now), 49);
  assert.ok(getBirthMonthInputError("2021-11", saved, now));
  assert.ok(getBirthMonthInputError("2026-02", parseBirthMonthInput("2026-02"), now));
});

test("월말·연말과 시간대는 기기의 현재 연월 규칙을 따른다", () => {
  const birth = parseBirthMonthInput("2025-12")!;
  assert.equal(getAgeMonthsFromBirthMonth(birth, new Date(2025, 11, 31, 23, 59)), 0);
  assert.equal(getAgeMonthsFromBirthMonth(birth, new Date(2026, 0, 1)), 1);
  assert.equal(getAgeMonthsFromBirthMonth(birth, new Date(2026, 1, 28)), 2);
});
