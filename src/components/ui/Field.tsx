import { View, StyleSheet } from "react-native";
import type { PropsWithChildren } from "react";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { getUiStyles } from "@/components/ui/styles";
import { space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export function Field({ label, children }: PropsWithChildren<{ label: string }>) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const uiStyles = getUiStyles(colors);
  const { t } = useI18n();
  return (
    <View style={styles.field}>
      <Text style={uiStyles.label}>{t(label)}</Text>
      {children}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  field: { gap: space.sm },
});
