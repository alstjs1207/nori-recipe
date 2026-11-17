import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import type { Play } from "@/types";
import { trackAnalytics } from "@/analytics/analytics";
import { appRuntime } from "@/platform/runtime";

type PlaySharing = {
  open: () => void;
};

const PlaySharingContext = createContext<PlaySharing | null>(null);

function ShareIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></svg>;
}

export function PlayWebActionsProvider({ play, children }: { play?: Play; children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tossUrl, setTossUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const activePlay = useRef(play?.id);
  activePlay.current = play?.id;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const toss = appRuntime.target === "toss";
  const webUrl = play ? `${window.location.origin}/play/${encodeURIComponent(play.id)}` : "";
  const url = toss ? tossUrl : webUrl;
  const nativeShareAvailable = toss || (typeof navigator.share === "function" &&
    (!navigator.canShare || navigator.canShare({ url })));
  useEffect(() => { setTossUrl(""); setBusy(false); }, [play?.id]);

  useFocusEffect(useCallback(() => {
    if (!play) return;
    document.title = `${play.name} · 노리 레시피`;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical && !toss) canonical.href = webUrl;
    return () => {
      setDialogOpen(false);
      document.title = "노리 레시피 · 오늘의 육아 놀이";
    };
  }, [play?.id, play?.name, webUrl]));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialogOpen && dialog && !dialog.open) dialog.showModal();
    else if (!dialogOpen && dialog?.open) dialog.close();
  }, [dialogOpen]);

  function open() {
    setMessage(null);
    setDialogOpen(true);
  }

  async function sharingUrl() {
    if (!toss) return url;
    if (tossUrl) return tossUrl;
    if (!play || !appRuntime.createPlayLink) throw new Error("공유할 놀이를 확인해 주세요.");
    const id = play.id;
    const result = await appRuntime.createPlayLink(id);
    if (activePlay.current !== id) throw new Error("놀이가 바뀌었어요. 다시 공유해 주세요.");
    setTossUrl(result);
    return result;
  }

  async function copy() {
    if (busy) return;
    setBusy(true);
    try {
      const link = await sharingUrl();
      if (toss) await appRuntime.copyText?.(link);
      else await navigator.clipboard.writeText(link);
      if (play) trackAnalytics({ name: "share", params: { item_id: play.id, content_type: "play", method: "copy_link" } });
      setMessage("놀이 링크를 복사했어요.");
    } catch {
      setMessage(toss ? "토스 링크를 복사하지 못했어요. 권한과 연결을 확인하고 다시 시도해 주세요." : "아래 링크를 길게 누르거나 선택해서 복사해 주세요.");
      setDialogOpen(true);
    } finally { setBusy(false); }
  }

  async function shareToApp() {
    if (!play || busy) return;
    setBusy(true);
    try {
      const link = await sharingUrl();
      if (toss) await appRuntime.shareMessage?.(`${play.name} · 노리 레시피\n${link}`);
      else await navigator.share({ title: `${play.name} · 노리 레시피`, url: link });
      trackAnalytics({ name: "share", params: { item_id: play.id, content_type: "play", method: "native_share" } });
      setDialogOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage(toss ? "토스 링크를 공유하지 못했어요. 연결을 확인하고 다시 시도해 주세요." : "다른 앱으로 공유할 수 없어요. 링크를 복사해서 공유해 주세요.");
    } finally { setBusy(false); }
  }

  return (
    <PlaySharingContext.Provider value={{ open }}>
      {children}
      {play ? (
        <dialog ref={dialogRef} className="play-share-dialog" aria-labelledby={titleId}
          onClose={() => setDialogOpen(false)}
          onClick={(event) => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
          <div className="play-share-dialog-header">
            <h2 id={titleId}>놀이 링크 공유</h2>
            <button type="button" className="play-share-close" aria-label="공유창 닫기" onClick={() => setDialogOpen(false)}>×</button>
          </div>
          <p className="play-share-name">{play.name}</p>
          {!toss || tossUrl ? <label className="play-share-link-label">
            놀이 링크
            <input aria-label="공유할 놀이 링크" readOnly value={url} onFocus={(event) => event.target.select()} />
          </label> : <p>토스에서 이 놀이를 바로 열 수 있는 링크로 공유해요.</p>}
          <div className="play-share-dialog-actions">
            <button type="button" disabled={busy} className="play-share-copy" onClick={() => { void copy(); }}>{busy ? "링크 준비 중…" : "링크 복사"}</button>
            {nativeShareAvailable ? <button type="button" disabled={busy} onClick={() => { void shareToApp(); }}><ShareIcon /> 다른 앱으로 공유</button> : null}
          </div>
          <p className="play-share-status" role="status">{message ?? (toss ? "링크에는 아이 정보와 놀이 기록을 담지 않아요." : "받는 사람은 가입 없이 이 놀이를 바로 볼 수 있어요.")}</p>
        </dialog>
      ) : null}
    </PlaySharingContext.Provider>
  );
}

export function PlayShareButton() {
  const sharing = useContext(PlaySharingContext);
  if (!sharing) return null;
  return <button type="button" className="play-share-toolbar-button" aria-label="놀이 공유" aria-haspopup="dialog" onClick={sharing.open}><ShareIcon /> 공유</button>;
}
