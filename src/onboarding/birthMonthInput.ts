import { getAgeMonthsFromBirthMonth } from "./utils";

export function formatBirthMonthInput(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12 + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function parseBirthMonthInput(value: string): number | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match || Number(match[1]) < 1) return null;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

export function getBirthMonthInputError(
  value: string,
  savedBirthMonth: number | null = null,
  referenceDate = new Date(),
): string | null {
  const birthMonth = parseBirthMonthInput(value);
  if (birthMonth === null) return "생년월을 입력해 주세요. (예: 2024-01)";
  const currentMonth = referenceDate.getFullYear() * 12 + referenceDate.getMonth();
  if (birthMonth > currentMonth) return "생년월은 이번 달까지 입력할 수 있어요.";
  if (birthMonth !== savedBirthMonth && getAgeMonthsFromBirthMonth(birthMonth, referenceDate) > 48) {
    return "0~48개월 아이의 생년월을 입력해 주세요.";
  }
  return null;
}
