import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export type MetricProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warning" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  accentColor?: string;
  badge?: string;
};

export function Metric({
  label,
  value,
  hint,
  tone = "default",
  icon,
  iconColor,
  accentColor,
  badge,
}: MetricProps) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const { t } = useI18n();

  const toneColor =
    accentColor ??
    (tone === "good"
      ? colors.primary
      : tone === "warning"
        ? colors.monitor
        : tone === "danger"
          ? colors.destructive
          : colors.foreground);

  const effectiveIconColor = iconColor ?? accentColor ?? toneColor;

  return (
    <View
      style={[
        styles.metric,
        accentColor ? { borderLeftWidth: 3.5, borderLeftColor: accentColor } : null,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.metricLabel} numberOfLines={2} ellipsizeMode="tail">
          {t(label)}
        </Text>
        {icon ? (
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: isDark
                  ? `${effectiveIconColor}22`
                  : `${effectiveIconColor}16`,
              },
            ]}
          >
            <Ionicons name={icon} size={15} color={effectiveIconColor} />
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.metricValue, { color: toneColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        ellipsizeMode="tail"
      >
        {value}
      </Text>
      <View style={styles.footerRow}>
        {hint ? (
          <Text style={styles.metricHint} numberOfLines={1} ellipsizeMode="tail">
            {t(hint)}
          </Text>
        ) : (
          <View />
        )}
        {badge ? (
          <View
            style={[
              styles.badgePill,
              {
                backgroundColor: isDark
                  ? `${effectiveIconColor}20`
                  : `${effectiveIconColor}14`,
                borderColor: isDark
                  ? `${effectiveIconColor}40`
                  : `${effectiveIconColor}30`,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: effectiveIconColor }]} numberOfLines={1}>
              {t(badge)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    metric: {
      flexGrow: 1,
      flexBasis: "45%",
      minWidth: 0,
      minHeight: 94,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingVertical: 12,
      paddingHorizontal: 14,
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 6,
    },
    iconWrapper: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    metricLabel: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontWeight: "500",
      flex: 1,
      lineHeight: 15,
    },
    metricValue: {
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.6,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 4,
    },
    metricHint: {
      color: colors.mutedForeground,
      fontSize: 10,
      flexShrink: 1,
    },
    badgePill: {
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: radius.sm,
      borderWidth: 1,
      flexShrink: 0,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
  });
