import { useId } from "react";
import { WheelPicker } from "./WheelPicker";
import {
  getBirthMonthInputError,
  getBirthMonthsInYear,
  getBirthYears,
  parseBirthMonthInput,
  selectBirthYear,
} from "@/onboarding/birthMonthInput";
import { getAgeMonthsFromBirthMonth } from "@/onboarding/utils";

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
        <WheelPicker
          className="birth-month-input"
          label="태어난 년도"
          value={year}
          options={[{ value: "", label: "년도 선택", placeholder: true }, ...getBirthYears(savedBirthMonth, now).map((year) => ({ value: String(year), label: `${year}년` }))]}
          onChange={(year) => onChange(selectBirthYear(value, year, savedBirthMonth))}
          disabled={disabled}
          summaryId={`${id}-summary`}
        />
        <WheelPicker
          className="birth-month-input"
          label="태어난 월"
          value={month}
          options={[{ value: "", label: "월 선택", placeholder: true }, ...getBirthMonthsInYear(year, savedBirthMonth, now).map((month) => ({ value: month, label: `${Number(month)}월` }))]}
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
