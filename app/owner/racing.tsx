import { router } from "expo-router";
import { View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { raceResults, races } from "@/lib/raceos-data";
import { Panel, PrimaryButton, Screen, SectionTitle, uiStyles } from "@/native/ui";
import { colors } from "@/native/theme";

export default function OwnerRacing() {
  return (
    <Screen role="owner" title="Racing">
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
                    color: result.place === "1st" ? colors.primary : colors.text,
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
    </Screen>
  );
}
