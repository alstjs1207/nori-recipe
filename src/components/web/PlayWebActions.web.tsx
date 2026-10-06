import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import type { Play } from "@/types";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const url = play ? `${window.location.origin}/play/${encodeURIComponent(play.id)}` : "";
  const nativeShareAvailable = typeof navigator.share === "function" &&
    (!navigator.canShare || navigator.canShare({ url }));

  useFocusEffect(useCallback(() => {
    if (!play) return;
    document.title = `${play.name} · 노리 레시피`;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = url;
    return () => {
      setDialogOpen(false);
      document.title = "노리 레시피 · 오늘의 육아 놀이";
    };
  }, [play?.name, url]));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialogOpen && dialog && !dialog.open) dialog.showModal();
    else if (!dialogOpen && dialog?.open) dialog.close();
  }, [dialogOpen]);

  function open() {
    setMessage(null);
    setDialogOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("놀이 링크를 복사했어요.");
    } catch {
      setMessage("아래 링크를 길게 누르거나 선택해서 복사해 주세요.");
      setDialogOpen(true);
    }
  }

  async function shareToApp() {
    if (!play) return;
    try {
      await navigator.share({ title: `${play.name} · 노리 레시피`, url });
      setDialogOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("다른 앱으로 공유할 수 없어요. 링크를 복사해서 공유해 주세요.");
    }
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
          <label className="play-share-link-label">
            놀이 링크
            <input aria-label="공유할 놀이 링크" readOnly value={url} onFocus={(event) => event.target.select()} />
          </label>
          <div className="play-share-dialog-actions">
            <button type="button" className="play-share-copy" onClick={() => { void copy(); }}>링크 복사</button>
            {nativeShareAvailable ? <button type="button" onClick={() => { void shareToApp(); }}><ShareIcon /> 다른 앱으로 공유</button> : null}
          </div>
          <p className="play-share-status" role="status">{message ?? "받는 사람은 가입 없이 이 놀이를 바로 볼 수 있어요."}</p>
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
