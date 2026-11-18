import { useEffect, useRef, useState } from "react";
import { router, usePathname } from "expo-router";
import { appRuntime } from "@/platform/runtime";
import { tossBackAction } from "@/platform/navigation";

export function TossPlatform() {
  const path = usePathname();
  const currentPath = useRef(path);
  currentPath.current = path;
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => appRuntime.completionAd?.start(), []);
  useEffect(() => {
    if (appRuntime.target !== "toss") return;
    const failed = () => setError(true);
    const close = () => { void appRuntime.close?.().catch(failed); };
    const back = () => {
      const dialog = Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]")).at(-1);
      switch (tossBackAction(currentPath.current, router.canGoBack(), Boolean(dialog))) {
        case "dialog": {
          const event = new Event("cancel", { cancelable: true });
          if (dialog?.dispatchEvent(event)) dialog.close();
          break;
        }
        case "close": close(); break;
        case "back": router.back(); break;
        case "home": router.replace("/"); break;
      }
    };
    let offNavigation: (() => void) | undefined;
    let offInsets: (() => void) | undefined;
    try {
    offNavigation = appRuntime.navigation?.(back, () => router.replace("/"), failed);
    offInsets = appRuntime.safeArea?.((insets) => {
      for (const edge of ["top", "bottom", "left", "right"] as const) {
        const size = Number.isFinite(insets[edge]) ? Math.max(0, insets[edge]) : 0;
        document.documentElement.style.setProperty(`--toss-safe-${edge}`, `${size}px`);
      }
    });
    } catch { failed(); }
    let revision = 0;
    const checkUser = async () => {
      const current = ++revision;
      document.documentElement.classList.add("toss-checking-user");
      setChecking(true);
      if (document.visibilityState !== "visible") return;
      const valid = await appRuntime.checkIdentity?.();
      if (current !== revision || document.visibilityState !== "visible") return;
      if (!valid) { window.location.reload(); return; }
      document.documentElement.classList.remove("toss-checking-user");
      setChecking(false);
    };
    document.addEventListener("visibilitychange", checkUser);
    return () => {
      revision++;
      document.documentElement.classList.remove("toss-checking-user");
      offNavigation?.(); offInsets?.();
      document.removeEventListener("visibilitychange", checkUser);
      for (const edge of ["top", "bottom", "left", "right"]) document.documentElement.style.removeProperty(`--toss-safe-${edge}`);
    };
  }, []);
  if (appRuntime.target !== "toss") return null;
  return <>
    {checking ? <div className="toss-session-shield" role="status">토스 사용자 정보를 확인하고 있어요.</div> : null}
    {error ? <p role="alert" className="toss-platform-error">토스 화면 연결을 확인하지 못했어요. <button type="button" onClick={() => window.location.reload()}>다시 열기</button></p> : null}
  </>;
}
