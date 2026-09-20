import { useLocalSearchParams } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useRaceOS } from "@/context/RaceOSContext";
import { Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { Link } from "expo-router";
import { TrainerRemark } from "@/types/raceos";

export default function OwnerSessionDetail() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const { id, horseId, phaseId } = useLocalSearchParams<{
    id: string;
    horseId: string;
    phaseId: string;
  }>();
  
  const { plans, horses, trainerRemarks } = useRaceOS();
  const { t } = useI18n();
  
  const horse = horses.find((h) => h.id === horseId);
  const plan = plans.find((p) => p.horseId === horseId);
  const phase = plan?.phases.find((p) => p.id === phaseId);
  const session = phase?.sessions.find((s) => s.id === id);
  const remark = trainerRemarks?.find((r) => r.sessionId === id);

  if (!session || !horse) {
    return (
      <Screen role="owner" title="Session unavailable" back>
        <Panel>
          <Text style={uiStyles.muted}>{t("This session could not be found.")}</Text>
        </Panel>
      </Screen>
    );
  }

  return (
    <Screen
      role="owner"
      title={session.title}
      subtitle={`${horse.name} · ${session.date}`}
      back
    >
      <View style={uiStyles.section}>
        <SectionTitle>Training Plan</SectionTitle>
        <Panel style={styles.grid}>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Distance</Text>
            <Text style={uiStyles.value}>{session.distanceM} m</Text>
          </View>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Duration</Text>
            <Text style={uiStyles.value}>{session.durationMin} min</Text>
          </View>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Surface</Text>
            <Text style={uiStyles.value}>{t(session.surface)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Intensity</Text>
            <Text style={uiStyles.value}>{t(session.intensity)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Workload</Text>
            <Text style={uiStyles.value}>{session.workloadPercent}%</Text>
          </View>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Phase</Text>
            <Text style={uiStyles.value}>{phase?.name}</Text>
          </View>
        </Panel>
      </View>

      <View style={uiStyles.section}>
        <SectionTitle>Status</SectionTitle>
        <Panel>
          <Text style={{ ...uiStyles.value, color: session.status === 'completed' ? colors.primary : colors.foreground }}>
            {t(session.status)}
          </Text>
        </Panel>
      </View>

      {session.status === "completed" && (
        <View style={uiStyles.section}>
          <SectionTitle>Performance</SectionTitle>
          <Panel style={styles.grid}>
            <View style={styles.cell}>
              <Text style={uiStyles.label}>Actual distance</Text>
              <Text style={uiStyles.value}>{session.distanceM + 20} m</Text>
            </View>
            <View style={styles.cell}>
              <Text style={uiStyles.label}>Avg speed</Text>
              <Text style={uiStyles.value}>{Math.round((session.distanceM / (session.durationMin * 60)) * 3.6)} km/h</Text>
            </View>
            <View style={styles.cell}>
              <Text style={uiStyles.label}>Energy used</Text>
              <Text style={uiStyles.value}>{session.energyMcal} Mcal</Text>
            </View>
          </Panel>
        </View>
      )}

      {remark && (
        <View style={uiStyles.section}>
          <SectionTitle>Trainer Remark</SectionTitle>
          <Panel>
            <Text style={styles.quote}>"{remark.observation.slice(0, 80)}..."</Text>
            <Link href={`/owner/remark/${remark.id}`} style={styles.link}>
              View full trainer remark →
            </Link>
          </Panel>
        </View>
      )}
    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
  },
  cell: {
    width: "45%",
    marginBottom: space.sm,
  },
  quote: {
    color: colors.foreground,
    fontSize: 15,
    fontStyle: "italic",
    marginBottom: space.md,
  },
  link: {
    color: colors.primary,
    fontWeight: "700",
  }
});
