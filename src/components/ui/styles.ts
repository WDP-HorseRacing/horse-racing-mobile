import { StyleSheet } from "react-native";
import { colors, radius, space } from "@/config/theme";

export const uiStyles = StyleSheet.create({
  section: { gap: space.md },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { color: colors.muted, fontSize: 11, letterSpacing: 0.7 },
  value: { color: colors.text, fontSize: 15, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  alert: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
});
