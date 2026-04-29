export const CHILD_REACTION_OPTIONS = [
  "좋아했어요",
  "별로였어요",
  "어려워했어요",
  "더 하고 싶어했어요",
] as const;

export type ChildReaction = (typeof CHILD_REACTION_OPTIONS)[number];
