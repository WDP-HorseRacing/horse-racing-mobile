import { View, type StyleProp, type ViewStyle, StyleSheet } from "react-native";
import type { PropsWithChildren } from "react";
import { colors, radius, space } from "@/config/theme";

export function Panel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    shadowColor: "#065F46",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
});
