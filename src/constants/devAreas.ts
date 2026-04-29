export const DEV_AREA_SLUGS = [
  "fine_motor",
  "gross_motor",
  "cognitive",
  "language",
  "emotional",
  "social",
  "sensory",
] as const;

export type DevArea = (typeof DEV_AREA_SLUGS)[number];

export const DEV_AREA_LABELS: Record<DevArea, string> = {
  fine_motor: "소근육",
  gross_motor: "대근육",
  cognitive: "인지",
  language: "언어",
  emotional: "정서",
  social: "사회성",
  sensory: "감각",
};

export const DEV_AREA_THEME: Record<
  DevArea,
  {
    accentColor: string;
    backgroundColor: string;
    textColor: string;
  }
> = {
  fine_motor: {
    accentColor: "#DD8A6A",
    backgroundColor: "#F2D3C2",
    textColor: "#6E493B",
  },
  gross_motor: {
    accentColor: "#E8C15A",
    backgroundColor: "#F3E3A8",
    textColor: "#6F5715",
  },
  cognitive: {
    accentColor: "#BCB5E3",
    backgroundColor: "#E6E2F4",
    textColor: "#554C7F",
  },
  language: {
    accentColor: "#BCB5E3",
    backgroundColor: "#EDE8F7",
    textColor: "#554C7F",
  },
  emotional: {
    accentColor: "#DD8A6A",
    backgroundColor: "#F4DDD1",
    textColor: "#7A5646",
  },
  social: {
    accentColor: "#AFBE94",
    backgroundColor: "#DDE5CF",
    textColor: "#4A5A39",
  },
  sensory: {
    accentColor: "#E8C15A",
    backgroundColor: "#F5E8BC",
    textColor: "#6F5715",
  },
};
