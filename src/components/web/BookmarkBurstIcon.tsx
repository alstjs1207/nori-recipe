import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { bookmarkDotPose, createBookmarkBurst, finishBookmarkBurst, selectBookmark, stepBookmarkBurst } from "@/animations/bookmarkBurst";

export function BookmarkBurstIcon({ saved, requested, children }: {
  saved: boolean;
  requested: RefObject<boolean>;
  children: ReactNode;
}) {
  const icon = useRef<HTMLSpanElement>(null);
  const burst = useRef<HTMLSpanElement>(null);
  const previous = useRef(saved);
  const current = useRef(saved);
  const state = useRef(createBookmarkBurst(saved));
  const activate = useRef<(() => void) | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => { setHost(document.body); }, []);
  useLayoutEffect(() => {
    if (!host) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | undefined;
    let last = 0;
    function paint() {
      const element = icon.current;
      const dots = burst.current;
      if (!element || !dots) return;
      const sq = state.current.icon.x;
      element.style.transform = `scale(${sq * (2 - Math.min(sq, 1.15))}, ${sq})`;
      element.style.setProperty("--bookmark-fill", `${Math.max(0, Math.min(1, state.current.fill.x)) * 100}%`);
      // A portal keeps particles outside the cards' rounded image clipping.
      const bounds = element.getBoundingClientRect();
      dots.style.left = `${bounds.left + bounds.width / 2}px`;
      dots.style.top = `${bounds.top + bounds.height / 2}px`;
      Array.from(dots.children).forEach((dot, index) => {
        const pose = bookmarkDotPose(index, state.current.burstTime);
        const style = (dot as HTMLElement).style;
        style.opacity = String(pose.opacity);
        style.transform = `translate(${pose.x}px, ${pose.y}px) scale(${pose.scale})`;
      });
    }
    function stop() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
    }
    function finish() {
      stop();
      finishBookmarkBurst(state.current, current.current);
      paint();
    }
    function tick(now: number) {
      frame = undefined;
      const moving = stepBookmarkBurst(state.current, (now - last) / 1000);
      last = now;
      paint();
      if (moving) frame = requestAnimationFrame(tick);
    }
    activate.current = () => {
      stop();
      if (media.matches || document.hidden) { finish(); return; }
      paint();
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    function motionChange() { if (media.matches) finish(); }
    function visibilityChange() { if (document.hidden) finish(); }
    finish();
    media.addEventListener("change", motionChange);
    document.addEventListener("visibilitychange", visibilityChange);
    return () => {
      stop();
      activate.current = null;
      media.removeEventListener("change", motionChange);
      document.removeEventListener("visibilitychange", visibilityChange);
    };
  }, [host]);

  useLayoutEffect(() => {
    current.current = saved;
    if (previous.current === saved) return;
    previous.current = saved;
    if (requested.current) selectBookmark(state.current, saved);
    else finishBookmarkBurst(state.current, saved);
    requested.current = false;
    activate.current?.();
  }, [saved, requested]);

  return <>
    <span ref={icon} className="bookmark-burst-icon" aria-hidden="true"
      style={{ "--bookmark-fill": saved ? "100%" : "0%" } as CSSProperties}>{children}</span>
    {host ? createPortal(<span ref={burst} className="bookmark-burst" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
    </span>, host) : null}
  </>;
}
