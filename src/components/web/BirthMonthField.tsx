import { useId } from "react";
import { formatBirthMonthInput, getBirthMonthInputError, parseBirthMonthInput } from "@/onboarding/birthMonthInput";
import { getAgeMonthsFromBirthMonth } from "@/onboarding/utils";

export function BirthMonthField({
  value,
  onChange,
  savedBirthMonth = null,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  savedBirthMonth?: number | null;
  disabled?: boolean;
}) {
  const id = useId();
  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  const error = getBirthMonthInputError(value, savedBirthMonth, now);
  const birthMonth = parseBirthMonthInput(value);
  return (
    <div className="birth-month-field">
      <label htmlFor={id}>아이의 생년월</label>
      <input
        id={id}
        type="month"
        className="birth-month-input"
        aria-label="아이 생년월"
        aria-describedby={`${id}-summary`}
        aria-invalid={value !== "" && error !== null}
        value={value}
        min={formatBirthMonthInput(Math.min(currentMonth - 48, savedBirthMonth ?? currentMonth))}
        max={formatBirthMonthInput(currentMonth)}
        placeholder="YYYY-MM"
        required
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={`${id}-summary`} className={value && error ? "error-text" : "birth-month-summary"} role="status" aria-live="polite">
        {!error && birthMonth !== null
          ? <>지금 <strong>{getAgeMonthsFromBirthMonth(birthMonth, now)}개월</strong>이에요.</>
          : value ? error : "생년월을 입력하면 개월수를 자동으로 알려드려요."}
      </p>
    </div>
  );
}
