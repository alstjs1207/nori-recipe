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
  if (birthMonth === null) return "태어난 년도와 월을 모두 선택해 주세요.";
  const currentMonth = referenceDate.getFullYear() * 12 + referenceDate.getMonth();
  if (birthMonth > currentMonth) return "생년월은 이번 달까지 입력할 수 있어요.";
  if (birthMonth !== savedBirthMonth && getAgeMonthsFromBirthMonth(birthMonth, referenceDate) > 48) {
    return "0~48개월 아이의 생년월을 입력해 주세요.";
  }
  return null;
}

export function getBirthYears(savedBirthMonth: number | null = null, referenceDate = new Date()): number[] {
  const year = referenceDate.getFullYear();
  const years = Array.from({ length: 5 }, (_, index) => year - index);
  if (savedBirthMonth !== null) years.push(Math.floor(savedBirthMonth / 12));
  return [...new Set(years)].sort((a, b) => b - a);
}

export function getBirthMonthsInYear(year: string, savedBirthMonth: number | null = null, referenceDate = new Date()): string[] {
  return Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"))
    .filter((month) => !year || getBirthMonthInputError(`${year}-${month}`, savedBirthMonth, referenceDate) === null);
}

export function selectBirthYear(value: string, year: string, savedBirthMonth: number | null = null, referenceDate = new Date()): string {
  const month = value.split("-")[1] ?? "";
  if (!year || !month) return `${year}-${month}`;
  const months = getBirthMonthsInYear(year, savedBirthMonth, referenceDate);
  const nearest = months.reduce((best, candidate) =>
    Math.abs(Number(candidate) - Number(month)) < Math.abs(Number(best) - Number(month)) ? candidate : best,
  months[0]);
  return `${year}-${nearest ?? ""}`;
}
