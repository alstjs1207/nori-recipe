import { randomUUID } from "expo-crypto";
import { appRuntime } from "@/platform/runtime";
import { createHomeRecommendationStore } from "./homeRecommendationRound";

export const useHomeRecommendationStore = createHomeRecommendationStore(appRuntime.storage, randomUUID);
