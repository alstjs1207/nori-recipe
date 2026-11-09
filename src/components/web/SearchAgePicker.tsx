import { useId, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./NoriUI";
import { WheelPicker } from "./WheelPicker";

export function SearchAgePicker({ value, profileAge, onChange }: {
  value: number | null;
  profileAge: number | null;
  onChange: (age: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const ages = Array.from({ length: 49 }, (_, age) => age);
  // Existing profiles can grow past the catalog's 0–48 month input range.
  if (profileAge !== null && profileAge > 48) ages.push(profileAge);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="select-control search-age-trigger"
        aria-label="놀이 추천 월령"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-dialog`}
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
      >
        <span>{value === null ? "전체 월령" : `${value}개월`}</span>
        <Icon name="chevron" size={16} />
      </button>
      <dialog
        ref={ref}
        id={`${id}-dialog`}
        className="nori-dialog search-age-picker"
        aria-labelledby={`${id}-title`}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <div className="dialog-heading">
          <div>
            <h2 id={`${id}-title`}>찾아볼 놀이 월령</h2>
            <p>탐색에만 적용해요. 아이의 생년월은 바뀌지 않아요.</p>
          </div>
          <button type="button" className="icon-button" aria-label="월령 선택 닫기" onClick={() => setOpen(false)}>
            <Icon name="close" />
          </button>
        </div>
        {open ? (
          <div className="search-age-body">
            <div className="search-age-shortcuts">
              {profileAge !== null ? (
                <button type="button" className="secondary-button" aria-pressed={draft === profileAge} onClick={() => setDraft(profileAge)}>
                  우리 아이 · {profileAge}개월
                </button>
              ) : null}
              <button type="button" className="secondary-button" aria-pressed={draft === null} onClick={() => setDraft(null)}>
                전체 월령
              </button>
            </div>
            <WheelPicker
              label="찾아볼 월령"
              value={draft === null ? "" : String(draft)}
              options={[{ value: "", label: "전체 월령" }, ...ages.map((age) => ({ value: String(age), label: `${age}개월` }))]}
              onChange={(age) => setDraft(age === "" ? null : Number(age))}
              summaryId={`${id}-summary`}
            />
            <p id={`${id}-summary`} className="birth-month-summary" role="status" aria-live="polite">
              {draft === null ? "전체 월령의 놀이를 찾아볼게요." : `${draft}개월 놀이를 찾아볼게요.`}
            </p>
          </div>
        ) : null}
        <div className="dialog-footer search-age-footer">
          <button type="button" className="secondary-button" onClick={() => setOpen(false)}>취소</button>
          <button type="button" className="primary-button" onClick={() => {
            onChange(draft);
            setOpen(false);
          }}>월령 적용<Icon name="check" size={18} /></button>
        </div>
      </dialog>
    </>
  );
}
