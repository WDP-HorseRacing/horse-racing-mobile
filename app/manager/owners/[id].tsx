import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { getHorse } from "@/lib/raceos-data";
import { NativeInput , Panel, PrimaryButton, uiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";

export default function HorseOwners() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const horse = getHorse(id);
  const [primary, setPrimary] = useState("60");
  const [partner, setPartner] = useState("40");
  const total = Number(primary || 0) + Number(partner || 0);
  return (
    <Screen role="manager" title="Syndicate allocation" subtitle={horse.name} back>
      <View style={uiStyles.metricGrid}>
        <Panel>
          <Text style={uiStyles.label}>Allocated</Text>
          <Text style={uiStyles.value}>{total}%</Text>
        </Panel>
        <Panel>
          <Text style={uiStyles.label}>Remaining</Text>
          <Text style={uiStyles.value}>{Math.max(0, 100 - total)}%</Text>
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Owners</SectionTitle>
        <Panel>
          <Text style={uiStyles.value}>{horse.owner}</Text>
          <Text style={uiStyles.muted}>Primary owner percentage</Text>
          <NativeInput value={primary} onChangeText={setPrimary} />
        </Panel>
        <Panel>
          <Text style={uiStyles.value}>Syndicate partner</Text>
          <Text style={uiStyles.muted}>Secondary allocation</Text>
          <NativeInput value={partner} onChangeText={setPartner} />
        </Panel>
      </View>
      <PrimaryButton
        label="Save allocation"
        icon="checkmark"
        onPress={() =>
          Alert.alert(
            total === 100 ? "Allocation saved" : "Allocation incomplete",
            `Current total: ${total}%`,
          )
        }
      />
    </Screen>
  );
}
