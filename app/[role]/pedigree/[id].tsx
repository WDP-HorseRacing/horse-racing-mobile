import { Redirect, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { getHorse } from "@/lib/raceos-data";
import { isRole } from "@/features/auth/roles";
import { Panel, uiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";

export default function Pedigree() {
  const { role, id } = useLocalSearchParams<{ role: string; id: string }>();
  if (!isRole(role)) return <Redirect href="/" />;
  const horse = getHorse(id);
  return (
    <Screen role={role} title={`${horse.name} pedigree`} subtitle="Three-generation bloodline" back>
      <Lineage title="Horse" entries={[[horse.name, `${horse.breed} · ${horse.color}`]]} />
      <Lineage
        title="Parents"
        entries={[
          [horse.sire, "Sire"],
          [horse.dam, "Dam"],
        ]}
      />
      <Lineage
        title="Grandparents"
        entries={[
          [`${horse.sire} line`, "Paternal"],
          [`${horse.dam} line`, "Maternal"],
          ["Stud book record", "Verified"],
          ["Registry archive", "Imported"],
        ]}
      />
    </Screen>
  );
}

function Lineage({ title, entries }: { title: string; entries: [string, string][] }) {
  return (
    <View style={uiStyles.section}>
      <SectionTitle>{title}</SectionTitle>
      {entries.map(([name, relation]) => (
        <Panel key={`${name}-${relation}`}>
          <Text style={uiStyles.value}>{name}</Text>
          <Text style={uiStyles.muted}>{relation}</Text>
        </Panel>
      ))}
    </View>
  );
}
