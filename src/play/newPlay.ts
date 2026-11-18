const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const NEW_PLAY_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

export function getNewPlayWindow(createdAt?: string) {
  if (!createdAt || !/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) return null;

  const created = new Date(`${createdAt}T00:00:00.000Z`);
  if (
    !Number.isFinite(created.getTime()) ||
    created.toISOString().slice(0, 10) !== createdAt
  ) return null;

  // 생성일의 한국 자정부터 고정 90일 동안 표시한다.
  return {
    startsAt: created.getTime() - KOREA_OFFSET_MS,
    expiresAt: created.getTime() - KOREA_OFFSET_MS + NEW_PLAY_DURATION_MS,
  };
}

export function isNewPlay(createdAt?: string, now = new Date()): boolean {
  const window = getNewPlayWindow(createdAt);
  return window !== null && window.startsAt <= now.getTime() && now.getTime() < window.expiresAt;
}
