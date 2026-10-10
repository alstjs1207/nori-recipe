import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import { Link, useFocusEffect, useNavigation, usePathname, useSegments } from "expo-router";
import { webAnalytics, consumePlayEntry } from "@/analytics/analytics.web";
import { type AnalyticsClient } from "@/analytics/client";
import { getAnalyticsPage, type AnalyticsEntryPoint } from "@/analytics/policy";
import { isNewPlay } from "@/play/newPlay";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaysStore } from "@/store/playsStore";
import type { Play } from "@/types";

const AnalyticsContext = createContext<AnalyticsClient>(webAnalytics);
export function useWebAnalytics() {
  const client = useContext(AnalyticsContext);
  const consent = useSyncExternalStore(client.subscribe, client.getConsent, () => "unknown" as const);
  return { client, consent };
}

export function WebAnalyticsProvider({ children, client = webAnalytics }: PropsWithChildren<{ client?: AnalyticsClient }>) {
  return <AnalyticsContext.Provider value={client}><AnalyticsPageTracking />{children}<AnalyticsConsentBanner /></AnalyticsContext.Provider>;
}

function AnalyticsPageTracking() {
  const { client, consent } = useWebAnalytics();
  const pathname = usePathname();
  const segments = useSegments().join("/");
  const profileReady = useSessionStore((state) => state.onboardingCompleted && state.userContext.childBirthMonth !== null);
  const plays = usePlaysStore((state) => state.plays);
  const [online, setOnline] = useState(navigator.onLine);
  const playView = useRef<string | null>(null);
  const entry = useRef<{ key: string; source: AnalyticsEntryPoint } | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    const page = getAnalyticsPage(pathname, segments.includes("(main)"));
    // A returning profile redirects from index before the welcome screen is shown.
    if (page.screen === "welcome" && pathname === "/" && profileReady) return;
    client.trackPage(page);
    if (consent !== "granted") playView.current = null;
    if (page.screen !== "play") { playView.current = null; entry.current = null; return; }
    const play = plays.find((item) => `/play/${item.id}` === page.path);
    if (!play) return;
    if (entry.current?.key !== page.path) entry.current = { key: page.path, source: consumePlayEntry(play.id) };
    if (consent !== "granted" || !online || playView.current === page.path) return;
    playView.current = page.path;
    void client.track({ name: "play_view", params: { play_id: play.id, entry_point: entry.current.source, is_new: Number(isNewPlay(play.createdAt)) } })
      .then((sent) => { if (!sent && playView.current === page.path) playView.current = null; });
  }, [client, consent, pathname, segments, profileReady, plays, online]);
  return null;
}

export function AnalyticsConsentBanner() {
  const { client, consent } = useWebAnalytics();
  if (!client.enabled || consent !== "unknown") return null;
  return (
    <aside className="analytics-banner" aria-label="선택적 사용량 분석">
      <div>
        <h2>더 편한 놀이 찾기를 위해, 사용량 분석에 참여할까요?</h2>
        <p>페이지 방문과 놀이 선택, 저장·기록 기능의 사용을 Google Analytics로 분석해요. 아이 이름·생년월·메모는 보내지 않아요. 참여하지 않아도 모든 기능을 이용할 수 있어요.</p>
        <Link href={{ pathname: "/settings", params: { privacy: "1" } }} className="analytics-policy-link">개인정보 처리방침 보기</Link>
      </div>
      <div className="analytics-choice">
        <button type="button" className="secondary-button" onClick={() => client.setConsent("denied")}>참여하지 않기</button>
        <button type="button" className="secondary-button" onClick={() => client.setConsent("granted")}>분석에 동의하기</button>
      </div>
    </aside>
  );
}

export function AnalyticsSettings() {
  const { client, consent } = useWebAnalytics();
  return (
    <section className="settings-panel analytics-settings">
      <h2>사용량 분석 참여</h2>
      <p>{!client.enabled ? "현재 이 사이트에서는 사용량 분석을 수집하지 않아요." : consent === "granted" ? "사용량 분석에 참여하고 있어요." : consent === "denied" ? "사용량 분석에 참여하지 않고 있어요." : "아직 참여 여부를 선택하지 않았어요."}</p>
      <p>선택한 경우 페이지 방문과 놀이 선택, 저장·기록 기능 사용이 Google Analytics로 전송돼요. 아이 이름·생년월·메모는 보내지 않아요. 언제든 참여를 중단할 수 있고, 놀이 기능은 계속 이용할 수 있어요.</p>
      {client.enabled ? <div className="analytics-choice">
        {consent !== "denied" ? <button className="secondary-button" type="button" onClick={() => client.setConsent("denied")}>{consent === "granted" ? "참여 중단하기" : "참여하지 않기"}</button> : null}
        {consent !== "granted" ? <button className="secondary-button" type="button" onClick={() => client.setConsent("granted")}>분석에 동의하기</button> : null}
      </div> : null}
    </section>
  );
}

export function useRecommendationImpression<T extends HTMLElement>(play: Play | undefined, position?: number) {
  const ref = useRef<T>(null);
  const { client, consent } = useWebAnalytics();
  const navigation = useNavigation();
  const [focused, setFocused] = useState(navigation.isFocused());
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    const element = ref.current;
    if (!element || !play || position === undefined || !focused || consent !== "granted" || !client.enabled || typeof IntersectionObserver === "undefined") return;
    let seen = false;
    const observer = new IntersectionObserver((entries) => {
      if (seen || document.visibilityState !== "visible" || !entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      seen = true;
      void client.track({ name: "recommendation_impression", params: { play_id: play.id, position, is_new: Number(isNewPlay(play.createdAt)) } }).then((sent) => { if (!sent) seen = false; });
    }, { threshold: 0.5 });
    const observe = () => { observer.disconnect(); if (document.visibilityState === "visible") observer.observe(element); };
    observe();
    document.addEventListener("visibilitychange", observe);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", observe); };
  }, [client, consent, focused, play?.id, play?.createdAt, position]);
  return ref;
}
