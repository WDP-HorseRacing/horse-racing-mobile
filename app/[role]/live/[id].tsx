import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { getHorse, liveSeries } from "@/lib/raceos-data";
import { isRole } from "@/features/auth/roles";
import { MiniChart , Metric, Panel, PrimaryButton, uiStyles } from "@/components/ui";
import { KeyValue , Screen, SectionTitle } from "@/components/common";
import { colors, radius, space } from "@/config/theme";

export default function LiveTraining() {
  const { role, id } = useLocalSearchParams<{ role: string; id: string }>();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1600);
    return () => clearInterval(timer);
  }, []);
  const window = useMemo(() => liveSeries.slice(0, 26 + (tick % 14)), [tick]);
  if (!isRole(role)) return <Redirect href="/" />;
  const horse = getHorse(id);
  const latest = window[window.length - 1];
  const abnormal = latest.hr > 180;
  return (
    <Screen role={role} title={horse.name} subtitle="Live training · sensor vest #A14" back>
      <View style={styles.live}>
        <View style={styles.dot} />
        <Text style={styles.liveText}>Streaming live</Text>
      </View>
      {abnormal ? (
        <View style={uiStyles.alert}>
          <Text style={uiStyles.label}>Abnormal condition detected</Text>
          <Text style={styles.alertTitle}>{horse.name}</Text>
          <Text style={uiStyles.muted}>Heart rate exceeds the configured safety threshold.</Text>
          <KeyValue
            items={[
              ["Current HR", `${latest.hr} bpm`],
              ["Normal range", "60–180 bpm"],
              ["Speed", `${latest.speed} km/h`],
              ["Duration", "14 min 20 s"],
            ]}
          />
          <PrimaryButton
            label="Review horse"
            onPress={() => router.push(`/${role}/horse/${horse.id}`)}
          />
          <PrimaryButton
            label="Contact veterinarian"
            icon="medkit-outline"
            onPress={() => router.push("/vet/alerts")}
          />
        </View>
      ) : null}
      <View style={uiStyles.metricGrid}>
        <Metric
          label="Heart rate"
          value={latest.hr}
          hint="bpm"
          tone={abnormal ? "danger" : "warning"}
        />
        <Metric label="Speed" value={latest.speed} hint="km/h" tone="good" />
        <Metric label="Distance" value="1.2" hint="km · target 1.6" />
        <Metric label="Temperature" value="38.2" hint="°C · normal" tone="good" />
      </View>
      <Chart
        title="Heart rate · last 4 minutes"
        data={window}
        valueKey="hr"
        color={abnormal ? colors.danger : colors.info}
        caption="Safety threshold 180 bpm · updating every 1.6 s"
      />
      <Chart
        title="Speed"
        data={window}
        valueKey="speed"
        color={colors.primary}
        caption="Current and recent speed km/h"
      />
      <View style={uiStyles.section}>
        <SectionTitle>Session</SectionTitle>
        <Panel>
          <KeyValue
            items={[
              ["Phase", horse.phase],
              ["Surface", "Dirt · dry"],
              ["Assigned groom", "Mai Tran"],
              ["Plan", "1,600 m · moderate"],
            ]}
          />
        </Panel>
      </View>
      {role === "trainer" ? (
        <PrimaryButton
          label="Complete session & evaluate"
          icon="checkmark-circle-outline"
          onPress={() => router.push(`/trainer/eval/${horse.id}`)}
        />
      ) : null}
    </Screen>
  );
}

function Chart({
  title,
  data,
  valueKey,
  color,
  caption,
}: {
  title: string;
  data: Record<string, unknown>[];
  valueKey: string;
  color: string;
  caption: string;
}) {
  return (
    <View style={uiStyles.section}>
      <SectionTitle>{title}</SectionTitle>
      <Panel>
        <MiniChart data={data} valueKey={valueKey} color={color} height={145} />
        <Text style={uiStyles.muted}>{caption}</Text>
      </Panel>
    </View>
  );
}
const styles = StyleSheet.create({
  live: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.primarySoft,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  liveText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  alertTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
});
