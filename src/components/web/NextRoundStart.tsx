import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { appRuntime } from "@/platform/runtime";

// One confirmation, ad and write operation for every way to start a next round.
export function useNextRoundStart() {
  const [adNoticeOpen, setAdNoticeOpen] = useState(false);
  const adNoticeRef = useRef<HTMLDialogElement>(null);
  const adNoticeTitleId = useId();
  const resolveAdNotice = useRef<((confirmed: boolean) => void) | null>(null);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const request = useRef(0);
  const ad = appRuntime.recommendationAd;
  function answerAdNotice(confirmed: boolean) {
    const resolve = resolveAdNotice.current;
    resolveAdNotice.current = null;
    adNoticeRef.current?.close();
    setAdNoticeOpen(false);
    resolve?.(confirmed);
  }
  useEffect(() => {
    if (adNoticeOpen) adNoticeRef.current?.showModal();
  }, [adNoticeOpen]);
  useFocusEffect(useCallback(() => () => {
    request.current++;
    startingRef.current = false;
    setStarting(false);
    setAdNoticeOpen(false);
    resolveAdNotice.current?.(false);
    resolveAdNotice.current = null;
  }, []));
  async function beforeStartNextRound(): Promise<boolean> {
    // Both current-material and edited-material starts use this one ad gate.
    // Skip the SDK entirely without confirmation, including at the 24h boundary.
    if (!ad?.getSnapshot()) return true;
    const current = request.current;
    const confirmed = await new Promise<boolean>(resolve => {
      resolveAdNotice.current = resolve;
      setAdNoticeOpen(true);
    });
    if (!confirmed || current !== request.current) return false;
    const proceed = await ad.beforeNext();
    return proceed && current === request.current;
  }
  async function runNextRound(save: () => Promise<void>): Promise<boolean> {
    if (startingRef.current) return false;
    startingRef.current = true;
    const current = ++request.current;
    setStarting(true);
    try {
      const proceed = await beforeStartNextRound();
      if (!proceed || current !== request.current) return false;
      await save();
      return true;
    } finally {
      if (current === request.current) { startingRef.current = false; setStarting(false); }
    }
  }
  const notice = adNoticeOpen ? (
    <dialog ref={adNoticeRef} className="nori-dialog next-round-ad-dialog"
      aria-labelledby={adNoticeTitleId} aria-describedby={`${adNoticeTitleId}-description`}
      onClose={() => answerAdNotice(false)}>
      <div className="dialog-heading">
        <div>
          <h2 id={adNoticeTitleId}>광고 안내</h2>
          <p id={`${adNoticeTitleId}-description`}>다음 놀이 3개를 시작하기 전에 광고가 표시돼요. 광고가 한 번 표시되면 그 시점부터 24시간 동안 추가 광고 없이 새 놀이를 추천받을 수 있어요.</p>
        </div>
      </div>
      <div className="dialog-footer">
        <button type="button" className="secondary-button" onClick={() => answerAdNotice(false)}>취소</button>
        <button type="button" className="primary-button" onClick={() => answerAdNotice(true)}>확인</button>
      </div>
    </dialog>
  ) : null;
  return { run: runNextRound, starting, notice };
}
