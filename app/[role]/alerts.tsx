import { type Href, Redirect, router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { alerts } from "@/lib/raceos-data";
import { isRole } from "@/native/roles";
import { Screen, uiStyles } from "@/native/ui";
import { colors, radius, space } from "@/native/theme";

export default function Alerts() {
  const { role } = useLocalSearchParams<{ role: string }>();
  if (!isRole(role)) return <Redirect href="/" />;
  return (
    <Screen role={role} title="Alerts" subtitle="Prioritized by action required">
      <View style={styles.list}>
        {alerts.map((alert) => (
          <Pressable
            key={alert.id}
            onPress={() => router.push(`/${role}/horse/${alert.horseId}` as Href)}
            style={[
              styles.alert,
              alert.severity === "critical"
                ? styles.critical
                : alert.severity === "warning"
                  ? styles.warning
                  : styles.info,
            ]}
          >
            <View style={uiStyles.row}>
              <Text style={styles.severity}>{alert.severity}</Text>
              <Text style={uiStyles.muted}>{alert.time}</Text>
            </View>
            <Text style={uiStyles.value}>{alert.title}</Text>
            <Text style={uiStyles.muted}>
              {alert.horse} · {alert.detail}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  alert: { borderRadius: radius.md, borderWidth: 1, padding: space.lg, gap: space.sm },
  critical: { backgroundColor: colors.dangerSoft, borderColor: "#68342F" },
  warning: { backgroundColor: colors.warningSoft, borderColor: "#614A25" },
  info: { backgroundColor: colors.surface, borderColor: colors.border },
  severity: { color: colors.text, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
});
