import assert from "node:assert/strict";
import test from "node:test";

import { getNewPlayWindow, isNewPlay } from "@/play/newPlay";

test("NEW는 한국 생성일 자정부터 다음 달 같은 날 자정 직전까지 표시한다", () => {
  const createdAt = "2026-10-09";
  assert.equal(isNewPlay(createdAt, new Date("2026-10-08T14:59:59.999Z")), false);
  assert.equal(isNewPlay(createdAt, new Date("2026-10-08T15:00:00.000Z")), true);
  assert.equal(isNewPlay(createdAt, new Date("2026-11-08T14:59:59.999Z")), true);
  assert.equal(isNewPlay(createdAt, new Date("2026-11-08T15:00:00.000Z")), false);
});

test("한 달은 고정 30일이 아니라 달력 기준이며 연도를 넘어갈 수 있다", () => {
  assert.equal(isNewPlay("2026-10-09", new Date("2026-11-08T00:00:00+09:00")), true);
  assert.equal(isNewPlay("2026-12-31", new Date("2027-01-30T23:59:59+09:00")), true);
  assert.equal(isNewPlay("2026-12-31", new Date("2027-01-31T00:00:00+09:00")), false);
});

test("다음 달에 같은 날짜가 없으면 말일로 맞추고 윤년을 반영한다", () => {
  for (const [createdAt, expiresAt] of [
    ["2026-01-31", "2026-02-28T00:00:00+09:00"],
    ["2028-01-31", "2028-02-29T00:00:00+09:00"],
    ["2026-08-31", "2026-09-30T00:00:00+09:00"],
  ]) {
    const expiry = new Date(expiresAt);
    assert.equal(isNewPlay(createdAt, new Date(expiry.getTime() - 1)), true);
    assert.equal(isNewPlay(createdAt, expiry), false);
  }
});

test("생성일이 없거나 유효하지 않은 놀이와 미래·오래된 놀이는 NEW에서 제외한다", () => {
  const now = new Date("2026-10-09T12:00:00+09:00");
  for (const createdAt of [undefined, "", "invalid", "2026-02-30", "2026-13-01", "2026-2-01"]) {
    assert.equal(getNewPlayWindow(createdAt), null);
    assert.equal(isNewPlay(createdAt, now), false);
  }
  assert.equal(isNewPlay("2026-10-10", now), false);
  assert.equal(isNewPlay("2026-04-01", now), false);
});
