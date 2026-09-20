import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
  const { t } = useI18n();
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={[styles.chip, value === option && styles.chipActive]}
        >
          <Text style={[styles.chipText, value === option && styles.chipTextActive]}>
            {t(option)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
});
