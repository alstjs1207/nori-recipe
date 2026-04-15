export const APP_COLORS = {
  background: "#f5f0e6",
  surface: "#ffffff",
  card: "#eee5d6",
  pill: "#d7e8d4",
  line: "#e4dbd0",
  ink: "#1a1614",
  muted: "#8a7d72",
  accent: "#c2633a",
} as const;

export const APP_FONTS = {
  heading: "System",
  body: "System",
  mono: "Courier",
} as const;

export const APP_SHADOWS = {
  card: {
    shadowColor: "#1a1614",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLifted: {
    shadowColor: "#1a1614",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
} as const;
