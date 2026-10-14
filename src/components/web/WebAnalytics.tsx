import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import { Link, useFocusEffect, useNavigation, usePathname, useSegments } from "expo-router";
import { webAnalytics, consumePlayEntry } from "@/analytics/analytics.web";
import { type AnalyticsClient } from "@/analytics/client";
import { getAnalyticsPage, type AnalyticsEntryPoint } from "@/analytics/policy";
import { isNewPlay } from "@/play/newPlay";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaysStore } from "@/store/playsStore";
import type { Play } from "@/types";
import { ANALYTICS_NOTICE } from "@/constants/legalNotices";
import { ANALYTICS_INVITATION_RESET_EVENT, ANALYTICS_INVITATION_SESSION_KEY, createAnalyticsReadingProgress } from "@/analytics/invitation";

const AnalyticsContext = createContext<AnalyticsClient>(webAnalytics);
const ANALYTICS_PREVIEW_NOTE = "미리보기 · 분석 정보 전송 안 함";
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
  const pathname = usePathname();
  const segments = useSegments().join("/");
  const page = getAnalyticsPage(pathname, segments.includes("(main)"));
  // Browser Back can return to the root welcome route after browsing a play.
  const invitationPage = page.path === "/" || page.screen === "search" || page.screen === "favorites";
  const play = usePlaysStore((state) => state.plays.find((item) => `/play/${item.id}` === page.path));
  const [readEnough, setReadEnough] = useState(false);
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visible, setVisible] = useState(document.visibilityState === "visible");
  const prompted = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    try { prompted.current = sessionStorage.getItem(ANALYTICS_INVITATION_SESSION_KEY) === "shown"; } catch { /* Use this page's memory if storage is blocked. */ }
    const update = () => setVisible(document.visibilityState === "visible");
    const reset = () => {
      if (!client.preview) return;
      prompted.current = false;
      setReadEnough(false);
      setInvitationOpen(false);
      setDialogOpen(false);
    };
    document.addEventListener("visibilitychange", update);
    window.addEventListener(ANALYTICS_INVITATION_RESET_EVENT, reset);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener(ANALYTICS_INVITATION_RESET_EVENT, reset);
    };
  }, [client]);
  useEffect(() => {
    if (!client.consentAvailable || consent !== "unknown" || page.screen !== "play" || !play || readEnough) return;
    let detach: (() => void) | undefined;
    const attach = () => {
      if (detach) return;
      const content = document.querySelector<HTMLElement>(`[data-analytics-play-content="${play.id}"]`);
      const scroller = content?.closest<HTMLElement>(".nori-scroll-page");
      if (!content || !scroller || content.getBoundingClientRect().height <= 0) return;
      observer.disconnect();
      const reading = createAnalyticsReadingProgress(() => performance.now());
      const initialScroll = scroller.scrollTop;
      let timer: number | undefined;
      const qualify = () => {
        window.clearTimeout(timer);
        if (document.visibilityState !== "visible") return;
        if (reading.isReady()) setReadEnough(true);
        else timer = window.setTimeout(qualify, Math.max(1, Math.ceil(reading.remaining())));
      };
      const updateVisibility = () => {
        window.clearTimeout(timer);
        if (document.visibilityState !== "visible") { reading.pause(); return; }
        reading.resume();
        qualify();
      };
      const scroll = () => {
        if (document.visibilityState !== "visible" || scroller.scrollTop < initialScroll + 16) return;
        const rect = content.getBoundingClientRect();
        if (rect.height <= 0) return;
        const bottom = Math.min(window.innerHeight, scroller.getBoundingClientRect().bottom);
        reading.scroll((bottom - rect.top) / rect.height);
        qualify();
      };
      updateVisibility();
      scroller.addEventListener("scroll", scroll, { passive: true });
      document.addEventListener("visibilitychange", updateVisibility);
      detach = () => {
        window.clearTimeout(timer);
        scroller.removeEventListener("scroll", scroll);
        document.removeEventListener("visibilitychange", updateVisibility);
      };
    };
    // A previously visited tab restores its focused DOM after the route changes.
    const observer = new MutationObserver(attach);
    attach();
    if (!detach) observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      detach?.();
    };
  }, [client, consent, page.path, page.screen, play?.id, readEnough]);
  useEffect(() => {
    setInvitationOpen(false);
    setDialogOpen(false);
  }, [client, consent, page.path]);
  useEffect(() => {
    if (!client.consentAvailable || consent !== "unknown" || !visible || !readEnough || prompted.current ||
      !invitationPage) return;
    // Remember only that the invitation was shown, never the play or reading history.
    prompted.current = true;
    try { sessionStorage.setItem(ANALYTICS_INVITATION_SESSION_KEY, "shown"); } catch { /* Memory still prevents repeated prompts. */ }
    setInvitationOpen(true);
  }, [client, consent, page.path, invitationPage, visible, readEnough]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialogOpen && dialog && !dialog.open) dialog.showModal();
    else if (!dialogOpen && dialog?.open) dialog.close();
  }, [dialogOpen]);
  if (!client.consentAvailable || consent !== "unknown") return null;
  return (
    <>
      {invitationOpen ? <aside className="analytics-invitation" aria-label="선택적 사용량 분석" aria-live="polite">
        <h2>놀이를 둘러보셨나요?</h2>
        <p>많이 쓰이는 놀이와 기능을 파악해 서비스를 개선하려고 해요. 사용량 분석 참여는 선택이에요.</p>
        {client.preview ? <p className="analytics-preview-note">{ANALYTICS_PREVIEW_NOTE}</p> : null}
        <div className="analytics-choice">
          <button type="button" className="secondary-button" aria-haspopup="dialog" onClick={() => { setInvitationOpen(false); setDialogOpen(true); }}>자세히 보고 참여하기</button>
          <button type="button" className="secondary-button" onClick={() => setInvitationOpen(false)}>나중에</button>
        </div>
      </aside> : null}
      <dialog ref={dialogRef} className="nori-dialog analytics-consent-dialog" aria-labelledby={titleId}
        onCancel={(event) => { event.preventDefault(); setDialogOpen(false); }} onClose={() => setDialogOpen(false)}>
        <div className="dialog-heading">
          <div><h2 id={titleId}>서비스 개선에 참여할까요?</h2><p>어떤 놀이와 기능이 자주 쓰이는지 살펴 서비스를 개선해요. 아이 이름·생년월·메모는 보내지 않아요. 참여하지 않아도 모든 기능을 이용할 수 있어요.</p></div>
          <button type="button" className="secondary-button analytics-dialog-close" autoFocus onClick={() => setDialogOpen(false)}>닫기</button>
        </div>
        <div className="analytics-dialog-body">
          {client.preview ? <p className="analytics-preview-note">{ANALYTICS_PREVIEW_NOTE}</p> : null}
          <Link href={{ pathname: "/settings", params: { privacy: "1" } }} className="analytics-policy-link">개인정보 처리방침 보기</Link>
          {dialogOpen ? <AnalyticsConsentForm /> : null}
        </div>
      </dialog>
    </>
  );
}

function AnalyticsConsentForm() {
  const { client } = useWebAnalytics();
  const [collection, setCollection] = useState(false);
  const [transfer, setTransfer] = useState(false);
  return (
    <div>
      <fieldset className="analytics-consent-fields">
        <legend>선택 동의</legend>
        <label><input type="checkbox" checked={collection} onChange={(event) => setCollection(event.target.checked)} /><span>[선택] 서비스 개선을 위한 이용 통계 분석에 동의해요.</span></label>
        <details><summary>개인정보 수집·이용 내용 보기</summary>{ANALYTICS_NOTICE.collection.map((item) => <p key={item}>{item}</p>)}</details>
        <label><input type="checkbox" checked={transfer} onChange={(event) => setTransfer(event.target.checked)} /><span>[선택] Google의 해외 분석 처리·보관에 동의해요.</span></label>
        <details>
          <summary>개인정보 국외 이전 내용 보기</summary>
          {ANALYTICS_NOTICE.transfer.map((item) => <p key={item}>{item}</p>)}
          <p><a className="analytics-policy-link" href="https://datacenters.google/locations/" target="_blank" rel="noopener noreferrer">Google 데이터센터 목록</a>{" · "}<a className="analytics-policy-link" href="https://business.safety.google/adssubprocessors/" target="_blank" rel="noopener noreferrer">Google 하위처리업체 목록</a></p>
        </details>
      </fieldset>
      <p>{client.preview ? "선택은 미리보기에만 저장돼요." : "두 항목 모두 동의한 경우에만 분석에 참여해요. 동의하지 않아도 모든 놀이 기능을 이용할 수 있어요."}</p>
      <div className="analytics-choice">
        <button type="button" className="secondary-button" onClick={() => client.setConsent("denied")}>참여하지 않기</button>
        <button type="button" className="secondary-button" disabled={!collection || !transfer} onClick={() => { if (collection && transfer) client.setConsent("granted"); }}>동의하고 참여하기</button>
      </div>
    </div>
  );
}

export function AnalyticsSettings() {
  const { client, consent } = useWebAnalytics();
  const [previewResetCount, setPreviewResetCount] = useState(0);
  function resetPreviewInvitation() {
    if (!client.preview) return;
    client.setConsent("unknown");
    try { sessionStorage.removeItem(ANALYTICS_INVITATION_SESSION_KEY); } catch { /* Reset this tab's in-memory state as well. */ }
    window.dispatchEvent(new Event(ANALYTICS_INVITATION_RESET_EVENT));
    setPreviewResetCount((count) => count + 1);
  }
  const status = client.preview ? {
    granted: "미리보기에서 참여를 선택했어요.",
    denied: "미리보기에서 참여하지 않기로 선택했어요.",
    unknown: "미리보기에서 참여 여부를 선택할 수 있어요.",
  }[consent] : !client.enabled ? "현재 이 사이트에서는 사용량 분석을 수집하지 않아요." : {
    granted: "사용량 분석에 참여하고 있어요.",
    denied: "사용량 분석에 참여하지 않고 있어요.",
    unknown: "아직 참여 여부를 선택하지 않았어요.",
  }[consent];
  return (
    <section className="settings-panel analytics-settings">
      <h2>사용량 분석 참여</h2>
      <p>{status}</p>
      {client.preview ? <p className="analytics-preview-note">{ANALYTICS_PREVIEW_NOTE}</p> : <p>선택한 경우 페이지 방문과 놀이 선택, 저장·기록 기능 사용이 Google Analytics로 전송돼요. 아이 이름·생년월·메모는 보내지 않아요. 언제든 참여를 중단할 수 있고, 놀이 기능은 계속 이용할 수 있어요.</p>}
      {client.consentAvailable ? consent === "granted" ? <div className="analytics-choice"><button className="secondary-button" type="button" onClick={() => client.setConsent("denied")}>참여 중단하기</button></div> : <AnalyticsConsentForm key={`${consent}:${previewResetCount}`} /> : null}
      {client.preview ? <>
        <div className="analytics-choice"><button className="secondary-button" type="button" onClick={resetPreviewInvitation}>동의 안내 다시 테스트</button></div>
        {previewResetCount > 0 && consent === "unknown" ? <p role="status">미리보기의 동의 선택과 안내 표시 상태를 초기화했어요. 놀이 상세를 20초 읽거나 본문 절반까지 스크롤한 뒤 홈·탐색·저장 목록으로 돌아오면 안내가 다시 나와요.</p> : null}
      </> : null}
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
