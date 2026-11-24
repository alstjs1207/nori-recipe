import test from "node:test";
import assert from "node:assert/strict";
import { createFanMotion, finishFanMotion, selectFanCard, stepFanMotion, getAnchoredFanPose, getFanStackLayer } from "./fanSpring";

for (const fps of [30, 60, 120]) {
  test(`opening overshoots once and settles without an idle loop at ${fps}Hz`, () => {
    const motion = createFanMotion(false);
    motion.spread.target = 1;
    let peak = 0;
    let moving = true;
    for (let frame = 0; frame < fps * 3 && moving; frame++) {
      moving = stepFanMotion(motion, 1 / fps);
      peak = Math.max(peak, motion.spread.x);
    }
    assert.ok(peak > 1 && peak < 1.15);
    assert.equal(moving, false);
    assert.equal(motion.spread.x, 1);
    assert.equal(motion.spread.v, 0);
    assert.equal(stepFanMotion(motion, 1 / fps), false);
  });
}

test("focus moves to exactly one card and releasing it settles back", () => {
  const motion = createFanMotion(true);
  selectFanCard(motion, 0);
  for (let i = 0; i < 180; i++) stepFanMotion(motion, 1 / 60);
  assert.equal(motion.cards[0].lift.x, -22);
  assert.equal(motion.cards[0].scale.x, 1.06);
  assert.equal(motion.cards[1].lift.x, 0);
  selectFanCard(motion, 2);
  for (let i = 0; i < 180; i++) stepFanMotion(motion, 1 / 60);
  assert.equal(motion.cards[0].lift.x, 0);
  assert.equal(motion.cards[2].lift.x, -22);
  selectFanCard(motion, null);
  for (let i = 0; i < 180; i++) stepFanMotion(motion, 1 / 60);
  assert.ok(motion.cards.every(card => card.lift.x === 0 && card.scale.x === 1));
});

test("reduced motion finishes an entrance and a lift immediately", () => {
  const motion = createFanMotion(false);
  motion.spread.target = 1;
  selectFanCard(motion, 1);
  stepFanMotion(motion, 1 / 60);
  finishFanMotion(motion);
  assert.equal(motion.spread.x, 1);
  assert.ok(motion.cards.every(card => card.lift.x === 0 && card.scale.x === 1));
  assert.equal(stepFanMotion(motion, 1 / 60), false);
});

test("a long background pause is capped to the original 1/30-second integration", () => {
  const paused = createFanMotion(false);
  const regular = createFanMotion(false);
  paused.spread.target = regular.spread.target = 1;
  stepFanMotion(paused, 60);
  stepFanMotion(regular, 1 / 30);
  assert.deepEqual(paused, regular);
});

test("leaving during opening reverses into a closed settled stack", () => {
  const motion = createFanMotion(false);
  motion.spread.target = 1;
  for (let i = 0; i < 8; i++) stepFanMotion(motion, 1 / 60);
  assert.ok(motion.spread.x > 0);
  motion.spread.target = 0;
  let moving = true;
  for (let i = 0; i < 180 && moving; i++) moving = stepFanMotion(motion, 1 / 60);
  assert.equal(motion.spread.x, 0);
  assert.equal(motion.spread.v, 0);
  assert.equal(moving, false);
});

test("the anchored cover remains fixed throughout unfolding and spring overshoot", () => {
  for (const direction of [-1, 1]) for (const progress of [0, 0.3, 0.8, 1, 1.1]) {
    const pose = getAnchoredFanPose(direction > 0 ? 0 : 2, progress, { direction, cardWidth: 140, cardHeight: 180, centerX: 100, left: 8, right: 385, scale: 1, lift: 0 });
    for (const value of [pose.x, pose.y, pose.rotation]) assert.ok(Math.abs(value) < 1e-12);
  }
});

test("anchored outer cards stay inside the row on both sides, including overshoot and focus scale", () => {
  for (const width of [320, 393, 551]) for (const direction of [-1, 1]) {
    const margin = width === 320 ? 16 : 20;
    const cell = (width - 2 * margin - 12) / 2;
    const cardWidth = Math.min(150, cell - 28);
    const centerX = direction === 1 ? margin + cell / 2 : width - margin - cell / 2;
    for (const index of [0, 1, 2]) for (const progress of [0, 0.5, 1, 1.1]) for (const scale of [1, 1.06]) {
      const pose = getAnchoredFanPose(index, progress, { direction, cardWidth, cardHeight: 180, centerX, left: margin - 8, right: width - margin + 8, scale, lift: -22 });
      const r = pose.rotation * Math.PI / 180;
      for (const x of [-cardWidth / 2, cardWidth / 2]) for (const y of [-180, 0]) {
        const renderedX = centerX + pose.x + (x * Math.cos(r) - y * Math.sin(r)) * scale;
        assert.ok(renderedX >= margin - 8 - 0.001 && renderedX <= width - margin + 8 + 0.001);
      }
    }
  }
});

test("mobile fans mirror the 1-2-3 sequence with the outside card in front", () => {
  for (const direction of [1, -1]) {
    const order = direction === 1 ? [0, 1, 2] : [2, 1, 0];
    const poses = order.map(index => getAnchoredFanPose(index, 1, { direction, cardWidth: 140, cardHeight: 180, centerX: direction === 1 ? 100 : 300, left: 8, right: 392, scale: 1, lift: 0 }));
    assert.deepEqual(poses.map(pose => pose.layer), [3, 2, 1]);
    assert.equal(Math.abs(poses[0].x), 0);
    assert.ok(poses[1].x * direction > 0);
    assert.ok(poses[2].x * direction > poses[1].x * direction);
  }
});

test("highlight changes reorder the entire mobile stack by neighbouring card distance", () => {
  const order = (active: number | null, direction: number) => [0, 1, 2].sort((a, b) => getFanStackLayer(b, active, direction) - getFanStackLayer(a, active, direction)).map(index => index + 1);
  assert.deepEqual(order(null, 1), [1, 2, 3]);
  assert.deepEqual(order(2, 1), [3, 2, 1]);
  assert.deepEqual(order(null, -1), [3, 2, 1]);
  assert.deepEqual(order(0, -1), [1, 2, 3]);
  assert.deepEqual(order(1, 1), [2, 1, 3]);
  assert.deepEqual(order(1, -1), [2, 3, 1]);
  assert.deepEqual(order(0, 1), [1, 2, 3]);
  assert.deepEqual(order(2, -1), [3, 2, 1]);
});
