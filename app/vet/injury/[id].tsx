import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { getHorse, recoveryTrend } from "@/lib/raceos-data";
import { MiniChart, ProgressBar } from "@/native/components";
import { Panel, PrimaryButton, Screen, SectionTitle, uiStyles } from "@/native/ui";
import { colors, radius, space } from "@/native/theme";

type Region = { id: string; label: string; finding?: string; recovery?: number };
const regions: Region[] = [
  { id: "head", label: "Head & neck" },
  { id: "shoulder", label: "Left shoulder" },
  { id: "back", label: "Back" },
  { id: "left-fore", label: "Left fore", finding: "Grade 2 tendon strain", recovery: 38 },
  { id: "right-fore", label: "Right fore" },
  { id: "hind", label: "Hindquarter" },
  { id: "left-hind", label: "Left hind", finding: "Soft-tissue inflammation", recovery: 65 },
  { id: "hoof", label: "Right hind hoof" },
];

export default function InjuryMap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const horse = getHorse(id);
  const [active, setActive] = useState(regions[3]);
  return (
    <Screen role="vet" title="Injury mapping" subtitle={`${horse.name} · tap a region`} back>
      <Panel>
        <View style={styles.body}>
          <Text style={styles.horse}>HORSE BODY MAP</Text>
          <View style={styles.regions}>
            {regions.map((region) => (
              <Pressable
                key={region.id}
                onPress={() => setActive(region)}
                style={[
                  styles.region,
                  region.finding && styles.injured,
                  active.id === region.id && styles.active,
                ]}
              >
                <Text style={[styles.regionText, region.finding && styles.injuredText]}>
                  {region.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={uiStyles.muted}>
          Red regions are open findings · neutral regions are clear
        </Text>
      </Panel>
      <View style={uiStyles.section}>
        <SectionTitle>{active.label}</SectionTitle>
        <Panel>
          {active.finding ? (
            <>
              <Text style={uiStyles.value}>{active.finding}</Text>
              <Text style={uiStyles.muted}>Recorded Sep 02 · monitoring · re-scan in 5 days</Text>
              <View style={{ height: space.md }} />
              <View style={uiStyles.row}>
                <Text style={uiStyles.muted}>Recovery</Text>
                <Text style={uiStyles.value}>{active.recovery}%</Text>
              </View>
              <ProgressBar value={active.recovery ?? 0} tone={colors.warning} />
              <MiniChart data={recoveryTrend} valueKey="v" color={colors.warning} />
            </>
          ) : (
            <Text style={uiStyles.muted}>No findings recorded for this region.</Text>
          )}
        </Panel>
      </View>
      <PrimaryButton
        label={`Add finding to ${active.label.toLowerCase()}`}
        icon="add"
        onPress={() => Alert.alert("Finding drafted", active.label)}
      />
      <PrimaryButton
        label="Open examination"
        onPress={() => router.push(`/vet/exam/${horse.id}`)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, paddingVertical: space.md },
  horse: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
  },
  regions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  region: {
    width: "48%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    padding: space.sm,
  },
  injured: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  active: { borderWidth: 2, borderColor: colors.primary },
  regionText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  injuredText: { color: colors.danger },
});
