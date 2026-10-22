import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { trainingService, type TrainingClassDto } from "@/services/training.service";
import { performanceService } from "@/services/performance.service";
import { usersService } from "@/services/users.service";
import type { StaffDto } from "@/adapters/staff.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDate, formatDateTime, formatEnum } from "@/utils/formatters";
import { radius, space } from "@/config/theme";

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
  distance: "1600",
  duration: "60",
  surface: "",
  target: "",
});

type TrainingTab = "Môn học" | "Lớp huấn luyện" | "Hiệu suất" | "Bàn giao";

export default function ManagerTraining() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const ui = getUiStyles(colors);
  const { token } = useAuth();

  const [tab, setTab] = useState<TrainingTab>("Môn học");
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL");
  const [subjectSearch, setSubjectSearch] = useState("");
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
    for (const { horses } of details) {
      for (const horse of horses) enrolledHorses.set(horse.horseId, horse.horseName);
    }
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

  const subjects = payload?.subjects;
  // Filtered subjects
  const filteredSubjects = useMemo(() => {
    if (!subjects) return [];
    const query = subjectSearch.trim().toLowerCase();
    return subjects.filter((s) => {
      if (
        query &&
        !s.name.toLowerCase().includes(query) &&
        !(s.surface ?? "").toLowerCase().includes(query)
      ) {
        return false;
      }
      if (subjectFilter === "TRIAL") return s.sessionType === "TIME_TRIAL";
      if (subjectFilter === "LIGHT") return s.intensity === "LIGHT" && s.sessionType === "REGULAR";
      if (subjectFilter === "HEAVY") return s.intensity === "HEAVY" && s.sessionType === "REGULAR";
      return true;
    });
  }, [subjects, subjectSearch, subjectFilter]);

  // Performance calculations
  const performanceStats = useMemo(() => {
    const rows = payload?.performanceRows ?? [];
    const totalHorses = rows.length;
    let totalSessions = 0;
    let scoreSum = 0;
    let scoredCount = 0;
    for (const row of rows) {
      if (row.summary) {
        totalSessions += row.summary.sessionsTracked ?? 0;
        if (row.summary.latestEvaluation?.score) {
          scoreSum += row.summary.latestEvaluation.score;
          scoredCount++;
        }
      }
    }
    const avgScore = scoredCount > 0 ? (scoreSum / scoredCount).toFixed(1) : "—";
    return { totalHorses, totalSessions, avgScore };
  }, [payload?.performanceRows]);

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
        t("Check subject details"),
        t(
          "Name is required; distance must be 0–20,000 m (over 0 for trials), duration 15–480 min, and trial target time must be 1–3,600,000 ms.",
        ),
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
          description: subjectForm.description.trim() || undefined,
          surface: subjectForm.surface.trim() || undefined,
          targetTimeMs: subjectForm.sessionType === "TIME_TRIAL" ? target : undefined,
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
      Alert.alert(t("Action failed"), extractErrorMessage(error));
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
      t("Delete subject?"),
      `${name} ${t("can only be removed when no plan, class plan, or session uses it.")}`,
      [
        { text: t("Keep"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: () =>
            void (async () => {
              try {
                await trainingService.deleteSubject(token!, subjectId);
                await resource.refresh();
              } catch (error) {
                Alert.alert(t("Action failed"), extractErrorMessage(error));
              }
            })(),
        },
      ],
    );

  const handover = async () => {
    if (!sourceTrainer || !targetTrainer || sourceTrainer === targetTrainer) {
      return Alert.alert(
        t("Choose trainers"),
        t("Choose different source and receiving Head Trainers."),
      );
    }
    setHandoverBusy(true);
    try {
      const result = await usersService.handoverHeadTrainer(token!, sourceTrainer, targetTrainer);
      Alert.alert(
        t("Handover complete"),
        `${result.barnsMoved} ${t("barns")}, ${result.plansMoved} ${t("active plans")} · ${result.classesMoved} ${t("active classes")}`,
      );
      setSourceTrainer("");
      setTargetTrainer("");
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Action failed"), extractErrorMessage(error));
    } finally {
      setHandoverBusy(false);
    }
  };

  const sourceTrainerObj = trainers.find((tr) => tr.id === sourceTrainer);
  const targetTrainerObj = trainers.find((tr) => tr.id === targetTrainer);

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

      {/* Primary 4 Tabs in Natural Vietnamese */}
      <View style={styles.tabBarContainer}>
        {(["Môn học", "Lớp huấn luyện", "Hiệu suất", "Bàn giao"] as TrainingTab[]).map(
          (tabName) => {
            const isActive = tab === tabName;
            return (
              <Pressable
                key={tabName}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => setTab(tabName)}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
              >
                <Text style={[styles.tabItemText, isActive && styles.tabItemTextActive]}>
                  {tabName}
                </Text>
              </Pressable>
            );
          },
        )}
      </View>

      {/* TAB 1: MÔN HỌC */}
      {payload && tab === "Môn học" ? (
        <View style={ui.section}>
          <View style={ui.row}>
            <SectionTitle>{t("Club training subjects")}</SectionTitle>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {payload.subjects.length} {t("Môn học")}
              </Text>
            </View>
          </View>

          {/* Action button to open Create/Edit Form */}
          <PrimaryButton
            label={subjectForm ? t("Close subject form") : t("Add subject")}
            icon={subjectForm ? "close" : "add-circle-outline"}
            onPress={() => setSubjectForm(subjectForm ? null : emptySubject())}
          />

          {/* Form: Thêm / Sửa môn học */}
          {subjectForm ? (
            <Panel style={{ gap: space.md }}>
              <Text style={styles.formSectionTitle}>
                {subjectForm.id ? t("Edit subject") : t("Add subject")}
              </Text>

              {/* Group 1: Thông tin cơ bản */}
              <View style={styles.formGroup}>
                <Text style={styles.groupHeading}>{t("Basic information")}</Text>
                <Field label={t("Subject name")}>
                  <NativeInput
                    value={subjectForm.name}
                    onChangeText={(value) =>
                      setSubjectForm((form) => form && { ...form, name: value })
                    }
                    placeholder={t("e.g. 800m sprint")}
                  />
                </Field>
                <Field label={t("Description")}>
                  <NativeInput
                    value={subjectForm.description}
                    onChangeText={(value) =>
                      setSubjectForm((form) => form && { ...form, description: value })
                    }
                    placeholder={t("Training goals, technical instructions…")}
                    multiline
                  />
                </Field>
              </View>

              {/* Group 2: Cấu hình tập luyện */}
              <View style={styles.formGroup}>
                <Text style={styles.groupHeading}>{t("Training configuration")}</Text>
                <Field label={t("Session type")}>
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
                <Field label={t("Intensity")}>
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
              </View>

              {/* Group 3: Thông số kỹ thuật */}
              <View style={styles.formGroup}>
                <Text style={styles.groupHeading}>{t("Technical specifications")}</Text>
                <Field label={t("Planned distance (m)")}>
                  <NativeInput
                    value={subjectForm.distance}
                    onChangeText={(value) =>
                      setSubjectForm((form) => form && { ...form, distance: value })
                    }
                    keyboardType="number-pad"
                    placeholder="1600"
                  />
                </Field>
                <Field label={t("Session duration (15–480 minutes)")}>
                  <NativeInput
                    value={subjectForm.duration}
                    onChangeText={(value) =>
                      setSubjectForm((form) => form && { ...form, duration: value })
                    }
                    keyboardType="number-pad"
                    placeholder="60"
                  />
                </Field>
                <Field label={t("Track surface (optional)")}>
                  <NativeInput
                    value={subjectForm.surface}
                    onChangeText={(value) =>
                      setSubjectForm((form) => form && { ...form, surface: value })
                    }
                    placeholder={t("e.g. Dirt track, Turf…")}
                  />
                </Field>
                {subjectForm.sessionType === "TIME_TRIAL" ? (
                  <Field label={t("Target time (milliseconds, optional)")}>
                    <NativeInput
                      value={subjectForm.target}
                      onChangeText={(value) =>
                        setSubjectForm((form) => form && { ...form, target: value })
                      }
                      keyboardType="number-pad"
                      placeholder="105000"
                    />
                  </Field>
                ) : null}
              </View>

              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <PrimaryButton
                  label={
                    saving ? t("Saving…") : subjectForm.id ? t("Save subject") : t("Create subject")
                  }
                  disabled={saving || !subjectForm.name.trim()}
                  onPress={() => void saveSubject()}
                />
                <SecondaryButton
                  label={t("Cancel")}
                  disabled={saving}
                  onPress={() => setSubjectForm(null)}
                />
              </View>
            </Panel>
          ) : null}

          {/* Search & Filter Bar */}
          <View style={styles.searchFilterRow}>
            <View style={{ flex: 1 }}>
              <NativeInput
                value={subjectSearch}
                onChangeText={setSubjectSearch}
                placeholder={t("Search subjects…")}
              />
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.xs }}
          >
            {[
              { id: "ALL", label: t("All intensities") },
              { id: "LIGHT", label: t("Light") },
              { id: "HEAVY", label: t("Heavy") },
              { id: "TRIAL", label: t("Time trial") },
            ].map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setSubjectFilter(f.id)}
                style={[styles.filterPill, subjectFilter === f.id && styles.filterPillActive]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    subjectFilter === f.id && styles.filterPillTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Subjects List */}
          {filteredSubjects.length ? (
            filteredSubjects.map((subject) => {
              const isTrial = subject.sessionType === "TIME_TRIAL";
              return (
                <Panel key={subject.id} style={{ gap: space.sm }}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={styles.subjectName} numberOfLines={1}>
                        {subject.name}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <View
                          style={[
                            styles.typeBadge,
                            isTrial ? styles.trialBadge : styles.regularBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeBadgeText,
                              isTrial ? { color: colors.monitor } : { color: colors.primary },
                            ]}
                          >
                            {isTrial ? t("Time trial") : t("Regular")}
                          </Text>
                        </View>
                        <View style={styles.intensityBadge}>
                          <Text style={styles.intensityBadgeText}>
                            {subject.intensity === "HEAVY" ? t("Heavy") : t("Light")}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Metrics Specs Row */}
                  <View style={styles.specsRow}>
                    <View style={styles.specItem}>
                      <Ionicons name="navigate-outline" size={13} color={colors.mutedForeground} />
                      <Text style={styles.specText}>
                        {subject.plannedDistanceM.toLocaleString()} m
                      </Text>
                    </View>
                    <View style={styles.specItem}>
                      <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
                      <Text style={styles.specText}>
                        {subject.durationMinutes} {t("min")}
                      </Text>
                    </View>
                    {subject.surface ? (
                      <View style={styles.specItem}>
                        <Ionicons
                          name="footsteps-outline"
                          size={13}
                          color={colors.mutedForeground}
                        />
                        <Text style={styles.specText}>{subject.surface}</Text>
                      </View>
                    ) : null}
                  </View>

                  {subject.targetTimeMs ? (
                    <Text style={ui.label}>
                      {t("Target:")} {subject.targetTimeMs} ms
                    </Text>
                  ) : null}

                  {subject.description ? (
                    <Text style={ui.muted} numberOfLines={2}>
                      {subject.description}
                    </Text>
                  ) : null}

                  {/* Actions */}
                  <View style={styles.cardActionRow}>
                    <SecondaryButton
                      label={t("Edit")}
                      icon="create-outline"
                      style={{ flex: 1 }}
                      onPress={() => editSubject(subject)}
                    />
                    <SecondaryButton
                      label={t("Delete")}
                      icon="trash-outline"
                      style={{ flex: 1 }}
                      onPress={() => deleteSubject(subject.id, subject.name)}
                    />
                  </View>
                </Panel>
              );
            })
          ) : (
            <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
              <Ionicons name="book-outline" size={32} color={colors.mutedForeground} />
              <Text style={[ui.muted, { marginTop: 4 }]}>
                {subjectSearch
                  ? t("No subjects match the filter")
                  : t("No training subjects registered.")}
              </Text>
            </Panel>
          )}
        </View>
      ) : null}

      {/* TAB 2: LỚP HUẤN LUYỆN */}
      {payload && tab === "Lớp huấn luyện" ? (
        <View style={ui.section}>
          <SectionTitle>{t("Training class report")}</SectionTitle>

          {/* Operational KPIs */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{payload.plans.length}</Text>
              <Text style={styles.kpiLabel}>{t("active plans")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: colors.primary }]}>
                {payload.classes.filter((c) => c.trainingClass.status === "ACTIVE").length}
              </Text>
              <Text style={styles.kpiLabel}>{t("active classes")}</Text>
            </View>
          </View>

          {payload.classes.map(({ trainingClass, sessions, horses, progress }) => {
            const planObj = payload.plans.find((p) => p.id === trainingClass.planId);
            const activeHorsesCount = horses.filter((h) => h.status === "ACTIVE").length;
            const completedSessions = sessions.filter((s) => s.status === "COMPLETED").length;

            return (
              <Panel key={trainingClass.id} style={{ gap: space.sm }}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.classCodeText}>{trainingClass.code}</Text>
                    <Text style={styles.classNameText} numberOfLines={1}>
                      {trainingClass.name}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.classStatusBadge,
                      trainingClass.status === "ACTIVE"
                        ? { backgroundColor: colors.fitSoft }
                        : trainingClass.status === "COMPLETED"
                          ? { backgroundColor: colors.muted }
                          : { backgroundColor: colors.injuredSoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.classStatusBadgeText,
                        trainingClass.status === "ACTIVE"
                          ? { color: colors.primary }
                          : trainingClass.status === "COMPLETED"
                            ? { color: colors.mutedForeground }
                            : { color: colors.destructive },
                      ]}
                    >
                      {formatEnum(trainingClass.status)}
                    </Text>
                  </View>
                </View>

                {/* Plan & Schedule Range */}
                <View style={styles.planScheduleRow}>
                  <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
                  <Text style={styles.planScheduleText}>
                    {formatDate(trainingClass.startDate)} – {formatDate(trainingClass.endDate)}
                    {planObj ? ` · ${planObj.name}` : ""}
                  </Text>
                </View>

                {/* Metrics Breakdown */}
                <View style={styles.classMetricsGrid}>
                  <View style={styles.classMetricItem}>
                    <Text style={styles.classMetricValue}>{activeHorsesCount}</Text>
                    <Text style={styles.classMetricLabel}>{t("horses")}</Text>
                  </View>
                  <View style={styles.classMetricItem}>
                    <Text style={styles.classMetricValue}>
                      {completedSessions}/{sessions.length}
                    </Text>
                    <Text style={styles.classMetricLabel}>{t("Sessions")}</Text>
                  </View>
                  <View style={styles.classMetricItem}>
                    <Text style={styles.classMetricValue}>
                      {progress.scheduledMinutes}/{progress.minTotalMinutes}
                    </Text>
                    <Text style={styles.classMetricLabel}>{t("min")}</Text>
                  </View>
                </View>

                {/* Upcoming/Recent Sessions */}
                {sessions.length > 0 ? (
                  <View style={{ gap: 4, marginTop: 2 }}>
                    {sessions.slice(0, 3).map((s) => (
                      <View key={s.id} style={styles.sessionPreviewRow}>
                        <Ionicons
                          name={s.status === "COMPLETED" ? "checkmark-circle" : "time-outline"}
                          size={13}
                          color={s.status === "COMPLETED" ? colors.fit : colors.mutedForeground}
                        />
                        <Text style={styles.sessionPreviewText} numberOfLines={1}>
                          {formatDateTime(s.scheduledStartAt)} · {s.name}
                        </Text>
                        <Text style={[ui.label, { fontSize: 11 }]}>{formatEnum(s.status)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Panel>
            );
          })}

          {payload.classes.length === 0 ? (
            <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
              <Ionicons name="calendar-outline" size={32} color={colors.mutedForeground} />
              <Text style={[ui.muted, { marginTop: 4 }]}>
                {t("No training classes are available.")}
              </Text>
            </Panel>
          ) : null}
        </View>
      ) : null}

      {/* TAB 3: HIỆU SUẤT */}
      {payload && tab === "Hiệu suất" ? (
        <View style={ui.section}>
          <SectionTitle>{t("Horse performance overview")}</SectionTitle>

          {/* Summary KPIs */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{performanceStats.totalHorses}</Text>
              <Text style={styles.kpiLabel}>{t("Total enrolled horses")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{performanceStats.totalSessions}</Text>
              <Text style={styles.kpiLabel}>{t("Tracked sessions")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: colors.primary }]}>
                {performanceStats.avgScore}
              </Text>
              <Text style={styles.kpiLabel}>{t("Average score")}</Text>
            </View>
          </View>

          {/* Horse Performance Cards */}
          {payload.performanceRows.length ? (
            payload.performanceRows.map(({ horseId, horseName, summary }) => {
              const latestMetric = summary?.latestMetric;
              const latestEval = summary?.latestEvaluation;

              return (
                <Pressable
                  key={horseId}
                  onPress={() => router.push(`/manager/horse/${horseId}?tab=Performance` as Href)}
                >
                  <Panel style={{ gap: space.sm }}>
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.subjectName} numberOfLines={1}>
                          {horseName}
                        </Text>
                        <Text style={ui.muted}>
                          {summary
                            ? `${summary.sessionsTracked ?? 0} ${t("buổi có dữ liệu đo")}`
                            : t("No performance data")}
                        </Text>
                      </View>
                      {latestEval ? (
                        <View style={styles.scoreBadge}>
                          <Text style={styles.scoreBadgeText}>{latestEval.score}/10</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Vitals & Metrics */}
                    {latestMetric ? (
                      <View style={styles.metricVitalsRow}>
                        <View style={styles.vitalItem}>
                          <Ionicons name="pulse" size={13} color={colors.destructive} />
                          <Text style={styles.vitalText}>{latestMetric.heartRateBpm} bpm</Text>
                        </View>
                        <View style={styles.vitalItem}>
                          <Ionicons name="speedometer-outline" size={13} color={colors.primary} />
                          <Text style={styles.vitalText}>
                            {(latestMetric.speedMps * 3.6).toFixed(1)} km/h
                          </Text>
                        </View>
                        <View style={styles.vitalItem}>
                          <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
                          <Text style={styles.vitalText}>
                            {formatDateTime(latestMetric.recordedAt)}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {latestEval?.comment ? (
                      <Text style={ui.label} numberOfLines={2}>
                        {`"${latestEval.comment}"`}
                      </Text>
                    ) : null}

                    <View style={styles.drillDownRow}>
                      <Text style={styles.drillDownText}>{t("View performance detail")}</Text>
                      <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                    </View>
                  </Panel>
                </Pressable>
              );
            })
          ) : (
            <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
              <Ionicons name="stats-chart-outline" size={32} color={colors.mutedForeground} />
              <Text style={[ui.muted, { marginTop: 4 }]}>
                {t("There are no enrolled horses to report on yet.")}
              </Text>
            </Panel>
          )}
        </View>
      ) : null}

      {/* TAB 4: BÀN GIAO */}
      {payload && tab === "Bàn giao" ? (
        <View style={ui.section}>
          <SectionTitle>{t("Head Trainer handover")}</SectionTitle>

          <Panel style={{ gap: space.md }}>
            <View style={styles.handoverNoticeBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.handoverNoticeText}>
                {t(
                  "The Backend transfers barns, plans and unfinished classes together. This cannot be undone from the mobile app.",
                )}
              </Text>
            </View>

            {/* Step 1: Source Trainer Selection */}
            <View style={{ gap: space.xs }}>
              <Text style={styles.groupHeading}>{t("Source Head Trainer")}</Text>
              {trainers.map((trainer) => {
                const isSelected = sourceTrainer === trainer.id;
                return (
                  <Pressable
                    key={`from-${trainer.id}`}
                    onPress={() => setSourceTrainer(trainer.id)}
                  >
                    <View
                      style={[
                        styles.trainerSelectCard,
                        isSelected && styles.trainerSelectCardActive,
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={styles.trainerName} numberOfLines={1}>
                          {trainer.fullName}
                        </Text>
                        <Text style={ui.muted} numberOfLines={1}>
                          {trainer.email}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={isSelected ? colors.primary : colors.mutedForeground}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Step 2: Target Trainer Selection */}
            <View style={{ gap: space.xs }}>
              <Text style={styles.groupHeading}>{t("Receiving Head Trainer")}</Text>
              {trainers
                .filter((trainer) => trainer.id !== sourceTrainer)
                .map((trainer) => {
                  const isSelected = targetTrainer === trainer.id;
                  return (
                    <Pressable
                      key={`to-${trainer.id}`}
                      onPress={() => setTargetTrainer(trainer.id)}
                    >
                      <View
                        style={[
                          styles.trainerSelectCard,
                          isSelected && styles.trainerSelectCardActive,
                        ]}
                      >
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={styles.trainerName} numberOfLines={1}>
                            {trainer.fullName}
                          </Text>
                          <Text style={ui.muted} numberOfLines={1}>
                            {trainer.email}
                          </Text>
                        </View>
                        <Ionicons
                          name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                          size={20}
                          color={isSelected ? colors.primary : colors.mutedForeground}
                        />
                      </View>
                    </Pressable>
                  );
                })}
            </View>

            {/* Transfer Preview Card */}
            {sourceTrainerObj && targetTrainerObj ? (
              <View style={styles.transferPreviewCard}>
                <View style={styles.transferFlowRow}>
                  <Text style={styles.transferTrainerText} numberOfLines={1}>
                    {sourceTrainerObj.fullName}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                  <Text style={styles.transferTrainerText} numberOfLines={1}>
                    {targetTrainerObj.fullName}
                  </Text>
                </View>
              </View>
            ) : null}

            <PrimaryButton
              label={
                handoverBusy ? t("Transferring…") : t("Transfer Head Trainer responsibilities")
              }
              icon="swap-horizontal"
              disabled={handoverBusy || !sourceTrainer || !targetTrainer}
              onPress={() =>
                Alert.alert(
                  t("Confirm handover"),
                  t("Transfer all barns, plans and unfinished classes from this Head Trainer?"),
                  [
                    { text: t("Cancel"), style: "cancel" },
                    { text: t("Transfer"), style: "destructive", onPress: () => void handover() },
                  ],
                )
              }
            />
          </Panel>
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

const getStyles = (colors: any) =>
  StyleSheet.create({
    tabBarContainer: {
      flexDirection: "row",
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      padding: 3,
      gap: 4,
      marginBottom: space.md,
    },
    tabItem: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
    },
    tabItemActive: {
      backgroundColor: colors.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    tabItemText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
      textAlign: "center",
    },
    tabItemTextActive: {
      color: colors.foreground,
      fontWeight: "700",
    },
    countBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    formSectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: space.xs,
    },
    formGroup: {
      gap: space.xs,
      paddingBottom: space.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    groupHeading: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    searchFilterRow: {
      flexDirection: "row",
      gap: space.xs,
      marginVertical: space.xs,
    },
    filterPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.fitSoft,
    },
    filterPillText: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.mutedForeground,
    },
    filterPillTextActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: space.sm,
    },
    subjectName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    typeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    trialBadge: {
      backgroundColor: colors.monitorSoft,
    },
    regularBadge: {
      backgroundColor: colors.fitSoft,
    },
    typeBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    intensityBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.muted,
    },
    intensityBadgeText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    specsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      flexWrap: "wrap",
    },
    specItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    specText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontWeight: "500",
    },
    cardActionRow: {
      flexDirection: "row",
      gap: space.sm,
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    kpiRow: {
      flexDirection: "row",
      gap: space.sm,
      marginBottom: space.xs,
    },
    kpiCard: {
      flex: 1,
      alignItems: "center",
      paddingVertical: space.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 2,
    },
    kpiValue: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.foreground,
    },
    kpiLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.mutedForeground,
      textAlign: "center",
    },
    classCodeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    classNameText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    planScheduleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    planScheduleText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    classMetricsGrid: {
      flexDirection: "row",
      backgroundColor: colors.muted,
      borderRadius: radius.sm,
      paddingVertical: space.xs,
      paddingHorizontal: space.sm,
    },
    classMetricItem: {
      flex: 1,
      alignItems: "center",
    },
    classMetricValue: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    classMetricLabel: {
      fontSize: 10,
      color: colors.mutedForeground,
    },
    sessionPreviewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 2,
    },
    sessionPreviewText: {
      flex: 1,
      fontSize: 11,
      color: colors.mutedForeground,
    },
    scoreBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
    },
    scoreBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    metricVitalsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      paddingVertical: 4,
      paddingHorizontal: 8,
      backgroundColor: colors.muted,
      borderRadius: radius.sm,
    },
    vitalItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    vitalText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
    drillDownRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 4,
      paddingTop: 2,
    },
    drillDownText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    handoverNoticeBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      padding: space.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
    },
    handoverNoticeText: {
      flex: 1,
      fontSize: 12,
      color: colors.primary,
      lineHeight: 17,
    },
    trainerSelectCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: space.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    trainerSelectCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.fitSoft,
    },
    trainerName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    transferPreviewCard: {
      padding: space.md,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      alignItems: "center",
    },
    transferFlowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
    },
    transferTrainerText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      maxWidth: 130,
    },
    classStatusBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      flexShrink: 0,
    },
    classStatusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
  });
