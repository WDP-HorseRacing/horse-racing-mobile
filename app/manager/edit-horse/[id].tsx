import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { getHorse } from "@/lib/raceos-data";
import { useRaceOS } from "@/context/RaceOSContext";
import { Field, NativeInput , Panel, PrimaryButton } from "@/components/ui";
import { Screen } from "@/components/common";

export default function EditHorse() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses, updateHorse } = useRaceOS();
  const horse = horses.find((item) => item.id === id) ?? getHorse(id);
  const [name, setName] = useState(horse.name);
  const [weight, setWeight] = useState(String(horse.weight));
  const [stall, setStall] = useState(horse.stall);
  const [owner, setOwner] = useState(horse.owner);
  return (
    <Screen role="manager" title="Edit horse profile" subtitle={horse.name} back>
      <Panel>
        <View style={{ gap: 18 }}>
          <Field label="Horse name">
            <NativeInput value={name} onChangeText={setName} />
          </Field>
          <Field label="Weight (kg)">
            <NativeInput value={weight} onChangeText={setWeight} />
          </Field>
          <Field label="Stall">
            <NativeInput value={stall} onChangeText={setStall} />
          </Field>
          <Field label="Primary owner">
            <NativeInput value={owner} onChangeText={setOwner} />
          </Field>
        </View>
      </Panel>
      <PrimaryButton
        label="Save profile"
        icon="checkmark"
        onPress={() => {
          updateHorse(horse.id, { name, weight: Number(weight) || horse.weight, stall, owner });
          Alert.alert("Profile saved", `${name} · Stall ${stall}`);
        }}
      />
    </Screen>
  );
}
