import { router } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { alerts } from "@/lib/raceos-data";
import { Screen, SectionTitle } from "@/components/common";
import { AlertCard } from "@/features/alerts/components/AlertCard";
import { Panel, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";

export default function TrainerAlerts() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  
  const stats = [
    { key: "Peak HR", value: "188 bpm" },
    { key: "Normal range", value: "60–180 bpm" },
    { key: "Locked at", value: "10:24" },
    { key: "Locked by", value: "Dr. S. Rao" },
  ];
  
  return (
    <Screen role="trainer" title="Alerts" subtitle="2 critical · 1 warning · 1 info">
      <View style={uiStyles.section}>
        <SectionTitle>Critical — action required</SectionTitle>
        <Panel style={uiStyles.alert}>
          <Text style={uiStyles.label}>Training locked by veterinarian</Text>
          <Text style={styles.horseName}>Thunder King</Text>
          <Text style={[uiStyles.muted, { marginTop: 4 }]}>
            Reason: abnormal heart-rate response during 1,600 m moderate work.
          </Text>
          
          <View style={styles.dataGrid}>
            {stats.map((stat) => (
              <View key={stat.key} style={styles.dataGridItem}>
                <Text style={styles.dataGridKey}>{stat.key}</Text>
                <Text style={styles.dataGridValue}>{stat.value}</Text>
              </View>
            ))}
          </View>
          
          <View style={styles.buttonGroup}>
            <SecondaryButton
              label="View health report"
              onPress={() => router.push("/trainer/horse/thunder-king")}
            />
            <PrimaryButton
              label="Adjust training plan"
              onPress={() => router.push("/trainer/plan/thunder-king")}
            />
          </View>
        </Panel>
      </View>
      
      <View style={uiStyles.section}>
        <SectionTitle>Alert stream</SectionTitle>
        <View style={styles.alertStream}>
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} role="trainer" />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  horseName: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "600",
    marginTop: 8,
  },
  dataGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: colors.injured + "4D", // ~30% opacity
    marginTop: 16,
    paddingTop: 12,
    rowGap: 12,
  },
  dataGridItem: {
    width: "50%",
  },
  dataGridKey: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: colors.mutedForeground,
    textTransform: "uppercase",
  },
  dataGridValue: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
  },
  buttonGroup: {
    marginTop: 16,
    gap: 8,
  },
  alertStream: {
    gap: 8,
  },
});
