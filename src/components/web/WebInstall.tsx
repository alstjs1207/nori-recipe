import { createContext, useContext, useEffect, useId, useState, type PropsWithChildren } from "react";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallContext = createContext<{
  installed: boolean;
  requestInstall(): Promise<"prompted" | "manual">;
} | null>(null);

// Keep the browser's install event when it arrives before Settings is opened.
export function WebInstallProvider({ children }: PropsWithChildren) {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
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
    <InstallContext.Provider value={{ installed, requestInstall }}>
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
              <p>처음에는 인터넷에 연결해 놀이를 열어주세요. 한 번 본 놀이와 이미지는 오프라인에서도 볼 수 있어요.</p>
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
