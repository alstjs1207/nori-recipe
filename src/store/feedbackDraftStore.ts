import { create } from "zustand";
import type { ChildReaction } from "@/constants/feedback";

export type FeedbackDraft = { rating: number; reactions: ChildReaction[]; memo: string };
export const EMPTY_FEEDBACK_DRAFT: FeedbackDraft = { rating: 0, reactions: [], memo: "" };
const draftKey = (guestId: string, playId: string) => JSON.stringify([guestId, playId]);

type DraftState = {
  drafts: Record<string, FeedbackDraft>;
  update: (guestId: string, playId: string, patch: Partial<FeedbackDraft> | ((draft: FeedbackDraft) => Partial<FeedbackDraft>)) => void;
  saved: (guestId: string, playId: string, submitted: FeedbackDraft) => void;
  clearGuest: (guestId: string) => void;
};
// Survives screen unmounts and play changes during this app session. Never a completion record.
export const useFeedbackDraftStore = create<DraftState>((set) => ({
  drafts: {},
  update: (guestId, playId, patch) => set(state => {
    const key = draftKey(guestId, playId);
    const previous = state.drafts[key] ?? EMPTY_FEEDBACK_DRAFT;
    return { drafts: { ...state.drafts, [key]: { ...previous, ...(typeof patch === "function" ? patch(previous) : patch) } } };
  }),
  saved: (guestId, playId, submitted) => set(state => {
    const key = draftKey(guestId, playId);
    // A user can edit again while a write is in flight. Only clear the saved revision.
    if (state.drafts[key] !== submitted) return state;
    const drafts = { ...state.drafts };
    delete drafts[key];
    return { drafts };
  }),
  clearGuest: guestId => set(state => ({ drafts: Object.fromEntries(Object.entries(state.drafts).filter(([key]) => (JSON.parse(key) as string[])[0] !== guestId)) })),
}));
export function useFeedbackDraft(guestId: string | null, playId: string | undefined | null) {
  const draft = useFeedbackDraftStore(state => guestId && playId ? state.drafts[draftKey(guestId, playId)] ?? EMPTY_FEEDBACK_DRAFT : EMPTY_FEEDBACK_DRAFT);
  const update = (patch: Parameters<DraftState["update"]>[2]) => {
    if (guestId && playId) useFeedbackDraftStore.getState().update(guestId, playId, patch);
  };
  return {
    draft,
    rating: draft.rating,
    reactions: draft.reactions,
    memo: draft.memo,
    setRating: (rating: number) => update({ rating }),
    setMemo: (memo: string) => update({ memo }),
    setReactions: (value: ChildReaction[] | ((previous: ChildReaction[]) => ChildReaction[])) => update(previous => ({ reactions: typeof value === "function" ? value(previous.reactions) : value })),
    saved: (submitted: FeedbackDraft) => {
      if (guestId && playId) useFeedbackDraftStore.getState().saved(guestId, playId, submitted);
    },
  };
}
