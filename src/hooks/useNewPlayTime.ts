import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { getNewPlayWindow } from "@/play/newPlay";
import type { Play } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Refresh ordering when a NEW period starts or ends, including while the screen stays open. */
export function useNewPlayTime(plays: readonly Pick<Play, "createdAt">[]): number {
  const [now, setNow] = useState(Date.now);
  const nextTransitionAt = plays.reduce((next, play) => {
    const window = getNewPlayWindow(play.createdAt);
    if (!window) return next;
    const boundary = now < window.startsAt ? window.startsAt : window.expiresAt;
    return boundary > now ? Math.min(next, boundary) : next;
  }, Infinity);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = Number.isFinite(nextTransitionAt)
      ? setTimeout(refresh, Math.min(Math.max(1, nextTransitionAt - Date.now()), DAY_MS))
      : undefined;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [nextTransitionAt, now]);

  return now;
}
