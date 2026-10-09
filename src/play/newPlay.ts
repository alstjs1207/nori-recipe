const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getNewPlayWindow(createdAt?: string) {
  if (!createdAt || !/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) return null;

  const created = new Date(`${createdAt}T00:00:00.000Z`);
  if (
    !Number.isFinite(created.getTime()) ||
    created.toISOString().slice(0, 10) !== createdAt
  ) return null;

  const nextMonth = new Date(created);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);
  const lastDay = new Date(nextMonth);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  nextMonth.setUTCDate(Math.min(created.getUTCDate(), lastDay.getUTCDate()));

  // 날짜는 한국 자정 기준으로 비교하고, 다음 달에 같은 날이 없으면 말일로 맞춘다.
  return {
    startsAt: created.getTime() - KOREA_OFFSET_MS,
    expiresAt: nextMonth.getTime() - KOREA_OFFSET_MS,
  };
}

export function isNewPlay(createdAt?: string, now = new Date()): boolean {
  const window = getNewPlayWindow(createdAt);
  return window !== null && window.startsAt <= now.getTime() && now.getTime() < window.expiresAt;
}
