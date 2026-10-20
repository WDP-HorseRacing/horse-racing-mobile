import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
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
import { trainingService, type TrainingClassDto } from "@/services/training.service";
import { performanceService } from "@/services/performance.service";
import { usersService } from "@/services/users.service";
import type { StaffDto } from "@/adapters/staff.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDate, formatDateTime } from "@/utils/formatters";

type ManagerPayload = {
  subjects: Awaited<ReturnType<typeof trainingService.listSubjects>>;
  plans: Awaited<ReturnType<typeof trainingService.listPlans>>;
  classes: {
    trainingClass: TrainingClassDto;
    sessions: Awaited<ReturnType<typeof trainingService.listClassSessions>>;
    horses: Awaited<ReturnType<typeof trainingService.listEnrollments>>;
    progress: Awaited<ReturnType<typeof trainingService.getClassProgress>>;
  }[];
  performanceRows: {
    horseId: string;
    horseName: string;
    summary: Awaited<ReturnType<typeof performanceService.getHorseSummary>> | null;
  }[];
  users: StaffDto[];
};

type SubjectForm = {
  id: string | null;
  name: string;
  description: string;
  sessionType: "REGULAR" | "TIME_TRIAL";
  intensity: "LIGHT" | "HEAVY";
  distance: string;
  duration: string;
  surface: string;
  target: string;
};
const emptySubject = (): SubjectForm => ({
  id: null,
  name: "",
  description: "",
  sessionType: "REGULAR",
  intensity: "LIGHT",
  distance: "0",
  duration: "60",
  surface: "",
  target: "",
});

export default function ManagerTraining() {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const { token } = useAuth();
  const [tab, setTab] = useState("Subjects");
  const [subjectForm, setSubjectForm] = useState<SubjectForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [sourceTrainer, setSourceTrainer] = useState("");
  const [targetTrainer, setTargetTrainer] = useState("");
  const [handoverBusy, setHandoverBusy] = useState(false);
  const load = useCallback(async (): Promise<ManagerPayload> => {
    const [subjects, plans, classes, users] = await Promise.all([
      trainingService.listSubjects(token!),
      trainingService.listPlans(token!),
      trainingService.listClasses(token!),
      usersService.list(token!),
    ]);
    const details = await Promise.all(
      classes.map(async (trainingClass) => {
        const [sessions, horses, progress] = await Promise.all([
          trainingService.listClassSessions(token!, trainingClass.id),
          trainingService.listEnrollments(token!, trainingClass.id),
          trainingService.getClassProgress(token!, trainingClass.id),
        ]);
        return { trainingClass, sessions, horses, progress };
      }),
    );
    const enrolledHorses = new Map<string, string>();
    for (const { horses } of details)
      for (const horse of horses) enrolledHorses.set(horse.horseId, horse.horseName);
    const horseEntries = [...enrolledHorses.entries()];
    const performanceRows = await mapConcurrent(horseEntries, 6, async ([horseId, horseName]) => {
      try {
        return {
          horseId,
          horseName,
          summary: await performanceService.getHorseSummary(token!, horseId),
        };
      } catch {
        return { horseId, horseName, summary: null };
      }
    });
    return { subjects, plans, classes: details, performanceRows, users };
  }, [token]);
  const resource = useApiResource(load, Boolean(token));
  const payload = resource.data;
  const trainers =
    payload?.users.filter((user) => user.role === "HEAD_TRAINER" && user.status === "ACTIVE") ?? [];

  const saveSubject = async () => {
    if (!token || !subjectForm) return;
    const distance = Number(subjectForm.distance);
    const duration = Number(subjectForm.duration);
    const target = subjectForm.target.trim() ? Number(subjectForm.target) : undefined;
    if (
      !subjectForm.name.trim() ||
      subjectForm.name.trim().length > 160 ||
      !Number.isInteger(distance) ||
      distance < 0 ||
      distance > 20_000 ||
      !Number.isInteger(duration) ||
      duration < 15 ||
      duration > 480 ||
      (subjectForm.sessionType === "TIME_TRIAL" && distance <= 0) ||
      (target !== undefined && (!Number.isInteger(target) || target < 1 || target > 3_600_000))
    ) {
      return Alert.alert(
        "Check subject details",
        "Name is required; distance must be 0–20,000 m (over 0 for trials), duration 15–480 min, and trial target time must be 1–3,600,000 ms.",
      );
    }
    const input = {
      name: subjectForm.name.trim(),
      sessionType: subjectForm.sessionType,
      intensity: subjectForm.intensity,
      plannedDistanceM: distance,
      durationMinutes: duration,
    };
    setSaving(true);
    try {
      if (subjectForm.id) {
        await trainingService.updateSubject(token, subjectForm.id, {
          ...input,
          description: subjectForm.description.trim() || null,
          surface: subjectForm.surface.trim() || null,
          targetTimeMs: subjectForm.sessionType === "TIME_TRIAL" ? (target ?? null) : null,
        });
      } else {
        await trainingService.createSubject(token, {
          ...input,
          ...(subjectForm.description.trim()
            ? { description: subjectForm.description.trim() }
            : {}),
          ...(subjectForm.surface.trim() ? { surface: subjectForm.surface.trim() } : {}),
          ...(subjectForm.sessionType === "TIME_TRIAL" && target !== undefined
            ? { targetTimeMs: target }
            : {}),
        });
      }
      await resource.refresh();
      setSubjectForm(null);
    } catch (error) {
      Alert.alert("Could not save subject", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const editSubject = (subject: ManagerPayload["subjects"][number]) =>
    setSubjectForm({
      id: subject.id,
      name: subject.name,
      description: subject.description ?? "",
      sessionType: subject.sessionType,
      intensity: subject.intensity,
      distance: String(subject.plannedDistanceM),
      duration: String(subject.durationMinutes),
      surface: subject.surface ?? "",
      target: subject.targetTimeMs == null ? "" : String(subject.targetTimeMs),
    });

  const deleteSubject = (subjectId: string, name: string) =>
    Alert.alert(
      "Delete subject?",
      `${name} can only be removed when no plan, class plan, or session uses it.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void (async () => {
              try {
                await trainingService.deleteSubject(token!, subjectId);
                await resource.refresh();
              } catch (error) {
                Alert.alert("Could not delete subject", extractErrorMessage(error));
              }
            })(),
        },
      ],
    );

  const handover = async () => {
    if (!sourceTrainer || !targetTrainer || sourceTrainer === targetTrainer)
      return Alert.alert("Choose trainers", "Choose different source and receiving Head Trainers.");
    setHandoverBusy(true);
    try {
      const result = await usersService.handoverHeadTrainer(token!, sourceTrainer, targetTrainer);
      Alert.alert(
        "Handover complete",
        `${result.barnsMoved} barns, ${result.plansMoved} plans and ${result.classesMoved} active classes were moved.`,
      );
      setSourceTrainer("");
      setTargetTrainer("");
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not hand over training", extractErrorMessage(error));
    } finally {
      setHandoverBusy(false);
    }
  };

  return (
    <Screen
      role="manager"
      title="Training management"
      subtitle="Club subjects, class progress and trainer handover"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      <Chips
        options={["Subjects", "Classes", "Performance", "Handover"]}
        value={tab}
        onChange={setTab}
      />
      {payload && tab === "Subjects" ? (
        <View style={ui.section}>
          <SectionTitle>Club training subjects</SectionTitle>
          <Text style={ui.muted}>
            Only Club Managers can create, edit and delete subjects. The Backend permits LIGHT and
            HEAVY intensity.
          </Text>
          <PrimaryButton
            label={subjectForm ? "Close subject form" : "Add subject"}
            icon={subjectForm ? "close" : "add-circle-outline"}
            onPress={() => setSubjectForm(subjectForm ? null : emptySubject())}
          />
          {subjectForm ? (
            <Panel style={{ gap: 10 }}>
              <Field label="Name">
                <NativeInput
                  value={subjectForm.name}
                  onChangeText={(value) =>
                    setSubjectForm((form) => form && { ...form, name: value })
                  }
                />
              </Field>
              <Field label="Description">
                <NativeInput
                  value={subjectForm.description}
                  onChangeText={(value) =>
                    setSubjectForm((form) => form && { ...form, description: value })
                  }
                  multiline
                />
              </Field>
              <Field label="Session type">
                <Chips
                  options={["REGULAR", "TIME_TRIAL"]}
                  value={subjectForm.sessionType}
                  onChange={(value) =>
                    setSubjectForm(
                      (form) =>
                        form && { ...form, sessionType: value as SubjectForm["sessionType"] },
                    )
                  }
                />
              </Field>
              <Field label="Intensity">
                <Chips
                  options={["LIGHT", "HEAVY"]}
                  value={subjectForm.intensity}
                  onChange={(value) =>
                    setSubjectForm(
                      (form) => form && { ...form, intensity: value as SubjectForm["intensity"] },
                    )
                  }
                />
              </Field>
              <Field label="Planned distance (m)">
                <NativeInput
                  value={subjectForm.distance}
                  onChangeText={(value) =>
                    setSubjectForm((form) => form && { ...form, distance: value })
                  }
                  keyboardType="number-pad"
                />
              </Field>
              <Field label="Session duration (15–480 minutes)">
                <NativeInput
                  value={subjectForm.duration}
                  onChangeText={(value) =>
                    setSubjectForm((form) => form && { ...form, duration: value })
                  }
                  keyboardType="number-pad"
                />
              </Field>
              <Field label="Track surface (optional)">
                <NativeInput
                  value={subjectForm.surface}
                  onChangeText={(value) =>
                    setSubjectForm((form) => form && { ...form, surface: value })
                  }
                />
              </Field>
              {subjectForm.sessionType === "TIME_TRIAL" ? (
                <Field label="Target time (milliseconds, optional)">
                  <NativeInput
                    value={subjectForm.target}
                    onChangeText={(value) =>
                      setSubjectForm((form) => form && { ...form, target: value })
                    }
                    keyboardType="number-pad"
                  />
                </Field>
              ) : null}
              <PrimaryButton
                label={saving ? "Saving…" : subjectForm.id ? "Save subject" : "Create subject"}
                disabled={saving}
                onPress={() => void saveSubject()}
              />
            </Panel>
          ) : null}
          {payload.subjects.length ? (
            payload.subjects.map((subject) => (
              <Panel key={subject.id} style={{ gap: 7 }}>
                <Text style={ui.value}>{subject.name}</Text>
                <Text style={ui.muted}>
                  {subject.sessionType.replaceAll("_", " ")} · {subject.intensity} ·{" "}
                  {subject.durationMinutes} min · {subject.plannedDistanceM.toLocaleString()} m
                </Text>
                {subject.description ? <Text style={ui.muted}>{subject.description}</Text> : null}
                <Text style={ui.label}>
                  {subject.surface ?? "No surface"}
                  {subject.targetTimeMs ? ` · target ${subject.targetTimeMs} ms` : ""}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <SecondaryButton
                    label="Edit"
                    icon="create-outline"
                    style={{ flex: 1 }}
                    onPress={() => editSubject(subject)}
                  />
                  <SecondaryButton
                    label="Delete"
                    icon="trash-outline"
                    style={{ flex: 1 }}
                    onPress={() => deleteSubject(subject.id, subject.name)}
                  />
                </View>
              </Panel>
            ))
          ) : (
            <Panel>
              <Text style={ui.muted}>No training subjects registered.</Text>
            </Panel>
          )}
        </View>
      ) : null}

      {payload && tab === "Classes" ? (
        <View style={ui.section}>
          <SectionTitle>Training class report</SectionTitle>
          <View style={ui.row}>
            <Text style={ui.label}>PLANS</Text>
            <Text style={ui.value}>{payload.plans.length}</Text>
            <Text style={ui.label}>CLASSES</Text>
            <Text style={ui.value}>{payload.classes.length}</Text>
          </View>
          {payload.plans.map((plan) => (
            <Panel key={plan.id}>
              <Text style={ui.value}>{plan.name}</Text>
              <Text style={ui.muted}>
                {plan.totalWeeks} weeks · {plan.minTotalMinutes} minimum minutes ·{" "}
                {plan.headTrainerId}
              </Text>
            </Panel>
          ))}
          {payload.classes.map(({ trainingClass, sessions, horses, progress }) => (
            <Panel key={trainingClass.id} style={{ gap: 7 }}>
              <View style={ui.row}>
                <Text style={[ui.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                  {trainingClass.code} · {trainingClass.name}
                </Text>
                <Text style={[ui.label, { flexShrink: 0 }]}>{trainingClass.status}</Text>
              </View>
              <Text style={ui.muted}>
                {formatDate(trainingClass.startDate)} – {formatDate(trainingClass.endDate)} · plan{" "}
                {payload.plans.find((plan) => plan.id === trainingClass.planId)?.name ??
                  trainingClass.planId}
              </Text>
              <Text style={ui.label}>
                {horses.filter((horse) => horse.status === "ACTIVE").length} active horses ·{" "}
                {sessions.length} sessions ·{" "}
                {sessions.filter((session) => session.status === "COMPLETED").length} completed
              </Text>
              <Text style={ui.label}>
                Class plan minimum {progress.minTotalMinutes} min · scheduled{" "}
                {progress.scheduledMinutes} min
              </Text>
              <Text style={ui.label}>
                {
                  progress.weeks.filter((week) =>
                    week.subjects.some(
                      (subject) => subject.scheduledSessions < subject.minSessions,
                    ),
                  ).length
                }{" "}
                weeks have a subject below the schedule minimum
              </Text>
              {sessions.slice(0, 3).map((session) => (
                <Text key={session.id} style={ui.muted}>
                  {formatDateTime(session.scheduledStartAt)} · {session.name} · {session.status}
                </Text>
              ))}
            </Panel>
          ))}
          {payload.classes.length === 0 ? (
            <Panel>
              <Text style={ui.muted}>No training classes are available.</Text>
            </Panel>
          ) : null}
        </View>
      ) : null}

      {payload && tab === "Handover" ? (
        <View style={ui.section}>
          <SectionTitle>Head Trainer handover</SectionTitle>
          <Panel style={{ gap: 8 }}>
            <Text style={ui.muted}>
              The Backend transfers barns, plans and unfinished classes together. This cannot be
              undone from the mobile app.
            </Text>
            <Text style={ui.label}>Current Head Trainer</Text>
            {trainers.map((trainer) => (
              <Pressable key={`from-${trainer.id}`} onPress={() => setSourceTrainer(trainer.id)}>
                <Panel
                  style={{
                    padding: 12,
                    borderColor: sourceTrainer === trainer.id ? colors.primary : colors.border,
                  }}
                >
                  <Text style={ui.value}>
                    {sourceTrainer === trainer.id ? "✓ " : ""}
                    {trainer.fullName}
                  </Text>
                  <Text style={ui.label}>{trainer.email}</Text>
                </Panel>
              </Pressable>
            ))}
            <Text style={ui.label}>Receiving Head Trainer</Text>
            {trainers
              .filter((trainer) => trainer.id !== sourceTrainer)
              .map((trainer) => (
                <Pressable key={`to-${trainer.id}`} onPress={() => setTargetTrainer(trainer.id)}>
                  <Panel
                    style={{
                      padding: 12,
                      borderColor: targetTrainer === trainer.id ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={ui.value}>
                      {targetTrainer === trainer.id ? "✓ " : ""}
                      {trainer.fullName}
                    </Text>
                    <Text style={ui.label}>{trainer.email}</Text>
                  </Panel>
                </Pressable>
              ))}
            <PrimaryButton
              label={handoverBusy ? "Transferring…" : "Transfer Head Trainer responsibilities"}
              icon="swap-horizontal"
              disabled={handoverBusy || !sourceTrainer || !targetTrainer}
              onPress={() =>
                Alert.alert(
                  "Confirm handover",
                  "Transfer all barns, plans and unfinished classes from this Head Trainer?",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Transfer", style: "destructive", onPress: () => void handover() },
                  ],
                )
              }
            />
          </Panel>
        </View>
      ) : null}
      {payload && tab === "Performance" ? (
        <View style={ui.section}>
          <SectionTitle>Horse performance overview</SectionTitle>
          <Text style={ui.muted}>
            Latest performance summaries for horses enrolled in training classes. The Backend does
            not provide a single club-wide report endpoint, so this view combines its per-horse
            summary endpoint.
          </Text>
          {payload.performanceRows.length ? (
            payload.performanceRows.map(({ horseId, horseName, summary }) => (
              <Pressable
                key={horseId}
                onPress={() => router.push(`/manager/horse/${horseId}?tab=Performance` as Href)}
              >
                <Panel style={{ gap: 6 }}>
                  <View style={ui.row}>
                    <Text style={[ui.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                      {horseName}
                    </Text>
                    <Text style={[ui.label, { flexShrink: 0 }]}>
                      {summary ? `${summary.sessionsTracked} sessions` : "No performance data"}
                    </Text>
                  </View>
                  {summary?.latestMetric ? (
                    <Text style={ui.muted}>
                      Latest {formatDateTime(summary.latestMetric.recordedAt)} ·{" "}
                      {summary.latestMetric.heartRateBpm} bpm ·{" "}
                      {(summary.latestMetric.speedMps * 3.6).toFixed(1)} km/h ·{" "}
                      {summary.latestMetric.alertLevel}
                    </Text>
                  ) : null}
                  {summary?.latestEvaluation ? (
                    <Text style={ui.label}>
                      Latest evaluation {summary.latestEvaluation.score}/10
                      {summary.latestEvaluation.comment
                        ? ` · ${summary.latestEvaluation.comment}`
                        : ""}
                    </Text>
                  ) : null}
                </Panel>
              </Pressable>
            ))
          ) : (
            <Panel>
              <Text style={ui.muted}>There are no enrolled horses to report on yet.</Text>
            </Panel>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await map(items[index]);
      }
    }),
  );
  return results;
}
