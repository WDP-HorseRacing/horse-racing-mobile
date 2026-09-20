import { View, type StyleProp, type ViewStyle, StyleSheet } from "react-native";
import type { PropsWithChildren } from "react";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export function Panel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
  return <View style={[styles.panel, style]}>{children}</View>;
}

const getStyles = (colors: any) => StyleSheet.create({
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
