import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
import {
  trainingService,
  type EnrollableHorseDto,
  type TrainingSessionInput,
} from "@/services/training.service";
import {
  addDaysToClubDate,
  classWeekNumber,
  clubDateTimeToIso,
  defaultClubDateTime,
} from "@/features/training/training-utils";
import { formatDate, formatDateTime } from "@/utils/formatters";
import { extractErrorMessage } from "@/utils/errorHandler";

export default function TrainingClassDetail() {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const classId = Array.isArray(id) ? id[0] : id;
  const { token } = useAuth();
  const [tab, setTab] = useState("Overview");
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("06:00");
  const [repeatWeeks, setRepeatWeeks] = useState("1");
  const [subjectId, setSubjectId] = useState("");
  const [location, setLocation] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [enrollable, setEnrollable] = useState<EnrollableHorseDto[] | null>(null);
  const [loadingEnrollable, setLoadingEnrollable] = useState(false);
  const [editClass, setEditClass] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editCapacity, setEditCapacity] = useState("10");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [pending, setPending] = useState("");

  const load = useCallback(async () => {
    const [trainingClass, plan, progress, enrollments, sessions] = await Promise.all([
      trainingService.getClass(token!, classId),
      trainingService.getClassPlan(token!, classId),
      trainingService.getClassProgress(token!, classId),
      trainingService.listEnrollments(token!, classId),
      trainingService.listClassSessions(token!, classId),
    ]);
    return { trainingClass, plan, progress, enrollments, sessions };
  }, [token, classId]);
  const resource = useApiResource(load, Boolean(token && classId));
  const payload = resource.data;
  const currentDate = sessionDate || payload?.trainingClass.startDate || defaultClubDateTime().date;
  const weekNumber = payload ? classWeekNumber(payload.trainingClass.startDate, currentDate) : null;
  const activePhase = payload?.plan.phases.find((phase) => {
    const firstWeek =
      payload.plan.phases.slice(0, phase.position - 1).reduce((sum, item) => sum + item.weeks, 0) +
      1;
    return weekNumber !== null && weekNumber >= firstWeek && weekNumber < firstWeek + phase.weeks;
  });
  const allowedSubjects = activePhase?.subjects ?? [];
  const effectiveSubjectId = allowedSubjects.some((item) => item.subject.id === subjectId)
    ? subjectId
    : allowedSubjects[0]?.subject.id;
  const selectedSubject = allowedSubjects.find(
    (item) => item.subject.id === effectiveSubjectId,
  )?.subject;

  const perform = async (key: string, action: () => Promise<unknown>) => {
    if (!token) return;
    setPending(key);
    try {
      await action();
      setEnrollable(null);
      await resource.refresh();
    } catch (error) {
      Alert.alert("Action failed", extractErrorMessage(error));
    } finally {
      setPending("");
    }
  };

  const loadEnrollable = async () => {
    setLoadingEnrollable(true);
    try {
      setEnrollable(await trainingService.listEnrollableHorses(token!, classId));
    } catch (error) {
      Alert.alert("Could not load horses", extractErrorMessage(error));
    } finally {
      setLoadingEnrollable(false);
    }
  };

  const addSessions = async () => {
    if (!selectedSubject || !payload)
      return Alert.alert(
        "Choose a valid subject",
        "This subject must be part of the class phase covering the chosen date.",
      );
    const start = clubDateTimeToIso(currentDate, sessionTime);
    const count = Number(repeatWeeks);
    if (!start || !Number.isInteger(count) || count < 1 || count > 100)
      return Alert.alert(
        "Check the schedule",
        "Enter a valid club date, time, and repeat count from 1 to 100.",
      );
    const starts: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const date = addDaysToClubDate(currentDate, 7 * index);
      const week = classWeekNumber(payload.trainingClass.startDate, date);
      const phase = payload.plan.phases.find((item) => {
        const firstWeek =
          payload.plan.phases
            .slice(0, item.position - 1)
            .reduce((sum, current) => sum + current.weeks, 0) + 1;
        return week !== null && week >= firstWeek && week < firstWeek + item.weeks;
      });
      if (!phase?.subjects.some((item) => item.subject.id === selectedSubject.id))
        return Alert.alert(
          "Subject not available",
          `This subject is not part of the class plan for ${date}. Reduce the repeat count or choose another subject.`,
        );
      const startAt = clubDateTimeToIso(date, sessionTime);
      if (!startAt) return Alert.alert("Invalid schedule", `Check the time for ${date}.`);
      starts.push(startAt);
    }
    const sessions: TrainingSessionInput[] = starts.map((scheduledStartAt) => {
      const scheduledEndAt = new Date(
        new Date(scheduledStartAt).getTime() + selectedSubject.durationMinutes * 60_000,
      ).toISOString();
      return {
        name: selectedSubject.name,
        subjectId: selectedSubject.id,
        sessionType: selectedSubject.sessionType,
        intensity: selectedSubject.intensity,
        plannedDistanceM: selectedSubject.plannedDistanceM,
        scheduledStartAt,
        scheduledEndAt,
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(selectedSubject.surface ? { surface: selectedSubject.surface } : {}),
        ...(sessionNotes.trim() ? { notes: sessionNotes.trim() } : {}),
        ...(selectedSubject.sessionType === "TIME_TRIAL"
          ? { targetTimeMs: selectedSubject.targetTimeMs }
          : {}),
      };
    });
    await perform("sessions", async () => {
      if (sessions.length === 1) await trainingService.createSession(token!, classId, sessions[0]);
      else await trainingService.createSessions(token!, classId, sessions);
      setShowSessionForm(false);
      setRepeatWeeks("1");
    });
  };

  const saveClass = async () => {
    const maxHorses = Number(editCapacity);
    if (
      !editName.trim() ||
      !editCode.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(editStartDate) ||
      !Number.isInteger(maxHorses) ||
      maxHorses < 1
    )
      return Alert.alert(
        "Check class information",
        "Enter a class code, name, valid start date and positive capacity.",
      );
    await perform("class", () =>
      trainingService.updateClass(token!, classId, {
        name: editName.trim(),
        code: editCode.trim(),
        startDate: editStartDate,
        maxHorses,
      }),
    );
    setEditClass(false);
  };

  const cancelClass = async () => {
    if (!cancelReason.trim())
      return Alert.alert(
        "Cancellation reason required",
        "Enter a reason before cancelling the class.",
      );
    await perform("cancel", () =>
      trainingService.setClassStatus(token!, classId, {
        status: "CANCELLED",
        cancelReason: cancelReason.trim(),
      }),
    );
    setShowCancelForm(false);
  };

  return (
    <Screen
      role="trainer"
      title={payload?.trainingClass.name ?? "Training class"}
      subtitle={payload?.trainingClass.code ?? "Class details"}
      back
      fallbackHref="/trainer/training"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {payload ? (
        <>
          <Chips options={["Overview", "Horses", "Sessions"]} value={tab} onChange={setTab} />
          {tab === "Overview" ? (
            <>
              <Panel style={{ gap: 8 }}>
                <View style={ui.row}>
                  <Text style={[ui.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                    {payload.trainingClass.status.replaceAll("_", " ")}
                  </Text>
                  <Text style={[ui.label, { flexShrink: 0 }]}>
                    {payload.trainingClass.raceAptitude ?? "All race aptitudes"}
                  </Text>
                </View>
                <Text style={ui.muted}>
                  {payload.trainingClass.description || "No class description."}
                </Text>
                <Text style={ui.muted}>
                  {formatDate(payload.trainingClass.startDate)} →{" "}
                  {formatDate(payload.trainingClass.endDate)}
                </Text>
                <Text style={ui.label}>
                  {payload.enrollments.filter((item) => item.status === "ACTIVE").length} active
                  horses · capacity {payload.trainingClass.maxHorses}
                </Text>
                <Text style={ui.label}>
                  Class plan minimum: {payload.progress.minTotalMinutes} min · scheduled:{" "}
                  {payload.progress.scheduledMinutes} min
                </Text>
              </Panel>
              <View style={ui.row}>
                {payload.trainingClass.status === "ACTIVE" ? (
                  <>
                    <SecondaryButton
                      label="Edit class"
                      icon="create-outline"
                      style={{ flex: 1 }}
                      onPress={() => {
                        if (editClass) {
                          setEditClass(false);
                          return;
                        }
                        setEditName(payload.trainingClass.name);
                        setEditCode(payload.trainingClass.code);
                        setEditStartDate(payload.trainingClass.startDate);
                        setEditCapacity(String(payload.trainingClass.maxHorses));
                        setEditClass(true);
                      }}
                    />
                    <SecondaryButton
                      label="Complete class"
                      icon="checkmark-done-outline"
                      style={{ flex: 1 }}
                      disabled={pending !== ""}
                      onPress={() =>
                        Alert.alert(
                          "Complete class?",
                          "The Backend will close this class; future session changes will no longer be available.",
                          [
                            { text: "Keep active", style: "cancel" },
                            {
                              text: "Complete",
                              onPress: () =>
                                void perform("complete", () =>
                                  trainingService.setClassStatus(token!, classId, {
                                    status: "COMPLETED",
                                  }),
                                ),
                            },
                          ],
                        )
                      }
                    />
                  </>
                ) : null}
              </View>
              {editClass ? (
                <Panel style={{ gap: 10 }}>
                  <Field label="Class code">
                    <NativeInput value={editCode} onChangeText={setEditCode} />
                  </Field>
                  <Field label="Class name">
                    <NativeInput value={editName} onChangeText={setEditName} />
                  </Field>
                  <Field label="Start date (YYYY-MM-DD)">
                    <NativeInput value={editStartDate} onChangeText={setEditStartDate} />
                  </Field>
                  <Field label="Maximum horses">
                    <NativeInput
                      value={editCapacity}
                      onChangeText={setEditCapacity}
                      keyboardType="number-pad"
                    />
                  </Field>
                  <PrimaryButton
                    label={pending === "class" ? "Saving…" : "Save class"}
                    disabled={pending !== ""}
                    onPress={() => void saveClass()}
                  />
                </Panel>
              ) : null}
              {payload.trainingClass.status === "ACTIVE" ? (
                <>
                  <SecondaryButton
                    label="Cancel class"
                    icon="close-circle-outline"
                    onPress={() => setShowCancelForm((value) => !value)}
                  />
                  {showCancelForm ? (
                    <Panel style={{ gap: 10 }}>
                      <Field label="Cancellation reason (required)">
                        <NativeInput
                          value={cancelReason}
                          onChangeText={setCancelReason}
                          multiline
                          placeholder="Why is this class being cancelled?"
                        />
                      </Field>
                      <PrimaryButton
                        label={pending === "cancel" ? "Cancelling…" : "Confirm cancellation"}
                        disabled={pending !== ""}
                        onPress={() => void cancelClass()}
                      />
                    </Panel>
                  ) : null}
                </>
              ) : null}
              <View style={ui.section}>
                <SectionTitle>Copied plan phases</SectionTitle>
                {payload.plan.phases.map((phase) => (
                  <Panel key={phase.position} style={{ gap: 5 }}>
                    <Text style={ui.value}>
                      Phase {phase.position} · {phase.weeks} weeks
                    </Text>
                    <Text style={ui.muted}>
                      {formatDate(phase.startDate)} – {formatDate(phase.endDate)} ·{" "}
                      {phase.minTotalMinutes} min minimum
                    </Text>
                    {phase.subjects.map((item) => (
                      <Text key={item.subject.id} style={ui.label}>
                        {item.subject.name} · {item.minSessionsPerWeek} sessions/week ·{" "}
                        {item.subject.durationMinutes} min/session
                      </Text>
                    ))}
                  </Panel>
                ))}
              </View>
              <View style={ui.section}>
                <SectionTitle>Schedule progress</SectionTitle>
                {payload.progress.weeks.map((week) => (
                  <Panel key={week.week} style={{ gap: 5 }}>
                    <Text style={ui.value}>
                      Week {week.week} · Phase {week.phasePosition}
                    </Text>
                    <Text style={ui.muted}>
                      {formatDate(week.startDate)} – {formatDate(week.endDate)}
                    </Text>
                    {week.subjects.map((subject) => (
                      <Text key={subject.subjectId} style={ui.label}>
                        {subject.subjectName}: {subject.scheduledSessions}/{subject.minSessions}{" "}
                        sessions
                      </Text>
                    ))}
                  </Panel>
                ))}
              </View>
            </>
          ) : null}

          {tab === "Horses" ? (
            <View style={ui.section}>
              <SectionTitle>Enrolled horses</SectionTitle>
              {payload.trainingClass.status === "ACTIVE" ? (
                <PrimaryButton
                  label="Add eligible horses"
                  icon="person-add-outline"
                  disabled={loadingEnrollable || pending !== ""}
                  onPress={() => void loadEnrollable()}
                />
              ) : null}
              {payload.enrollments.length ? (
                payload.enrollments.map((horse) => (
                  <Panel key={horse.id} style={{ gap: 5 }}>
                    <View style={ui.row}>
                      <Text style={[ui.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                        {horse.horseName}
                      </Text>
                      <Text style={[ui.label, { flexShrink: 0 }]}>{horse.status}</Text>
                    </View>
                    <Text style={ui.muted}>
                      Enrolled {formatDateTime(horse.enrolledAt)}
                      {horse.leftAt ? ` · left ${formatDateTime(horse.leftAt)}` : ""}
                    </Text>
                    {horse.status === "ACTIVE" && payload.trainingClass.status === "ACTIVE" ? (
                      <SecondaryButton
                        label="Remove from class"
                        icon="remove-circle-outline"
                        onPress={() =>
                          Alert.alert(
                            "Horse leaves this class?",
                            `${horse.horseName} will not be included in future class sessions.`,
                            [
                              { text: "Keep", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () =>
                                  void perform(`leave:${horse.id}`, () =>
                                    trainingService.leaveEnrollment(token!, horse.id),
                                  ),
                              },
                            ],
                          )
                        }
                      />
                    ) : null}
                  </Panel>
                ))
              ) : (
                <AsyncStateView
                  isLoading={false}
                  error={null}
                  onRetry={() => void resource.refresh()}
                  empty
                  emptyLabel="No horses are enrolled in this class."
                />
              )}
              {enrollable ? (
                <View style={ui.section}>
                  <SectionTitle>Eligible now ({enrollable.length})</SectionTitle>
                  {enrollable.length ? (
                    enrollable.map((horse) => (
                      <Panel key={horse.horseId} style={{ gap: 8 }}>
                        <Text style={ui.value}>{horse.horseName}</Text>
                        <Text style={ui.label}>
                          {horse.horsePhotoUrl ? "Horse photo available" : "No profile photo"}
                        </Text>
                        <PrimaryButton
                          label={pending === `enroll:${horse.horseId}` ? "Adding…" : "Enroll horse"}
                          disabled={pending !== ""}
                          onPress={() =>
                            void perform(`enroll:${horse.horseId}`, () =>
                              trainingService.enrollHorse(token!, classId, horse.horseId),
                            )
                          }
                        />
                      </Panel>
                    ))
                  ) : (
                    <Panel>
                      <Text style={ui.muted}>
                        No horses can be enrolled under current class schedule and eligibility
                        rules.
                      </Text>
                    </Panel>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {tab === "Sessions" ? (
            <View style={ui.section}>
              <SectionTitle>Sessions ({payload.sessions.length})</SectionTitle>
              {payload.trainingClass.status === "ACTIVE" ? (
                <PrimaryButton
                  label={showSessionForm ? "Close session form" : "Schedule session"}
                  icon={showSessionForm ? "close" : "calendar-outline"}
                  onPress={() => setShowSessionForm((value) => !value)}
                />
              ) : null}
              {showSessionForm && payload.trainingClass.status === "ACTIVE" ? (
                <Panel style={{ gap: 12 }}>
                  <Text style={ui.value}>Add a session from this class phase</Text>
                  <Field label="Session date (club calendar, YYYY-MM-DD)">
                    <NativeInput value={currentDate} onChangeText={setSessionDate} />
                  </Field>
                  <Field label="Start time (club time, HH:mm)">
                    <NativeInput
                      value={sessionTime}
                      onChangeText={setSessionTime}
                      placeholder="06:00"
                    />
                  </Field>
                  <Field label="Subject in this phase">
                    <View style={{ gap: 8 }}>
                      {allowedSubjects.map((item) => (
                        <Pressable
                          key={item.subject.id}
                          onPress={() => setSubjectId(item.subject.id)}
                        >
                          <Panel
                            style={{
                              borderColor:
                                effectiveSubjectId === item.subject.id
                                  ? colors.primary
                                  : colors.border,
                              backgroundColor:
                                effectiveSubjectId === item.subject.id
                                  ? colors.fitSoft
                                  : colors.surface,
                            }}
                          >
                            <Text style={ui.value}>{item.subject.name}</Text>
                            <Text style={ui.muted}>
                              {item.subject.intensity} · {item.subject.durationMinutes} min ·{" "}
                              {item.subject.plannedDistanceM} m · min {item.minSessionsPerWeek}/week
                            </Text>
                          </Panel>
                        </Pressable>
                      ))}
                    </View>
                  </Field>
                  {!allowedSubjects.length ? (
                    <Text style={{ color: colors.destructive }}>
                      No plan phase covers this date.
                    </Text>
                  ) : null}
                  <Field label="Repeat every week (1–100 sessions)">
                    <NativeInput
                      value={repeatWeeks}
                      onChangeText={setRepeatWeeks}
                      keyboardType="number-pad"
                    />
                  </Field>
                  <Field label="Location (optional)">
                    <NativeInput value={location} onChangeText={setLocation} />
                  </Field>
                  <Field label="Notes (optional)">
                    <NativeInput value={sessionNotes} onChangeText={setSessionNotes} multiline />
                  </Field>
                  {selectedSubject?.sessionType === "TIME_TRIAL" ? (
                    <Text style={ui.muted}>
                      This trial subject’s distance and target are copied into each scheduled
                      session.
                    </Text>
                  ) : null}
                  <Text style={ui.label}>
                    The Backend checks class dates, phase subject, overlaps, daily horse limits and
                    rest gaps; all repeated sessions are saved together or none are saved.
                  </Text>
                  <PrimaryButton
                    label={
                      pending === "sessions"
                        ? "Scheduling…"
                        : repeatWeeks === "1"
                          ? "Schedule session"
                          : "Schedule repeated sessions"
                    }
                    disabled={pending !== "" || !allowedSubjects.length}
                    onPress={() => void addSessions()}
                  />
                </Panel>
              ) : null}
              {payload.sessions.length ? (
                payload.sessions.map((session) => (
                  <Pressable
                    key={session.id}
                    onPress={() => router.push(`/trainer/plan/${classId}/session/${session.id}`)}
                  >
                    <Panel style={{ gap: 5 }}>
                      <View style={ui.row}>
                        <Text style={[ui.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                          {session.name}
                        </Text>
                        <Text style={[ui.label, { flexShrink: 0 }]}>
                          {session.status.replaceAll("_", " ")}
                        </Text>
                      </View>
                      <Text style={ui.muted}>
                        {formatDateTime(session.scheduledStartAt)} →{" "}
                        {formatDateTime(session.scheduledEndAt)}
                      </Text>
                      <Text style={ui.label}>
                        {session.sessionType.replaceAll("_", " ")} · {session.intensity} ·{" "}
                        {session.plannedDistanceM} m
                      </Text>
                      {session.cancelReason ? (
                        <Text style={{ ...ui.muted, color: colors.destructive }}>
                          Cancelled: {session.cancelReason}
                        </Text>
                      ) : null}
                    </Panel>
                  </Pressable>
                ))
              ) : (
                <AsyncStateView
                  isLoading={false}
                  error={null}
                  onRetry={() => void resource.refresh()}
                  empty
                  emptyLabel="No sessions yet. Add a session after creating the class."
                />
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
