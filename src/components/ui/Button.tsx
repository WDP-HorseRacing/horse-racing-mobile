import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { colors, radius, space } from "@/config/theme";

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

const styles = StyleSheet.create({
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
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  buttonDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
