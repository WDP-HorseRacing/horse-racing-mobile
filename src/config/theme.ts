export const lightColors = {
  background: "#F8FAF8",
  foreground: "#1A2E1A",

  surface: "#FFFFFF",
  surfaceForeground: "#1A2E1A",

  elevated: "#F0FDF4",

  card: "#FFFFFF",
  cardForeground: "#1A2E1A",

  popover: "#FFFFFF",
  popoverForeground: "#1A2E1A",

  primary: "#059669",
  primaryForeground: "#FFFFFF",

  secondary: "#F0F2F0",
  secondaryForeground: "#2F3E2F",

  muted: "#F0F2F0",
  mutedForeground: "#6B7F6B",

  accent: "#ECFDF5",
  accentForeground: "#1A2E1A",

  destructive: "#DC2626",
  destructiveForeground: "#FFFFFF",

  border: "#D4E4D4",
  borderStrong: "#B8CCB8",

  input: "#D4E4D4",
  ring: "#059669",

  // Semantic status colors
  fit: "#059669",
  fitSoft: "#ECFDF5",

  monitor: "#D97706",
  monitorSoft: "#FEF3C7",

  injured: "#DC2626",
  injuredSoft: "#FEF2F2",

  locked: "#4B5563",
  lockedSoft: "#E5E7EB",

  training: "#0284C7",
  trainingSoft: "#F0F9FF",

  raceReady: "#9333EA",
  raceReadySoft: "#FAF5FF",

  // Chart colors
  chart1: "#059669",
  chart2: "#0284C7",
  chart3: "#D97706",
  chart4: "#9333EA",
  chart5: "#DC2626",
} as const;

export const darkColors = {
  background: "#000101ff",
  foreground: "#F5F7F6",

  surface: "#22262B",
  surfaceForeground: "#F5F7F6",

  elevated: "#2A3035",

  card: "#22262B",
  cardForeground: "#F5F7F6",

  popover: "#252A2F",
  popoverForeground: "#F5F7F6",

  primary: "#5FD6A8",
  primaryForeground: "#10251C",

  secondary: "#30353A",
  secondaryForeground: "#ffffffff",

  muted: "#2F3439",
  mutedForeground: "#ffffffff",

  accent: "#343A3F",
  accentForeground: "#F5F7F6",

  destructive: "#F87171",
  destructiveForeground: "#FFF7F7",

  border: "#FFFFFF17",
  borderStrong: "#FFFFFF29",

  input: "#FFFFFF1F",
  ring: "#5FD6A899",

  // Semantic status colors
  fit: "#63D9A8",
  fitSoft: "#63D9A824",

  monitor: "#F3C969",
  monitorSoft: "#F3C96924",

  injured: "#F27668",
  injuredSoft: "#F2766826",

  locked: "#A7ADB3",
  lockedSoft: "#7379804D",

  training: "#69AEEA",
  trainingSoft: "#69AEEA26",

  raceReady: "#B88BE8",
  raceReadySoft: "#B88BE826",

  // Chart colors
  chart1: "#63D9A8",
  chart2: "#69AEEA",
  chart3: "#F3C969",
  chart4: "#B88BE8",
  chart5: "#F27668",
} as const;

export type ThemeColors = Record<keyof typeof lightColors, string>;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;
