import { View, Pressable, StyleSheet } from "react-native";
import { router, type Href } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { alerts, horses, fitnessTrend } from "@/mocks/raceos";
import { AlertCard } from "@/features/alerts/components/AlertCard";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { MiniChart } from "@/components/ui/MiniChart";
import { TimelineItem } from "@/components/common/TimelineItem";
import { HorseRow } from "@/features/horses/components/HorseRow";
import { Metric } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/Panel";
import { PrimaryButton } from "@/components/ui/Button";
import { SectionTitle } from "@/components/common/SectionTitle";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getUiStyles } from "@/components/ui/styles";
import { space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export function TrainerDashboard() {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const uiStyles = getUiStyles(colors);
  const attention = horses.filter((horse) =>
    ["MONITOR", "INJURED", "LOCKED"].includes(horse.status),
  );
  const training = horses.filter((horse) => horse.status === "TRAINING");
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Stable fitness" value="78%" hint="+3 pts this week" tone="good" />
        <Metric label="Training today" value={12} hint="4 remaining" />
        <Metric
          label="Attention"
          value={attention.length}
          hint="1 locked · 1 injured"
          tone="warning"
        />
        <Metric label="Race ready" value={2} hint="Autumn Sprint" tone="good" />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Stable fitness trend</SectionTitle>
        <Panel>
          <MiniChart data={fitnessTrend} valueKey="v" />
          <Text style={uiStyles.muted}>Fitness index · last seven days</Text>
        </Panel>
      </View>
      {training.map((horse) => (
        <Pressable
          key={horse.id}
          onPress={() => router.push(`/trainer/live/${horse.id}` as Href)}
          style={styles.live}
        >
          <View style={styles.liveDot} />
          <View style={styles.flex}>
            <Text style={uiStyles.value}>{horse.name} · live now</Text>
            <Text style={uiStyles.muted}>{horse.phase} · sensor vest active</Text>
          </View>
          <Text style={styles.liveValue}>{horse.hr} bpm</Text>
        </Pressable>
      ))}
      <View style={uiStyles.section}>
        <SectionTitle>Needs a decision</SectionTitle>
        {alerts.slice(0, 2).map((alert) => (
          <AlertCard key={alert.id} alert={alert} role="trainer" />
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Attention list</SectionTitle>
        {attention.map((horse) => (
          <HorseRow key={horse.id} horse={horse} role="trainer" />
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>{"Today's sessions"}</SectionTitle>
        {horses.slice(0, 4).map((horse, index) => (
          <Panel key={horse.id}>
            <View style={uiStyles.row}>
              <View>
                <Text style={uiStyles.value}>
                  {["06:00", "06:40", "07:10", "07:40"][index]} · {horse.name}
                </Text>
                <Text style={uiStyles.muted}>{horse.lastSession}</Text>
              </View>
              <StatusBadge status={horse.status} />
            </View>
          </Panel>
        ))}
      </View>
    </>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  flex: { flex: 1 },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: colors.fitSoft,
    borderRadius: 16,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  liveValue: { color: colors.training, fontSize: 15, fontWeight: "800" },
});
