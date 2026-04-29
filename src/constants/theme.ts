export const APP_COLORS = {
  background: "#FFFDF8",
  surface: "#FFFFFF",
  card: "#FFF7DF",
  pill: "#FFF2B8",
  line: "#E9E3D8",
  lineSoft: "#F1EADF",
  ink: "#222222",
  muted: "#7B7B7B",
  placeholder: "#B7B0A6",
  accent: "#FFD83D",
  accentSoft: "#FFF1AD",
  accentText: "#2B2410",
  mustard: "#FFD83D",
  mustardSoft: "#FFF4C7",
  coral: "#FF8E86",
  coralSoft: "#FFE7E3",
  lavender: "#A884FF",
  lavenderSoft: "#EFE7FF",
  sage: "#61D6B3",
  sageSoft: "#E4F8F1",
  sky: "#8ACCF4",
  skySoft: "#E5F5FE",
} as const;

export const APP_FONTS = {
  heading: "IBMPlexSansKR_600SemiBold",
  body: "IBMPlexSansKR_400Regular",
  mono: "IBMPlexSansKR_400Regular",
} as const;

export const APP_SHADOWS = {
  card: {
    shadowColor: "#1D1D1D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardLifted: {
    shadowColor: "#1D1D1D",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 4,
  },
  control: {
    shadowColor: "#1D1D1D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
} as const;
