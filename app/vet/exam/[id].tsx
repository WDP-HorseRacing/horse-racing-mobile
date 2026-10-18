import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { examSymptoms, getHorse } from "@/lib/raceos-data";
import { useRaceOS } from "@/context/RaceOSContext";
import { Chips, Field, NativeInput, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { KeyValue, Screen, SectionTitle, TimelineItem } from "@/components/common";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { medicalService } from "@/services/medical.service";
import { mapMedicalCase } from "@/adapters/medical.adapter";
import { formatWeight } from "@/utils/formatters";
import { isUuid } from "@/features/medical/medical-validation";

export default function Examination() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { id, view, horseName } = useLocalSearchParams<{
    id: string;
    view?: string;
    horseName?: string;
  }>();
  const normalizedId = Array.isArray(id) ? id[0] : id;
  const normalizedView = Array.isArray(view) ? view[0] : view;
  const { token } = useAuth();
  const loadCase = useCallback(
    () => medicalService.getCase(token!, normalizedId),
    [normalizedId, token],
  );
  const caseResource = useApiResource(loadCase, normalizedView === "case" && Boolean(token));
  const medicalCase = useMemo(
    () =>
      normalizedView === "case" && caseResource.data
        ? mapMedicalCase(caseResource.data, horseName || undefined)
        : null,
    [caseResource.data, horseName, normalizedView],
  );
  const horse = getHorse(normalizedId);
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

  if (normalizedView === "case" && isUuid(normalizedId)) {
    return <Redirect href={`/vet/medical/cases/${normalizedId}` as Href} />;
  }
  if (normalizedView !== "case" && isUuid(normalizedId)) {
    return <Redirect href={`/vet/medical/visit?horseId=${normalizedId}` as Href} />;
  }

  if (normalizedView === "case") {
    return (
      <Screen
        role="vet"
        title="Medical case"
        subtitle={medicalCase ? `${medicalCase.horseName} · ${medicalCase.status}` : "Case details"}
        back
        fallbackHref="/vet/medical"
        refreshing={caseResource.isRefreshing}
        onRefresh={() => void caseResource.refresh()}
      >
        <AsyncStateView
          isLoading={caseResource.isLoading}
          error={caseResource.error}
          onRetry={() => void caseResource.retry()}
        />
        {medicalCase ? (
          <>
            <Panel>
              <KeyValue
                items={[
                  ["Horse", medicalCase.horseName],
                  ["Status", medicalCase.status],
                  ["Opened", medicalCase.openedAtLabel],
                  ["Initial diagnosis", medicalCase.diagnosis],
                  ["Final conclusion", medicalCase.finalConclusion ?? "—"],
                  [
                    "Total cost",
                    medicalCase.totalCost == null ? "—" : `${medicalCase.totalCost} VND`,
                  ],
                ]}
              />
            </Panel>
            <View style={uiStyles.section}>
              <SectionTitle>Examinations and follow-ups</SectionTitle>
              {medicalCase.visits.length ? (
                <Panel>
                  {medicalCase.visits.map((visit, index) => (
                    <TimelineItem
                      key={visit.id}
                      time={visit.examDateLabel}
                      title={`${visit.kind.replaceAll("_", " ")} · ${visit.diagnosis}`}
                      detail={[
                        visit.resultingStatus.replaceAll("_", " "),
                        visit.careInstructions,
                        visit.isVoided
                          ? `Voided: ${visit.voidReason ?? "No reason provided"}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      tone={visit.isVoided ? colors.mutedForeground : colors.primary}
                      last={index === medicalCase.visits.length - 1}
                    />
                  ))}
                </Panel>
              ) : (
                <AsyncStateView
                  isLoading={false}
                  error={null}
                  onRetry={() => undefined}
                  empty
                  emptyLabel="No examination visits are recorded for this case."
                />
              )}
            </View>
          </>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen role="vet" title="Examination" subtitle={`${horse.name} · stall ${horse.stall}`} back fallbackHref="/vet/medical">
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
              ["Weight", formatWeight(horse.weight)],
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
