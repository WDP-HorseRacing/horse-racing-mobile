import { View, StyleSheet } from "react-native";
import type { PropsWithChildren } from "react";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { uiStyles } from "@/components/ui/styles";
import { space } from "@/config/theme";

export function Field({ label, children }: PropsWithChildren<{ label: string }>) {
  const { t } = useI18n();
  return (
    <View style={styles.field}>
      <Text style={uiStyles.label}>{t(label)}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
});
