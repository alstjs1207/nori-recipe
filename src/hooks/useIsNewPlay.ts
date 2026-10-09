import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { getNewPlayWindow, isNewPlay } from "@/play/newPlay";

const DAY_MS = 24 * 60 * 60 * 1000;

export function useIsNewPlay(createdAt?: string): boolean {
  const [now, setNow] = useState(Date.now);
  const window = getNewPlayWindow(createdAt);
  const startsAt = window?.startsAt;
  const expiresAt = window?.expiresAt;

  useEffect(() => {
    if (startsAt === undefined || expiresAt === undefined) return;
    const start = startsAt;
    const expiry = expiresAt;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function refresh() {
      const current = Date.now();
      setNow(current);
      clearTimeout(timer);
      const next = current < start ? start : expiry;
      if (current < next) {
        // 긴 타이머의 범위 제한과 기기의 날짜 변경을 고려해 하루 이내에 재확인한다.
        timer = setTimeout(refresh, Math.min(next - current, DAY_MS));
      }
    }

    refresh();
    if (Date.now() >= expiry) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [startsAt, expiresAt]);

  return isNewPlay(createdAt, new Date(now));
}
