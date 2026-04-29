import type { Weights } from "@/engine/types";

export const DEFAULT_WEIGHTS: Weights = {
  material: 35,
  dev: 30,
  popular: 0,
  time: 10,
  feedback: 25,
};

export const COLD_START_WEIGHTS: Weights = {
  material: 45,
  dev: 30,
  popular: 0,
  time: 15,
  feedback: 0,
};
