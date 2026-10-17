export type PlayIntent = "cutting" | "gluing" | "tape" | "painting";

export type IntentReadiness = {
  adultSupervision?: boolean;
  productsAgeAppropriate?: boolean;
  noMouthing?: boolean;
  scissorSnipping?: boolean;
  tapeSurfaceSafe?: boolean;
  washablePaint?: boolean;
};

export type HomeIntentConfirmation = {
  key: string;
  readiness: IntentReadiness;
};
