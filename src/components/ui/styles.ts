import { StyleSheet } from "react-native";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export const getUiStyles = (colors: any) => StyleSheet.create({
  section: { gap: space.md },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  body: { color: colors.foreground, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19 },
  label: { color: colors.mutedForeground, fontSize: 11, letterSpacing: 0.7 },
  value: { color: colors.foreground, fontSize: 15, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  alert: {
    backgroundColor: colors.injuredSoft,
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
  warning: {
    backgroundColor: colors.monitorSoft,
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
});
