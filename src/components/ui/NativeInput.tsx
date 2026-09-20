import { TextInput, StyleSheet } from "react-native";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export function NativeInput({
  value,
  onChangeText,
  multiline,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
  const { t } = useI18n();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      placeholder={placeholder ? t(placeholder) : undefined}
      placeholderTextColor={colors.mutedForeground}
      style={[styles.input, multiline && styles.multiline]}
    />
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  input: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    color: colors.foreground,
    paddingHorizontal: space.md,
    fontSize: 14,
  },
  multiline: { minHeight: 92, paddingTop: space.md, textAlignVertical: "top" },
});
