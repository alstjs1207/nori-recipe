import assert from "node:assert/strict";
import test from "node:test";
import { createAnalyticsReadingProgress } from "./invitation";

test("백그라운드 시간을 제외하고 상세를 실제로 본 20초만 누적한다", () => {
  let time = 0;
  const reading = createAnalyticsReadingProgress(() => time);
  reading.resume();
  time = 8_000;
  reading.pause();
  time = 90_000;
  assert.equal(reading.isReady(), false);
  assert.equal(reading.remaining(), 12_000);
  reading.resume();
  time = 101_999;
  assert.equal(reading.isReady(), false);
  time = 102_000;
  assert.equal(reading.isReady(), true);
});

test("보이는 상세의 본문 절반을 읽으면 시간 조건 없이 안내 대상이 된다", () => {
  const reading = createAnalyticsReadingProgress(() => 0);
  reading.scroll(1);
  assert.equal(reading.isReady(), false);
  reading.resume();
  reading.scroll(0.49);
  assert.equal(reading.isReady(), false);
  reading.scroll(0.5);
  assert.equal(reading.isReady(), true);
  reading.pause();
  assert.equal(reading.isReady(), true);
});

test("짧게 보고 나간 상세의 시간을 다음 상세 열람에 이어 붙이지 않는다", () => {
  let time = 0;
  const first = createAnalyticsReadingProgress(() => time);
  first.resume();
  time = 15_000;
  first.pause();
  const second = createAnalyticsReadingProgress(() => time);
  second.resume();
  time = 21_000;
  assert.equal(second.isReady(), false);
  assert.equal(second.remaining(), 14_000);
});
