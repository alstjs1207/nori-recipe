import type { DevArea } from "@/constants/devAreas";
import type { Play } from "@/types";

export type Weights = {
  material: number;
  dev: number;
  popular: number;
  time: number;
  feedback: number;
};

export type ScoreBreakdown = {
  material: number;
  dev: number;
  popular: number;
  time: number;
  feedback: number;
};

export type ScoredPlay = {
  play: Play;
  total: number;
  breakdown: ScoreBreakdown;
};

export type UserStats = {
  totalPlays: number;
  popularScores?: Partial<Record<string, number>>;
  recentCompletedPlayIds?: string[];
};

export type RecommendResult = {
  results: Play[];
  usedFallback: boolean;
  appliedWeights: Weights;
};

export type HardFilterReason = "status" | "age" | "place" | "time" | "blocked_material";

export type AreaScoreMap = Partial<Record<DevArea, number>>;
