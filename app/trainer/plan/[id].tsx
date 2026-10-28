import { useCallback, useMemo, useState } from "react";
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
  BottomSheetModal,
  Chips,
  DatePickerField,
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
import { formatSessionType, formatIntensity } from "../plans";
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
  const [addSearch, setAddSearch] = useState("");
  const [addedHorseIds, setAddedHorseIds] = useState<Set<string>>(new Set());
  const [addedEnrollmentIds, setAddedEnrollmentIds] = useState<Map<string, string>>(new Map());
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

  const filteredAddModalHorses = useMemo(() => {
    if (!addSearch.trim()) return addModalHorses;
    const q = addSearch.trim().toLowerCase();
    return addModalHorses.filter((h) => {
      const profile = horseMap.get(h.horseId);
      return (
        h.horseName.toLowerCase().includes(q) ||
        Boolean(profile?.microchipId?.toLowerCase().includes(q)) ||
        Boolean(profile?.breed?.toLowerCase().includes(q))
      );
    });
  }, [addModalHorses, addSearch, horseMap]);
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
      await resource.refresh();
    } catch (error) {
      Alert.alert("Action failed", extractErrorMessage(error));
    } finally {
      setPending("");
    }
  };

  const openAddModal = async () => {
    setAddSearch("");
    setAddModalVisible(true);
    setLoadingEnrollable(true);
    setAddedHorseIds(new Set());
    setAddedEnrollmentIds(new Map());
    try {
      const list = await trainingService.listEnrollableHorses(token!, classId);
      const activeHorseIds = new Set(
        (payload?.enrollments ?? []).filter((e) => e.status === "ACTIVE").map((e) => e.horseId),
      );
      setAddModalHorses(list.filter((h) => !activeHorseIds.has(h.horseId)));
    } catch (error) {
      Alert.alert(t("Lỗi tải danh sách ngựa"), extractErrorMessage(error));
    } finally {
      setLoadingEnrollable(false);
    }
  };

  const enrollSingleHorse = async (horseId: string) => {
    try {
      setPending(`enroll:${horseId}`);
      const res = await trainingService.enrollHorse(token!, classId, horseId);
      setAddedHorseIds((prev) => new Set(prev).add(horseId));
      if (res?.id) {
        setAddedEnrollmentIds((prev) => new Map(prev).set(horseId, res.id));
      }
      void resource.refresh();
    } catch (error) {
      Alert.alert("Lỗi đăng ký ngựa", extractErrorMessage(error));
    } finally {
      setPending("");
    }
  };

  const unenrollSingleHorse = async (horseId: string) => {
    let enrollmentId = addedEnrollmentIds.get(horseId);
    if (!enrollmentId) {
      enrollmentId = (payload?.enrollments ?? []).find(
        (e) => e.horseId === horseId && e.status === "ACTIVE",
      )?.id;
    }
    if (!enrollmentId) {
      Alert.alert(t("Lỗi hoàn tác"), t("Không tìm thấy thông tin ghi danh để hoàn tác."));
      return;
    }
    try {
      setPending(`enroll:${horseId}`);
      await trainingService.leaveEnrollment(token!, enrollmentId, { reason: "Added by mistake" });
      setAddedHorseIds((prev) => {
        const next = new Set(prev);
        next.delete(horseId);
        return next;
      });
      setAddedEnrollmentIds((prev) => {
        const next = new Map(prev);
        next.delete(horseId);
        return next;
      });
      void resource.refresh();
    } catch (error) {
      Alert.alert(t("Lỗi gỡ ngựa"), extractErrorMessage(error));
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
      title={payload?.trainingClass.name ?? t("Lớp huấn luyện")}
      subtitle={payload ? `${payload.trainingClass.code} · ${formatDate(payload.trainingClass.startDate)}` : t("Chi tiết lớp")}
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
              {payload.trainingClass.status === "ACTIVE" ? (
                <View style={styles.twoButtonRow}>
                  <SecondaryButton
                    label="Edit class"
                    icon="create-outline"
                    style={styles.flexButton}
                    onPress={() => {
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
                    style={styles.flexButton}
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
                </View>
              ) : null}

              {/* Bottom Sheet Modal: Sửa lớp học */}
              <BottomSheetModal
                visible={editClass}
                title={t("Sửa lớp huấn luyện")}
                onClose={() => setEditClass(false)}
                onSave={() => void saveClass()}
                saveLoading={pending === "class"}
                saveDisabled={pending !== ""}
                saveLabel={t("Lưu")}
                cancelLabel={t("Hủy")}
              >
                <Field label={t("Mã lớp")}>
                  <NativeInput value={editCode} onChangeText={setEditCode} />
                </Field>
                <Field label={t("Tên lớp")}>
                  <NativeInput value={editName} onChangeText={setEditName} />
                </Field>
                <Field label={t("Ngày bắt đầu (YYYY-MM-DD)")}>
                  <DatePickerField
                    value={editStartDate}
                    onChangeText={setEditStartDate}
                    placeholder="YYYY-MM-DD"
                    outputFormat="YYYY-MM-DD"
                    title={t("Chọn ngày bắt đầu lớp")}
                  />
                </Field>
                <Field label={t("Số ngựa tối đa")}>
                  <NativeInput
                    value={editCapacity}
                    onChangeText={setEditCapacity}
                    keyboardType="number-pad"
                  />
                </Field>
              </BottomSheetModal>

              {payload.trainingClass.status === "ACTIVE" ? (
                <>
                  <SecondaryButton
                    label={t("Hủy lớp")}
                    icon="close-circle-outline"
                    onPress={() => setShowCancelForm(true)}
                  />
                  {/* Bottom Sheet Modal: Hủy lớp học */}
                  <BottomSheetModal
                    visible={showCancelForm}
                    title={t("Hủy lớp huấn luyện")}
                    onClose={() => setShowCancelForm(false)}
                    onSave={() => void cancelClass()}
                    saveLoading={pending === "cancel"}
                    saveDisabled={pending !== "" || !cancelReason.trim()}
                    saveLabel={t("Xác nhận hủy")}
                    cancelLabel={t("Hủy")}
                  >
                    <Field label={t("Lý do hủy (bắt buộc)")}>
                      <NativeInput
                        value={cancelReason}
                        onChangeText={setCancelReason}
                        multiline
                        placeholder={t("Nhập lý do hủy lớp...")}
                      />
                    </Field>
                  </BottomSheetModal>
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
              {/* Search & Sort Row */}
              <View style={styles.searchSortRow}>
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

                <Pressable
                  style={[
                    styles.sortBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  onPress={() => setSortModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("Sắp xếp")}
                >
                  <Ionicons name="swap-vertical-outline" size={18} color={colors.foreground} />
                  <Text
                    style={[styles.sortBtnText, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {horseSort === "name_asc"
                      ? "A-Z"
                      : horseSort === "name_desc"
                        ? "Z-A"
                        : horseSort === "recently_added"
                          ? "Mới nhất"
                          : "Cũ nhất"}
                  </Text>
                </Pressable>
              </View>

              {/* Action Buttons Row: Exactly TWO buttons side-by-side */}
              {payload.trainingClass.status === "ACTIVE" ? (
                <View style={styles.actionButtonsRow}>
                  <Pressable
                    style={[
                      styles.actionBtn,
                      { backgroundColor: colors.fitSoft, borderColor: colors.primary },
                    ]}
                    onPress={() => void openAddModal()}
                  >
                    <Ionicons name="add-circle" size={18} color={colors.primary} />
                    <Text
                      style={[styles.actionBtnText, { color: colors.primary }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {t("Đăng ký")}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.actionBtn,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                    ]}
                    onPress={openEditModal}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.foreground} />
                    <Text
                      style={[styles.actionBtnText, { color: colors.foreground }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {t("Chỉnh sửa")}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

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
              <SectionTitle>{t("Buổi tập")} ({payload.sessions.length})</SectionTitle>
              {payload.trainingClass.status === "ACTIVE" ? (
                <PrimaryButton
                  label={t("Lên lịch buổi tập")}
                  icon="calendar-outline"
                  onPress={() => setShowSessionForm(true)}
                />
              ) : null}

              {/* Bottom Sheet Modal: Lên lịch buổi tập */}
              <BottomSheetModal
                visible={showSessionForm && payload.trainingClass.status === "ACTIVE"}
                title={t("Lên lịch buổi tập")}
                onClose={() => setShowSessionForm(false)}
                onSave={() => void addSessions()}
                saveLoading={pending === "sessions"}
                saveDisabled={pending !== "" || !allowedSubjects.length}
                saveLabel={t("Lưu")}
                cancelLabel={t("Hủy")}
              >
                <Text style={ui.value}>{t("Thêm buổi tập từ giai đoạn hiện tại")}</Text>
                <Field label={t("Ngày buổi tập (YYYY-MM-DD)")}>
                  <DatePickerField
                    value={currentDate}
                    onChangeText={setSessionDate}
                    placeholder="YYYY-MM-DD"
                    outputFormat="YYYY-MM-DD"
                    title={t("Chọn ngày buổi tập")}
                  />
                </Field>
                <Field label={t("Giờ bắt đầu (HH:mm)")}>
                  <NativeInput
                    value={sessionTime}
                    onChangeText={setSessionTime}
                    placeholder="06:00"
                  />
                  {/* Google Calendar Quick Time Presets */}
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {[
                      { label: "06:00 (Sáng sớm)", value: "06:00" },
                      { label: "08:00 (Buổi sáng)", value: "08:00" },
                      { label: "15:30 (Buổi chiều)", value: "15:30" },
                      { label: "17:00 (Chiều muộn)", value: "17:00" },
                    ].map((pt) => (
                      <Pressable
                        key={pt.value}
                        onPress={() => setSessionTime(pt.value)}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: radius.pill,
                          backgroundColor: sessionTime === pt.value ? colors.fitSoft : colors.muted,
                          borderWidth: 1,
                          borderColor: sessionTime === pt.value ? colors.primary : colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: sessionTime === pt.value ? "700" : "500",
                            color: sessionTime === pt.value ? colors.primary : colors.foreground,
                          }}
                        >
                          {pt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Field>
                <Field label={t("Môn học trong giai đoạn này")}>
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
                <Field label={t("Lặp lại hàng tuần (1–100 buổi)")}>
                  <NativeInput
                    value={repeatWeeks}
                    onChangeText={setRepeatWeeks}
                    keyboardType="number-pad"
                  />
                </Field>
                <Field label={t("Địa điểm (không bắt buộc)")}>
                  <NativeInput value={location} onChangeText={setLocation} />
                </Field>
                <Field label={t("Ghi chú (không bắt buộc)")}>
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
              </BottomSheetModal>
              {payload.sessions.length ? (
                payload.sessions.map((session) => (
                  <Pressable
                    key={session.id}
                    onPress={() => router.push(`/trainer/plan/${classId}/session/${session.id}`)}
                  >
                    <Panel
                      style={{
                        gap: 6,
                        borderLeftWidth: 4,
                        borderLeftColor:
                          session.status === "IN_PROGRESS"
                            ? colors.destructive
                            : session.status === "COMPLETED"
                              ? colors.fit
                              : colors.primary,
                      }}
                    >
                      <View style={ui.row}>
                        <Text style={[ui.value, { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "800" }]} numberOfLines={1}>
                          {session.name}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: radius.pill,
                            backgroundColor:
                              session.status === "IN_PROGRESS"
                                ? colors.injuredSoft
                                : session.status === "COMPLETED"
                                  ? colors.muted
                                  : colors.fitSoft,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color:
                                session.status === "IN_PROGRESS"
                                  ? colors.destructive
                                  : session.status === "COMPLETED"
                                    ? colors.mutedForeground
                                    : colors.primary,
                            }}
                          >
                            {formatTrainingStatus(session.status)}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="time-outline" size={13} color={colors.primary} />
                        <Text style={ui.muted}>
                          {formatDateTime(session.scheduledStartAt)} →{" "}
                          {formatDateTime(session.scheduledEndAt)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="school-outline" size={13} color={colors.mutedForeground} />
                          <Text style={ui.label}>{formatSessionType(session.sessionType, t)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="flame-outline" size={13} color="#f59e0b" />
                          <Text style={ui.label}>{formatIntensity(session.intensity, t)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="flag-outline" size={13} color={colors.primary} />
                          <Text style={ui.label}>{session.plannedDistanceM.toLocaleString()} m</Text>
                        </View>
                      </View>
                      {session.cancelReason ? (
                        <Text style={{ ...ui.muted, color: colors.destructive }}>
                          Đã hủy: {session.cancelReason}
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
                  emptyLabel="Chưa có buổi tập nào. Hãy lên lịch buổi tập cho lớp này."
                />
              )}
            </View>
          ) : null}
        </>
      ) : null}

      {/* ADD HORSES MODAL BOTTOM SHEET */}
      <PlanBottomSheetModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        title={t("Đăng ký ngựa vào lớp")}
        subtitle={t("Nhấn '+' để thêm ngựa vào lớp")}
        colors={colors}
      >
        <View
          style={[
            styles.modalSearchContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={16}
            color={colors.mutedForeground}
            style={{ marginRight: 6 }}
          />
          <TextInput
            value={addSearch}
            onChangeText={setAddSearch}
            placeholder={t("Tìm ngựa đủ điều kiện...")}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.modalSearchInput, { color: colors.foreground }]}
            autoCapitalize="none"
          />
          {addSearch ? (
            <Pressable onPress={() => setAddSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 10,
            paddingVertical: 8,
            paddingBottom: 32,
          }}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {loadingEnrollable ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 30 }} />
          ) : filteredAddModalHorses.length ? (
            filteredAddModalHorses.map((horse) => {
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
                        .join(" · ") || t("Ngựa đủ điều kiện")}
                    </Text>
                  </View>
                  <Pressable
                    disabled={pending === `enroll:${horse.horseId}`}
                    onPress={() => {
                      if (isAdded) {
                        void unenrollSingleHorse(horse.horseId);
                      } else {
                        void enrollSingleHorse(horse.horseId);
                      }
                    }}
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
                {addSearch
                  ? t("Không tìm thấy ngựa nào phù hợp.")
                  : t("Không có ngựa nào đủ điều kiện để thêm vào lớp lúc này.")}
              </Text>
            </View>
          )}
        </ScrollView>
      </PlanBottomSheetModal>

      {/* EDIT HORSES MODAL BOTTOM SHEET */}
      <PlanBottomSheetModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title={t("Chỉnh sửa danh sách lớp")}
        subtitle={t("Nhấn '-' để gỡ ngựa khỏi lớp")}
        colors={colors}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 10,
            paddingVertical: 8,
            paddingBottom: 32,
          }}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
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
      </PlanBottomSheetModal>

      {/* SORT MODAL BOTTOM SHEET */}
      <PlanBottomSheetModal
        visible={sortModalVisible}
        onClose={() => setSortModalVisible(false)}
        title={t("Sắp xếp danh sách ngựa")}
        colors={colors}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            gap: 10,
            paddingVertical: 8,
            paddingBottom: 32,
          }}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
        >
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
                  numberOfLines={1}
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
        </ScrollView>
      </PlanBottomSheetModal>
    </Screen>
  );
}

function PlanBottomSheetModal({
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
  const { t } = useI18n();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 10 && Math.abs(gesture.dx) < Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 50 || gesture.vy > 0.4) {
            onClose();
          }
        },
      }),
    [onClose],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("Close")}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetKeyboardAvoid}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.sheetCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Draggable header area */}
            <View {...panResponder.panHandlers} style={styles.sheetHeader}>
              <View
                style={[
                  styles.sheetDragBar,
                  {
                    backgroundColor: colors.border,
                  },
                ]}
              />
              <View style={styles.sheetHeaderRow}>
                <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <Text style={[styles.sheetTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text
                      style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={[
                    styles.sheetCloseBtn,
                    {
                      backgroundColor: colors.fitSoft,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("Close")}
                >
                  <Ionicons name="close" size={18} color={colors.foreground} />
                </Pressable>
              </View>
            </View>

            <View style={styles.sheetBody}>{children}</View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    searchSortRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    searchContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      paddingVertical: 0,
    },
    sortBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 44,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    sortBtnText: {
      fontSize: 13,
      fontWeight: "700",
    },
    actionButtonsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 10,
      width: "100%",
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: 10,
    },
    actionBtnText: {
      fontSize: 14,
      fontWeight: "700",
    },
    twoButtonRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 10,
      width: "100%",
    },
    flexButton: {
      flex: 1,
      minHeight: 48,
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
    sheetOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    sheetKeyboardAvoid: {
      width: "100%",
      height: "82%",
      maxHeight: "85%",
      justifyContent: "flex-end",
    },
    sheetCard: {
      flex: 1,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    },
    sheetHeader: {
      alignItems: "center",
      paddingTop: 10,
      paddingBottom: 12,
    },
    sheetDragBar: {
      width: 44,
      height: 5,
      borderRadius: 3,
      marginBottom: 10,
    },
    sheetHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      paddingHorizontal: 20,
    },
    sheetTitle: {
      fontSize: 17,
      fontWeight: "700",
    },
    sheetSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    sheetCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetBody: {
      flex: 1,
      minHeight: 0,
      paddingBottom: Platform.OS === "ios" ? 34 : 16,
    },
    modalSearchContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 10,
      paddingHorizontal: 12,
      height: 40,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    modalSearchInput: {
      flex: 1,
      fontSize: 13,
      paddingVertical: 0,
    },
  });
