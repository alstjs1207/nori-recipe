import type { DevArea } from "@/constants/devAreas";
import type { ChildReaction } from "@/constants/feedback";

/**
 * 동기화 상태. 출시 시점에는 서버가 없으므로 모든 로컬 변경은 "pending"으로 쌓이고,
 * 향후 계정 연동/서버 동기화가 추가되면 업로드 완료 후 "synced"로 전이된다.
 */
export type SyncState = "pending" | "synced";

export type PlayLogRecord = {
  id: string;
  guestId: string;
  playId: string;
  completedAt: string;
  durationActual: number | null;
  starRating: number | null;
  childReaction: ChildReaction[];
  memo: string | null;
};

export type FavoriteRecord = {
  id: string;
  guestId: string;
  playId: string;
  createdAt: string;
};

export type DevAreaStat = {
  devArea: DevArea;
  total: number;
};
