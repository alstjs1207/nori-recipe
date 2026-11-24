import { useLayoutEffect, useRef, type ReactNode } from "react";
import { AppLink } from "@/navigation/AppLink";
import {
  createBottomBarMotion, finishBottomBar, popBottomBarIcon,
  selectBottomBar, stepBottomBar,
} from "@/animations/bottomBarSpring";

type MenuItem = { href: string; label: string; ariaLabel: string; icon: ReactNode };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function AnimatedBottomBar({ items, activeIndex }: { items: MenuItem[]; activeIndex: number }) {
  const root = useRef<HTMLElement>(null);
  const active = useRef(activeIndex);
  active.current = activeIndex;
  const controls = useRef<{ select: (index: number) => void; pop: (index: number) => void } | null>(null);

  useLayoutEffect(() => {
    const nav = root.current;
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a"));
    const labels = Array.from(nav.querySelectorAll<HTMLElement>(".bottom-bar-label"));
    const texts = Array.from(nav.querySelectorAll<HTMLElement>(".bottom-bar-label-text"));
    const icons = Array.from(nav.querySelectorAll<HTMLElement>(".bottom-bar-icon"));
    const highlight = nav.querySelector<HTMLElement>(".bottom-bar-highlight")!;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let widths = texts.map(text => text.getBoundingClientRect().width + 8);
    const motion = createBottomBarMotion(widths, active.current);
    let frame = 0, previous = 0, disposed = false;
    const visible = () => !document.hidden && nav.getBoundingClientRect().width > 0;
    const paint = () => {
      labels.forEach((label, index) => {
        const width = Math.max(0, motion.labels[index].x);
        const progress = clamp(width / widths[index]);
        label.style.width = `${width}px`;
        label.style.paddingLeft = `${progress * 8}px`;
        label.style.opacity = String(clamp(progress * 1.4 - 0.4));
        icons[index].style.transform = `scale(${motion.icons[index].x})`;
      });
      highlight.style.transform = `translateX(${motion.left.x}px)`;
      highlight.style.width = `${Math.max(0, motion.width.x)}px`;
      highlight.style.opacity = motion.selected < 0 ? "0" : "1";
    };
    const measureIndicator = () => {
      const link = links[motion.selected];
      if (!link) return;
      motion.left.target = link.offsetLeft;
      motion.width.target = link.offsetWidth;
      highlight.style.top = `${link.offsetTop + (link.offsetHeight - 44) / 2}px`;
    };
    const stop = () => {
      cancelAnimationFrame(frame); frame = 0; previous = 0;
      nav.dataset.animating = "false";
    };
    const settle = () => {
      stop(); finishBottomBar(motion); paint(); measureIndicator(); finishBottomBar(motion); paint();
    };
    const tick = (now: number) => {
      frame = 0;
      if (!visible()) { stop(); return; }
      measureIndicator();
      const moving = stepBottomBar(motion, previous ? (now - previous) / 1000 : 1 / 60);
      previous = now; paint();
      // Labels alter flex layout; keep following the final layout for one more
      // frame before stopping, just like the reference highlight follows items.
      measureIndicator();
      if (moving || Math.abs(motion.left.target - motion.left.x) > 0.01 || Math.abs(motion.width.target - motion.width.x) > 0.01) {
        frame = requestAnimationFrame(tick);
      } else stop();
    };
    const wake = () => {
      if (preference.matches || !visible()) { settle(); return; }
      if (!frame) { previous = 0; nav.dataset.animating = "true"; frame = requestAnimationFrame(tick); }
    };
    const select = (index: number) => {
      if (index === motion.selected) return;
      selectBottomBar(motion, index, widths); wake();
    };
    controls.current = { select, pop(index) { popBottomBarIcon(motion, index); wake(); } };
    const resize = () => {
      if (disposed) return;
      widths = texts.map(text => text.getBoundingClientRect().width + 8);
      selectBottomBar(motion, active.current, widths);
      settle();
    };
    const reduced = () => { nav.dataset.reducedMotion = String(preference.matches); settle(); };
    const visibility = () => { if (document.hidden) stop(); else resize(); };
    const observer = new ResizeObserver(resize);
    observer.observe(nav);
    texts.forEach(text => observer.observe(text));
    document.fonts.ready.then(resize);
    document.fonts.addEventListener("loadingdone", resize);
    document.addEventListener("visibilitychange", visibility);
    preference.addEventListener("change", reduced);
    reduced(); resize();
    return () => {
      disposed = true; stop(); observer.disconnect(); controls.current = null;
      document.fonts.removeEventListener("loadingdone", resize);
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", reduced);
    };
  }, [items.length]);

  useLayoutEffect(() => { controls.current?.select(activeIndex); }, [activeIndex]);

  return (
    <nav ref={root} className="nori-nav nori-nav-bottom nori-bottom-bar" aria-label="주 메뉴">
      <span className="bottom-bar-highlight" aria-hidden="true" />
      {items.map((item, index) => (
        <AppLink key={item.href} href={item.href} className={`bottom-bar-link${index === activeIndex ? " is-active" : ""}`}
          aria-label={item.ariaLabel} aria-current={index === activeIndex ? "page" : undefined}
          onPress={event => {
            const pointer = event as typeof event & { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number };
            if (event.defaultPrevented || pointer.metaKey || pointer.ctrlKey || pointer.shiftKey || pointer.altKey || (pointer.button != null && pointer.button !== 0)) return;
            if (index === active.current) controls.current?.pop(index);
          }}>
          <span className="bottom-bar-icon" aria-hidden="true">{item.icon}</span>
          <span className="bottom-bar-label" aria-hidden="true"><span className="bottom-bar-label-text">{item.label}</span></span>
        </AppLink>
      ))}
    </nav>
  );
}
