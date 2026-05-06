export const CHILD_REACTION_OPTIONS = [
  "집중했어요",
  "스스로 했어요",
  "도움이 필요했어요",
  "흥미가 적었어요",
] as const;

export const LEGACY_CHILD_REACTION_OPTIONS = [
  "좋아했어요",
  "별로였어요",
  "어려워했어요",
  "더 하고 싶어했어요",
] as const;

export const CHILD_REACTION_PARSE_OPTIONS = [
  ...CHILD_REACTION_OPTIONS,
  ...LEGACY_CHILD_REACTION_OPTIONS,
] as const;

export type ChildReactionOption = (typeof CHILD_REACTION_OPTIONS)[number];
export type ChildReaction = (typeof CHILD_REACTION_PARSE_OPTIONS)[number];
