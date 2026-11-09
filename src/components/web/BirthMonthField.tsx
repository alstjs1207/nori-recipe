import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import {
  getBirthMonthInputError,
  getBirthMonthsInYear,
  getBirthYears,
  parseBirthMonthInput,
  selectBirthYear,
} from "@/onboarding/birthMonthInput";
import { getAgeMonthsFromBirthMonth } from "@/onboarding/utils";

const WHEEL_ROW_HEIGHT = 44;
type WheelOption = { value: string; label: string };

function BirthWheel({ label, value, options, onChange, disabled, summaryId }: {
  label: string;
  value: string;
  options: WheelOption[];
  onChange: (value: string) => void;
  disabled: boolean;
  summaryId: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ value, options, onChange, disabled });
  latest.current = { value, options, onChange, disabled };
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const optionKey = options.map((option) => option.value).join(",");

  useEffect(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (ref.current) ref.current.scrollTop = selectedIndex * WHEEL_ROW_HEIGHT;
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [selectedIndex, optionKey]);

  function select(index: number) {
    const current = latest.current;
    const option = current.options[Math.max(0, Math.min(index, current.options.length - 1))];
    if (current.disabled || !option) return;
    if (ref.current) ref.current.scrollTop = current.options.indexOf(option) * WHEEL_ROW_HEIGHT;
    if (option.value !== current.value) current.onChange(option.value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next = selectedIndex;
    if (event.key === "ArrowDown") next += 1;
    else if (event.key === "ArrowUp") next -= 1;
    else if (event.key === "PageDown") next += 3;
    else if (event.key === "PageUp") next -= 3;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;
    event.preventDefault();
    select(next);
  }

  return (
    <div className="birth-wheel-column">
      <span id={`${id}-label`} className="birth-wheel-label">{label}</span>
      <div
        ref={ref}
        className="birth-month-input birth-wheel"
        role="listbox"
        aria-labelledby={`${id}-label`}
        aria-describedby={summaryId}
        aria-orientation="vertical"
        aria-activedescendant={`${id}-option-${selectedIndex}`}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
        onScroll={() => {
          if (timer.current !== null) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            if (ref.current) select(Math.round(ref.current.scrollTop / WHEEL_ROW_HEIGHT));
          }, 150);
        }}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={option.value === value}
            className={`birth-wheel-option ${option.value === "" ? "is-placeholder" : ""}`}
            onClick={() => {
              select(index);
              ref.current?.focus({ preventScroll: true });
            }}
          >
            {option.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BirthMonthField({ value, onChange, savedBirthMonth = null, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  savedBirthMonth?: number | null;
  disabled?: boolean;
}) {
  const id = useId();
  const now = new Date();
  const [year = "", month = ""] = value.split("-");
  const error = getBirthMonthInputError(value, savedBirthMonth, now);
  const birthMonth = parseBirthMonthInput(value);
  return (
    <div className="birth-month-field" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="birth-month-label">아이의 생년월</span>
      <div className="birth-month-wheels">
        <BirthWheel
          label="태어난 년도"
          value={year}
          options={[{ value: "", label: "년도 선택" }, ...getBirthYears(savedBirthMonth, now).map((year) => ({ value: String(year), label: `${year}년` }))]}
          onChange={(year) => onChange(selectBirthYear(value, year, savedBirthMonth))}
          disabled={disabled}
          summaryId={`${id}-summary`}
        />
        <BirthWheel
          label="태어난 월"
          value={month}
          options={[{ value: "", label: "월 선택" }, ...getBirthMonthsInYear(year, savedBirthMonth, now).map((month) => ({ value: month, label: `${Number(month)}월` }))]}
          onChange={(month) => onChange(`${year}-${month}`)}
          disabled={disabled}
          summaryId={`${id}-summary`}
        />
      </div>
      <p className="birth-wheel-hint">년과 월을 위아래로 밀어 선택해 주세요.</p>
      <p id={`${id}-summary`} className={value && error ? "error-text" : "birth-month-summary"} role="status" aria-live="polite">
        {!error && birthMonth !== null
          ? <>지금 <strong>{getAgeMonthsFromBirthMonth(birthMonth, now)}개월</strong>이에요.</>
          : value ? error : "생년월을 선택하면 개월수를 자동으로 알려드려요."}
      </p>
    </div>
  );
}
