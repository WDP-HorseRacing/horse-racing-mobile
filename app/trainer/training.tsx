import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Chips, Panel, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { trainingService, type TrainingSessionDto } from "@/services/training.service";
import { formatDate, formatDateTime } from "@/utils/formatters";
import { formatTrainingStatus } from "@/features/training/training-utils";
import { clubDate } from "@/utils/horse-validation";
import { formatSessionType, formatIntensity } from "./plans";
import { space } from "@/config/theme";

type TrainingHubPayload = {
  classes: Awaited<ReturnType<typeof trainingService.listClasses>>;
  plans: Awaited<ReturnType<typeof trainingService.listPlans>>;
  sessions: TrainingSessionDto[];
};

export default function TrainerTraining() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const styles = getStyles(colors);
  const { token } = useAuth();
  const [tab, setTab] = useState("Classes");

  // Google Calendar state
  const todayStr = useMemo(() => clubDate(), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [anchorDate, setAnchorDate] = useState(todayStr);
  const [calFilter, setCalFilter] = useState<"ALL" | "IN_PROGRESS" | "SCHEDULED" | "COMPLETED">("ALL");
  const [viewMode, setViewMode] = useState<"day" | "agenda">("day");

  const load = useCallback(async (): Promise<TrainingHubPayload> => {
    const [classes, plans] = await Promise.all([
      trainingService.listClasses(token!),
      trainingService.listPlans(token!),
    ]);
    const sessionGroups = await Promise.all(
      classes.map((trainingClass) => trainingService.listClassSessions(token!, trainingClass.id)),
    );
    return { classes, plans, sessions: sessionGroups.flat() };
  }, [token]);
  const resource = useApiResource(load, Boolean(token));
  const payload = resource.data;
  const activeClasses = payload?.classes.filter((item) => item.status === "ACTIVE") ?? [];
  const liveSessions = payload?.sessions.filter((item) => item.status === "IN_PROGRESS") ?? [];
  const scheduledSessions = payload?.sessions.filter((item) => item.status === "SCHEDULED") ?? [];

  // 7-day week strip calculation centered around anchorDate
  const weekDays = useMemo(() => {
    const [y, m, d] = anchorDate.split("-").map(Number);
    const anchor = new Date(Date.UTC(y, m - 1, d));
    const dayOfWeek = (anchor.getUTCDay() + 6) % 7; // Monday = 0
    const monday = new Date(anchor.getTime() - dayOfWeek * 86400000);

    const days = [];
    const dayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday.getTime() + i * 86400000);
      const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayName: dayLabels[i],
        dayNum: date.getUTCDate(),
        month: date.getUTCMonth() + 1,
        year: date.getUTCFullYear(),
      });
    }
    return days;
  }, [anchorDate]);

  const changeWeek = (dayDelta: number) => {
    const [y, m, d] = anchorDate.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + dayDelta));
    const nextAnchor = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    setAnchorDate(nextAnchor);
  };

  const jumpToToday = () => {
    setAnchorDate(todayStr);
    setSelectedDate(todayStr);
    setViewMode("day");
  };

  const selectedMonth = weekDays[0]?.month ?? 10;
  const selectedYear = weekDays[0]?.year ?? 2026;
  const isViewingToday = selectedDate === todayStr;

  // Map sessions by date
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, TrainingSessionDto[]>();
    if (!payload?.sessions) return map;
    for (const session of payload.sessions) {
      const datePart = session.scheduledStartAt.slice(0, 10);
      const list = map.get(datePart) || [];
      list.push(session);
      map.set(datePart, list);
    }
    return map;
  }, [payload?.sessions]);

  return (
    <Screen
      role="trainer"
      title="Training"
      subtitle="Plans, classes and scheduled sessions"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      {/* Compact Axis-Aligned KPI Stat Cards */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiTile}>
          <View style={[styles.kpiIconBox, { backgroundColor: colors.fitSoft }]}>
            <Ionicons name="school-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.kpiContent}>
            <Text style={styles.kpiValue}>{activeClasses.length}</Text>
            <Text style={styles.kpiLabel} numberOfLines={1}>
              {t("Lớp đang mở")}
            </Text>
          </View>
        </View>

        <View style={styles.kpiTile}>
          <View style={[styles.kpiIconBox, { backgroundColor: colors.accent }]}>
            <Ionicons name="book-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.kpiContent}>
            <Text style={styles.kpiValue}>{payload?.plans.length ?? "—"}</Text>
            <Text style={styles.kpiLabel} numberOfLines={1}>
              {t("Giáo án")}
            </Text>
          </View>
        </View>

        <View style={styles.kpiTile}>
          <View style={[styles.kpiIconBox, { backgroundColor: colors.muted }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.mutedForeground} />
          </View>
          <View style={styles.kpiContent}>
            <Text style={styles.kpiValue}>{scheduledSessions.length}</Text>
            <Text style={styles.kpiLabel} numberOfLines={1}>
              {t("Buổi đã xếp")}
            </Text>
          </View>
        </View>

        <View style={styles.kpiTile}>
          <View
            style={[
              styles.kpiIconBox,
              {
                backgroundColor: liveSessions.length ? colors.injuredSoft : colors.muted,
              },
            ]}
          >
            <Ionicons
              name={liveSessions.length ? "radio" : "radio-outline"}
              size={18}
              color={liveSessions.length ? colors.destructive : colors.mutedForeground}
            />
          </View>
          <View style={styles.kpiContent}>
            <Text
              style={[
                styles.kpiValue,
                liveSessions.length > 0 && { color: colors.destructive },
              ]}
            >
              {liveSessions.length}
            </Text>
            <Text style={styles.kpiLabel} numberOfLines={1}>
              {t("Đang diễn ra")}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Hierarchy: Primary Hero Action + Sleek Secondary Action */}
      <View style={styles.actionSection}>
        <PrimaryButton
          label={t("Tạo lớp huấn luyện")}
          icon="add-circle-outline"
          onPress={() => router.push("/trainer/class/new" as Href)}
        />
        <SecondaryButton
          label={t("Quản lý giáo án")}
          icon="reader-outline"
          onPress={() => router.push("/trainer/plans" as Href)}
        />
      </View>

      <Chips options={["Classes", "Schedule"]} value={tab} onChange={setTab} />
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {payload && tab === "Classes" ? (
        <View style={ui.section}>
          <SectionTitle>{t("Training classes")}</SectionTitle>
          {payload.classes.length ? (
            payload.classes.map((trainingClass) => {
              const plan = payload.plans.find((p) => p.id === trainingClass.planId);
              return (
                <Pressable
                  key={trainingClass.id}
                  onPress={() => router.push(`/trainer/plan/${trainingClass.id}` as Href)}
                >
                  <Panel style={{ gap: space.xs }}>
                    {/* Header: Code badge and Status badge on top row, Class name on second row */}
                    <View style={{ gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeBadgeText}>{trainingClass.code}</Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            trainingClass.status === "ACTIVE"
                              ? { backgroundColor: colors.fitSoft }
                              : { backgroundColor: colors.muted },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              trainingClass.status === "ACTIVE"
                                ? { color: colors.primary }
                                : { color: colors.mutedForeground },
                            ]}
                          >
                            {formatTrainingStatus(trainingClass.status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={[ui.value, { fontSize: 16 }]} numberOfLines={2}>
                        {trainingClass.name}
                      </Text>
                    </View>

                    {plan ? (
                      <View style={styles.planRow}>
                        <Ionicons name="book-outline" size={13} color={colors.primary} />
                        <Text style={styles.planText} numberOfLines={1}>
                          {plan.name}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
                        <Text style={styles.metaText}>
                          {formatDate(trainingClass.startDate)} – {formatDate(trainingClass.endDate)}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={13} color={colors.mutedForeground} />
                        <Text style={styles.metaText}>
                          {t("Tối đa")} {trainingClass.maxHorses} {t("ngựa")}
                        </Text>
                      </View>
                    </View>
                  </Panel>
                </Pressable>
              );
            })
          ) : (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => void resource.refresh()}
              empty
              emptyLabel="No training classes yet. Create a class from one of your plans."
            />
          )}
        </View>
      ) : null}

      {payload && tab === "Schedule" ? (
        <View style={{ gap: space.md }}>
          {/* Google Calendar Header: Month/Year + Today/Nav + 7-Day Strip */}
          <View style={styles.calendarContainer}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              {/* Month & Year Title */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
                <Text style={styles.monthTitle}>
                  Tháng {selectedMonth}, {selectedYear}
                </Text>
              </View>

              {/* Navigation Controls */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pressable
                  onPress={() => changeWeek(-7)}
                  style={styles.calNavBtn}
                  accessibilityLabel="Tuần trước"
                >
                  <Ionicons name="chevron-back" size={18} color={colors.foreground} />
                </Pressable>

                <Pressable
                  onPress={jumpToToday}
                  style={[styles.calTodayBtn, isViewingToday && styles.calTodayBtnActive]}
                >
                  <Text style={[styles.calTodayBtnText, isViewingToday && { color: colors.primary }]}>
                    Hôm nay
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => changeWeek(7)}
                  style={styles.calNavBtn}
                  accessibilityLabel="Tuần sau"
                >
                  <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
                </Pressable>
              </View>
            </View>

            {/* 7-Day Week Strip */}
            <View style={styles.weekStrip}>
              {weekDays.map((day) => {
                const isSelected = day.dateStr === selectedDate && viewMode === "day";
                const isToday = day.dateStr === todayStr;
                const daySessions = sessionsByDate.get(day.dateStr) || [];
                const hasLive = daySessions.some((s) => s.status === "IN_PROGRESS");
                const hasScheduled = daySessions.some((s) => s.status === "SCHEDULED");
                const hasCompleted = daySessions.some((s) => s.status === "COMPLETED");

                return (
                  <Pressable
                    key={day.dateStr}
                    onPress={() => {
                      setSelectedDate(day.dateStr);
                      setViewMode("day");
                    }}
                    style={[
                      styles.dayColumn,
                      isSelected && styles.dayColumnSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNameText,
                        isToday && { color: colors.primary, fontWeight: "800" },
                        isSelected && { color: colors.primary, fontWeight: "800" },
                      ]}
                    >
                      {day.dayName}
                    </Text>
                    <View
                      style={[
                        styles.dayNumCircle,
                        isToday && !isSelected && styles.dayNumCircleToday,
                        isSelected && styles.dayNumCircleSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumText,
                          isToday && !isSelected && { color: colors.primary, fontWeight: "800" },
                          isSelected && { color: "#ffffff", fontWeight: "800" },
                        ]}
                      >
                        {day.dayNum}
                      </Text>
                    </View>
                    {/* Event Dots */}
                    <View style={styles.dotsRow}>
                      {hasLive ? <View style={[styles.eventDot, { backgroundColor: colors.destructive }]} /> : null}
                      {hasScheduled ? <View style={[styles.eventDot, { backgroundColor: colors.primary }]} /> : null}
                      {hasCompleted && !hasLive && !hasScheduled ? (
                        <View style={[styles.eventDot, { backgroundColor: colors.mutedForeground }]} />
                      ) : null}
                      {!daySessions.length ? <View style={[styles.eventDot, { opacity: 0 }]} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Sub-bar: View mode switcher & Filter chips */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Pressable
                onPress={() => setViewMode("day")}
                style={[styles.calFilterChip, viewMode === "day" && styles.calFilterChipActive]}
              >
                <Text style={[styles.calFilterChipText, viewMode === "day" && styles.calFilterChipTextActive]}>
                  {selectedDate === todayStr ? "Hôm nay" : formatDate(selectedDate)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setViewMode("agenda")}
                style={[styles.calFilterChip, viewMode === "agenda" && styles.calFilterChipActive]}
              >
                <Text style={[styles.calFilterChipText, viewMode === "agenda" && styles.calFilterChipTextActive]}>
                  Toàn bộ ({payload.sessions.length})
                </Text>
              </Pressable>
            </View>

            {/* Status Filter */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {(["ALL", "IN_PROGRESS", "SCHEDULED", "COMPLETED"] as const).map((st) => (
                <Pressable
                  key={st}
                  onPress={() => setCalFilter(st)}
                  style={[styles.calFilterChip, calFilter === st && styles.calFilterChipActive]}
                >
                  <Text style={[styles.calFilterChipText, calFilter === st && styles.calFilterChipTextActive]}>
                    {st === "ALL"
                      ? "Tất cả"
                      : st === "IN_PROGRESS"
                        ? `Live (${liveSessions.length})`
                        : st === "SCHEDULED"
                          ? `Sắp tới (${scheduledSessions.length})`
                          : "Đã xong"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Agenda Event Stream */}
          {(() => {
            let sessionList = payload.sessions;
            if (viewMode === "day") {
              sessionList = sessionList.filter((s) => s.scheduledStartAt.slice(0, 10) === selectedDate);
            }
            if (calFilter !== "ALL") {
              sessionList = sessionList.filter((s) => s.status === calFilter);
            }
            sessionList = [...sessionList].sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt));

            if (!sessionList.length) {
              return (
                <Panel style={{ padding: space.lg, alignItems: "center", gap: 8 }}>
                  <Ionicons name="calendar-outline" size={36} color={colors.mutedForeground} />
                  <Text style={[ui.value, { textAlign: "center" }]}>
                    {viewMode === "day"
                      ? `Không có buổi tập nào vào ngày ${formatDate(selectedDate)}`
                      : "Không có buổi tập nào phù hợp bộ lọc"}
                  </Text>
                  <Text style={[ui.muted, { textAlign: "center" }]}>
                    {viewMode === "day"
                      ? "Bạn có thể chọn ngày khác trên dải tuần ở trên hoặc xem toàn bộ lịch trình."
                      : "Thử chọn trạng thái khác hoặc lên lịch buổi tập mới trong lớp học."}
                  </Text>
                  {viewMode === "day" ? (
                    <SecondaryButton
                      label="Xem toàn bộ lịch trình"
                      onPress={() => setViewMode("agenda")}
                      style={{ marginTop: 6 }}
                    />
                  ) : null}
                </Panel>
              );
            }

            return (
              <View style={{ gap: space.sm }}>
                {sessionList.map((session) => {
                  const trainingClass = payload.classes.find((item) => item.id === session.classId);
                  const startTime = new Date(session.scheduledStartAt);
                  const endTime = session.scheduledEndAt ? new Date(session.scheduledEndAt) : null;
                  const startTimeStr = !isNaN(startTime.getTime())
                    ? `${String(startTime.getHours()).padStart(2, "0")}:${String(startTime.getMinutes()).padStart(2, "0")}`
                    : "—";
                  const endTimeStr = endTime && !isNaN(endTime.getTime())
                    ? `${String(endTime.getHours()).padStart(2, "0")}:${String(endTime.getMinutes()).padStart(2, "0")}`
                    : "";
                  const durationMinutes = endTime && !isNaN(startTime.getTime()) && !isNaN(endTime.getTime())
                    ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
                    : null;
                  const timeRangeStr = endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr;

                  return (
                    <View key={session.id} style={styles.timelineRow}>
                      {/* Left Time Column (Google Calendar timeline gutter) */}
                      <View style={styles.timelineTimeCol}>
                        <Text style={styles.timelineTimeText}>{startTimeStr}</Text>
                        {durationMinutes ? (
                          <Text style={styles.timelineDurationText}>{durationMinutes}p</Text>
                        ) : null}
                        {viewMode === "agenda" ? (
                          <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 4 }}>
                            {formatDate(session.scheduledStartAt.slice(0, 10))}
                          </Text>
                        ) : null}
                      </View>

                      {/* Right Event Block (Google Calendar Card) */}
                      <Pressable
                        style={[
                          styles.timelineCard,
                          {
                            borderLeftColor:
                              session.status === "IN_PROGRESS"
                                ? colors.destructive
                                : session.status === "COMPLETED"
                                  ? colors.fit
                                  : colors.primary,
                          },
                        ]}
                        onPress={() =>
                          router.push(`/trainer/plan/${session.classId}/session/${session.id}` as Href)
                        }
                      >
                        {/* Header: Title + Status */}
                        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                          <Text style={[ui.value, { flex: 1, fontSize: 15, fontWeight: "800" }]} numberOfLines={1}>
                            {session.name}
                          </Text>
                          <View
                            style={[
                              styles.statusBadge,
                              session.status === "IN_PROGRESS"
                                ? { backgroundColor: colors.injuredSoft }
                                : session.status === "COMPLETED"
                                  ? { backgroundColor: colors.muted }
                                  : { backgroundColor: colors.fitSoft },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                session.status === "IN_PROGRESS"
                                  ? { color: colors.destructive }
                                  : session.status === "COMPLETED"
                                    ? { color: colors.mutedForeground }
                                    : { color: colors.primary },
                              ]}
                            >
                              {formatTrainingStatus(session.status)}
                            </Text>
                          </View>
                        </View>

                        {/* Class Info Row */}
                        {trainingClass ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <View style={styles.codeBadge}>
                              <Text style={styles.codeBadgeText}>{trainingClass.code}</Text>
                            </View>
                            <Text style={{ fontSize: 12, color: colors.mutedForeground, flex: 1 }} numberOfLines={1}>
                              {trainingClass.name}
                            </Text>
                          </View>
                        ) : null}

                        {/* Details Chips */}
                        <View style={styles.metaRow}>
                          <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={13} color={colors.primary} />
                            <Text style={styles.metaText}>{timeRangeStr}</Text>
                          </View>
                          <View style={styles.metaItem}>
                            <Ionicons name="flag-outline" size={13} color={colors.primary} />
                            <Text style={styles.metaText}>{session.plannedDistanceM.toLocaleString()} m</Text>
                          </View>
                          <View style={styles.metaItem}>
                            <Ionicons name="flame-outline" size={13} color="#f59e0b" />
                            <Text style={styles.metaText}>{formatIntensity(session.intensity, t)}</Text>
                          </View>
                          {session.location ? (
                            <View style={styles.metaItem}>
                              <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
                              <Text style={styles.metaText} numberOfLines={1}>{session.location}</Text>
                            </View>
                          ) : null}
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </View>
      ) : null}
    </Screen>
  );
}

const getStyles = (colors: any) => ({
  kpiGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    marginBottom: 4,
  },
  kpiTile: {
    flex: 1,
    minWidth: "47%" as any,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  kpiContent: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: colors.foreground,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: colors.mutedForeground,
  },
  actionSection: {
    gap: 8,
    marginVertical: 4,
  },
  codeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
  },
  planRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  planText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.primary,
  },
  metaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    flexWrap: "wrap" as const,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  calendarContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 12,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: colors.foreground,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: colors.muted,
  },
  calTodayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  calTodayBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.fitSoft,
  },
  calTodayBtnText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: colors.foreground,
  },
  weekStrip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  dayColumn: {
    flex: 1,
    alignItems: "center" as const,
    gap: 4,
    paddingVertical: 6,
    borderRadius: 10,
  },
  dayColumnSelected: {
    backgroundColor: colors.accent,
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: colors.mutedForeground,
  },
  dayNumCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  dayNumCircleToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayNumCircleSelected: {
    backgroundColor: colors.primary,
  },
  dayNumText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: colors.foreground,
  },
  dotsRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 2,
    height: 6,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  timelineRow: {
    flexDirection: "row" as const,
    gap: 12,
  },
  timelineTimeCol: {
    width: 52,
    alignItems: "flex-end" as const,
    paddingTop: 10,
  },
  timelineTimeText: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: colors.foreground,
  },
  timelineDurationText: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  timelineCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    padding: 12,
    gap: 6,
  },
  calFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: colors.muted,
  },
  calFilterChipActive: {
    backgroundColor: colors.fitSoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  calFilterChipText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.mutedForeground,
  },
  calFilterChipTextActive: {
    color: colors.primary,
    fontWeight: "700" as const,
  },
});
