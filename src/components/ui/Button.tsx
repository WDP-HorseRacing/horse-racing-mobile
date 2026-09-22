import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function PrimaryButton({
  label,
  onPress,
  icon = "arrow-forward",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
}) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.buttonText}>{t(label)}</Text>
      <Ionicons name={icon} size={18} color="#FFFFFF" />
    </Pressable>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  secondaryButtonText: { color: colors.foreground, fontSize: 15, fontWeight: "800" },
  buttonDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});

export function SecondaryButton({
  label,
  onPress,
  icon,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{t(label)}</Text>
      {icon && <Ionicons name={icon} size={18} color={colors.foreground} />}
    </Pressable>
  );
}
