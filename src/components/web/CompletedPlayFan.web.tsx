import { useLayoutEffect, useRef } from "react";
import { AppLink as Link } from "@/navigation/AppLink";
import { PlayImage } from "./PlayImage.web";
import { createFanMotion, finishFanMotion, selectFanCard, stepFanMotion, getAnchoredFanPose, getFanStackLayer } from "@/animations/fanSpring";

type Card = { id: string; title: string; image: string };
type Controls = { pointer(inside: boolean): void; hover(index: number | null): void; focus(index: number | null): void };

export function CompletedPlayFan({ bundleId, cards, expanded = false }: {
  bundleId: string;
  cards: Card[];
  expanded?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const cardElements = useRef<(HTMLDivElement | null)[]>([]);
  const controls = useRef<Controls | null>(null);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = media.matches;
    const hoverMedia = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    let canHover = hoverMedia.matches;
    let pointerInside = false;
    let local = getComputedStyle(element).getPropertyValue("--fan-local-anchor").trim() === "1";
    let direction = 1;
    let centerX = 0;
    let left = 0;
    let right = 0;
    const state = createFanMotion(local ? false : !canHover || reduced);
    if (local) state.spread.target = expanded ? 1 : 0;
    let visible = false;
    let disposed = false;
    let frame: number | undefined;
    let last = 0;
    let fit = 1;
    let hovered: number | null = null;
    let focused: number | null = null;
    let active: number | null = null;

    function paint() {
      element!.dataset.fanProgress = state.spread.x.toFixed(4);
      state.cards.forEach((card, index) => {
        const cardElement = cardElements.current[index];
        if (!cardElement) return;
        const d = index - 1;
        const { x, y, rotation, layer } = local ? getAnchoredFanPose(index, state.spread.x, {
          direction, cardWidth: cardElement.offsetWidth, cardHeight: cardElement.offsetHeight,
          centerX, left, right, scale: card.scale.x, lift: card.lift.x,
        }) : {
          x: d * (6 + state.spread.x * 72) * fit,
          y: (Math.abs(d) * state.spread.x * 12 + card.lift.x) * fit,
          rotation: d * (3 + state.spread.x * 9),
          layer: index === 1 ? 3 : 2,
        };
        cardElement.style.transform = `translate(calc(-50% + ${x.toFixed(2)}px), ${y.toFixed(2)}px) rotate(${rotation.toFixed(3)}deg) scale(${card.scale.x.toFixed(4)})`;
        cardElement.style.zIndex = local ? String(getFanStackLayer(index, reduced ? null : active, direction)) : index === active && !reduced ? "5" : String(layer);
      });
    }
    function stop() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      element!.dataset.fanAnimating = "false";
    }
    function tick(now: number) {
      frame = undefined;
      if (disposed || reduced || !visible || document.hidden) { stop(); return; }
      const moving = stepFanMotion(state, (now - last) / 1000);
      last = now;
      paint();
      element!.dataset.fanAnimating = String(moving);
      if (moving) frame = requestAnimationFrame(tick);
    }
    function wake() {
      if (disposed || reduced || !visible || document.hidden || frame !== undefined) return;
      last = performance.now();
      element!.dataset.fanAnimating = "true";
      frame = requestAnimationFrame(tick);
    }
    function activate() {
      state.spread.target = local ? (expanded ? 1 : 0) : reduced || !canHover || pointerInside || focused !== null ? 1 : 0;
      selectFanCard(state, reduced || (local && !canHover) ? null : active);
      if (reduced) { stop(); finishFanMotion(state); paint(); }
      else wake();
    }
    controls.current = {
      pointer(inside) { pointerInside = inside; if (!inside) { hovered = null; active = focused; } activate(); },
      hover(index) { hovered = index; active = index ?? focused; activate(); },
      focus(index) { focused = index; active = index ?? hovered; activate(); },
    };
    function resize() {
      const wasLocal = local;
      const style = getComputedStyle(element!);
      local = style.getPropertyValue("--fan-local-anchor").trim() === "1";
      direction = Number(style.getPropertyValue("--fan-direction")) || 1;
      const bounds = element!.getBoundingClientRect();
      const row = element!.closest(".completed-recent-bundles")?.getBoundingClientRect();
      centerX = bounds.left + bounds.width / 2;
      left = Math.max(0, (row?.left ?? 8) - 8);
      right = Math.min(window.innerWidth, (row?.right ?? window.innerWidth - 8) + 8);
      const maxFit = Number(style.getPropertyValue("--fan-max-fit")) || 1;
      const fitSpan = Number(style.getPropertyValue("--fan-fit-span")) || 400;
      fit = local ? Math.max(0, Math.min(150, bounds.width - 28)) / 160 : Math.min(maxFit, Math.max(0, (bounds.width - 16) / fitSpan));
      element!.style.setProperty("--fan-fit", String(fit));
      const covers = element!.closest(".completed-recent-cards")?.querySelectorAll<HTMLElement>(".completed-bundle-cover-card");
      const coverHeight = Math.max(180, ...Array.from(covers ?? []).map(card => card.offsetHeight));
      element!.style.setProperty("--fan-cover-height", `${coverHeight}px`);
      const cardHeight = Math.max(...cardElements.current.map(card => card?.offsetHeight ?? 0));
      element!.style.setProperty("--fan-stage-height", `${cardHeight + (local ? 52 : 92) * fit}px`);
      if (wasLocal !== local) activate();
      paint();
    }
    function motionChange() {
      reduced = media.matches;
      element!.dataset.fanReduced = String(reduced);
      activate();
    }
    function hoverChange() {
      canHover = hoverMedia.matches;
      pointerInside = false;
      hovered = null;
      active = focused;
      activate();
    }
    function visibilityChange() {
      if (document.hidden) stop();
      else wake();
    }
    element.dataset.fanReduced = String(reduced);
    element.dataset.fanAnimating = "false";
    resize();
    if (reduced) { finishFanMotion(state); paint(); }
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) wake();
      else stop();
    }, { threshold: 0.15 });
    if (observer) observer.observe(element);
    else { visible = true; wake(); }
    const sizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    sizeObserver?.observe(element);
    cardElements.current.forEach(card => { if (card) sizeObserver?.observe(card); });
    if (!sizeObserver) window.addEventListener("resize", resize);
    media.addEventListener("change", motionChange);
    hoverMedia.addEventListener("change", hoverChange);
    document.addEventListener("visibilitychange", visibilityChange);
    return () => {
      disposed = true;
      stop();
      controls.current = null;
      observer?.disconnect();
      sizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      media.removeEventListener("change", motionChange);
      hoverMedia.removeEventListener("change", hoverChange);
      document.removeEventListener("visibilitychange", visibilityChange);
    };
  }, [bundleId, expanded]);

  return <div className="completed-play-fan" ref={root}
    onPointerEnter={event => { if (event.pointerType === "mouse") controls.current?.pointer(true); }}
    onPointerLeave={() => controls.current?.pointer(false)}
  >
    {cards.map((card, index) => <div
      key={card.id}
      className="completed-play-fan-item"
      ref={element => { cardElements.current[index] = element; }}
      onPointerMove={event => { if (event.pointerType === "mouse") controls.current?.hover(index); }}
      onFocus={() => controls.current?.focus(index)}
      onBlur={() => controls.current?.focus(null)}
    >
      <Link href={`/play/${card.id}`} className="completed-play-fan-link">
      <span className="completed-play-fan-photo">
        <PlayImage src={card.image} alt="" loading="lazy" />
      </span>
      <span className="completed-play-fan-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <span className="completed-play-fan-caption">{card.title}</span>
      </Link>
    </div>)}
  </div>;
}

export function CompletedPlayFanCover({ cards, label, controlsId, onOpen }: { cards: Card[]; label: string; controlsId: string; onOpen(trigger: HTMLButtonElement): void }) {
  return <button className="completed-bundle-cover" type="button" aria-label={label} aria-expanded={false} aria-controls={controlsId} onClick={event => onOpen(event.currentTarget)}>
    <span className="completed-bundle-cover-cards" aria-hidden="true">
      {cards.map((card, index) => <span className="completed-bundle-cover-card" key={card.id}>
        <span className="completed-play-fan-photo"><PlayImage src={card.image} alt="" loading="lazy" /></span>
        <span className="completed-play-fan-number">{String(index + 1).padStart(2, "0")}</span>
        <span className="completed-play-fan-caption">{card.title}</span>
      </span>)}
    </span>
    <span className="completed-bundle-cover-label">놀이 3개 펼치기</span>
  </button>;
}
