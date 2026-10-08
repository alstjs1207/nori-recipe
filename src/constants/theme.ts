import { Platform } from "react-native";

export const APP_COLORS = {
  background: Platform.OS === "web" ? "#FAFAFE" : "#FFFDF8",
  surface: "#FFFFFF",
  card: Platform.OS === "web" ? "#F2EFFF" : "#FFF7DF",
  pill: Platform.OS === "web" ? "#EEEAFE" : "#FFF2B8",
  line: Platform.OS === "web" ? "#E4E3EF" : "#E9E3D8",
  lineSoft: Platform.OS === "web" ? "#EFEDF6" : "#F1EADF",
  ink: Platform.OS === "web" ? "#19192F" : "#222222",
  muted: Platform.OS === "web" ? "#676A83" : "#7B7B7B",
  placeholder: "#B7B0A6",
  accent: Platform.OS === "web" ? "#5846E8" : "#FFD83D",
  accentSoft: Platform.OS === "web" ? "#EEEAFE" : "#FFF1AD",
  accentText: Platform.OS === "web" ? "#FFFFFF" : "#2B2410",
  mustard: Platform.OS === "web" ? "#5846E8" : "#FFD83D",
  mustardSoft: Platform.OS === "web" ? "#F2EFFF" : "#FFF4C7",
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
  heading: Platform.OS === "web" ? 'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' : "IBMPlexSansKR_600SemiBold",
  body: Platform.OS === "web" ? 'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' : "IBMPlexSansKR_400Regular",
  mono: Platform.OS === "web" ? 'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' : "IBMPlexSansKR_400Regular",
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
