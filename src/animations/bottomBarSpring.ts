// DesignBookmark bottom-bar/bar.js springs. Its icon uses 520/14, rather
// than the generic 520/16 preset in shared/tokens.css. Unit mass, four steps.
export type BarSpring = { x: number; v: number; target: number; stiffness: number; damping: number };
const spring = (x: number, stiffness: number, damping: number): BarSpring =>
  ({ x, v: 0, target: x, stiffness, damping });

export function createBottomBarMotion(widths: number[], selected: number) {
  return {
    selected,
    labels: widths.map((width, index) => spring(index === selected ? width : 0, 300, 26)),
    icons: widths.map(() => spring(1, 520, 14)),
    left: spring(0, 340, 28),
    width: spring(0, 340, 28),
  };
}
export type BottomBarMotion = ReturnType<typeof createBottomBarMotion>;
const springs = (motion: BottomBarMotion) => [...motion.labels, ...motion.icons, motion.left, motion.width];

export function popBottomBarIcon(motion: BottomBarMotion, index: number) {
  const icon = motion.icons[index];
  if (icon) { icon.x = 0.72; icon.v = 6; }
}
export function selectBottomBar(motion: BottomBarMotion, selected: number, widths: number[]) {
  motion.selected = selected;
  motion.labels.forEach((label, index) => { label.target = index === selected ? widths[index] : 0; });
  popBottomBarIcon(motion, selected);
}
export function finishBottomBar(motion: BottomBarMotion) {
  for (const s of springs(motion)) { s.x = s.target; s.v = 0; }
}
export function stepBottomBar(motion: BottomBarMotion, elapsedSeconds: number) {
  const dt = Math.min(Math.max(elapsedSeconds, 0), 1 / 30) / 4;
  const values = springs(motion);
  for (let step = 0; step < 4; step++) {
    for (const s of values) {
      s.v += (-s.stiffness * (s.x - s.target) - s.damping * s.v) * dt;
      s.x += s.v * dt;
    }
  }
  let moving = false;
  for (const s of values) {
    if (Math.abs(s.x - s.target) < 0.001 && Math.abs(s.v) < 0.01) { s.x = s.target; s.v = 0; }
    else moving = true;
  }
  return moving;
}
