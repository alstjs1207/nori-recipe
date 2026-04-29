import type { DevArea } from "@/constants/devAreas";
import type { ChildReaction } from "@/constants/feedback";

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
