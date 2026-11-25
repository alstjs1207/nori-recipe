import test from "node:test";
import assert from "node:assert/strict";
import { bookmarkDotPose, createBookmarkBurst, finishBookmarkBurst, selectBookmark, stepBookmarkBurst } from "./bookmarkBurst";

for (const fps of [30, 60, 120]) {
  test(`bookmark burst bounces and settles at ${fps}fps without idle frames`, () => {
    const state = createBookmarkBurst(false);
    assert.equal(stepBookmarkBurst(state, 1 / fps), false);
    selectBookmark(state, true);
    let peak = 0;
    for (let i = 0; i < fps * 3; i++) {
      stepBookmarkBurst(state, 1 / fps);
      peak = Math.max(peak, state.icon.x);
    }
    assert.ok(peak > 1.1 && peak < 1.5);
    assert.equal(state.fill.x, 1);
    assert.equal(state.icon.x, 1);
    assert.equal(stepBookmarkBurst(state, 0), false);
    for (let i = 0; i < 8; i++) assert.equal(bookmarkDotPose(i, state.burstTime).opacity, 0);
  });
}

test("rapid save/cancel settles on the actual state and cancels particles", () => {
  const state = createBookmarkBurst(false);
  for (const saved of [true, false, true, false]) {
    selectBookmark(state, saved);
    stepBookmarkBurst(state, 1 / 60);
  }
  assert.equal(state.burstTime, .55);
  for (let i = 0; i < 180; i++) stepBookmarkBurst(state, 1 / 60);
  assert.equal(state.fill.x, 0);
  assert.equal(state.icon.x, 1);
  selectBookmark(state, true);
  assert.equal(state.burstTime, 0);
});

test("reduced motion finishes immediately and long frames use the reference dt cap", () => {
  const a = createBookmarkBurst(false), b = createBookmarkBurst(false);
  selectBookmark(a, true); selectBookmark(b, true);
  stepBookmarkBurst(a, 30); stepBookmarkBurst(b, 1 / 30);
  assert.deepEqual(a, b);
  finishBookmarkBurst(a, true);
  assert.equal(a.fill.x, 1);
  assert.equal(stepBookmarkBurst(a, 1 / 60), false);
  finishBookmarkBurst(a, false);
  assert.equal(a.fill.x, 0);
});

test("eight dots travel radially and fade within 550ms", () => {
  for (let i = 0; i < 8; i++) {
    const start = bookmarkDotPose(i, 0), middle = bookmarkDotPose(i, .275), end = bookmarkDotPose(i, .55);
    assert.ok(Math.abs(Math.hypot(start.x, start.y) - 10) < .001);
    assert.ok(Math.hypot(middle.x, middle.y) > 25);
    assert.ok(Math.abs(Math.hypot(end.x, end.y) - (32 + i % 2 * 6)) < .001);
    assert.equal(start.opacity, 1);
    assert.equal(end.opacity, 0);
    assert.ok(middle.scale < start.scale);
  }
});
