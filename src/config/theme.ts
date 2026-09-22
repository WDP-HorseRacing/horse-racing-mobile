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
  background: "#0D1013",

  foreground: "#F1F4F6",

  surface: "#16191D",

  surfaceForeground: "#F1F4F6",

  elevated: "#1E2226",

  card: "#16191D",

  cardForeground: "#F1F4F6",

  popover: "#191D22",

  popoverForeground: "#F1F4F6",

  primary: "#47C682",

  primaryForeground: "#04130A",

  secondary: "#202429",

  secondaryForeground: "#E6E8EA",

  muted: "#1D2125",

  mutedForeground: "#9399A0",

  accent: "#25292F",

  accentForeground: "#F1F4F6",

  destructive: "#E64343",

  destructiveForeground: "#FCF7F7",

  border: "#FFFFFF17",

  borderStrong: "#FFFFFF29",

  input: "#FFFFFF1F",

  ring: "#47C68299",

  // Semantic status colors

  fit: "#4FCD88",

  fitSoft: "#4FCD8824",

  monitor: "#F4B93C",

  monitorSoft: "#F4B93C24",

  injured: "#F45152",

  injuredSoft: "#F4515226",

  locked: "#9FA5AC",

  lockedSoft: "#80858A4D",

  training: "#46A6EF",

  trainingSoft: "#46A6EF26",

  raceReady: "#B08AF0",

  raceReadySoft: "#B08AF026",

  // Chart colors
  chart1: "#4FCD88",
  chart2: "#46A6EF",
  chart3: "#F4B93C",
  chart4: "#B08AF0",
  chart5: "#F45152",
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
