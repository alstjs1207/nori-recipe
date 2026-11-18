import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const colors = ["#796BFF", "#FF9F99", "#FFD27D", "#70CDB3"];
const particles = Array.from({ length: 72 }, (_, index) => ({
  left: `${((index * 37) % 100) + 0.5}%`,
  top: `${((index * 23) % 100) - 5}%`,
  width: `${6 + (index % 5)}px`,
  height: `${10 + (index % 7)}px`,
  background: colors[index % colors.length],
  borderRadius: index % 3 === 0 ? "50%" : "2px",
  animationDelay: `${(index % 8) * 0.04}s`,
  animationDuration: `${2.4 + (index % 6) * 0.09}s`,
  "--confetti-drift": `${((index * 29) % 121) - 60}px`,
  "--confetti-turn": `${360 + (index % 5) * 180}deg`,
}) as CSSProperties);

export function CompletionConfetti({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timeout: number | undefined;
    const hide = () => setVisible(false);
    // Changing the preference can stop this celebration, but cannot replay it.
    const handleMotionChange = () => { if (motion.matches) hide(); };
    motion.addEventListener("change", handleMotionChange);
    if (!motion.matches) {
      setVisible(true);
      timeout = window.setTimeout(hide, 3300);
    }

    return () => {
      window.clearTimeout(timeout);
      motion.removeEventListener("change", handleMotionChange);
      setVisible(false);
    };
  }, [active]);

  if (!active || !visible) return null;

  // Escape the tab scene's scrolling and clipping ancestors.
  return createPortal(
    <div className="completion-confetti" aria-hidden="true">
      {particles.map((style, index) => <i key={index} style={style} />)}
    </div>,
    document.body,
  );
}
