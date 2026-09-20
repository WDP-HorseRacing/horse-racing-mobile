import { Pressable, View, StyleSheet } from "react-native";
import { router, type Href } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { uiStyles } from "@/components/ui/styles";
import { colors, radius, space } from "@/config/theme";
import type { AlertItem } from "@/lib/raceos-data";

export function AlertCard({ alert, role }: { alert: AlertItem; role: string }) {
  const palette =
    alert.severity === "critical"
      ? { backgroundColor: colors.dangerSoft, borderColor: "#FECACA" }
      : alert.severity === "warning"
        ? { backgroundColor: colors.warningSoft, borderColor: "#FDE68A" }
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
              color:
                alert.severity === "critical"
                  ? colors.danger
                  : alert.severity === "warning"
                    ? colors.warning
                    : colors.info,
            },
          ]}
        >
          {alert.severity}
        </Text>
        <Text style={uiStyles.muted}>{alert.time}</Text>
      </View>
      <Text style={uiStyles.value}>{alert.title}</Text>
      <Text style={uiStyles.muted}>
        {alert.horse} — {alert.detail}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  alert: { borderRadius: radius.md, borderWidth: 1, padding: space.lg, gap: space.sm },
  alertSeverity: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
});
