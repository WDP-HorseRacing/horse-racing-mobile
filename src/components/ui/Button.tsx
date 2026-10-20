import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
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
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
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
        styles.buttonSpacing,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.buttonText}>{t(label)}</Text>
      <Ionicons name={icon} size={18} color="#FFFFFF" />
    </Pressable>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    buttonSpacing: { marginHorizontal: space.xs, marginVertical: space.xs },
    button: {
      minHeight: 52,
      borderRadius: radius.md,
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
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
      paddingVertical: space.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: space.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dangerButton: {
      minHeight: 52,
      borderRadius: radius.md,
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: space.sm,
      backgroundColor: colors.destructive,
    },
    buttonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
      flexShrink: 1,
      textAlign: "center",
    },
    secondaryButtonText: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: "800",
      flexShrink: 1,
      textAlign: "center",
    },
    dangerButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
      flexShrink: 1,
      textAlign: "center",
    },
    buttonDisabled: { opacity: 0.4 },
    pressed: { opacity: 0.7 },
  });

export function DangerButton({
  label,
  onPress,
  icon,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
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
        styles.dangerButton,
        styles.buttonSpacing,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.dangerButtonText}>{t(label)}</Text>
      {icon && <Ionicons name={icon} size={18} color="#FFFFFF" />}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
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
        styles.buttonSpacing,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{t(label)}</Text>
      {icon && <Ionicons name={icon} size={18} color={colors.foreground} />}
    </Pressable>
  );
}
