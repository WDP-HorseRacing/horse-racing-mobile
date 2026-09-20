import { View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { alerts, horses } from "@/mocks/raceos";
import { AlertCard } from "@/features/alerts/components/AlertCard";
import { HorseRow } from "@/features/horses/components/HorseRow";
import { Metric } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/Panel";
import { PrimaryButton } from "@/components/ui/Button";
import { SectionTitle } from "@/components/common/SectionTitle";
import { getUiStyles } from "@/components/ui/styles";
import { useTheme } from "@/hooks/useTheme";

export function VetDashboard() {
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
  const critical = horses.filter((horse) => ["LOCKED", "INJURED"].includes(horse.status));
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Critical" value={critical.length} hint="needs today" tone="danger" />
        <Metric label="Monitoring" value={1} hint="recheck 48h" tone="warning" />
        <Metric label="Healthy" value={5} hint="no findings" tone="good" />
        <Metric label="Due" value={4} hint="vaccine · farrier" />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Critical cases</SectionTitle>
        {critical.map((horse) => (
          <HorseRow key={horse.id} horse={horse} role="vet" />
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Medical alerts</SectionTitle>
        {alerts.slice(0, 3).map((alert) => (
          <AlertCard key={alert.id} alert={alert} role="vet" />
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Preventive schedule</SectionTitle>
        {[
          ["Vaccination", "Pale Comet", "Due in 3 days"],
          ["Deworming", "Iron Verdict", "Due in 6 days"],
          ["Farrier", "Golden Hour", "Tomorrow 11:00"],
        ].map(([kind, horse, when]) => (
          <Panel key={kind}>
            <View style={uiStyles.row}>
              <View>
                <Text style={uiStyles.value}>{kind}</Text>
                <Text style={uiStyles.muted}>{horse}</Text>
              </View>
              <Text style={uiStyles.muted}>{when}</Text>
            </View>
          </Panel>
        ))}
      </View>
      <PrimaryButton
        label="Record examination"
        onPress={() => router.push("/vet/exam/thunder-king")}
      />
    </>
  );
}
