import { View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { colors, radius, space } from "@/config/theme";

export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  const { t } = useI18n();
  const toneColor =
    tone === "good"
      ? colors.primary
      : tone === "warning"
        ? colors.warning
        : tone === "danger"
          ? colors.danger
          : colors.text;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{t(label)}</Text>
      <Text style={[styles.metricValue, { color: toneColor }]}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{t(hint)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 104,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: { color: colors.muted, fontSize: 11 },
  metricValue: { fontSize: 26, fontWeight: "700", letterSpacing: -0.7 },
  metricHint: { color: colors.muted, fontSize: 10 },
});
