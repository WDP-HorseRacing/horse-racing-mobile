import { View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { getUiStyles } from "@/components/ui/styles";
import { space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export function KeyValue({ items }: { items: [string, string][] }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const uiStyles = getUiStyles(colors);
  const { t } = useI18n();
  return (
    <View style={styles.keyGrid}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.keyItem}>
          <Text style={uiStyles.label}>{t(label)}</Text>
          <Text style={uiStyles.value} numberOfLines={2}>
            {t(value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  keyGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.lg },
  keyItem: { width: "50%", paddingRight: space.md, gap: 5 },
});
