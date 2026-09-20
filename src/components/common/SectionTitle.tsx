import { View, StyleSheet } from "react-native";
import type { PropsWithChildren, ReactNode } from "react";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export function SectionTitle({ children, action }: PropsWithChildren<{ action?: ReactNode }>) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
  const { t } = useI18n();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>
        {typeof children === "string" ? t(children) : children}
      </Text>
      {action}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
});
