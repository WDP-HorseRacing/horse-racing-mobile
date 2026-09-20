import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useRaceOS } from "@/context/RaceOSContext";
import type { TrainingSession } from "@/lib/raceos-data";
import { Chips, Field, NativeInput , Panel, PrimaryButton, uiStyles } from "@/components/ui";
import { Screen } from "@/components/common";
import { colors, radius, space } from "@/config/theme";
import { useI18n } from "@/context/I18nContext";

export default function SessionEditor() {
  const { id, sessionId, phaseId } = useLocalSearchParams<{
    id: string;
    sessionId: string;
    phaseId: string;
  }>();
  const { plans, saveTrainingSession } = useRaceOS();
  const { t } = useI18n();
  const plan = plans.find((item) => item.horseId === id);
  const phase = plan?.phases.find((item) => item.id === phaseId) ?? plan?.phases[0];
  const existing = phase?.sessions.find((item) => item.id === sessionId);
  const [title, setTitle] = useState(existing?.title ?? "New training session");
  const [type, setType] = useState(existing?.type ?? "Aerobic");
  const [objective, setObjective] = useState(
    existing?.objective ?? "Support the objective of this phase.",
  );
  const [date, setDate] = useState(existing?.date ?? "2026-09-20");
  const [time, setTime] = useState(existing?.time ?? "06:00");
  const [distance, setDistance] = useState(existing?.distanceM ?? 1200);
  const [duration, setDuration] = useState(existing?.durationMin ?? 30);
  const [workload, setWorkload] = useState(existing?.workloadPercent ?? 50);
  const [intensity, setIntensity] = useState<TrainingSession["intensity"]>(
    existing?.intensity ?? "Light",
  );
  const [surface, setSurface] = useState<TrainingSession["surface"]>(existing?.surface ?? "Turf");
  const [groom, setGroom] = useState(existing?.assignedGroom ?? "Mai Tran");
  const [note, setNote] = useState(existing?.note ?? "");
  if (!plan || !phase)
    return (
      <Screen role="trainer" title="Session unavailable" back>
        <Panel>
          <Text style={uiStyles.muted}>
            {t("Create and publish the plan before adding sessions.")}
          </Text>
        </Panel>
      </Screen>
    );
  const save = () => {
    const session: TrainingSession = {
      id: existing?.id ?? `session-${Date.now()}`,
      date,
      time,
      title,
      type,
      objective,
      distanceM: distance,
      durationMin: duration,
      intensity,
      workloadPercent: workload,
      surface,
      status: existing?.status ?? "planned",
      assignedGroom: groom,
      note,
      energyMcal: Math.round(
        16 + (distance / 1000) * (intensity === "High" ? 10 : intensity === "Moderate" ? 7 : 5),
      ),
      concentratePercent: intensity === "High" ? 50 : intensity === "Moderate" ? 40 : 25,
    };
    saveTrainingSession(plan.id, phase.id, session);
    Alert.alert(t("Session saved"), `${title} · ${phase.name}`, [
      { text: t("Done"), onPress: () => router.back() },
    ]);
  };
  return (
    <Screen
      role="trainer"
      title={existing ? "Edit session" : "Add session"}
      subtitle={`${plan.name} · ${phase.name}`}
      back
    >
      <Panel style={styles.form}>
        <Field label="Session title">
          <NativeInput value={title} onChangeText={setTitle} />
        </Field>
        <Field label="Session purpose">
          <NativeInput value={objective} onChangeText={setObjective} multiline />
        </Field>
        <Field label="Exercise type">
          <NativeInput value={type} onChangeText={setType} />
        </Field>
        <View style={styles.two}>
          <View style={styles.flex}>
            <Field label="Date">
              <NativeInput value={date} onChangeText={setDate} />
            </Field>
          </View>
          <View style={styles.flex}>
            <Field label="Time">
              <NativeInput value={time} onChangeText={setTime} />
            </Field>
          </View>
        </View>
        <Field label="Intensity">
          <Chips
            options={["Light", "Moderate", "High"]}
            value={intensity}
            onChange={(value) => setIntensity(value as TrainingSession["intensity"])}
          />
        </Field>
        <Field label="Surface">
          <Chips
            options={["Soft", "Turf", "Dirt", "Synthetic", "Sand"]}
            value={surface}
            onChange={(value) => setSurface(value as TrainingSession["surface"])}
          />
        </Field>
        <Stepper
          label="Distance"
          value={distance}
          unit="m"
          step={200}
          min={400}
          max={3200}
          onChange={setDistance}
        />
        <Stepper
          label="Duration"
          value={duration}
          unit="min"
          step={5}
          min={10}
          max={90}
          onChange={setDuration}
        />
        <Stepper
          label="Workload"
          value={workload}
          unit="%"
          step={5}
          min={20}
          max={100}
          onChange={setWorkload}
        />
        <Field label="Assigned groom">
          <NativeInput value={groom} onChangeText={setGroom} />
        </Field>
        <Field label="Execution note">
          <NativeInput value={note} onChangeText={setNote} multiline />
        </Field>
      </Panel>
      <Panel>
        <Text style={uiStyles.label}>{t("Auto nutrition estimate")}</Text>
        <Text style={styles.energy}>
          {Math.round(
            16 + (distance / 1000) * (intensity === "High" ? 10 : intensity === "Moderate" ? 7 : 5),
          )}{" "}
          Mcal/day
        </Text>
        <Text style={uiStyles.muted}>
          {t("Calculated from this session only, not from the whole plan.")}
        </Text>
      </Panel>
      <PrimaryButton label="Save session" icon="checkmark" onPress={save} />
    </Screen>
  );
}

function Stepper({
  label,
  value,
  unit,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <View style={styles.stepper}>
        <Pressable style={styles.stepButton} onPress={() => onChange(Math.max(min, value - step))}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>
          {value.toLocaleString()} {unit}
        </Text>
        <Pressable style={styles.stepButton} onPress={() => onChange(Math.min(max, value + step))}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xl },
  two: { flexDirection: "row", gap: space.md },
  flex: { flex: 1 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.elevated,
    padding: 6,
  },
  stepButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  stepText: { color: colors.primary, fontSize: 24, fontWeight: "700" },
  stepValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
  energy: { color: colors.warning, fontSize: 30, fontWeight: "800", marginVertical: space.sm },
});
