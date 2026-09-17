import { router } from "expo-router";
import { View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { alerts, liveSeries } from "@/lib/raceos-data";
import { AlertCard, KeyValue, MiniChart } from "@/native/components";
import { Panel, PrimaryButton, Screen, SectionTitle, uiStyles } from "@/native/ui";
import { colors } from "@/native/theme";

export default function VetAlerts() {
  return (
    <Screen role="vet" title="Alerts" subtitle="1 awaiting decision">
      <View style={uiStyles.alert}>
        <Text style={uiStyles.label}>Abnormal condition detected</Text>
        <Text style={{ ...uiStyles.value, fontSize: 22 }}>Thunder King</Text>
        <Text style={uiStyles.muted}>
          Heart rate exceeded the configured safety threshold during moderate work.
        </Text>
        <KeyValue
          items={[
            ["Peak HR", "188 bpm"],
            ["Normal range", "60–180 bpm"],
            ["Speed at peak", "52 km/h"],
            ["Session", "14 min 20 s"],
          ]}
        />
        <MiniChart data={liveSeries} valueKey="hr" color={colors.danger} />
        <PrimaryButton
          label="Open live session"
          onPress={() => router.push("/vet/live/thunder-king")}
        />
        <PrimaryButton
          label="Examine horse"
          icon="medkit-outline"
          onPress={() => router.push("/vet/exam/thunder-king")}
        />
        <PrimaryButton
          label="Lock training"
          icon="lock-closed"
          onPress={() => router.push("/vet/lock/thunder-king")}
        />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Alert stream</SectionTitle>
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} role="vet" />
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Escalation policy</SectionTitle>
        <Panel>
          <Text style={uiStyles.muted}>• HR above threshold for 30 s → vet paged</Text>
          <Text style={uiStyles.muted}>• No acknowledgement in 5 min → manager paged</Text>
          <Text style={uiStyles.muted}>
            • Vet lock → training stopped and groom tasks rewritten
          </Text>
        </Panel>
      </View>
    </Screen>
  );
}
