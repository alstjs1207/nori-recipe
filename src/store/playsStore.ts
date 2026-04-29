import { create } from "zustand";

import { loadLivePlays } from "@/data/content";
import type { Play } from "@/types";

type PlaysStatus = "idle" | "loading" | "ready" | "error";

type PlaysStore = {
  plays: Play[];
  status: PlaysStatus;
  error: string | null;
  loadPlays: () => Promise<Play[]>;
};

export const usePlaysStore = create<PlaysStore>((set, get) => ({
  plays: [],
  status: "idle",
  error: null,
  loadPlays: async () => {
    if (get().status === "ready" && get().plays.length > 0) {
      return get().plays;
    }

    set({ status: "loading", error: null });

    try {
      const plays = loadLivePlays();
      set({ plays, status: "ready", error: null });
      return plays;
    } catch (error) {
      const message = error instanceof Error ? error.message : "놀이 데이터를 불러오지 못했습니다.";
      set({ status: "error", error: message });
      throw error;
    }
  },
}));
