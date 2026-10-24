import { TextInput, StyleSheet, type TextInputProps } from "react-native";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export function NativeInput({
  value,
  onChangeText,
  multiline,
  numberOfLines,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  autoFocus,
  maxLength,
  editable,
  style,
}: {
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  numberOfLines?: number;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  keyboardType?: TextInputProps["keyboardType"];
  autoFocus?: boolean;
  maxLength?: number;
  editable?: boolean;
  style?: any;
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { t } = useI18n();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      numberOfLines={numberOfLines}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      autoFocus={autoFocus}
      maxLength={maxLength}
      editable={editable}
      placeholder={placeholder ? t(placeholder) : undefined}
      placeholderTextColor={colors.mutedForeground}
      style={[styles.input, multiline && styles.multiline, style]}
    />
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
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
