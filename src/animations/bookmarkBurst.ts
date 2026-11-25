// DesignBookmark like-burst/like.js uses these component-specific springs,
// rather than tokens.css's generic --spring-pop (520/16).
type Spring = { x: number; v: number; target: number; stiffness: number; damping: number };
export type BookmarkBurst = { icon: Spring; fill: Spring; burstTime: number };
const spring = (x: number, stiffness: number, damping: number): Spring => ({ x, v: 0, target: x, stiffness, damping });

export function createBookmarkBurst(saved: boolean): BookmarkBurst {
  return { icon: spring(1, 520, 13), fill: spring(saved ? 1 : 0, 300, 26), burstTime: .55 };
}

export function selectBookmark(state: BookmarkBurst, saved: boolean) {
  state.icon.x = saved ? .6 : .85;
  state.icon.v = saved ? 9 : 3;
  state.fill.target = saved ? 1 : 0;
  // Cancelling a save also cancels any unfinished burst.
  state.burstTime = saved ? 0 : .55;
}

export function finishBookmarkBurst(state: BookmarkBurst, saved: boolean) {
  state.icon.x = 1;
  state.icon.v = 0;
  state.fill.x = state.fill.target = saved ? 1 : 0;
  state.fill.v = 0;
  state.burstTime = .55;
}

/** Unit mass, semi-implicit Euler; same four substeps and dt cap as shared/motion.js. */
export function stepBookmarkBurst(state: BookmarkBurst, elapsed: number): boolean {
  const dt = Math.min(Math.max(elapsed, 0), 1 / 30);
  state.burstTime = Math.min(.55, state.burstTime + dt);
  let moving = state.burstTime < .55;
  for (const s of [state.icon, state.fill]) {
    for (let substep = 0; substep < 4; substep++) {
      s.v += (-s.stiffness * (s.x - s.target) - s.damping * s.v) * dt / 4;
      s.x += s.v * dt / 4;
    }
    if (Math.abs(s.x - s.target) > .001 || Math.abs(s.v) > .01) moving = true;
    else { s.x = s.target; s.v = 0; }
  }
  return moving;
}

export function bookmarkDotPose(index: number, burstTime: number) {
  const k = Math.max(0, Math.min(burstTime / .55, 1));
  const radius = 10 + (1 - (1 - k) ** 3) * (22 + index % 2 * 6);
  const angle = index / 8 * Math.PI * 2 + .2;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, scale: 1 - .7 * k, opacity: k >= 1 ? 0 : 1 - k * k };
}
