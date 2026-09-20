import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { examSymptoms, getHorse } from "@/lib/raceos-data";
import { useRaceOS } from "@/context/RaceOSContext";
import { Chips, Field, NativeInput , Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { KeyValue , Screen, SectionTitle } from "@/components/common";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export default function Examination() {
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const horse = getHorse(id);
  const { saveExamination, examinations } = useRaceOS();
  const savedExam = examinations[horse.id];
  const [symptoms, setSymptoms] = useState(
    savedExam?.symptoms ?? ["Elevated HR", "Slow HR recovery"],
  );
  const [diagnosis, setDiagnosis] = useState(
    savedExam?.diagnosis ?? "Exercise intolerance — suspected cardiac arrhythmia",
  );
  const [treatment, setTreatment] = useState(
    savedExam?.treatment ?? "Rest 10 days, cardiac monitoring, no heavy work",
  );
  const [medication, setMedication] = useState(savedExam?.medication ?? "None pending ECG");
  const [notes, setNotes] = useState(
    savedExam?.notes ?? "Recheck ECG in 72 h. Recommend training lock until cleared.",
  );
  const [saved, setSaved] = useState(Boolean(savedExam));
  const toggle = (item: string) =>
    setSymptoms((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
    );
  const save = () => {
    saveExamination({ horseId: horse.id, symptoms, diagnosis, treatment, medication, notes });
    setSaved(true);
    Alert.alert("Examination recorded", "Trainer has been notified.");
  };
  return (
    <Screen role="vet" title="Examination" subtitle={`${horse.name} · stall ${horse.stall}`} back>
      {saved ? (
        <View
          style={{
            backgroundColor: colors.fitSoft,
            borderRadius: radius.md,
            padding: space.lg,
          }}
        >
          <Text style={uiStyles.value}>Examination saved</Text>
          <Text style={uiStyles.muted}>Added to the medical record and horse timeline.</Text>
        </View>
      ) : null}
      <View style={uiStyles.section}>
        <SectionTitle>Vitals</SectionTitle>
        <Panel>
          <KeyValue
            items={[
              ["Heart rate", "48 bpm resting"],
              ["Temperature", "38.4 °C"],
              ["Respiration", "18 /min"],
              ["Weight", `${horse.weight} kg`],
            ]}
          />
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Symptoms</SectionTitle>
        <Chips options={examSymptoms} value="" onChange={toggle} />
        <Text style={uiStyles.muted}>Selected: {symptoms.join(", ")}</Text>
      </View>
      <Field label="Diagnosis">
        <NativeInput value={diagnosis} onChangeText={setDiagnosis} multiline />
      </Field>
      <Field label="Treatment">
        <NativeInput value={treatment} onChangeText={setTreatment} multiline />
      </Field>
      <Field label="Medication">
        <NativeInput value={medication} onChangeText={setMedication} multiline />
      </Field>
      <Field label="Notes">
        <NativeInput value={notes} onChangeText={setNotes} multiline />
      </Field>
      <PrimaryButton label="Save examination" icon="checkmark" onPress={save} />
      <PrimaryButton
        label="Continue to training lock"
        icon="lock-closed"
        onPress={() => router.push(`/vet/lock/${horse.id}`)}
      />
    </Screen>
  );
}
