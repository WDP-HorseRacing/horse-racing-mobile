import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen } from "@/components/common";
import {
  Chips,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { trainingService } from "@/services/training.service";
import { safeBack } from "@/utils/navigation";
import {
  addDaysToClubDate,
  clubDateTimeToIso,
  defaultClubDateTime,
} from "@/features/training/training-utils";
import { extractErrorMessage } from "@/utils/errorHandler";

export default function CreateTrainingClass() {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(defaultClubDateTime().date);
  const [planId, setPlanId] = useState("");
  const [raceAptitude, setRaceAptitude] = useState("");
  const [maxHorses, setMaxHorses] = useState("10");
  const [saving, setSaving] = useState(false);
  const loadPlans = useCallback(() => trainingService.listPlans(token!), [token]);
  const plansResource = useApiResource(loadPlans, Boolean(token));
  const selectedPlan = useMemo(
    () => plansResource.data?.find((plan) => plan.id === planId),
    [planId, plansResource.data],
  );
  const endDate = selectedPlan
    ? addDaysToClubDate(startDate, selectedPlan.totalWeeks * 7 - 1)
    : null;

  const save = async () => {
    if (!token) return;
    if (
      !code.trim() ||
      code.trim().length > 32 ||
      !name.trim() ||
      name.trim().length > 160 ||
      !planId ||
      !clubDateTimeToIso(startDate, "12:00")
    ) {
      return Alert.alert(
        "Check the class details",
        "Add a class code (up to 32 characters), a name, a valid start date and a training plan.",
      );
    }
    const capacity = Number(maxHorses);
    if (!Number.isInteger(capacity) || capacity < 1)
      return Alert.alert("Check capacity", "Maximum horses must be a positive whole number.");
    setSaving(true);
    try {
      const created = await trainingService.createClass(token, {
        code: code.trim(),
        name: name.trim(),
        planId,
        startDate,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(raceAptitude ? { raceAptitude: raceAptitude as "SPRINTER" | "MILER" | "STAYER" } : {}),
        maxHorses: capacity,
      });
      router.replace(`/trainer/plan/${created.id}`);
    } catch (error) {
      Alert.alert("Could not create class", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      role="trainer"
      title="Create training class"
      subtitle="A class starts active; schedule sessions after creation"
      back
      fallbackHref="/trainer/training"
    >
      <AsyncStateView
        isLoading={plansResource.isLoading}
        error={plansResource.error}
        onRetry={() => void plansResource.retry()}
      />
      <Panel style={{ gap: 12 }}>
        <Field label="Class code">
          <NativeInput value={code} onChangeText={setCode} placeholder="e.g. HT-2026-01" />
        </Field>
        <Field label="Class name">
          <NativeInput value={name} onChangeText={setName} placeholder="Name this class" />
        </Field>
        <Field label="Description">
          <NativeInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Optional class notes"
          />
        </Field>
        <Field label="Start date (club calendar, YYYY-MM-DD)">
          <NativeInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="Maximum horses">
          <NativeInput value={maxHorses} onChangeText={setMaxHorses} keyboardType="number-pad" />
        </Field>
        <Field label="Race aptitude (optional)">
          <Chips
            options={["Any", "SPRINTER", "MILER", "STAYER"]}
            value={raceAptitude || "Any"}
            onChange={(value) => setRaceAptitude(value === "Any" ? "" : value)}
          />
        </Field>
      </Panel>

      <View style={ui.section}>
        <Text style={ui.label}>Choose one of your plans</Text>
        {plansResource.data?.length
          ? plansResource.data.map((plan) => (
              <Pressable key={plan.id} onPress={() => setPlanId(plan.id)}>
                <Panel
                  style={{
                    gap: 5,
                    borderColor: planId === plan.id ? colors.primary : colors.border,
                    backgroundColor: planId === plan.id ? colors.fitSoft : colors.surface,
                  }}
                >
                  <Text style={ui.value}>
                    {plan.name}
                    {planId === plan.id ? "  ✓" : ""}
                  </Text>
                  <Text style={ui.muted}>
                    {plan.totalWeeks} weeks · {plan.phases.length} phases · {plan.minTotalMinutes}{" "}
                    minimum minutes
                  </Text>
                </Panel>
              </Pressable>
            ))
          : null}
        {selectedPlan && endDate ? (
          <Panel>
            <Text style={ui.value}>Class dates</Text>
            <Text style={ui.muted}>
              {startDate} → {endDate}
            </Text>
            <Text style={ui.label}>
              No sessions are created here. The class plan is copied from the selected plan.
            </Text>
          </Panel>
        ) : null}
        {plansResource.data && plansResource.data.length === 0 ? (
          <Panel>
            <Text style={ui.muted}>Create a training plan before creating a class.</Text>
            <SecondaryButton
              label="Manage plans"
              icon="reader-outline"
              onPress={() => router.push("/trainer/plans")}
            />
          </Panel>
        ) : null}
      </View>
      <PrimaryButton
        label={saving ? "Creating…" : "Create active class"}
        icon="checkmark"
        disabled={saving || !plansResource.data?.length}
        onPress={() => void save()}
      />
      <SecondaryButton label="Cancel" icon="close" onPress={() => safeBack("/trainer/training")} />
    </Screen>
  );
}
