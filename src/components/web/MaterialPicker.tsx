import { useEffect, useId, useRef, useState } from "react";
import { getVisibleMaterialCategories } from "@/onboarding/utils";
import {
  MATERIAL_DISPLAY_NAMES,
  type MaterialSlug,
} from "@/constants/materials";
import { Icon } from "./NoriUI";

export function MaterialPicker({
  selected,
  onSave,
  onClose,
}: {
  selected: MaterialSlug[];
  onSave: (materials: MaterialSlug[]) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(selected);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function save() {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } catch {
      setError("재료를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
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
      onClose={onClose}
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">우리 집 재료</span>
          <h2 id={titleId}>지금 사용할 재료를 골라주세요</h2>
          <p>선택한 재료로 추천 놀이 3개를 다시 찾아드려요.</p>
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
                  <img
                    src={`/media/materials/${material}.webp`}
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
          {saving ? "추천 준비 중…" : `${draft.length}개 재료로 추천 받기`}
          <Icon name="arrow" size={20} />
        </button>
      </div>
    </dialog>
  );
}
