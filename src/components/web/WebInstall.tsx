import { createContext, useContext, useEffect, useId, useState, type PropsWithChildren } from "react";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallContext = createContext<{
  installed: boolean;
  offlineStatus: "preparing" | "ready" | "unavailable";
  requestInstall(): Promise<"prompted" | "manual">;
} | null>(null);

// Keep the browser's install event when it arrives before Settings is opened.
export function WebInstallProvider({ children }: PropsWithChildren) {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState<"preparing" | "ready" | "unavailable">("preparing");

  useEffect(() => {
    let mounted = true;
    const ready = () => setOfflineStatus("ready");
    const unavailable = () => setOfflineStatus("unavailable");
    window.addEventListener("nori:offline-ready", ready);
    window.addEventListener("nori:offline-error", unavailable);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.ready.then(() => { if (mounted) ready(); });
    } else unavailable();
    const standalone = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setInstalled(
      standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    updateInstalled();
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("pageshow", updateInstalled);
    standalone.addEventListener("change", updateInstalled);
    return () => {
      mounted = false;
      window.removeEventListener("nori:offline-ready", ready);
      window.removeEventListener("nori:offline-error", unavailable);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("pageshow", updateInstalled);
      standalone.removeEventListener("change", updateInstalled);
    };
  }, []);

  async function requestInstall(): Promise<"prompted" | "manual"> {
    if (!installEvent) return "manual";
    setInstallEvent(null);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      return "prompted";
    } catch {
      return "manual";
    }
  }

  return (
    <InstallContext.Provider value={{ installed, offlineStatus, requestInstall }}>
      {children}
    </InstallContext.Provider>
  );
}

export function InstallSettings() {
  const install = useContext(InstallContext);
  const [instructions, setInstructions] = useState(false);
  const guideId = useId();
  if (!install) return null;

  return (
    <section className="settings-panel install-settings">
      <h2>앱처럼 이용하기</h2>
      <p role="status">
        {install.offlineStatus === "ready"
          ? "기본 화면과 이용 안내를 오프라인으로 열 수 있어요."
          : install.offlineStatus === "preparing"
            ? "기본 화면을 준비하고 있어요. 잠시 인터넷 연결을 유지해 주세요."
            : "오프라인 준비를 완료하지 못했어요. 인터넷 연결을 확인하고 다시 열어주세요."}
      </p>
      {install.installed ? (
        <p role="status">홈 화면에 추가했어요. 홈 화면에서 바로 열 수 있어요.</p>
      ) : (
        <>
          <p>홈 화면에 추가하면 노리 레시피를 더 편하게 열 수 있어요.</p>
          <button
            type="button"
            className="secondary-button install-button"
            aria-controls={instructions ? guideId : undefined}
            onClick={async () => {
              const result = await install.requestInstall();
              setInstructions(result === "manual");
            }}
          >
            홈 화면에 추가
          </button>
          {instructions ? (
            <div id={guideId} className="install-guide" role="status">
              <strong>홈 화면에서 바로 열어보세요</strong>
              <p>
                iPhone은 Safari의 공유 메뉴에서 ‘홈 화면에 추가’를 선택하고,
                ‘웹 앱으로 열기’가 보이면 켠 뒤 추가해 주세요. 추가한 홈 화면 아이콘으로 열면 주소창 없이 이용할 수 있어요.
              </p>
              <p>주소창이나 하단 브라우저 도구막대가 계속 보이면 Safari에서 위 방법으로 다시 추가해 주세요. 기존 설정과 기록은 지우지 않아도 돼요.</p>
              <p>Android는 브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해 주세요.</p>
              <p>처음에는 인터넷에 연결해 기본 화면 준비를 마쳐주세요. 준비 후에는 처음 오프라인으로 열어도 기본 화면과 이용 안내를 볼 수 있어요. 이미지는 한 번 열어본 항목을 오프라인에서도 볼 수 있어요.</p>
              <p>브라우저를 바꾸면 설정과 기록이 별도로 저장될 수 있어요.</p>
              <button type="button" onClick={() => setInstructions(false)}>
                닫기
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
