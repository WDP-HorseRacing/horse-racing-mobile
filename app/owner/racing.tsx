import { router } from "expo-router";
import { View, Pressable } from "react-native";
import { useState } from "react";
import { Text } from "@/components/common/LocalizedText";
import { raceResults, races, trials } from "@/lib/raceos-data";
import { Panel, PrimaryButton, Chips, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { useRaceOS } from "@/context/RaceOSContext";
import { Ionicons } from "@expo/vector-icons";
import { radius, space } from "@/config/theme";

export default function OwnerRacing() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { horses } = useRaceOS();
  const [tab, setTab] = useState("Racing");

  // Filter for Marlow Bloodstock (or current owner)
  const myHorses = horses.filter((h) => h.owner === "Marlow Bloodstock");
  const myHorseIds = new Set(myHorses.map((h) => h.id));
  const myTrials = trials.filter((t) => myHorseIds.has(t.horseId));

  return (
    <Screen role="owner" title="Racing">
      <Chips options={["Racing", "Trials"]} value={tab} onChange={setTab} />
      
      {tab === "Racing" ? (
        <>
          <PrimaryButton
            label="Register for a race"
            icon="flag-outline"
            onPress={() => router.push("/owner/race-registration")}
          />
          <View style={uiStyles.section}>
            <SectionTitle>Upcoming</SectionTitle>
            {races.map((race) => (
              <Panel key={race.name}>
                <View style={uiStyles.row}>
                  <View>
                    <Text style={uiStyles.value}>{race.name}</Text>
                    <Text style={uiStyles.muted}>{race.track}</Text>
                    <Text style={uiStyles.muted}>{race.entries} entries from this stable</Text>
                  </View>
                  <View>
                    <Text style={{ ...uiStyles.value, color: colors.primary }}>{race.date}</Text>
                    <Text style={uiStyles.muted}>{race.purse}</Text>
                  </View>
                </View>
              </Panel>
            ))}
          </View>
          <View style={uiStyles.section}>
            <SectionTitle>Results</SectionTitle>
            {raceResults.map((result) => (
              <Panel key={result.name}>
                <View style={uiStyles.row}>
                  <View>
                    <Text style={uiStyles.value}>{result.horse}</Text>
                    <Text style={uiStyles.muted}>
                      {result.name} · {result.date}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={{
                        ...uiStyles.value,
                        color: result.place === "1st" ? colors.primary : colors.foreground,
                      }}
                    >
                      {result.place}
                    </Text>
                    <Text style={uiStyles.muted}>{result.prize}</Text>
                  </View>
                </View>
              </Panel>
            ))}
          </View>
        </>
      ) : (
        <View style={uiStyles.section}>
          <SectionTitle>Trial Videos</SectionTitle>
          {myTrials.length > 0 ? (
            myTrials.map((trial) => {
              const horse = horses.find(h => h.id === trial.horseId);
              return (
                <Pressable
                  key={trial.id}
                  onPress={() => router.push(`/owner/trial/${trial.id}`)}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    padding: space.md,
                    flexDirection: "row",
                    gap: space.md,
                  }}
                >
                  <View style={{
                    width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.background,
                    alignItems: "center", justifyContent: "center"
                  }}>
                    <Ionicons name="play-circle" size={32} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, justifyContent: "center" }}>
                    <Text style={uiStyles.value}>{horse?.name}</Text>
                    <Text style={uiStyles.muted}>{trial.type} · {trial.date}</Text>
                    <Text style={uiStyles.label}>{trial.distanceM} m · {trial.surface}</Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Panel>
              <Text style={uiStyles.muted}>No trial videos available</Text>
            </Panel>
          )}
        </View>
      )}
    </Screen>
  );
}
