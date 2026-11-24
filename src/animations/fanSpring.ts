// Fan Cards reference: designbookmark.com/motion-src/fan-cards/fan.js.
// Keep its unit mass, stiffness/damping, dt cap and four integration substeps.
type Spring = { x: number; v: number; target: number; stiffness: number; damping: number };
export type FanMotion = { spread: Spring; cards: { lift: Spring; scale: Spring }[] };
const spring = (x: number, stiffness: number, damping: number): Spring => ({ x, v: 0, target: x, stiffness, damping });

export function createFanMotion(open: boolean): FanMotion {
  return {
    spread: spring(open ? 1 : 0, 220, 18),
    cards: Array.from({ length: 3 }, () => ({ lift: spring(0, 420, 20), scale: spring(1, 420, 22) })),
  };
}

export function selectFanCard(state: FanMotion, index: number | null) {
  state.cards.forEach((card, i) => {
    card.lift.target = i === index ? -22 : 0;
    card.scale.target = i === index ? 1.06 : 1;
  });
}

export function finishFanMotion(state: FanMotion) {
  state.spread.x = state.spread.target = 1;
  state.spread.v = 0;
  selectFanCard(state, null);
  for (const card of state.cards) {
    card.lift.x = card.lift.v = 0;
    card.scale.x = 1;
    card.scale.v = 0;
  }
}

/** Returns false once every spring has settled, so there is no idle rAF loop. */
export function stepFanMotion(state: FanMotion, elapsed: number): boolean {
  const springs = [state.spread, ...state.cards.flatMap(card => [card.lift, card.scale])];
  const dt = Math.min(Math.max(elapsed, 0), 1 / 30) / 4;
  for (let substep = 0; substep < 4; substep++) {
    for (const s of springs) {
      s.v += (-s.stiffness * (s.x - s.target) - s.damping * s.v) * dt;
      s.x += s.v * dt;
    }
  }
  let moving = false;
  for (const s of springs) {
    if (Math.abs(s.x - s.target) > 0.001 || Math.abs(s.v) > 0.01) moving = true;
    else { s.x = s.target; s.v = 0; }
  }
  return moving;
}

/** Unfold toward the neighbouring column while keeping the cover card in place. */
export function getAnchoredFanPose(index: number, progress: number, geometry: {
  direction: number; cardWidth: number; cardHeight: number; centerX: number;
  left: number; right: number; scale: number; lift: number;
}) {
  const anchor = geometry.direction > 0 ? 0 : 2;
  const step = Math.abs(index - anchor);
  const fit = geometry.cardWidth / 160;
  const rotation = geometry.direction * step * (3 + 3 * progress);
  let x = geometry.direction * step * (6 * (1 - progress) + 68 * fit * progress);
  if (index !== anchor) {
    const radians = rotation * Math.PI / 180;
    const half = geometry.cardWidth / 2 * Math.cos(radians) * geometry.scale;
    const tilt = geometry.cardHeight * Math.sin(radians) * geometry.scale;
    const min = -half + Math.min(0, tilt);
    const max = half + Math.max(0, tilt);
    x = Math.min(geometry.right - geometry.centerX - max, Math.max(geometry.left - geometry.centerX - min, x));
  }
  return { x, y: ((step ? progress * 12 : 0) + geometry.lift) * fit, rotation, layer: 3 - step };
}

/** Keep neighbouring cards immediately behind the currently highlighted card. */
export function getFanStackLayer(index: number, active: number | null, direction: number) {
  const front = active ?? (direction > 0 ? 0 : 2);
  const order = [0, 1, 2].sort((a, b) => Math.abs(a - front) - Math.abs(b - front) || direction * (a - b));
  return 3 - order.indexOf(index);
}
