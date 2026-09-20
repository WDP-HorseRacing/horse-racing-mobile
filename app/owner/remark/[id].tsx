import { useLocalSearchParams } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useRaceOS } from "@/context/RaceOSContext";
import { Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export default function OwnerRemarkDetail() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const { trainerRemarks, horses } = useRaceOS();
  const remark = trainerRemarks?.find((r) => r.id === id);
  const horse = horses.find((h) => h.id === remark?.horseId);

  if (!remark || !horse) {
    return (
      <Screen role="owner" title="Remark unavailable" back>
        <Panel>
          <Text style={uiStyles.muted}>This trainer remark could not be found.</Text>
        </Panel>
      </Screen>
    );
  }

  return (
    <Screen
      role="owner"
      title="Trainer Remark"
      subtitle={`${horse.name} · ${remark.date}`}
      back
    >
      <View style={uiStyles.section}>
        <SectionTitle>Context</SectionTitle>
        <Panel style={styles.grid}>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Head Trainer</Text>
            <Text style={uiStyles.value}>{remark.trainerName}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Session</Text>
            <Text style={uiStyles.value}>{remark.sessionTitle || remark.context}</Text>
          </View>
          <View style={[styles.cell, { width: "100%" }]}>
            <Text style={uiStyles.label}>Performance Summary</Text>
            <Text style={uiStyles.value}>{remark.performanceSummary}</Text>
          </View>
        </Panel>
      </View>

      <View style={uiStyles.section}>
        <SectionTitle>Professional Observation</SectionTitle>
        <Panel>
          <Text style={styles.observation}>"{remark.observation}"</Text>
        </Panel>
      </View>

      {remark.recommendation && (
        <View style={uiStyles.section}>
          <SectionTitle>Recommendation</SectionTitle>
          <Panel>
            <Text style={uiStyles.value}>{remark.recommendation}</Text>
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
  observation: {
    color: colors.foreground,
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
  },
});
