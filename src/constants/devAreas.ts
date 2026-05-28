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
    backgroundColor: "#F7DFD3",
    textColor: "#6E493B",
  },
  gross_motor: {
    accentColor: "#E7BE4F",
    backgroundColor: "#FFF0B8",
    textColor: "#6F5715",
  },
  cognitive: {
    accentColor: "#A99AE4",
    backgroundColor: "#EFEAFB",
    textColor: "#514978",
  },
  language: {
    accentColor: "#9EA8E9",
    backgroundColor: "#ECEFFD",
    textColor: "#46507E",
  },
  emotional: {
    accentColor: "#D88A6F",
    backgroundColor: "#F6DDD0",
    textColor: "#744D3D",
  },
  social: {
    accentColor: "#A9B88A",
    backgroundColor: "#E5ECD8",
    textColor: "#4A5A39",
  },
  sensory: {
    accentColor: "#F0C04F",
    backgroundColor: "#FFF0C2",
    textColor: "#6F5715",
  },
};
