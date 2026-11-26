import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getVisibleMaterialCategories } from "@/onboarding/utils";
import {
  MATERIAL_DISPLAY_NAMES,
  type MaterialSlug,
} from "@/constants/materials";
import { PlayImage } from "./PlayImage.web";
import { Icon } from "./NoriUI";
import { getMaterialImageUrl } from "@/constants/materialImageUrls";

export function MaterialPicker({
  selected,
  onSave,
  onClose,
  startNextRound,
  completedCount,
}: {
  selected: MaterialSlug[];
  onSave: (materials: MaterialSlug[]) => Promise<void>;
  onClose: () => void;
  startNextRound: (materials: MaterialSlug[]) => Promise<boolean>;
  completedCount: number;
}) {
  const [draft, setDraft] = useState(selected);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const focusEpoch = useRef(0);
  useFocusEffect(useCallback(() => {
    focusEpoch.current++;
    return () => { focusEpoch.current++; };
  }, []));
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    const current = focusEpoch.current;
    setSaving(true);
    setError(null);
    try {
      if (completedCount === 3) {
        // Keep this component/draft mounted, but remove the modal before the
        // shared notice and SDK ad. Cancellation returns to the same draft.
        ref.current?.close();
        if (!await startNextRound(draft)) {
          if (current === focusEpoch.current && ref.current?.isConnected) ref.current.showModal();
          return;
        }
      } else await onSave(draft);
      onClose();
    } catch {
      if (current === focusEpoch.current) {
        setError("재료를 저장하지 못했어요. 다시 시도해 주세요.");
        if (ref.current?.isConnected && !ref.current.open) ref.current.showModal();
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="nori-dialog material-picker"
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (saving) event.preventDefault();
      }}
      onClose={() => {
        // Ignore the handoff close, including a queued event after reopening.
        if (!savingRef.current && !ref.current?.open) onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">우리 집 재료</span>
          <h2 id={titleId}>지금 사용할 재료를 골라주세요</h2>
          <p>{completedCount === 3 ? "다른 놀이를 먼저 추천하고, 대안이 부족하면 방금 한 놀이도 포함해요. 완성한 묶음은 기록에 남아요." : completedCount ? `완료한 ${completedCount}개는 유지하고 남은 ${3 - completedCount}개만 다시 추천해요.` : "선택한 재료로 추천 놀이 3개를 다시 찾아드려요."}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="재료 설정 닫기"
          onClick={onClose}
          disabled={saving}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="picker-summary">
        <span>
          <strong>{draft.length}개</strong> 선택했어요
        </span>
        <button
          className="text-button"
          type="button"
          onClick={() => setDraft([])}
        >
          전체 해제
        </button>
      </div>
      <div className="picker-content">
        {getVisibleMaterialCategories().map((category) => (
          <fieldset key={category.name}>
            <legend>{category.name}</legend>
            <div className="picker-grid">
              {category.materials.map((material) => (
                <label
                  className={`material-option ${draft.includes(material) ? "is-selected" : ""}`}
                  key={material}
                >
                  <input
                    type="checkbox"
                    checked={draft.includes(material)}
                    onChange={() =>
                      setDraft((current) =>
                        current.includes(material)
                          ? current.filter((item) => item !== material)
                          : [...current, material],
                      )
                    }
                  />
                  <PlayImage
                    src={getMaterialImageUrl(material)}
                    alt=""
                    loading="lazy"
                  />
                  <span>{MATERIAL_DISPLAY_NAMES[material]}</span>
                  <span className="material-check" aria-hidden="true">
                    <Icon name="check" size={13} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="dialog-footer">
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="primary-button"
          type="button"
          disabled={saving}
          onClick={() => {
            void save();
          }}
        >
          {saving ? "추천 준비 중…" : completedCount === 3 ? "다음 놀이 3개 시작" : completedCount ? `남은 ${3 - completedCount}개 다시 추천` : `${draft.length}개 재료로 추천 받기`}
          <Icon name="arrow" size={20} />
        </button>
      </div>
    </dialog>
  );
}
