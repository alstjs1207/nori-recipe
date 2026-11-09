import assert from "node:assert/strict";
import test from "node:test";
import { formatBirthMonthInput, getBirthMonthInputError, getBirthMonthsInYear, getBirthYears, parseBirthMonthInput, selectBirthYear } from "./birthMonthInput";
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

test("년·월 휠은 0~48개월 범위와 기존의 오래된 출생월만 제공한다", () => {
  const reference = new Date(2026, 10, 9);
  assert.deepEqual(getBirthYears(null, reference), [2026, 2025, 2024, 2023, 2022]);
  assert.deepEqual(getBirthMonthsInYear("2026", null, reference), ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"]);
  assert.deepEqual(getBirthMonthsInYear("2022", null, reference), ["11", "12"]);
  const saved = parseBirthMonthInput("2020-03")!;
  assert.deepEqual(getBirthYears(saved, reference), [2026, 2025, 2024, 2023, 2022, 2020]);
  assert.deepEqual(getBirthMonthsInYear("2020", saved, reference), ["03"]);
  assert.equal(getBirthMonthsInYear("", null, reference).length, 12);
});

test("년·월을 어느 순서로 골라도 되며 년도 변경 시 가장 가까운 유효 월을 선택한다", () => {
  const reference = new Date(2026, 10, 9);
  assert.equal(selectBirthYear("", "2024", null, reference), "2024-");
  assert.equal(selectBirthYear("-05", "2024", null, reference), "2024-05");
  assert.equal(selectBirthYear("2024-12", "2026", null, reference), "2026-11");
  assert.equal(selectBirthYear("2024-01", "2022", null, reference), "2022-11");
  assert.equal(selectBirthYear("2024-05", "", null, reference), "-05");
  assert.ok(getBirthMonthInputError("2024-", null, reference));
  assert.ok(getBirthMonthInputError("-05", null, reference));
});
