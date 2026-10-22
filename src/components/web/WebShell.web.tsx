import { type PropsWithChildren, useEffect, useState } from "react";
import { Link, router } from "expo-router";
import { BrandMark, Icon, WebNavigation } from "./NoriUI";
import { useSessionStore } from "@/store/sessionStore";
import { getAgeMonthsFromBirthMonth } from "@/onboarding/utils";
import { WebAnalyticsProvider } from "./WebAnalytics";
import { WebInstallProvider } from "./WebInstall";

export function WebShell({ children }: PropsWithChildren) {
  return (
    <WebAnalyticsProvider>
      <WebInstallProvider>
        <WebShellContent>{children}</WebShellContent>
      </WebInstallProvider>
    </WebAnalyticsProvider>
  );
}

function WebShellContent({ children }: PropsWithChildren) {
  const birthMonth = useSessionStore(
    (state) => state.userContext.childBirthMonth,
  );
  const childName = useSessionStore((state) => state.childName);
  const age =
    birthMonth === null ? null : getAgeMonthsFromBirthMonth(birthMonth);
  const [online, setOnline] = useState(true);
  const [offlineReady, setOfflineReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onReady = () => setOfflineReady(true);
    const onUpdate = (event: Event) =>
      setWaiting((event as CustomEvent<ServiceWorker>).detail);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("nori:offline-ready", onReady);
    window.addEventListener("nori:update-ready", onUpdate);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then((registration) => {
        setOfflineReady(true);
        if (registration.waiting) setWaiting(registration.waiting);
      });
    }
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("nori:offline-ready", onReady);
      window.removeEventListener("nori:update-ready", onUpdate);
    };
  }, []);

  function update() {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true },
    );
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  function openProfileSettings() {
    const ageSelect = document.querySelector<HTMLSelectElement>(
      ".settings-page .age-select",
    );
    if (ageSelect) {
      ageSelect.scrollIntoView({ block: "center" });
      ageSelect.focus({ preventScroll: true });
      return;
    }
    router.push("/mypage");
  }

  return (
    <div className="web-shell">
      <header className="web-toolbar">
        <Link href="/" className="web-brand" aria-label="노리 레시피 홈">
          <BrandMark />
          <span>노리 레시피</span>
          <span className="brand-tagline">아이와의 오늘을, 더 즐겁게</span>
        </Link>
        <WebNavigation placement="header" />
        <div className="web-toolbar-actions">
          <button
            className="profile-button"
            type="button"
            aria-label={age === null ? "아이 월령 설정" : "아이 월령과 내 설정"}
            onClick={openProfileSettings}
          >
            <span className="profile-avatar">
              {childName.trim().slice(0, 1) || <Icon name="child" size={20} />}
            </span>
            {age === null ? "월령 설정" : `${age}개월`}
            <Icon name="chevron" size={15} />
          </button>
        </div>
      </header>
      {!online ? (
        <div className="web-notice" role="status">
          오프라인이에요. 저장된 놀이와 기록을 볼 수 있어요.
        </div>
      ) : null}
      {waiting ? (
        <div className="web-notice" role="status">
          새 버전이 준비됐어요.{" "}
          <button type="button" onClick={update}>
            새 버전 열기
          </button>
        </div>
      ) : null}
      <main className="web-app">{children}</main>
      <span className="sr-only" role="status">
        {offlineReady ? "오프라인 이용 준비 완료" : ""}
      </span>
    </div>
  );
}
