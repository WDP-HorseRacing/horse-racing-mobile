import { Pressable, View, StyleSheet } from "react-native";
import { router, type Href } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { getUiStyles } from "@/components/ui/styles";
import { radius, space } from "@/config/theme";
import type { AlertItem } from "@/lib/raceos-data";
import { useTheme } from "@/hooks/useTheme";

export function AlertCard({ alert, role }: { alert: AlertItem; role: string }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const palette =
    alert.severity === "critical"
      ? { backgroundColor: colors.injuredSoft, borderColor: "#FECACA" }
      : alert.severity === "warning"
        ? { backgroundColor: colors.monitorSoft, borderColor: "#FDE68A" }
        : { backgroundColor: colors.surface, borderColor: colors.border };
  return (
    <Pressable
      onPress={() => router.push(`/${role}/horse/${alert.horseId}` as Href)}
      style={[styles.alert, palette]}
    >
      <View style={uiStyles.row}>
        <Text
          style={[
            styles.alertSeverity,
            {
              flex: 1,
              minWidth: 0,
              color:
                alert.severity === "critical"
                  ? colors.destructive
                  : alert.severity === "warning"
                    ? colors.monitor
                    : colors.training,
            },
          ]}
          numberOfLines={1}
        >
          {alert.severity}
        </Text>
        <Text style={[uiStyles.muted, { flexShrink: 0 }]}>{alert.time}</Text>
      </View>
      <Text style={uiStyles.value} numberOfLines={2}>
        {alert.title}
      </Text>
      <Text style={uiStyles.muted}>
        {alert.horse} — {alert.detail}
      </Text>
    </Pressable>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    alert: { borderRadius: radius.md, borderWidth: 1, padding: space.lg, gap: space.sm },
    alertSeverity: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "capitalize",
      letterSpacing: 0.3,
    },
  });
