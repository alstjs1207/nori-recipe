import { type PropsWithChildren, useEffect, useState } from "react";
import { router } from "expo-router";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function WebShell({ children }: PropsWithChildren) {
  const [online, setOnline] = useState(true);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const standalone = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setInstalled(standalone.matches);
    updateInstalled();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); setInstructions(false); };
    const onReady = () => setOfflineReady(true);
    const onUpdate = (event: Event) => setWaiting((event as CustomEvent<ServiceWorker>).detail);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("nori:offline-ready", onReady);
    window.addEventListener("nori:update-ready", onUpdate);
    standalone.addEventListener("change", updateInstalled);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then((registration) => {
        setOfflineReady(true);
        if (registration.waiting) setWaiting(registration.waiting);
      });
    }
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("nori:offline-ready", onReady);
      window.removeEventListener("nori:update-ready", onUpdate);
      standalone.removeEventListener("change", updateInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) { setInstructions((value) => !value); return; }
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    } catch { setInstructions(true); }
  }

  function update() {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <div className="web-shell">
      <header className="web-toolbar">
        <a href="/" className="web-brand">🧸 노리 레시피</a>
        <div className="web-toolbar-actions">
          <button type="button" onClick={() => router.push("/start")}>월령 설정</button>
          {!installed ? <button type="button" className="install-button" onClick={() => { void install(); }}>홈 화면에 추가</button> : null}
        </div>
      </header>
      {!online ? <div className="web-notice" role="status">오프라인이에요. 저장된 놀이와 기록을 볼 수 있어요.</div> : null}
      {waiting ? <div className="web-notice" role="status">새 버전이 준비됐어요. <button type="button" onClick={update}>새 버전 열기</button></div> : null}
      {instructions ? <div className="install-guide" role="status"><strong>홈 화면에서 바로 열어보세요</strong><p>iPhone은 Safari의 공유 메뉴에서 ‘홈 화면에 추가’를, Android는 브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해 주세요.</p><p>{offlineReady ? "한 번 본 놀이와 기록은 오프라인에서도 이용할 수 있어요." : "처음에는 인터넷에 연결해 놀이를 열어주세요."}</p><p>브라우저를 바꾸면 설정과 기록이 별도로 저장될 수 있어요.</p><button type="button" onClick={() => setInstructions(false)}>닫기</button></div> : null}
      <main className="web-app">{children}</main>
      <span className="sr-only" role="status">{offlineReady ? "오프라인 이용 준비 완료" : ""}</span>
    </div>
  );
}
