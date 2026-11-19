import { useHomeRecommendationStore } from "./homeRecommendationStore";
import { useFeedbackDraftStore } from "./feedbackDraftStore";
import { appRuntime } from "@/platform/runtime";
import { randomUUID } from "expo-crypto";
import { create } from "zustand";

import { deleteAllUserData, getLatestPlayLog, getUserContext, upsertUserContext } from "@/db/queries";
import type { MaterialSlug } from "@/constants/materials";
import type { HomeIntentConfirmation, UserContext } from "@/types";
import { parseIntentConfirmation } from "@/engine/intentRecommendation";
import { DEFAULT_USER_CONTEXT } from "@/types";
import { resetAnalyticsConsent } from "@/analytics/analytics";

const AsyncStorage = appRuntime.storage;

const GUEST_ID_STORAGE_KEY = "nori-recipe/guest-id";
const ONBOARDING_COMPLETE_STORAGE_KEY = "nori-recipe/onboarding-complete";
const ONBOARDING_CHILD_NAME_STORAGE_KEY = "nori-recipe/onboarding-child-name";
const ONBOARDING_FAMILY_TYPE_STORAGE_KEY = "nori-recipe/onboarding-family-type";
const CHILD_BIRTH_MONTH_STORAGE_KEY = "nori-recipe/child-birth-month";
const TODAY_MATERIALS_STORAGE_KEY = "nori-recipe/today-materials";
const HOME_RECOMMENDATION_IDS_STORAGE_KEY = "nori-recipe/home-recommendation-ids";
const HOME_RECOMMENDATION_KEY_STORAGE_KEY = "nori-recipe/home-recommendation-key";
const HOME_INTENT_CONFIRMATION_STORAGE_KEY = "nori-recipe/home-intent-confirmation";

type SessionStatus = "idle" | "loading" | "ready" | "error";
export type FamilyType = "single" | "multiple";

type SessionStore = {
  guestId: string | null;
  userContext: UserContext;
  todayMaterials: MaterialSlug[] | null;
  updatingHomeRecommendations: boolean;
  homeIntentConfirmation: HomeIntentConfirmation | null;
  childName: string;
  familyType: FamilyType | null;
  onboardingCompleted: boolean;
  status: SessionStatus;
  error: string | null;
  initSession: () => Promise<void>;
  upsertUserContext: (context: UserContext) => Promise<void>;
  setUserContext: (context: UserContext) => Promise<void>;
  setTodayMaterials: (materials: MaterialSlug[] | null) => Promise<void>;
  setPinnedHomeRecommendations: (payload: { ids: string[]; key: string; roundId: string | null }) => Promise<void>;
  clearPinnedHomeRecommendations: () => Promise<void>;
  setHomeIntentConfirmation: (confirmation: HomeIntentConfirmation | null) => Promise<void>;
  updateOnboardingProfile: (profile: {
    childName?: string;
    familyType?: FamilyType | null;
  }) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  resetLocalData: () => Promise<void>;
};

async function getOrCreateGuestId(): Promise<string> {
  const savedGuestId = await AsyncStorage.getItem(GUEST_ID_STORAGE_KEY);

  if (savedGuestId) {
    return savedGuestId;
  }

  const nextGuestId = randomUUID();
  await AsyncStorage.setItem(GUEST_ID_STORAGE_KEY, nextGuestId);
  return nextGuestId;
}

function parseStoredMaterials(value: string | null): MaterialSlug[] | null {
  if (value === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as MaterialSlug[]) : null;
  } catch {
    return null;
  }
}

function parseStoredStringArray(value: string | null): string[] {
  if (value === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  guestId: null,
  userContext: DEFAULT_USER_CONTEXT,
  todayMaterials: null,
  updatingHomeRecommendations: false,
  homeIntentConfirmation: null,
  childName: "",
  familyType: null,
  onboardingCompleted: false,
  status: "idle",
  error: null,
  initSession: async () => {
    if (get().status === "loading") {
      return;
    }

    set({ status: "loading", error: null });

    let fallbackBirthMonth: number | null = null;
    try {
      const guestId = await getOrCreateGuestId();
      const [
        childName,
        familyType,
        onboardingCompleted,
        savedBirthMonth,
        savedTodayMaterials,
        savedPinnedRecommendationIds,
        savedPinnedRecommendationKey,
        savedIntentConfirmation,
      ] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_CHILD_NAME_STORAGE_KEY),
        AsyncStorage.getItem(ONBOARDING_FAMILY_TYPE_STORAGE_KEY),
        AsyncStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY),
        AsyncStorage.getItem(CHILD_BIRTH_MONTH_STORAGE_KEY),
        AsyncStorage.getItem(TODAY_MATERIALS_STORAGE_KEY),
        AsyncStorage.getItem(HOME_RECOMMENDATION_IDS_STORAGE_KEY),
        AsyncStorage.getItem(HOME_RECOMMENDATION_KEY_STORAGE_KEY),
        AsyncStorage.getItem(HOME_INTENT_CONFIRMATION_STORAGE_KEY),
      ]);

      const legacyIds = parseStoredStringArray(savedPinnedRecommendationIds);
      const legacyRecords = (await Promise.all(legacyIds.map(id => getLatestPlayLog(guestId, id))))
        .filter((record) => record !== null);
      await useHomeRecommendationStore.getState().hydrate(guestId, {
        ids: legacyIds, key: savedPinnedRecommendationKey, records: legacyRecords,
      });

      set({
        guestId,
        childName: childName ?? "",
        familyType: familyType === "single" || familyType === "multiple" ? familyType : null,
        onboardingCompleted: onboardingCompleted === "true",
        todayMaterials: parseStoredMaterials(savedTodayMaterials),
        homeIntentConfirmation: parseIntentConfirmation(savedIntentConfirmation),
      });

      fallbackBirthMonth = savedBirthMonth !== null ? Number(savedBirthMonth) : null;
      const storedContext = await getUserContext(guestId);
      const contextWithStoredProfile =
        storedContext.childBirthMonth === null && fallbackBirthMonth !== null
          ? { ...storedContext, childBirthMonth: fallbackBirthMonth }
          : storedContext;
      const userContext = await upsertUserContext(guestId, contextWithStoredProfile);
      set({ userContext, status: "ready", error: null });
    } catch (error) {
      set({
        userContext: { ...DEFAULT_USER_CONTEXT, childBirthMonth: fallbackBirthMonth },
        status: "error",
        error: error instanceof Error ? error.message : "세션 초기화에 실패했습니다.",
      });
    }
  },
  upsertUserContext: async (context) => {
    const guestId = get().guestId;

    if (!guestId) {
      throw new Error("Guest session has not been initialized.");
    }

    if (context.childBirthMonth !== null) {
      await AsyncStorage.setItem(CHILD_BIRTH_MONTH_STORAGE_KEY, String(context.childBirthMonth));
    }

    const savedContext = await upsertUserContext(guestId, context);
    const previous = get().userContext;
    if (previous.childBirthMonth !== savedContext.childBirthMonth || JSON.stringify(previous.ownedMaterials) !== JSON.stringify(savedContext.ownedMaterials) || JSON.stringify(previous.blockedMaterials) !== JSON.stringify(savedContext.blockedMaterials)) {
      set({ updatingHomeRecommendations: true });
      try {
        await useHomeRecommendationStore.getState().restart(guestId);
        await AsyncStorage.removeItem(HOME_INTENT_CONFIRMATION_STORAGE_KEY);
        set({ userContext: savedContext, homeIntentConfirmation: null });
      } finally { set({ updatingHomeRecommendations: false }); }
    } else {
      set({ userContext: savedContext });
    }
  },
  setUserContext: async (context) => {
    await get().upsertUserContext(context);
  },
  setTodayMaterials: async (materials) => {
    const guestId = get().guestId;
    if (!guestId) throw new Error("Guest session has not been initialized.");
    set({ updatingHomeRecommendations: true });
    try {
      // Persist the new empty round even when the selected materials/IDs repeat.
      await useHomeRecommendationStore.getState().restart(guestId);
      if (materials === null) await AsyncStorage.removeItem(TODAY_MATERIALS_STORAGE_KEY);
      else await AsyncStorage.setItem(TODAY_MATERIALS_STORAGE_KEY, JSON.stringify(materials));
      await Promise.all([
        AsyncStorage.removeItem(HOME_INTENT_CONFIRMATION_STORAGE_KEY),
        AsyncStorage.removeItem(HOME_RECOMMENDATION_IDS_STORAGE_KEY),
        AsyncStorage.removeItem(HOME_RECOMMENDATION_KEY_STORAGE_KEY),
      ]);
      set({ todayMaterials: materials, homeIntentConfirmation: null });
    } finally { set({ updatingHomeRecommendations: false }); }
  },
  setHomeIntentConfirmation: async (confirmation) => {
    const guestId = get().guestId;
    if (!guestId) throw new Error("Guest session has not been initialized.");
    set({ updatingHomeRecommendations: true });
    try {
      await useHomeRecommendationStore.getState().restart(guestId);
      if (confirmation) await AsyncStorage.setItem(HOME_INTENT_CONFIRMATION_STORAGE_KEY, JSON.stringify(confirmation));
      else await AsyncStorage.removeItem(HOME_INTENT_CONFIRMATION_STORAGE_KEY);
      set({ homeIntentConfirmation: confirmation });
    } finally { set({ updatingHomeRecommendations: false }); }
  },
  setPinnedHomeRecommendations: async ({ ids, key, roundId }) => {
    const guestId = get().guestId;
    if (!guestId || get().updatingHomeRecommendations) return;
    await useHomeRecommendationStore.getState().pin(guestId, roundId, ids, key);
  },
  clearPinnedHomeRecommendations: async () => {
    const guestId = get().guestId;
    if (!guestId) return;
    set({ updatingHomeRecommendations: true });
    try {
      await useHomeRecommendationStore.getState().restart(guestId);
      await Promise.all([
        AsyncStorage.removeItem(HOME_RECOMMENDATION_IDS_STORAGE_KEY),
        AsyncStorage.removeItem(HOME_RECOMMENDATION_KEY_STORAGE_KEY),
        AsyncStorage.removeItem(HOME_INTENT_CONFIRMATION_STORAGE_KEY),
      ]);
      set({ homeIntentConfirmation: null });
    } finally { set({ updatingHomeRecommendations: false }); }
  },
  updateOnboardingProfile: async ({ childName, familyType }) => {
    const updates: Array<Promise<void>> = [];

    if (typeof childName === "string") {
      updates.push(AsyncStorage.setItem(ONBOARDING_CHILD_NAME_STORAGE_KEY, childName));
    }

    if (familyType === null) {
      updates.push(AsyncStorage.removeItem(ONBOARDING_FAMILY_TYPE_STORAGE_KEY));
    } else if (familyType) {
      updates.push(AsyncStorage.setItem(ONBOARDING_FAMILY_TYPE_STORAGE_KEY, familyType));
    }

    await Promise.all(updates);

    set((state) => ({
      childName: typeof childName === "string" ? childName : state.childName,
      familyType: familyType === undefined ? state.familyType : familyType,
    }));
  },
  completeOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_STORAGE_KEY, "true");
    set({ onboardingCompleted: true });
  },
  resetOnboarding: async () => {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_STORAGE_KEY);
    set({ onboardingCompleted: false });
  },
  resetLocalData: async () => {
    const guestId = get().guestId;

    if (!guestId) {
      throw new Error("Guest session has not been initialized.");
    }

    await deleteAllUserData(guestId);
    useFeedbackDraftStore.getState().clearGuest(guestId);
    resetAnalyticsConsent();
    await Promise.all([
      AsyncStorage.removeItem(GUEST_ID_STORAGE_KEY),
      AsyncStorage.removeItem(ONBOARDING_COMPLETE_STORAGE_KEY),
      AsyncStorage.removeItem(ONBOARDING_CHILD_NAME_STORAGE_KEY),
      AsyncStorage.removeItem(ONBOARDING_FAMILY_TYPE_STORAGE_KEY),
      AsyncStorage.removeItem(CHILD_BIRTH_MONTH_STORAGE_KEY),
      AsyncStorage.removeItem(TODAY_MATERIALS_STORAGE_KEY),
      AsyncStorage.removeItem(HOME_RECOMMENDATION_IDS_STORAGE_KEY),
      AsyncStorage.removeItem(HOME_RECOMMENDATION_KEY_STORAGE_KEY),
      AsyncStorage.removeItem(HOME_INTENT_CONFIRMATION_STORAGE_KEY),
    ]);

    const nextGuestId = await getOrCreateGuestId();
    await useHomeRecommendationStore.getState().restart(nextGuestId);
    const nextUserContext = await upsertUserContext(nextGuestId, DEFAULT_USER_CONTEXT);

    set({
      guestId: nextGuestId,
      userContext: nextUserContext,
      homeIntentConfirmation: null,
      todayMaterials: null,
      updatingHomeRecommendations: false,
      childName: "",
      familyType: null,
      onboardingCompleted: false,
      status: "ready",
      error: null,
    });
  },
}));
