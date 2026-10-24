import { router, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { SectionTitle } from "@/components/common";
import { Chips, Metric, Panel, ProgressBar, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import type { RoleId } from "@/types/raceos";
import type { HorseListItemDto } from "@/adapters/horse.adapter";
import type { BarnListItemDto, StallDto } from "@/services/stable.service";
import type { MedicalDashboardDto } from "@/adapters/medical.adapter";
import type { IncidentDto } from "@/services/stable-care.service";
import type { SupplyItemDto } from "@/adapters/supplies.adapter";
import type { TrainingClassDto, TrainingSessionDto } from "@/services/training.service";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { medicalService } from "@/services/medical.service";

type CheckupItemDto = MedicalDashboardDto["checkups"][number];

export type ManagerTrainerDashboardData = {
  horses: HorseListItemDto[];
  barns: BarnListItemDto[];
  stalls: StallDto[];
  medical: MedicalDashboardDto;
  checkups: CheckupItemDto[];
  costs?: { key: string; label: string; total: number; count: number }[];
  stable: {
    incidents: IncidentDto[];
    lowStock: SupplyItemDto[];
    pendingSupply: number;
  };
  classes: TrainingClassDto[];
  sessions: TrainingSessionDto[];
};

type AttentionItem = {
  key: string;
  level: "danger" | "warn" | "info";
  title: string;
  detail?: string;
  to: Href;
  cta: string;
};

export function ManagerTrainerDashboard({
  role,
  data,
  token,
}: {
  role: RoleId;
  data: ManagerTrainerDashboardData;
  token: string;
  onRefresh: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [trainerScope, setTrainerScope] = useState<"mine" | "all">("mine");
  const [scopedMedical, setScopedMedical] = useState<{
    scope: "mine" | "all";
    data: MedicalDashboardDto;
  } | null>(null);

  const medical =
    scopedMedical && scopedMedical.scope === trainerScope
      ? scopedMedical.data
      : data.medical;

  const switchTrainerScope = async (scope: "mine" | "all") => {
    if (scope === trainerScope || !token || role !== "trainer") return;
    setTrainerScope(scope);
    try {
      const updated = await medicalService.getDashboard(token, {
        mine: scope === "mine",
      });
      setScopedMedical({ scope, data: updated });
    } catch {
      // Keep existing on error
    }
  };

  // --- 1. OPERATIONAL OVERVIEW CALCULATIONS ---
  const horses = data.horses;
  const barns = data.barns;
  const stalls = data.stalls;

  const isBlocked = (h: HorseListItemDto) =>
    h.lifecycleStatus === "ACTIVE" &&
    (h.healthStatus === "INJURED" ||
      h.healthStatus === "QUARANTINED" ||
      (h.healthStatus === "ELIGIBLE" && !h.canRegisterRace));

  const isWatch = (h: HorseListItemDto) =>
    h.lifecycleStatus === "ACTIVE" && h.healthStatus === "UNDER_OBSERVATION";

  const blockedHorses = useMemo(() => horses.filter(isBlocked), [horses]);
  const watchHorses = useMemo(() => horses.filter(isWatch), [horses]);

  const pendingBarnHorses = useMemo(
    () => horses.filter((h) => h.location.placementStatus === "PENDING_BARN" || !h.location.barn),
    [horses],
  );

  const pendingStallHorses = useMemo(
    () =>
      horses.filter(
        (h) =>
          h.location.placementStatus === "PENDING_STALL" ||
          (Boolean(h.location.barn) && !h.location.stall),
      ),
    [horses],
  );

  const urgentRequests = useMemo(
    () => medical.pendingRequests.filter((item) => item.urgent),
    [medical.pendingRequests],
  );

  const overdueCheckups = useMemo(
    () => medical.checkups.filter((item) => item.daysLeft < -7),
    [medical.checkups],
  );

  // Stalls occupancy
  const ownBarnIds = useMemo(() => new Set(barns.map((b) => b.id)), [barns]);
  const ownStalls = useMemo(
    () => stalls.filter((s) => ownBarnIds.has(s.barnId)),
    [stalls, ownBarnIds],
  );
  const occupiedStalls = useMemo(
    () => ownStalls.filter((s) => s.status === "OCCUPIED"),
    [ownStalls],
  );
  const usableStalls = useMemo(
    () => ownStalls.filter((s) => s.status === "AVAILABLE" || s.status === "OCCUPIED"),
    [ownStalls],
  );
  const occupancyRate =
    usableStalls.length > 0 ? Math.round((occupiedStalls.length / usableStalls.length) * 100) : 0;

  // --- 2. ATTENTION LIST ---
  const attentionItems = useMemo<AttentionItem[]>(() => {
    const list: AttentionItem[] = [];

    // Urgent Medical Requests (DANGER)
    urgentRequests.forEach((req) => {
      list.push({
        key: `req-${req.id}`,
        level: "danger",
        title: `${t("Urgent checkup request")}: ${req.horseName}`,
        detail: req.description,
        to: `/${role}/medical/requests` as Href,
        cta: t("Track"),
      });
    });

    // Urgent or stale Incidents (DANGER)
    data.stable.incidents
      .filter((inc) => inc.urgent)
      .forEach((inc) => {
        list.push({
          key: `inc-urgent-${inc.id}`,
          level: "danger",
          title: `${t("Urgent incident")}: ${inc.horseName}`,
          detail: inc.description,
          to: `/${role}/incidents` as Href,
          cta: t("Resolve"),
        });
      });

    // Other open Incidents (WARN)
    data.stable.incidents
      .filter((inc) => !inc.urgent)
      .forEach((inc) => {
        list.push({
          key: `inc-${inc.id}`,
          level: "warn",
          title: `${t("Stable incident")}: ${inc.horseName}`,
          detail: inc.description,
          to: `/${role}/incidents` as Href,
          cta: t("View"),
        });
      });

    // Pending Barn (WARN - Manager)
    pendingBarnHorses.forEach((horse) => {
      list.push({
        key: `pending-barn-${horse.id}`,
        level: "warn",
        title: `${horse.name} ${t("waiting for barn assignment")}`,
        detail: t("No barn assigned yet"),
        to: `/${role}/stable` as Href,
        cta: t("Assign barn"),
      });
    });

    // Pending Stall (WARN - Trainer & Manager)
    pendingStallHorses.forEach((horse) => {
      list.push({
        key: `pending-stall-${horse.id}`,
        level: "warn",
        title: `${horse.name} ${t("waiting for stall placement")}`,
        detail: horse.location.barn?.name ?? t("Barn assigned"),
        to: `/${role}/stable` as Href,
        cta: t("Assign stall"),
      });
    });

    // Overdue Checkups > 7 days (WARN)
    overdueCheckups.forEach((chk) => {
      list.push({
        key: `due-${chk.horseId}`,
        level: "warn",
        title: `${chk.horseName} ${t("periodic checkup overdue")} ${Math.abs(chk.daysLeft)} ${t("days")}`,
        detail: `${t("Due date")}: ${formatDate(chk.dueDate)}`,
        to: `/${role}/medical/checkups` as Href,
        cta: t("View"),
      });
    });

    // Pending Supply Requests (WARN - Manager only)
    if (data.stable.pendingSupply > 0) {
      list.push({
        key: "supply-pending-requests",
        level: "warn",
        title: `${data.stable.pendingSupply} ${t("supply requests pending review")}`,
        detail: t("Awaiting manager authorization"),
        to: `/${role}/inventory` as Href,
        cta: t("Review"),
      });
    }

    // Barns with no room (INFO)
    barns
      .filter((b) => b.status === "ACTIVE" && b.hasActiveHeadTrainer && b.availableStallCount <= 0)
      .forEach((b) => {
        list.push({
          key: `barn-full-${b.id}`,
          level: "info",
          title: `${b.name} ${t("is at full capacity")}`,
          detail: t("No available stalls remaining in this barn"),
          to: `/${role}/stable` as Href,
          cta: t("View barn"),
        });
      });

    // Barns without Head Trainer (INFO - Manager)
    if (role === "manager") {
      barns
        .filter((b) => b.status === "ACTIVE" && !b.hasActiveHeadTrainer)
        .forEach((b) => {
          list.push({
            key: `barn-no-ht-${b.id}`,
            level: "info",
            title: `${b.name} ${t("has no active Head Trainer")}`,
            detail: t("Barn cannot accept horses without head trainer"),
            to: `/${role}/stable` as Href,
            cta: t("Assign HT"),
          });
        });
    }

    // Low stock supplies (INFO)
    if (data.stable.lowStock.length > 0) {
      list.push({
        key: "supplies-low-stock-alert",
        level: "info",
        title: `${data.stable.lowStock.length} ${t("items running low in inventory")}`,
        detail: data.stable.lowStock
          .slice(0, 3)
          .map((item) => item.name)
          .join(", "),
        to: `/${role}/inventory` as Href,
        cta: t("Inventory"),
      });
    }

    // Blocked Horses (INFO)
    blockedHorses.slice(0, 4).forEach((horse) => {
      list.push({
        key: `blocked-${horse.id}`,
        level: "info",
        title: `${horse.name} ${t("cannot participate in training")}`,
        detail:
          horse.healthStatus === "INJURED"
            ? t("Currently injured")
            : horse.healthStatus === "QUARANTINED"
              ? t("In quarantine")
              : t("Training locked by veterinarian"),
        to: `/${role}/horse/${horse.id}` as Href,
        cta: t("Profile"),
      });
    });

    // Watch Horses (INFO)
    watchHorses.slice(0, 3).forEach((horse) => {
      list.push({
        key: `watch-${horse.id}`,
        level: "info",
        title: `${horse.name} ${t("requires health monitoring")}`,
        detail: t("Eligible for training, restricted from race entry"),
        to: `/${role}/horse/${horse.id}` as Href,
        cta: t("Profile"),
      });
    });

    const levelRank = { danger: 0, warn: 1, info: 2 };
    return list.sort((a, b) => levelRank[a.level] - levelRank[b.level]);
  }, [
    urgentRequests,
    data.stable.incidents,
    data.stable.pendingSupply,
    data.stable.lowStock,
    pendingBarnHorses,
    pendingStallHorses,
    overdueCheckups,
    barns,
    role,
    blockedHorses,
    watchHorses,
    t,
  ]);

  // --- 3. TRAINING ACTIVITIES ---
  const activeClasses = useMemo(
    () => data.classes.filter((c) => c.status === "ACTIVE"),
    [data.classes],
  );
  const cancelledClasses = useMemo(
    () => data.classes.filter((c) => c.status === "CANCELLED"),
    [data.classes],
  );
  const completedClasses = useMemo(
    () => data.classes.filter((c) => c.status === "COMPLETED"),
    [data.classes],
  );

  // Mon-Sun weekly sessions calculation with highlighted current day
  const weeklySessionColumns = useMemo(() => {
    const now = new Date();
    // Monday of current week
    const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const pad = (n: number) => String(n).padStart(2, "0");
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    return days.map((dayLabel, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const count = data.sessions.filter((s) => {
        if (!s.scheduledStartAt) return false;
        return s.scheduledStartAt.startsWith(dateKey);
      }).length;

      return {
        key: dateKey,
        dayLabel,
        dateNumber: d.getDate(),
        isToday: dateKey === todayKey,
        count,
      };
    });
  }, [data.sessions]);

  const totalWeeklySessions = weeklySessionColumns.reduce((sum, d) => sum + d.count, 0);
  const maxWeeklyCount = Math.max(1, ...weeklySessionColumns.map((d) => d.count));

  // --- 4. HEALTH & MEDICAL ---
  const herdCounts = medical.herd?.counts ?? {
    ELIGIBLE: 0,
    UNDER_OBSERVATION: 0,
    INJURED: 0,
    QUARANTINED: 0,
  };
  const totalHerd =
    (herdCounts.ELIGIBLE || 0) +
    (herdCounts.UNDER_OBSERVATION || 0) +
    (herdCounts.INJURED || 0) +
    (herdCounts.QUARANTINED || 0);

  const herdPercentages = {
    eligible: totalHerd > 0 ? Math.round(((herdCounts.ELIGIBLE || 0) / totalHerd) * 100) : 0,
    observation:
      totalHerd > 0 ? Math.round(((herdCounts.UNDER_OBSERVATION || 0) / totalHerd) * 100) : 0,
    injured: totalHerd > 0 ? Math.round(((herdCounts.INJURED || 0) / totalHerd) * 100) : 0,
    quarantined: totalHerd > 0 ? Math.round(((herdCounts.QUARANTINED || 0) / totalHerd) * 100) : 0,
  };

  const openCases = medical.openCases ?? [];

  // --- 5. COSTS (MANAGER) & UPCOMING SCHEDULE ---
  const totalCost6Months = (data.costs ?? []).reduce((sum, c) => sum + c.total, 0);
  const totalVisits6Months = (data.costs ?? []).reduce((sum, c) => sum + c.count, 0);
  const maxCostValue = Math.max(1, ...(data.costs ?? []).map((c) => c.total));

  // 7-day upcoming medical schedule (checkups and follow-up visits)
  const upcomingVisits = useMemo(() => {
    type VisitItem = {
      id: string;
      horseId: string;
      horseName: string;
      typeLabel: string;
      date: string;
      daysLeft: number;
      isOverdue: boolean;
      to: Href;
    };
    const list: VisitItem[] = [];
    const allCheckups = data.checkups?.length ? data.checkups : (medical.checkups ?? []);

    // 1. Follow-up appointments from openCases
    (medical.openCases ?? []).forEach((c) => {
      if (c.nextVisitAt) {
        const visitDate = new Date(c.nextVisitAt);
        const now = new Date();
        const diffDays = Math.ceil((visitDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          list.push({
            id: `case-${c.caseId}`,
            horseId: c.horseId,
            horseName: c.horseName,
            typeLabel: `${t("Follow-up:")} ${c.initialDiagnosis}`,
            date: c.nextVisitAt,
            daysLeft: diffDays,
            isOverdue: diffDays < 0,
            to: `/${role}/medical/cases/${c.caseId}` as Href,
          });
        }
      }
    });

    // 2. Routine checkups in next 7 days or overdue
    allCheckups.forEach((chk) => {
      const targetDate = chk.appointment?.scheduledAt || chk.dueDate;
      const isDueSoonOrOverdue = chk.daysLeft <= 7;
      if (isDueSoonOrOverdue || chk.appointment) {
        list.push({
          id: `chk-${chk.horseId}`,
          horseId: chk.horseId,
          horseName: chk.horseName,
          typeLabel: chk.appointment
            ? `${t("Routine checkup")} (${t("Set appointment")})`
            : t("Routine checkup"),
          date: targetDate,
          daysLeft: chk.daysLeft,
          isOverdue: chk.daysLeft < 0,
          to: `/${role}/medical/checkups` as Href,
        });
      }
    });

    // Fallback if none <= 7 days: show upcoming checkups nearest in schedule
    if (list.length === 0 && allCheckups.length > 0) {
      const sorted = [...allCheckups].sort((a, b) => a.daysLeft - b.daysLeft);
      sorted.slice(0, 4).forEach((chk) => {
        list.push({
          id: `chk-${chk.horseId}`,
          horseId: chk.horseId,
          horseName: chk.horseName,
          typeLabel: t("Routine checkup"),
          date: chk.appointment?.scheduledAt || chk.dueDate,
          daysLeft: chk.daysLeft,
          isOverdue: chk.daysLeft < 0,
          to: `/${role}/medical/checkups` as Href,
        });
      });
    }

    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [data.checkups, medical.checkups, medical.openCases, role, t]);

  return (
    <View style={{ gap: space.lg }}>
      {/* ======================================================== */}
      {/* 1. TỔNG QUAN VẬN HÀNH (OPERATIONAL OVERVIEW)               */}
      {/* ======================================================== */}
      <View style={uiStyles.metricGrid}>
        <Metric
          label={role === "trainer" ? "Ngựa trong khu" : "Ngựa ở câu lạc bộ"}
          value={horses.length}
          hint={
            role === "trainer"
              ? `${watchHorses.length} ${t("need observation")}`
              : `${blockedHorses.length} ${t("cannot train")}`
          }
        />
        <Metric
          label={t("Awaiting placement")}
          value={pendingBarnHorses.length + pendingStallHorses.length}
          hint={
            pendingBarnHorses.length > 0
              ? `${pendingBarnHorses.length} ${t("need barn")}`
              : `${pendingStallHorses.length} ${t("need stall")}`
          }
          tone={pendingBarnHorses.length + pendingStallHorses.length > 0 ? "warning" : "good"}
        />
        <Metric
          label={t("Urgent checkups")}
          value={urgentRequests.length}
          hint={`${medical.pendingRequests.length} ${t("requests pending")}`}
          tone={urgentRequests.length > 0 ? "danger" : "default"}
        />
        <Metric
          label={t("Overdue checkups")}
          value={overdueCheckups.length}
          hint={t("> 7 days overdue")}
          tone={overdueCheckups.length > 0 ? "warning" : "good"}
        />
      </View>

      {/* Tình trạng ô chuồng (Occupancy Card) */}
      <View style={uiStyles.section}>
        <View style={uiStyles.row}>
          <SectionTitle>Tình trạng ô chuồng</SectionTitle>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/${role}/stable` as Href)}
            style={styles.headerActionLink}
          >
            <Text style={styles.headerActionLinkText}>{t("Stable map")}</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.primary} />
          </Pressable>
        </View>

        <Panel>
          <View style={[uiStyles.row, { alignItems: "center", marginBottom: space.sm }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cardHighlightTitle}>
                {occupiedStalls.length}/{usableStalls.length} {t("stalls occupied")}
              </Text>
              <Text style={uiStyles.muted}>{t("Total usable capacity across assigned barns")}</Text>
            </View>
            <View style={styles.rateBadge}>
              <Text style={styles.rateBadgeText}>{occupancyRate}%</Text>
            </View>
          </View>

          <ProgressBar
            value={occupancyRate}
            tone={occupancyRate > 90 ? colors.monitor : colors.primary}
          />

          {/* Breakdown by barn */}
          <View style={styles.barnDistributionList}>
            {barns.slice(0, 4).map((barn) => {
              const barnStalls = stalls.filter((s) => s.barnId === barn.id);
              const bOccupied = barnStalls.filter((s) => s.status === "OCCUPIED").length;
              const bTotal = barnStalls.length;
              return (
                <Pressable
                  key={barn.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/${role}/stable` as Href)}
                  style={styles.barnRowItem}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                    <View
                      style={[
                        styles.dotIndicator,
                        {
                          backgroundColor:
                            barn.availableStallCount <= 0 ? colors.injured : colors.fit,
                        },
                      ]}
                    />
                    <Text style={styles.barnRowName} numberOfLines={1}>
                      {barn.name}
                    </Text>
                  </View>
                  <Text style={styles.barnRowNumbers}>
                    {bOccupied}/{bTotal} {t("stalls")}
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.mutedForeground} />
                </Pressable>
              );
            })}
          </View>
        </Panel>
      </View>

      {/* ======================================================== */}
      {/* 2. CẦN XỬ LÝ (ATTENTION LIST)                             */}
      {/* ======================================================== */}
      <View style={uiStyles.section}>
        <View style={uiStyles.row}>
          <SectionTitle>Cần xử lý</SectionTitle>
          {attentionItems.length > 0 ? (
            <View style={styles.attentionCountPill}>
              <Text style={styles.attentionCountPillText}>
                {attentionItems.length} {t("tasks")}
              </Text>
            </View>
          ) : null}
        </View>

        {attentionItems.length === 0 ? (
          <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
            <Ionicons name="checkmark-circle-outline" size={28} color={colors.fit} />
            <Text style={[uiStyles.muted, { marginTop: 4, fontWeight: "600" }]}>
              {t("No action items need attention right now.")}
            </Text>
          </Panel>
        ) : (
          <View style={{ gap: space.sm }}>
            {attentionItems.slice(0, 7).map((item) => {
              const dotColor =
                item.level === "danger"
                  ? colors.destructive
                  : item.level === "warn"
                    ? colors.monitor
                    : colors.primary;

              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  onPress={() => router.push(item.to)}
                  style={styles.attentionItemRow}
                >
                  <View style={[styles.attentionDot, { backgroundColor: dotColor }]} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.attentionItemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.detail ? (
                      <Text style={uiStyles.muted} numberOfLines={1}>
                        {item.detail}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.attentionCtaPill}>
                    <Text style={styles.attentionCtaText}>{item.cta}</Text>
                    <Ionicons name="chevron-forward" size={11} color={colors.primary} />
                  </View>
                </Pressable>
              );
            })}
            {attentionItems.length > 7 ? (
              <Text style={[uiStyles.muted, { textAlign: "center", fontSize: 12, marginTop: 4 }]}>
                {t("And")} {attentionItems.length - 7} {t("other items")}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      {/* ======================================================== */}
      {/* 3. HOẠT ĐỘNG HUẤN LUYỆN (TRAINING ACTIVITIES)             */}
      {/* ======================================================== */}
      <View style={uiStyles.section}>
        <View style={uiStyles.row}>
          <SectionTitle>Lớp huấn luyện</SectionTitle>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/${role}/training` as Href)}
            style={styles.headerActionLink}
          >
            <Text style={styles.headerActionLinkText}>{t("Training schedule")}</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.primary} />
          </Pressable>
        </View>

        {/* Classes Status Summary Grid */}
        <View style={styles.trainingClassesRow}>
          <View style={styles.classStatusBox}>
            <Text style={styles.classStatusNumber}>{activeClasses.length}</Text>
            <Text style={styles.classStatusLabel}>{t("Active classes")}</Text>
          </View>
          <View style={styles.classStatusBox}>
            <Text style={[styles.classStatusNumber, { color: colors.mutedForeground }]}>
              {cancelledClasses.length}
            </Text>
            <Text style={styles.classStatusLabel}>{t("Cancelled")}</Text>
          </View>
          <View style={styles.classStatusBox}>
            <Text style={[styles.classStatusNumber, { color: colors.fit }]}>
              {completedClasses.length}
            </Text>
            <Text style={styles.classStatusLabel}>{t("Completed")}</Text>
          </View>
        </View>

        {/* Active Class Cards Preview */}
        {activeClasses.length > 0 ? (
          <View style={{ gap: space.xs, marginTop: space.xs }}>
            {activeClasses.slice(0, 3).map((cl) => {
              const clSessions = data.sessions.filter((s) => s.classId === cl.id);
              const doneCount = clSessions.filter((s) => s.status === "COMPLETED").length;
              const clProgress =
                clSessions.length > 0 ? Math.round((doneCount / clSessions.length) * 100) : 0;

              return (
                <Panel key={cl.id}>
                  <View style={[uiStyles.row, { alignItems: "center" }]}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={styles.classCardCode}>{cl.code}</Text>
                      <Text style={styles.classCardName} numberOfLines={1}>
                        {cl.name}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.classCardSessionsText}>
                        {doneCount}/{clSessions.length} {t("sessions")}
                      </Text>
                      <Text style={uiStyles.muted}>
                        {cl.raceAptitude ? cl.raceAptitude : t("General")}
                      </Text>
                    </View>
                  </View>
                  <View style={{ marginTop: space.xs }}>
                    <ProgressBar value={clProgress} tone={colors.training} />
                  </View>
                </Panel>
              );
            })}
          </View>
        ) : (
          <Panel>
            <Text style={uiStyles.muted}>{t("No active classes currently running.")}</Text>
          </Panel>
        )}

        {/* Buổi tập tuần này (Weekly Column Chart) */}
        <Panel style={{ marginTop: space.sm }}>
          <View style={[uiStyles.row, { alignItems: "center", marginBottom: space.sm }]}>
            <View>
              <Text style={styles.cardHighlightTitle}>Buổi tập tuần này</Text>
              <Text style={uiStyles.muted}>
                {totalWeeklySessions} {t("sessions scheduled this week")}
              </Text>
            </View>
          </View>

          <View style={styles.weeklyChartContainer}>
            {weeklySessionColumns.map((col) => {
              const heightPercent =
                maxWeeklyCount > 0
                  ? Math.max(8, Math.round((col.count / maxWeeklyCount) * 100))
                  : 8;

              return (
                <View key={col.key} style={styles.weeklyBarColumn}>
                  <Text style={styles.weeklyBarCountText}>{col.count > 0 ? col.count : ""}</Text>
                  <View style={styles.weeklyBarTrack}>
                    <View
                      style={[
                        styles.weeklyBarFill,
                        {
                          height: `${heightPercent}%`,
                          backgroundColor: col.isToday
                            ? colors.primary
                            : col.count > 0
                              ? colors.training
                              : colors.border,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.weeklyBarDayLabel,
                      col.isToday && { color: colors.primary, fontWeight: "800" },
                    ]}
                  >
                    {col.dayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.weeklyBarDateNumber,
                      col.isToday && { color: colors.primary, fontWeight: "700" },
                    ]}
                  >
                    {col.dateNumber}
                  </Text>
                  {col.isToday ? <View style={styles.todayDot} /> : null}
                </View>
              );
            })}
          </View>
        </Panel>
      </View>

      {/* ======================================================== */}
      {/* 4. SỨC KHỎE VÀ Y TẾ (HERD HEALTH & MEDICAL)               */}
      {/* ======================================================== */}
      <View style={uiStyles.section}>
        <View style={uiStyles.row}>
          <SectionTitle>Sức khỏe</SectionTitle>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/${role}/medical` as Href)}
            style={styles.headerActionLink}
          >
            <Text style={styles.headerActionLinkText}>{t("Medical overview")}</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.primary} />
          </Pressable>
        </View>

        {role === "trainer" ? (
          <View style={{ marginBottom: space.sm }}>
            <Chips
              options={["Khu của tôi", "Toàn câu lạc bộ"]}
              value={trainerScope === "mine" ? "Khu của tôi" : "Toàn câu lạc bộ"}
              onChange={(val) => void switchTrainerScope(val === "Khu của tôi" ? "mine" : "all")}
            />
          </View>
        ) : null}

        <Panel>
          <Text style={styles.cardHighlightTitle}>{t("Herd health distribution")}</Text>
          <Text style={[uiStyles.muted, { marginBottom: space.sm }]}>
            {totalHerd} {t("active horses total")}
          </Text>

          {/* Segmented Horizontal Distribution Bar */}
          <View style={styles.segmentedBarTrack}>
            {herdPercentages.eligible > 0 ? (
              <View
                style={[
                  styles.segmentedBarPart,
                  { width: `${herdPercentages.eligible}%`, backgroundColor: colors.fit },
                ]}
              />
            ) : null}
            {herdPercentages.observation > 0 ? (
              <View
                style={[
                  styles.segmentedBarPart,
                  { width: `${herdPercentages.observation}%`, backgroundColor: colors.monitor },
                ]}
              />
            ) : null}
            {herdPercentages.injured > 0 ? (
              <View
                style={[
                  styles.segmentedBarPart,
                  { width: `${herdPercentages.injured}%`, backgroundColor: colors.destructive },
                ]}
              />
            ) : null}
            {herdPercentages.quarantined > 0 ? (
              <View
                style={[
                  styles.segmentedBarPart,
                  { width: `${herdPercentages.quarantined}%`, backgroundColor: colors.locked },
                ]}
              />
            ) : null}
          </View>

          {/* 4 Health Status Counters */}
          <View style={styles.healthCountersGrid}>
            <View style={styles.healthCounterBox}>
              <View style={[styles.statusDotSmall, { backgroundColor: colors.fit }]} />
              <Text style={styles.healthCounterNumber}>{herdCounts.ELIGIBLE || 0}</Text>
              <Text style={styles.healthCounterLabel}>{t("Eligible")}</Text>
            </View>
            <View style={styles.healthCounterBox}>
              <View style={[styles.statusDotSmall, { backgroundColor: colors.monitor }]} />
              <Text style={styles.healthCounterNumber}>{herdCounts.UNDER_OBSERVATION || 0}</Text>
              <Text style={styles.healthCounterLabel}>{t("Observation")}</Text>
            </View>
            <View style={styles.healthCounterBox}>
              <View style={[styles.statusDotSmall, { backgroundColor: colors.destructive }]} />
              <Text style={styles.healthCounterNumber}>{herdCounts.INJURED || 0}</Text>
              <Text style={styles.healthCounterLabel}>{t("Injured")}</Text>
            </View>
            <View style={styles.healthCounterBox}>
              <View style={[styles.statusDotSmall, { backgroundColor: colors.locked }]} />
              <Text style={styles.healthCounterNumber}>{herdCounts.QUARANTINED || 0}</Text>
              <Text style={styles.healthCounterLabel}>{t("Quarantined")}</Text>
            </View>
          </View>
        </Panel>
      </View>

      {/* Bệnh án đang điều trị (Open Medical Cases) */}
      <View style={uiStyles.section}>
        <SectionTitle>Bệnh án đang điều trị</SectionTitle>
        {openCases.length === 0 ? (
          <Panel>
            <Text style={uiStyles.muted}>{t("There are no open medical cases.")}</Text>
          </Panel>
        ) : (
          <View style={{ gap: space.sm }}>
            {openCases.slice(0, 4).map((c) => (
              <Pressable
                key={c.caseId}
                accessibilityRole="button"
                onPress={() => router.push(`/${role}/medical/cases/${c.caseId}` as Href)}
                style={styles.openCaseCard}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.openCaseHorseName}>{c.horseName}</Text>
                  <Text style={styles.openCaseDiagnosis} numberOfLines={1}>
                    {c.initialDiagnosis}
                  </Text>
                  <Text style={uiStyles.muted}>
                    {t("Opened")}: {formatDate(c.openedAt)}
                    {c.nextVisitAt ? ` · ${t("Next visit")}: ${formatDate(c.nextVisitAt)}` : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Khám y tế (Checkups Overview) */}
      <View style={uiStyles.section}>
        <Panel>
          <View style={[uiStyles.row, { alignItems: "center" }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cardHighlightTitle}>Khám y tế định kỳ</Text>
              <Text style={uiStyles.muted}>
                {data.checkups.length} {t("horses in periodic checkup schedule")}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/${role}/medical/checkups` as Href)}
              style={styles.headerActionLink}
            >
              <Text style={styles.headerActionLinkText}>{t("Details")}</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.primary} />
            </Pressable>
          </View>
        </Panel>
      </View>

      {/* ======================================================== */}
      {/* 5. CHI PHÍ VÀ LỊCH KHÁM (COSTS & UPCOMING SCHEDULE)       */}
      {/* ======================================================== */}
      {/* Chi phí y tế 6 tháng (Chỉ Manager hoặc khi có dữ liệu) */}
      {role === "manager" && data.costs && data.costs.length > 0 ? (
        <View style={uiStyles.section}>
          <View style={uiStyles.row}>
            <SectionTitle>Chi phí y tế 6 tháng</SectionTitle>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/${role}/medical/costs` as Href)}
              style={styles.headerActionLink}
            >
              <Text style={styles.headerActionLinkText}>{t("Cost report")}</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.primary} />
            </Pressable>
          </View>

          <Panel>
            <View style={[uiStyles.row, { alignItems: "flex-start", marginBottom: space.md }]}>
              <View>
                <Text style={styles.cardHighlightTitle}>{formatCurrency(totalCost6Months)}</Text>
                <Text style={uiStyles.muted}>
                  {totalVisits6Months} {t("medical visits in past 6 months")}
                </Text>
              </View>
            </View>

            {/* 6-Month Bar Chart */}
            <View style={styles.monthlyCostChartContainer}>
              {data.costs.map((m) => {
                const heightPct =
                  maxCostValue > 0 ? Math.max(10, Math.round((m.total / maxCostValue) * 100)) : 10;

                return (
                  <View key={m.key} style={styles.monthlyCostBarColumn}>
                    <View style={styles.monthlyCostBarTrack}>
                      <View
                        style={[
                          styles.monthlyCostBarFill,
                          {
                            height: `${heightPct}%`,
                            backgroundColor: m.total > 0 ? colors.training : colors.border,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.monthlyCostBarLabel}>{m.label}</Text>
                  </View>
                );
              })}
            </View>
          </Panel>
        </View>
      ) : null}

      {/* Lịch khám 7 ngày tới (Upcoming Examinations Timeline) */}
      <View style={uiStyles.section}>
        <SectionTitle>Lịch khám 7 ngày tới</SectionTitle>
        {upcomingVisits.length === 0 ? (
          <Panel>
            <Text style={uiStyles.muted}>
              {t("No upcoming medical visits scheduled for the next 7 days.")}
            </Text>
          </Panel>
        ) : (
          <View style={{ gap: space.sm }}>
            {/* Show up to 4 upcoming checkups / visits */}
            {upcomingVisits.slice(0, 4).map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => router.push(item.to)}
              >
                <Panel>
                  <View style={[uiStyles.row, { alignItems: "center" }]}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={styles.timelineItemTitle} numberOfLines={1}>
                        {item.horseName}
                      </Text>
                      <Text style={uiStyles.muted} numberOfLines={1}>
                        {item.typeLabel}: {formatDate(item.date)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.daysLeftPill,
                        item.isOverdue
                          ? { backgroundColor: colors.injuredSoft }
                          : { backgroundColor: colors.fitSoft },
                      ]}
                    >
                      <Text
                        style={[
                          styles.daysLeftPillText,
                          { color: item.isOverdue ? colors.destructive : colors.primary },
                        ]}
                      >
                        {item.daysLeft < 0
                          ? `${Math.abs(item.daysLeft)} ${t("days overdue")}`
                          : `${item.daysLeft} ${t("days left")}`}
                      </Text>
                    </View>
                  </View>
                </Panel>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    headerActionLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    headerActionLinkText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    cardHighlightTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
    },
    rateBadge: {
      paddingHorizontal: space.sm,
      paddingVertical: 4,
      borderRadius: radius.md,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    rateBadgeText: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.primary,
    },
    rateBadgeSub: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.mutedForeground,
      textTransform: "uppercase",
    },
    barnDistributionList: {
      marginTop: space.sm,
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 6,
    },
    barnRowItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    dotIndicator: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    barnRowName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
    },
    barnRowNumbers: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
      marginRight: 4,
    },
    attentionCountPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.monitorSoft,
    },
    attentionCountPillText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.monitor,
    },
    attentionItemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      paddingVertical: 12,
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    attentionDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
    },
    attentionItemTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    attentionCtaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    attentionCtaText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    trainingClassesRow: {
      flexDirection: "row",
      gap: space.xs,
      marginBottom: space.xs,
    },
    classStatusBox: {
      flex: 1,
      paddingVertical: space.sm,
      paddingHorizontal: space.xs,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      gap: 2,
    },
    classStatusNumber: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.primary,
    },
    classStatusLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
      textAlign: "center",
    },
    classCardCode: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedForeground,
      letterSpacing: 0.5,
    },
    classCardName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    classCardSessionsText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.foreground,
    },
    weeklyChartContainer: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: 120,
      paddingTop: space.sm,
      paddingBottom: 4,
    },
    weeklyBarColumn: {
      flex: 1,
      alignItems: "center",
      height: "100%",
      justifyContent: "flex-end",
    },
    weeklyBarCountText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 3,
      minHeight: 14,
    },
    weeklyBarTrack: {
      width: 18,
      height: 60,
      backgroundColor: colors.muted,
      borderRadius: 4,
      justifyContent: "flex-end",
      overflow: "hidden",
    },
    weeklyBarFill: {
      width: "100%",
      borderRadius: 4,
    },
    weeklyBarDayLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
      marginTop: 6,
    },
    weeklyBarDateNumber: {
      fontSize: 10,
      fontWeight: "500",
      color: colors.mutedForeground,
    },
    todayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
      marginTop: 2,
    },
    segmentedBarTrack: {
      flexDirection: "row",
      height: 10,
      borderRadius: radius.pill,
      overflow: "hidden",
      backgroundColor: colors.muted,
      marginBottom: space.sm,
    },
    segmentedBarPart: {
      height: "100%",
    },
    healthCountersGrid: {
      flexDirection: "row",
      gap: space.xs,
    },
    healthCounterBox: {
      flex: 1,
      paddingVertical: space.xs + 2,
      paddingHorizontal: 4,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      alignItems: "center",
      gap: 2,
    },
    statusDotSmall: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    healthCounterNumber: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.foreground,
    },
    healthCounterLabel: {
      fontSize: 9,
      fontWeight: "600",
      color: colors.mutedForeground,
      textAlign: "center",
    },
    openCaseCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: space.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    openCaseHorseName: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.foreground,
    },
    openCaseDiagnosis: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.destructive,
    },
    timelineItemTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    daysLeftPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    daysLeftPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    monthlyCostChartContainer: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: 110,
      paddingTop: space.xs,
    },
    monthlyCostBarColumn: {
      flex: 1,
      alignItems: "center",
      height: "100%",
      justifyContent: "flex-end",
    },
    monthlyCostBarTrack: {
      width: 22,
      height: 75,
      backgroundColor: colors.muted,
      borderRadius: 4,
      justifyContent: "flex-end",
      overflow: "hidden",
    },
    monthlyCostBarFill: {
      width: "100%",
      borderRadius: 4,
    },
    monthlyCostBarLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
      marginTop: 6,
    },
  });
