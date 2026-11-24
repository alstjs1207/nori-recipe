import assert from "node:assert/strict";
import { test } from "node:test";
import { createBottomBarMotion, finishBottomBar, popBottomBarIcon, selectBottomBar, stepBottomBar } from "./bottomBarSpring";

const widths = [36, 36, 36, 36, 36];
for (const fps of [30, 60, 120]) {
  test(`bottom bar settles with the reference icon bounce at ${fps}fps`, () => {
    const motion = createBottomBarMotion(widths, 0);
    selectBottomBar(motion, 4, widths);
    motion.left.target = 220; motion.width.target = 80;
    let overshoot = false;
    for (let i = 0; i < fps * 3; i++) {
      stepBottomBar(motion, 1 / fps);
      overshoot ||= motion.icons[4].x > 1;
    }
    assert.equal(overshoot, true);
    assert.equal(stepBottomBar(motion, 1 / fps), false);
    assert.deepEqual(motion.labels.map(s => s.x), [0, 0, 0, 0, 36]);
    assert.equal(motion.left.x, 220);
    assert.equal(motion.width.x, 80);
  });
}
test("rapid navigation and reselect preserve the final route without autoplay", () => {
  const motion = createBottomBarMotion(widths, 0);
  for (const index of [3, 1, 4, 0, 2]) { selectBottomBar(motion, index, widths); stepBottomBar(motion, 1 / 60); }
  popBottomBarIcon(motion, 2);
  for (let i = 0; i < 600; i++) stepBottomBar(motion, 1 / 60);
  assert.equal(motion.selected, 2);
  assert.deepEqual(motion.labels.map(s => s.x), [0, 0, 36, 0, 0]);
  assert.equal(motion.icons[2].x, 1);
});
test("reduced motion finishes every spring immediately, including an unselected route", () => {
  const motion = createBottomBarMotion(widths, 0);
  selectBottomBar(motion, 4, widths);
  motion.left.target = 240; motion.width.target = 84;
  finishBottomBar(motion);
  assert.equal(stepBottomBar(motion, 0), false);
  assert.equal(motion.left.x, 240);
  assert.equal(motion.icons[4].x, 1);
  selectBottomBar(motion, -1, widths);
  finishBottomBar(motion);
  assert.deepEqual(motion.labels.map(s => s.x), [0, 0, 0, 0, 0]);
});
test("long background frame is capped to the reference 1/30s timestep", () => {
  const a = createBottomBarMotion(widths, 0), b = createBottomBarMotion(widths, 0);
  selectBottomBar(a, 1, widths); selectBottomBar(b, 1, widths);
  stepBottomBar(a, 60); stepBottomBar(b, 1 / 30);
  assert.deepEqual(a, b);
});
