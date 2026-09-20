import { View, type StyleProp, type ViewStyle, StyleSheet } from "react-native";
import type { ReactNode } from "react";
import { space } from "@/config/theme";

export function ActionRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.actions, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  actions: { gap: space.sm },
});
