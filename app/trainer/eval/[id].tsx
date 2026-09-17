import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { getHorse } from "@/lib/raceos-data";
import { Chips, Field, NativeInput } from "@/native/components";
import { Panel, PrimaryButton, Screen, uiStyles } from "@/native/ui";

export default function SessionEvaluation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const horse = getHorse(id);
  const [effort, setEffort] = useState("On target");
  const [recovery, setRecovery] = useState("Normal");
  const [notes, setNotes] = useState("");
  return (
    <Screen role="trainer" title="Session evaluation" subtitle={horse.name} back>
      <Panel>
        <Text style={uiStyles.value}>{horse.lastSession}</Text>
        <Text style={uiStyles.muted}>Planned phase · {horse.phase}</Text>
      </Panel>
      <View style={{ gap: 18 }}>
        <Field label="Observed effort">
          <Chips
            options={["Below target", "On target", "Above target"]}
            value={effort}
            onChange={setEffort}
          />
        </Field>
        <Field label="Recovery">
          <Chips options={["Fast", "Normal", "Delayed"]} value={recovery} onChange={setRecovery} />
        </Field>
        <Field label="Trainer notes">
          <NativeInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Stride, breathing, temperament, next adjustment…"
          />
        </Field>
      </View>
      <PrimaryButton
        label="Save evaluation"
        icon="checkmark"
        onPress={() => Alert.alert("Evaluation saved", `${effort} · ${recovery}`)}
      />
    </Screen>
  );
}
