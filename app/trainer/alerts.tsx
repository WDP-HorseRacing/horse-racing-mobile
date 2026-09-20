import { router } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { alerts } from "@/lib/raceos-data";
import { KeyValue , Screen, SectionTitle } from "@/components/common";
import { AlertCard } from "@/features/alerts/components/AlertCard";
import { Panel, PrimaryButton, uiStyles } from "@/components/ui";

export default function TrainerAlerts() {
  return (
    <Screen role="trainer" title="Alerts" subtitle="2 critical · 1 warning · 1 info">
      <View style={uiStyles.section}>
        <SectionTitle>Critical — action required</SectionTitle>
        <Panel style={uiStyles.alert}>
          <Text style={uiStyles.label}>Training locked by veterinarian</Text>
          <Text style={{ ...uiStyles.value, fontSize: 22 }}>Thunder King</Text>
          <Text style={uiStyles.muted}>
            Abnormal heart-rate response during 1,600 m moderate work.
          </Text>
          <KeyValue
            items={[
              ["Peak HR", "188 bpm"],
              ["Normal range", "60–180 bpm"],
              ["Locked at", "10:24"],
              ["Locked by", "Dr. S. Rao"],
            ]}
          />
          <PrimaryButton
            label="View health report"
            onPress={() => router.push("/trainer/horse/thunder-king")}
          />
          <PrimaryButton
            label="Adjust training plan"
            icon="create-outline"
            onPress={() => router.push("/trainer/plan/thunder-king")}
          />
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Alert stream</SectionTitle>
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} role="trainer" />
        ))}
      </View>
    </Screen>
  );
}
