import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, type Href, useLocalSearchParams } from "expo-router";
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
import {
  trainingService,
  type EnrollableHorseDto,
  type HorseEnrollmentDto,
  type TrainingSessionInput,
} from "@/services/training.service";
import { horseService } from "@/services/horse.service";
import type { HorseListItemDto } from "@/adapters/horse.adapter";
import {
  addDaysToClubDate,
  classWeekNumber,
  clubDateTimeToIso,
  defaultClubDateTime,
  formatTrainingStatus,
} from "@/features/training/training-utils";
import { formatDate, formatDateTime } from "@/utils/formatters";
import { extractErrorMessage } from "@/utils/errorHandler";
import { radius, space } from "@/config/theme";

type HorseSortOption = "name_asc" | "name_desc" | "recently_added" | "oldest";
const SORT_OPTIONS: { id: HorseSortOption; label: string }[] = [
  { id: "name_asc", label: "Tên (A đến Z)" },
  { id: "name_desc", label: "Tên (Z đến A)" },
  { id: "recently_added", label: "Mới thêm gần đây" },
  { id: "oldest", label: "Cũ nhất" },
];

export default function TrainingClassDetail() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const ui = getUiStyles(colors);
  const { t } = useI18n();
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

  // Class Horses tab state
  const [horseSearch, setHorseSearch] = useState("");
  const [horseSort, setHorseSort] = useState<HorseSortOption>("name_asc");
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addModalHorses, setAddModalHorses] = useState<EnrollableHorseDto[]>([]);
  const [addedHorseIds, setAddedHorseIds] = useState<Set<string>>(new Set());
  const [editModalHorses, setEditModalHorses] = useState<HorseEnrollmentDto[]>([]);

  const load = useCallback(async () => {
    const [trainingClass, plan, progress, enrollments, sessions, allHorses] = await Promise.all([
      trainingService.getClass(token!, classId),
      trainingService.getClassPlan(token!, classId),
      trainingService.getClassProgress(token!, classId),
      trainingService.listEnrollments(token!, classId),
      trainingService.listClassSessions(token!, classId),
      horseService.list(token!).catch(() => [] as HorseListItemDto[]),
    ]);
    return { trainingClass, plan, progress, enrollments, sessions, allHorses };
  }, [token, classId]);
  const resource = useApiResource(load, Boolean(token && classId));
  const payload = resource.data;

  const horseMap = useMemo(() => {
    const map = new Map<string, HorseListItemDto>();
    for (const h of payload?.allHorses ?? []) {
      map.set(h.id, h);
    }
    return map;
  }, [payload?.allHorses]);
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

  const openAddModal = async () => {
    setAddModalVisible(true);
    setLoadingEnrollable(true);
    setAddedHorseIds(new Set());
    try {
      const list = await trainingService.listEnrollableHorses(token!, classId);
      const activeHorseIds = new Set(
        (payload?.enrollments ?? []).filter((e) => e.status === "ACTIVE").map((e) => e.horseId),
      );
      setAddModalHorses(list.filter((h) => !activeHorseIds.has(h.horseId)));
    } catch (error) {
      Alert.alert("Lỗi tải danh sách ngựa", extractErrorMessage(error));
    } finally {
      setLoadingEnrollable(false);
    }
  };

  const enrollSingleHorse = async (horseId: string) => {
    try {
      setPending(`enroll:${horseId}`);
      await trainingService.enrollHorse(token!, classId, horseId);
      setAddedHorseIds((prev) => new Set(prev).add(horseId));
      void resource.refresh();
    } catch (error) {
      Alert.alert("Lỗi đăng ký ngựa", extractErrorMessage(error));
    } finally {
      setPending("");
    }
  };

  const openEditModal = () => {
    const active = (payload?.enrollments ?? []).filter((e) => e.status === "ACTIVE");
    setEditModalHorses(active);
    setEditModalVisible(true);
  };

  const removeSingleHorse = async (enrollmentId: string) => {
    try {
      setPending(`leave:${enrollmentId}`);
      await trainingService.leaveEnrollment(token!, enrollmentId);
      // Immediately remove from list inside modal
      setEditModalHorses((prev) => prev.filter((item) => item.id !== enrollmentId));
      void resource.refresh();
    } catch (error) {
      Alert.alert("Lỗi gỡ ngựa", extractErrorMessage(error));
    } finally {
      setPending("");
    }
  };

  const filteredClassHorses = useMemo(() => {
    const list = payload?.enrollments ?? [];
    const query = horseSearch.trim().toLowerCase();
    const filtered = query
      ? list.filter((h) => {
          const profile = horseMap.get(h.horseId);
          return (
            h.horseName.toLowerCase().includes(query) ||
            h.horseId.toLowerCase().includes(query) ||
            (profile?.microchipId ?? "").toLowerCase().includes(query)
          );
        })
      : [...list];

    if (horseSort === "name_asc") {
      filtered.sort((a, b) => a.horseName.localeCompare(b.horseName, "vi"));
    } else if (horseSort === "name_desc") {
      filtered.sort((a, b) => b.horseName.localeCompare(a.horseName, "vi"));
    } else if (horseSort === "recently_added") {
      filtered.sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));
    } else if (horseSort === "oldest") {
      filtered.sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt));
    }
    return filtered;
  }, [payload?.enrollments, horseSearch, horseSort, horseMap]);

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
                    {formatTrainingStatus(payload.trainingClass.status)}
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
              {/* Search Box */}
              <View style={styles.searchContainer}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={colors.mutedForeground}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  value={horseSearch}
                  onChangeText={setHorseSearch}
                  placeholder={t("Tìm kiếm theo tên hoặc mã ngựa...")}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.searchInput, { color: colors.foreground }]}
                  autoCapitalize="none"
                />
                {horseSearch ? (
                  <Pressable onPress={() => setHorseSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                  </Pressable>
                ) : null}
              </View>

              {/* Action Buttons Row: Đăng ký, Sắp xếp, Chỉnh sửa */}
              <View style={styles.actionButtonsRow}>
                {payload.trainingClass.status === "ACTIVE" ? (
                  <Pressable
                    style={[
                      styles.actionBtn,
                      { backgroundColor: colors.fitSoft, borderColor: colors.primary },
                    ]}
                    onPress={() => void openAddModal()}
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                      {t("Đăng ký")}
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={[
                    styles.actionBtn,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                  onPress={() => setSortModalVisible(true)}
                >
                  <Ionicons name="swap-vertical-outline" size={16} color={colors.foreground} />
                  <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                    {horseSort === "name_asc"
                      ? "Tên A-Z"
                      : horseSort === "name_desc"
                        ? "Tên Z-A"
                        : horseSort === "recently_added"
                          ? "Mới nhất"
                          : "Cũ nhất"}
                  </Text>
                </Pressable>

                {payload.trainingClass.status === "ACTIVE" ? (
                  <Pressable
                    style={[
                      styles.actionBtn,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                    ]}
                    onPress={openEditModal}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.foreground} />
                    <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                      {t("Chỉnh sửa")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Capacity & Count banner */}
              <View style={styles.countBadgeRow}>
                <Ionicons name="people-outline" size={16} color={colors.primary} />
                <Text style={styles.countBadgeText}>
                  {payload.enrollments.filter((item) => item.status === "ACTIVE").length} /{" "}
                  {payload.trainingClass.maxHorses} ngựa đang học
                </Text>
              </View>

              {/* Horses List */}
              {filteredClassHorses.length ? (
                filteredClassHorses.map((horse) => {
                  const profile = horseMap.get(horse.horseId);
                  const photoUrl = horse.horsePhotoUrl || profile?.photoUrl;
                  const isActive = horse.status === "ACTIVE";
                  const gender = profile?.gender ? t(profile.gender) : null;
                  const breed = profile?.breed;
                  const aptitude = profile?.raceAptitude ? t(profile.raceAptitude) : null;
                  const location =
                    profile?.location?.placementStatus === "PLACED"
                      ? `${profile.location.barn?.name ?? "Chuồng"} · ${profile.location.stall?.code ?? "Ô"}`
                      : null;

                  return (
                    <Pressable
                      key={horse.id}
                      style={[
                        styles.horseCard,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                      ]}
                      onPress={() => router.push(`/trainer/horse/${horse.horseId}` as Href)}
                    >
                      {photoUrl ? (
                        <Image source={{ uri: photoUrl }} style={styles.horseCardPhoto} />
                      ) : (
                        <View
                          style={[
                            styles.horseCardPhotoFallback,
                            { backgroundColor: colors.fitSoft },
                          ]}
                        >
                          <Ionicons name="fitness-outline" size={24} color={colors.primary} />
                        </View>
                      )}

                      <View style={styles.horseCardBody}>
                        <View style={styles.horseCardHeader}>
                          <Text
                            style={[styles.horseCardName, { color: colors.foreground }]}
                            numberOfLines={1}
                          >
                            {horse.horseName}
                          </Text>
                          <View
                            style={[
                              styles.statusTag,
                              isActive
                                ? { backgroundColor: colors.fitSoft, borderColor: colors.primary }
                                : { backgroundColor: colors.border, borderColor: colors.border },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusTagText,
                                { color: isActive ? colors.primary : colors.mutedForeground },
                              ]}
                            >
                              {isActive ? "Đang học" : "Đã rời lớp"}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.horseMetaRow}>
                          {gender ? (
                            <View style={[styles.metaPill, { backgroundColor: colors.fitSoft }]}>
                              <Text style={[styles.metaPillText, { color: colors.foreground }]}>
                                {gender}
                              </Text>
                            </View>
                          ) : null}
                          {breed ? (
                            <View style={[styles.metaPill, { backgroundColor: colors.fitSoft }]}>
                              <Text style={[styles.metaPillText, { color: colors.foreground }]}>
                                {breed}
                              </Text>
                            </View>
                          ) : null}
                          {aptitude ? (
                            <View
                              style={[styles.metaPill, { backgroundColor: colors.primary + "1A" }]}
                            >
                              <Text
                                style={[
                                  styles.metaPillText,
                                  { color: colors.primary, fontWeight: "600" },
                                ]}
                              >
                                {aptitude}
                              </Text>
                            </View>
                          ) : null}
                          {location ? (
                            <View style={[styles.metaPill, { backgroundColor: colors.fitSoft }]}>
                              <Text
                                style={[styles.metaPillText, { color: colors.mutedForeground }]}
                              >
                                {location}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={[styles.enrolledDate, { color: colors.mutedForeground }]}>
                          Đã vào lớp: {formatDate(horse.enrolledAt)}
                          {horse.leftAt ? ` · Rời lớp: ${formatDate(horse.leftAt)}` : ""}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <AsyncStateView
                  isLoading={false}
                  error={null}
                  onRetry={() => void resource.refresh()}
                  empty
                  emptyLabel={
                    horseSearch
                      ? "Không tìm thấy ngựa nào phù hợp với tìm kiếm."
                      : "Chưa có ngựa nào trong lớp này."
                  }
                />
              )}
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
                        <Text
                          style={[
                            ui.label,
                            {
                              flexShrink: 0,
                              color:
                                session.status === "IN_PROGRESS"
                                ? colors.monitor
                                : colors.mutedForeground,
                              fontWeight: "600",
                            },
                          ]}
                        >
                          {formatTrainingStatus(session.status)}
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

      {/* ADD HORSES MODAL BOTTOM SHEET */}
      <BottomSheetModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        title={t("Đăng ký ngựa vào lớp")}
        subtitle={t("Nhấn '+' để thêm ngựa vào lớp")}
        colors={colors}
      >
        <ScrollView
          style={{ paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 10, paddingVertical: 8 }}
        >
          {loadingEnrollable ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 30 }} />
          ) : addModalHorses.length ? (
            addModalHorses.map((horse) => {
              const isAdded = addedHorseIds.has(horse.horseId);
              const profile = horseMap.get(horse.horseId);
              const photo = horse.horsePhotoUrl || profile?.photoUrl;
              return (
                <View
                  key={horse.horseId}
                  style={[
                    styles.modalRow,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.modalAvatar} />
                  ) : (
                    <View style={[styles.modalAvatarFallback, { backgroundColor: colors.fitSoft }]}>
                      <Ionicons name="fitness-outline" size={20} color={colors.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text
                      style={[styles.modalHorseName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {horse.horseName}
                    </Text>
                    <Text
                      style={[styles.modalHorseSub, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {[profile?.breed, profile?.color, profile?.gender ? t(profile.gender) : null]
                        .filter(Boolean)
                        .join(" · ") || "Ngựa đủ điều kiện"}
                    </Text>
                  </View>
                  <Pressable
                    disabled={isAdded || pending === `enroll:${horse.horseId}`}
                    onPress={() => void enrollSingleHorse(horse.horseId)}
                    style={styles.modalActionBtn}
                  >
                    {pending === `enroll:${horse.horseId}` ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : isAdded ? (
                      <Ionicons name="checkmark-circle" size={28} color="#10b981" />
                    ) : (
                      <Ionicons name="add-circle" size={30} color={colors.primary} />
                    )}
                  </Pressable>
                </View>
              );
            })
          ) : (
            <View style={{ paddingVertical: 30, alignItems: "center" }}>
              <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
                {t("Không có ngựa nào đủ điều kiện để thêm vào lớp lúc này.")}
              </Text>
            </View>
          )}
        </ScrollView>
      </BottomSheetModal>

      {/* EDIT HORSES MODAL BOTTOM SHEET */}
      <BottomSheetModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title={t("Chỉnh sửa danh sách lớp")}
        subtitle={t("Nhấn '-' để gỡ ngựa khỏi lớp")}
        colors={colors}
      >
        <ScrollView
          style={{ paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 10, paddingVertical: 8 }}
        >
          {editModalHorses.length ? (
            editModalHorses.map((enrollment) => {
              const profile = horseMap.get(enrollment.horseId);
              const photo = enrollment.horsePhotoUrl || profile?.photoUrl;
              return (
                <View
                  key={enrollment.id}
                  style={[
                    styles.modalRow,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.modalAvatar} />
                  ) : (
                    <View style={[styles.modalAvatarFallback, { backgroundColor: colors.fitSoft }]}>
                      <Ionicons name="fitness-outline" size={20} color={colors.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text
                      style={[styles.modalHorseName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {enrollment.horseName}
                    </Text>
                    <Text
                      style={[styles.modalHorseSub, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      Đã vào lớp: {formatDate(enrollment.enrolledAt)}
                    </Text>
                  </View>
                  <Pressable
                    disabled={pending === `leave:${enrollment.id}`}
                    onPress={() => void removeSingleHorse(enrollment.id)}
                    style={styles.modalActionBtn}
                  >
                    {pending === `leave:${enrollment.id}` ? (
                      <ActivityIndicator size="small" color={colors.destructive} />
                    ) : (
                      <Ionicons name="remove-circle" size={30} color={colors.destructive} />
                    )}
                  </Pressable>
                </View>
              );
            })
          ) : (
            <View style={{ paddingVertical: 30, alignItems: "center" }}>
              <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
                {t("Lớp hiện không có ngựa nào.")}
              </Text>
            </View>
          )}
        </ScrollView>
      </BottomSheetModal>

      {/* SORT MODAL BOTTOM SHEET */}
      <BottomSheetModal
        visible={sortModalVisible}
        onClose={() => setSortModalVisible(false)}
        title={t("Sắp xếp danh sách ngựa")}
        colors={colors}
      >
        <View style={{ paddingHorizontal: 20, gap: 10, paddingVertical: 8 }}>
          {SORT_OPTIONS.map((opt) => {
            const isSelected = horseSort === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  setHorseSort(opt.id);
                  setSortModalVisible(false);
                }}
                style={[
                  styles.sortRow,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.fitSoft : colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sortLabel,
                    {
                      color: isSelected ? colors.primary : colors.foreground,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}
                >
                  {opt.label}
                </Text>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : (
                  <Ionicons name="ellipse-outline" size={20} color={colors.mutedForeground} />
                )}
              </Pressable>
            );
          })}
        </View>
      </BottomSheetModal>
    </Screen>
  );
}

function BottomSheetModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  colors: any;
}) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 6 && Math.abs(gesture.dx) < Math.abs(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 40 || gesture.vy > 0.3) {
          onClose();
        }
      },
    }),
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          onPress={onClose}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "85%",
              minHeight: 280,
              paddingBottom: 28,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Draggable header area */}
            <View
              {...panResponder.panHandlers}
              style={{ alignItems: "center", paddingTop: 10, paddingBottom: 12 }}
            >
              <View
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: colors.border,
                  marginBottom: 10,
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  paddingHorizontal: 20,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.fitSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={18} color={colors.foreground} />
                </Pressable>
              </View>
            </View>
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      height: 44,
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      paddingVertical: 0,
    },
    actionButtonsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 40,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: 8,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: "700",
    },
    countBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
      alignSelf: "flex-start",
      marginBottom: 10,
    },
    countBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    horseCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
      marginBottom: 8,
    },
    horseCardPhoto: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      backgroundColor: colors.fitSoft,
    },
    horseCardPhotoFallback: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    horseCardBody: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    horseCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    horseCardName: {
      fontSize: 15,
      fontWeight: "700",
      flex: 1,
      minWidth: 0,
    },
    statusTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    statusTagText: {
      fontSize: 11,
      fontWeight: "700",
    },
    horseMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 2,
    },
    metaPill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    metaPillText: {
      fontSize: 11,
    },
    enrolledDate: {
      fontSize: 11,
      marginTop: 2,
    },
    modalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    modalAvatar: {
      width: 44,
      height: 44,
      borderRadius: radius.sm,
    },
    modalAvatarFallback: {
      width: 44,
      height: 44,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    modalHorseName: {
      fontSize: 14,
      fontWeight: "700",
    },
    modalHorseSub: {
      fontSize: 12,
    },
    modalActionBtn: {
      padding: 4,
    },
    sortRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    sortLabel: {
      fontSize: 14,
    },
  });
