import { router } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { alerts, liveSeries } from "@/lib/raceos-data";
import { Panel, PrimaryButton, SecondaryButton, DangerButton, getUiStyles } from "@/components/ui";
import { TrendArea } from "@/components/charts";
import { Screen, SectionTitle } from "@/components/common";
import { AlertCard } from "@/features/alerts/components/AlertCard";
import { useTheme } from "@/hooks/useTheme";

export default function VetAlerts() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  
  const stats = [
    { key: "Peak HR", value: "188 bpm" },
    { key: "Normal range", value: "60–180 bpm" },
    { key: "Speed at peak", value: "52 km/h" },
    { key: "Session length", value: "14 min 20 s" },
  ];
  
  return (
    <Screen role="vet" title="Alerts" subtitle="1 awaiting decision">
      <View style={uiStyles.section}>
        <Panel style={uiStyles.alert}>
          <Text style={uiStyles.label}>Abnormal condition detected</Text>
          <Text style={styles.horseName}>Thunder King</Text>
          <Text style={[uiStyles.muted, { marginTop: 4 }]}>
            Heart rate exceeded the configured safety threshold during moderate work.
          </Text>
          
          <View style={styles.dataGrid}>
            {stats.map((stat) => (
              <View key={stat.key} style={styles.dataGridItem}>
                <Text style={styles.dataGridKey}>{stat.key}</Text>
                <Text style={styles.dataGridValue}>{stat.value}</Text>
              </View>
            ))}
          </View>
          
          <View style={styles.chartContainer}>
            <TrendArea data={liveSeries} xKey="t" yKey="hr" color={colors.destructive} domain={[60, 200]} height={130} />
          </View>
          
          <View style={styles.buttonGroup}>
            <PrimaryButton
              label="Open live session"
              onPress={() => router.push("/vet/live/thunder-king")}
            />
            <SecondaryButton
              label="Examine horse"
              onPress={() => router.push("/vet/exam/thunder-king")}
            />
            <DangerButton
              label="Lock training"
              onPress={() => router.push("/vet/lock/thunder-king")}
            />
          </View>
        </Panel>
      </View>
      
      <View style={uiStyles.section}>
        <SectionTitle>Alert stream</SectionTitle>
        <View style={styles.alertStream}>
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} role="vet" />
          ))}
        </View>
      </View>
      
      <View style={uiStyles.section}>
        <SectionTitle>Escalation policy</SectionTitle>
        <Panel style={styles.policyPanel}>
          <Text style={styles.policyText}>• HR above threshold for 30 s → vet paged, trainer notified</Text>
          <Text style={styles.policyText}>• No vet acknowledgement in 5 min → club manager paged</Text>
          <Text style={styles.policyText}>• Vet lock → training stopped, groom instructions rewritten</Text>
        </Panel>
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
    marginTop: 12,
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
  chartContainer: {
    marginTop: 16,
  },
  buttonGroup: {
    marginTop: 16,
    gap: 8,
  },
  alertStream: {
    gap: 8,
  },
  policyPanel: {
    gap: 8,
  },
  policyText: {
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
  },
});
