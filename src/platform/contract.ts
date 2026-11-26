import type { RecommendationAd } from "./completion-ad";

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type Insets = { top: number; bottom: number; left: number; right: number };
export interface AppRuntime {
  target: "web" | "native" | "toss";
  storage: KeyValueStorage;
  initialize(): Promise<void>;
  checkIdentity?(): Promise<boolean>;
  recommendationAd?: RecommendationAd;
  createPlayLink?(playId: string): Promise<string>;
  shareMessage?(message: string): Promise<void>;
  copyText?(text: string): Promise<void>;
  close?(): Promise<void>;
  openExternal?(url: string): Promise<void>;
  navigation?(onBack: () => void, onHome: () => void, onError: () => void): () => void;
  safeArea?(onChange: (insets: Insets) => void): () => void;
}
