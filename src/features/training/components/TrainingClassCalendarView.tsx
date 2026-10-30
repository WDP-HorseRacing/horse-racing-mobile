import React, { useState, useMemo, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, ScrollView, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import type { TrainingSessionDto } from "@/services/training.service";
import { clubDate } from "@/utils/horse-validation";
import { clubDateTimeParts, formatTrainingStatus } from "@/features/training/training-utils";
import { formatTime, formatDate } from "@/utils/formatters";
import { PrimaryButton, SecondaryButton } from "@/components/ui";

const VI_SHORT_DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const VI_DAY_NAMES = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

const TIMELINE_START_HOUR = 6; // 06:00
const TIMELINE_END_HOUR = 22; // 22:00
const HOUR_SLOT_HEIGHT = 68; // Height per 1 hour slot in pixels

type ViewMode = "day" | "agenda";
type StatusFilter = "ALL" | "IN_PROGRESS" | "SCHEDULED" | "COMPLETED" | "CANCELLED";

type Props = {
  sessions: TrainingSessionDto[];
  classId: string;
  canAddSession?: boolean;
  onAddSession?: (prefillDate?: string) => void;
  onSelectSession: (session: TrainingSessionDto) => void;
};

export function TrainingClassCalendarView({
  sessions,
  classId,
  canAddSession = false,
  onAddSession,
  onSelectSession,
}: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useI18n();

  const todayStr = useMemo(() => clubDate(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [anchorDate, setAnchorDate] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [nowMinute, setNowMinute] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  // Keep live time updated for the current time red indicator line
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNowMinute(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  // Map sessions by date (YYYY-MM-DD)
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, TrainingSessionDto[]>();
    for (const session of sessions) {
      const datePart = session.scheduledStartAt.slice(0, 10);
      const list = map.get(datePart) || [];
      list.push(session);
      map.set(datePart, list);
    }
    // Sort sessions in each date by start time
    for (const [dateKey, list] of map.entries()) {
      list.sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt));
    }
    return map;
  }, [sessions]);

  // 7-day week strip centered around anchorDate
  const weekDays = useMemo(() => {
    const [y, m, d] = anchorDate.split("-").map(Number);
    const anchor = new Date(Date.UTC(y, m - 1, d));
    const dayOfWeek = (anchor.getUTCDay() + 6) % 7; // Monday = 0
    const monday = new Date(anchor.getTime() - dayOfWeek * 86_400_000);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday.getTime() + i * 86_400_000);
      const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      const dayIdx = date.getUTCDay();
      days.push({
        dateStr,
        dayName: VI_SHORT_DAYS[dayIdx],
        dayFullName: VI_DAY_NAMES[dayIdx],
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
  };

  const selectedMonth = weekDays[0]?.month ?? 10;
  const selectedYear = weekDays[0]?.year ?? 2026;
  const isViewingToday = selectedDate === todayStr;

  // Selected date full title
  const selectedDateHeader = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const dayIdx = dateObj.getUTCDay();
    return `${VI_DAY_NAMES[dayIdx]} – ${d} Tháng ${m}, ${y}`;
  }, [selectedDate]);

  // Sessions on the currently selected date
  const daySessions = useMemo(() => {
    let list = sessionsByDate.get(selectedDate) || [];
    if (statusFilter !== "ALL") {
      list = list.filter((s) => s.status === statusFilter);
    }
    return list;
  }, [sessionsByDate, selectedDate, statusFilter]);

  // All grouped dates for Agenda mode
  const agendaDates = useMemo(() => {
    const allDates = Array.from(sessionsByDate.keys()).sort();
    let filteredList: Array<{ dateStr: string; items: TrainingSessionDto[] }> = [];

    for (const dateKey of allDates) {
      let items = sessionsByDate.get(dateKey) || [];
      if (statusFilter !== "ALL") {
        items = items.filter((s) => s.status === statusFilter);
      }
      if (items.length > 0) {
        filteredList.push({ dateStr: dateKey, items });
      }
    }
    return filteredList;
  }, [sessionsByDate, statusFilter]);

  // Hours array for timeline grid: 06:00 to 22:00
  const timelineHours = useMemo(() => {
    const hours = [];
    for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) {
      hours.push(h);
    }
    return hours;
  }, []);

  // Compute position for the live red line
  const liveIndicatorTop = useMemo(() => {
    if (selectedDate !== todayStr) return null;
    if (
      nowMinute < TIMELINE_START_HOUR * 60 ||
      nowMinute > (TIMELINE_END_HOUR + 1) * 60
    ) {
      return null;
    }
    const minuteFromStart = nowMinute - TIMELINE_START_HOUR * 60;
    return minuteFromStart * (HOUR_SLOT_HEIGHT / 60);
  }, [selectedDate, todayStr, nowMinute]);

  const liveTimeString = useMemo(() => {
    const h = Math.floor(nowMinute / 60);
    const m = nowMinute % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }, [nowMinute]);

  // Helper for session status colors
  const getSessionColor = useCallback(
    (status: string) => {
      switch (status) {
        case "IN_PROGRESS":
          return {
            stripe: colors.destructive,
            bg: isDark ? "rgba(239, 68, 68, 0.22)" : "rgba(239, 68, 68, 0.12)",
            border: colors.destructive,
            text: colors.destructive,
          };
        case "COMPLETED":
          return {
            stripe: colors.fit,
            bg: isDark ? "rgba(16, 185, 129, 0.18)" : colors.fitSoft,
            border: colors.fit,
            text: colors.fit,
          };
        case "CANCELLED":
          return {
            stripe: colors.mutedForeground,
            bg: colors.muted,
            border: colors.border,
            text: colors.mutedForeground,
          };
        case "SCHEDULED":
        default:
          return {
            stripe: colors.primary,
            bg: isDark ? "rgba(59, 130, 246, 0.2)" : colors.primary + "18",
            border: colors.primary,
            text: colors.primary,
          };
      }
    },
    [colors, isDark],
  );

  return (
    <View style={styles.container}>
      {/* 1. Google Calendar Top Bar: Month/Year, Navigation, View Toggle, Today */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {/* Left: Month title */}
        <View style={styles.monthTitleWrapper}>
          <Ionicons name="calendar" size={18} color={colors.primary} />
          <Text style={[styles.monthTitleText, { color: colors.foreground }]}>
            Tháng {selectedMonth}, {selectedYear}
          </Text>
        </View>

        {/* Right: Controls (Prev/Next week, Today, View Toggle) */}
        <View style={styles.topControls}>
          <Pressable
            onPress={() => changeWeek(-7)}
            style={[styles.iconButton, { borderColor: colors.border }]}
            accessibilityLabel="Tuần trước"
          >
            <Ionicons name="chevron-back" size={17} color={colors.foreground} />
          </Pressable>

          <Pressable
            onPress={jumpToToday}
            style={[
              styles.todayButton,
              {
                backgroundColor: isViewingToday ? colors.fitSoft : colors.background,
                borderColor: isViewingToday ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.todayButtonText,
                { color: isViewingToday ? colors.primary : colors.foreground },
              ]}
            >
              Hôm nay
            </Text>
          </Pressable>

          <Pressable
            onPress={() => changeWeek(7)}
            style={[styles.iconButton, { borderColor: colors.border }]}
            accessibilityLabel="Tuần sau"
          >
            <Ionicons name="chevron-forward" size={17} color={colors.foreground} />
          </Pressable>

          {/* View Mode Toggle Switcher */}
          <View
            style={[
              styles.viewToggleGroup,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => setViewMode("day")}
              style={[
                styles.viewToggleItem,
                viewMode === "day" && { backgroundColor: colors.surface },
              ]}
              accessibilityLabel="Chế độ theo ngày"
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={viewMode === "day" ? colors.primary : colors.mutedForeground}
              />
            </Pressable>

            <Pressable
              onPress={() => setViewMode("agenda")}
              style={[
                styles.viewToggleItem,
                viewMode === "agenda" && { backgroundColor: colors.surface },
              ]}
              accessibilityLabel="Chế độ lịch trình"
            >
              <Ionicons
                name="list-outline"
                size={16}
                color={viewMode === "agenda" ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* 2. 7-Day Week Strip (Google Calendar Style) */}
      <View
        style={[
          styles.weekStripContainer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.weekStripRow}>
          {weekDays.map((day) => {
            const isSelected = day.dateStr === selectedDate && viewMode === "day";
            const isToday = day.dateStr === todayStr;
            const daySessionsList = sessionsByDate.get(day.dateStr) || [];
            const hasLive = daySessionsList.some((s) => s.status === "IN_PROGRESS");
            const hasScheduled = daySessionsList.some((s) => s.status === "SCHEDULED");
            const hasCompleted = daySessionsList.some((s) => s.status === "COMPLETED");

            return (
              <Pressable
                key={day.dateStr}
                onPress={() => {
                  setSelectedDate(day.dateStr);
                  if (viewMode !== "day") setViewMode("day");
                }}
                style={[
                  styles.dayColumn,
                  isSelected && {
                    backgroundColor: isDark
                      ? "rgba(59, 130, 246, 0.15)"
                      : "rgba(37, 99, 235, 0.08)",
                  },
                ]}
              >
                {/* Day name (T2, T3, T4...) */}
                <Text
                  style={[
                    styles.dayNameText,
                    { color: colors.mutedForeground },
                    (isToday || isSelected) && { color: colors.primary, fontWeight: "800" },
                  ]}
                >
                  {day.dayName}
                </Text>

                {/* Day number inside circle */}
                <View
                  style={[
                    styles.dayNumCircle,
                    isToday && !isSelected && {
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                    },
                    isSelected && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumText,
                      { color: colors.foreground },
                      isToday && !isSelected && { color: colors.primary, fontWeight: "800" },
                      isSelected && { color: "#FFFFFF", fontWeight: "800" },
                    ]}
                  >
                    {day.dayNum}
                  </Text>
                </View>

                {/* Event Dots */}
                <View style={styles.dotsRow}>
                  {hasLive && (
                    <View
                      style={[styles.eventDot, { backgroundColor: colors.destructive }]}
                    />
                  )}
                  {hasScheduled && (
                    <View
                      style={[styles.eventDot, { backgroundColor: colors.primary }]}
                    />
                  )}
                  {hasCompleted && !hasLive && !hasScheduled && (
                    <View
                      style={[styles.eventDot, { backgroundColor: colors.fit }]}
                    />
                  )}
                  {!daySessionsList.length && (
                    <View style={[styles.eventDot, { opacity: 0 }]} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 3. Action Sub-Bar: Header Text, Status Filters, Add Session */}
      <View style={styles.subBar}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.selectedDateTitle, { color: colors.foreground }]}>
            {viewMode === "day"
              ? selectedDateHeader
              : `Toàn bộ lịch trình (${sessions.length} buổi tập)`}
          </Text>
        </View>

        {canAddSession && onAddSession ? (
          <Pressable
            onPress={() => onAddSession(selectedDate)}
            style={[styles.addSessionBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addSessionBtnText}>Lên lịch</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Status Filter Chips */}
      <View style={styles.filterBar}>
        {(["ALL", "IN_PROGRESS", "SCHEDULED", "COMPLETED"] as const).map((st) => {
          const isActive = statusFilter === st;
          const label =
            st === "ALL"
              ? `Tất cả (${sessions.length})`
              : st === "IN_PROGRESS"
                ? `Đang diễn ra`
                : st === "SCHEDULED"
                  ? `Sắp tới`
                  : `Đã xong`;

          return (
            <Pressable
              key={st}
              onPress={() => setStatusFilter(st)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? colors.surface : colors.background,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: isActive ? colors.primary : colors.mutedForeground,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 4. MAIN VIEW CONTENT: DAY TIMELINE VS AGENDA */}
      {viewMode === "day" ? (
        /* ================= DAY TIMELINE VIEW (Image 2) ================= */
        <View
          style={[
            styles.timelineWrapper,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Timeline Grid Scroll Area */}
          <ScrollView
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: space.xl }}
            nestedScrollEnabled={true}
          >
            <View style={styles.timelineBody}>
              {/* Left Column: Time Labels */}
              <View style={styles.timeAxisCol}>
                {timelineHours.map((hour) => (
                  <View
                    key={hour}
                    style={[styles.timeAxisSlot, { height: HOUR_SLOT_HEIGHT }]}
                  >
                    <Text
                      style={[
                        styles.timeAxisText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {String(hour).padStart(2, "0")}:00
                    </Text>
                  </View>
                ))}
              </View>

              {/* Right Column: Grid Lines and Positioned Events */}
              <View style={styles.gridEventsCol}>
                {/* Horizontal Guide Lines */}
                {timelineHours.map((hour) => (
                  <View
                    key={hour}
                    style={[
                      styles.gridHourSlot,
                      {
                        height: HOUR_SLOT_HEIGHT,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  />
                ))}

                {/* Real-time Red Indicator Line (If selected date is Today) */}
                {liveIndicatorTop !== null && (
                  <View
                    style={[
                      styles.liveTimeLineContainer,
                      { top: liveIndicatorTop },
                    ]}
                  >
                    <View
                      style={[
                        styles.liveTimeBadge,
                        { backgroundColor: colors.destructive },
                      ]}
                    >
                      <Text style={styles.liveTimeBadgeText}>{liveTimeString}</Text>
                    </View>
                    <View
                      style={[
                        styles.liveTimeHorizontalLine,
                        { backgroundColor: colors.destructive },
                      ]}
                    />
                  </View>
                )}

                {/* Event Cards Positioned on the Timeline */}
                {daySessions.map((session) => {
                  const startParts = clubDateTimeParts(session.scheduledStartAt);
                  const endParts = clubDateTimeParts(session.scheduledEndAt);

                  let startMin = TIMELINE_START_HOUR * 60;
                  let endMin = (TIMELINE_START_HOUR + 1) * 60;

                  if (startParts) {
                    const [sh, sm] = startParts.time.split(":").map(Number);
                    startMin = sh * 60 + sm;
                  }
                  if (endParts) {
                    const [eh, em] = endParts.time.split(":").map(Number);
                    endMin = eh * 60 + em;
                  }
                  if (endMin <= startMin) endMin = startMin + 45;

                  // Compute top & height
                  const minuteFromBase = startMin - TIMELINE_START_HOUR * 60;
                  const durationMin = endMin - startMin;
                  const topPos = Math.max(0, minuteFromBase * (HOUR_SLOT_HEIGHT / 60));
                  const cardHeight = Math.max(48, durationMin * (HOUR_SLOT_HEIGHT / 60) - 4);

                  const palette = getSessionColor(session.status);

                  return (
                    <Pressable
                      key={session.id}
                      onPress={() => onSelectSession(session)}
                      style={[
                        styles.timelineEventCard,
                        {
                          top: topPos,
                          height: cardHeight,
                          backgroundColor: palette.bg,
                          borderColor: palette.border,
                          borderLeftColor: palette.stripe,
                        },
                      ]}
                    >
                      <View style={styles.timelineEventContent}>
                        {/* Title & Status badge */}
                        <View style={styles.timelineEventHeader}>
                          <Text
                            style={[styles.timelineEventTitle, { color: colors.foreground }]}
                            numberOfLines={1}
                          >
                            {session.name}
                          </Text>
                          <View
                            style={[
                              styles.miniStatusBadge,
                              { backgroundColor: palette.stripe + "25" },
                            ]}
                          >
                            <Text
                              style={[styles.miniStatusText, { color: palette.stripe }]}
                            >
                              {formatTrainingStatus(session.status)}
                            </Text>
                          </View>
                        </View>

                        {/* Time span */}
                        <View style={styles.timelineEventTimeRow}>
                          <Ionicons name="time-outline" size={12} color={palette.stripe} />
                          <Text style={[styles.timelineEventTimeText, { color: palette.stripe }]}>
                            {startParts?.time ?? "—"} – {endParts?.time ?? "—"}
                          </Text>
                          {session.plannedDistanceM > 0 && cardHeight >= 55 && (
                            <Text
                              style={[
                                styles.timelineEventMetaText,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              · {session.plannedDistanceM.toLocaleString()}m
                            </Text>
                          )}
                        </View>

                        {/* Extra metadata if block is tall enough */}
                        {cardHeight >= 75 && session.notes ? (
                          <Text
                            style={[styles.timelineEventNotes, { color: colors.mutedForeground }]}
                            numberOfLines={1}
                          >
                            {session.notes}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}

                {/* If no sessions on this day */}
                {daySessions.length === 0 && (
                  <View style={styles.emptyDayOverlay}>
                    <Ionicons
                      name="calendar-clear-outline"
                      size={28}
                      color={colors.mutedForeground}
                    />
                    <Text style={[styles.emptyDayTitle, { color: colors.foreground }]}>
                      Không có buổi tập nào
                    </Text>
                    <Text style={[styles.emptyDaySubtitle, { color: colors.mutedForeground }]}>
                      {selectedDateHeader}
                    </Text>
                    {canAddSession && onAddSession && (
                      <Pressable
                        onPress={() => onAddSession(selectedDate)}
                        style={[
                          styles.emptyDayAddBtn,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Ionicons name="add-circle-outline" size={15} color={colors.primary} />
                        <Text style={[styles.emptyDayAddBtnText, { color: colors.primary }]}>
                          Lên lịch cho ngày này
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      ) : (
        /* ================= AGENDA / SCHEDULE VIEW (Image 1) ================= */
        <View style={styles.agendaWrapper}>
          {agendaDates.length > 0 ? (
            agendaDates.map(({ dateStr, items }) => {
              const [y, m, d] = dateStr.split("-").map(Number);
              const dateObj = new Date(Date.UTC(y, m - 1, d));
              const dayIdx = dateObj.getUTCDay();
              const isToday = dateStr === todayStr;
              const headerText = `${VI_DAY_NAMES[dayIdx]} – ${d} Tháng ${m}`;

              return (
                <View key={dateStr} style={styles.agendaDayGroup}>
                  {/* Sticky-like Date Header */}
                  <View style={styles.agendaDateHeader}>
                    <Text
                      style={[
                        styles.agendaDateHeaderText,
                        {
                          color: isToday ? colors.destructive : colors.foreground,
                          fontWeight: isToday ? "800" : "700",
                        },
                      ]}
                    >
                      {headerText}
                    </Text>
                    {isToday && (
                      <View
                        style={[
                          styles.agendaTodayBadge,
                          { backgroundColor: colors.destructive },
                        ]}
                      >
                        <Text style={styles.agendaTodayBadgeText}>Hôm nay</Text>
                      </View>
                    )}
                  </View>

                  {/* Sessions for this date */}
                  <View style={{ gap: space.sm }}>
                    {items.map((session) => {
                      const startParts = clubDateTimeParts(session.scheduledStartAt);
                      const endParts = clubDateTimeParts(session.scheduledEndAt);
                      const palette = getSessionColor(session.status);

                      return (
                        <Pressable
                          key={session.id}
                          onPress={() => onSelectSession(session)}
                          style={[
                            styles.agendaEventCard,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                              borderLeftColor: palette.stripe,
                            },
                          ]}
                        >
                          <View style={styles.agendaEventBody}>
                            {/* Left: Name and tags */}
                            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                              <Text
                                style={[styles.agendaEventName, { color: colors.foreground }]}
                                numberOfLines={1}
                              >
                                {session.name}
                              </Text>
                              <View style={styles.agendaMetaRow}>
                                <View
                                  style={[
                                    styles.miniStatusBadge,
                                    { backgroundColor: palette.stripe + "20" },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.miniStatusText,
                                      { color: palette.stripe },
                                    ]}
                                  >
                                    {formatTrainingStatus(session.status)}
                                  </Text>
                                </View>
                                {session.plannedDistanceM > 0 && (
                                  <Text
                                    style={[
                                      styles.agendaEventSubText,
                                      { color: colors.mutedForeground },
                                    ]}
                                  >
                                    {session.plannedDistanceM.toLocaleString()}m
                                  </Text>
                                )}
                              </View>
                              {session.cancelReason && (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: colors.destructive,
                                  }}
                                  numberOfLines={1}
                                >
                                  Hủy: {session.cancelReason}
                                </Text>
                              )}
                            </View>

                            {/* Right: Time Range */}
                            <View style={styles.agendaTimeBox}>
                              <Text
                                style={[
                                  styles.agendaTimeText,
                                  { color: colors.foreground },
                                ]}
                              >
                                {startParts?.time ?? "—"}
                              </Text>
                              <Text
                                style={[
                                  styles.agendaTimeSubText,
                                  { color: colors.mutedForeground },
                                ]}
                              >
                                {endParts?.time ?? "—"}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })
          ) : (
            <View
              style={[
                styles.emptyStateCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={36}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>
                Không có buổi tập nào
              </Text>
              <Text style={[styles.emptyStateSub, { color: colors.mutedForeground }]}>
                Chưa có buổi tập nào phù hợp với bộ lọc này.
              </Text>
              {canAddSession && onAddSession && (
                <PrimaryButton
                  label="Lên lịch buổi tập mới"
                  icon="calendar-outline"
                  onPress={() => onAddSession(selectedDate)}
                />
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.sm,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space.xs,
    flexWrap: "wrap",
  },
  monthTitleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  monthTitleText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  topControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  todayButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  viewToggleGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 2,
    gap: 2,
    marginLeft: 4,
  },
  viewToggleItem: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  weekStripContainer: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: space.xs + 2,
    paddingHorizontal: 4,
  },
  weekStripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayColumn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    borderRadius: radius.md,
    gap: 2,
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  dayNumCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumText: {
    fontSize: 14,
    fontWeight: "700",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    height: 5,
    marginTop: 1,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  subBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 2,
    gap: space.sm,
  },
  selectedDateTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  addSessionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  addSessionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    paddingHorizontal: 2,
  },
  filterChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
  },
  timelineWrapper: {
    borderRadius: radius.lg,
    borderWidth: 1,
    maxHeight: 520,
    overflow: "hidden",
  },
  timelineBody: {
    flexDirection: "row",
    paddingTop: 8,
  },
  timeAxisCol: {
    width: 46,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(150, 150, 150, 0.2)",
    alignItems: "flex-end",
    paddingRight: 6,
  },
  timeAxisSlot: {
    justifyContent: "flex-start",
  },
  timeAxisText: {
    fontSize: 11,
    fontWeight: "600",
    top: -6,
  },
  gridEventsCol: {
    flex: 1,
    position: "relative",
  },
  gridHourSlot: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: "100%",
  },
  liveTimeLineContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  liveTimeBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 2,
  },
  liveTimeBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  liveTimeHorizontalLine: {
    flex: 1,
    height: 1.5,
  },
  timelineEventCard: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    zIndex: 5,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  timelineEventContent: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  timelineEventHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  timelineEventTitle: {
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  timelineEventTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timelineEventTimeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  timelineEventMetaText: {
    fontSize: 11,
  },
  timelineEventNotes: {
    fontSize: 10,
    fontStyle: "italic",
    marginTop: 1,
  },
  miniStatusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniStatusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  emptyDayOverlay: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: space.md,
  },
  emptyDayTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyDaySubtitle: {
    fontSize: 12,
  },
  emptyDayAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 4,
  },
  emptyDayAddBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  agendaWrapper: {
    gap: space.md,
  },
  agendaDayGroup: {
    gap: space.xs,
  },
  agendaDateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  agendaDateHeaderText: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  agendaTodayBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  agendaTodayBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  agendaEventCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  agendaEventBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  agendaEventName: {
    fontSize: 15,
    fontWeight: "700",
  },
  agendaMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  agendaEventSubText: {
    fontSize: 12,
  },
  agendaTimeBox: {
    alignItems: "flex-end",
    gap: 1,
  },
  agendaTimeText: {
    fontSize: 14,
    fontWeight: "800",
  },
  agendaTimeSubText: {
    fontSize: 11,
  },
  emptyStateCard: {
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyStateSub: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: space.sm,
  },
});
