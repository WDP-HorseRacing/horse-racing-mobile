import { router, type Href } from "expo-router";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { HorseRow } from "@/features/horses/components/HorseRow";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { Metric, Panel, PrimaryButton, ProgressBar, getUiStyles } from "@/components/ui";
import { SectionTitle } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import type { RoleId } from "@/types/raceos";
import {
  mapHorseSummaryToPrototype,
  type HorseListItemDto,
  type HorseSummary,
} from "@/adapters/horse.adapter";
import { mapGroomTodayToTasks, type GroomTodayDto } from "@/adapters/groom.adapter";
import type { MedicalDashboardDto } from "@/adapters/medical.adapter";
import type { SupplyItemDto } from "@/adapters/supplies.adapter";
import type { TrainingClassDto, TrainingSessionDto } from "@/services/training.service";
import { groomService } from "@/services/groom.service";
import { formatDate, formatDateTime, formatDistance, formatQuantity } from "@/utils/formatters";
import {
  ManagerTrainerDashboard,
  type ManagerTrainerDashboardData,
} from "./ManagerTrainerDashboard";
import { VetDashboard } from "./VetDashboard";
import type { NotificationDto } from "@/adapters/notifications.adapter";

export type DashboardPayload =
  | { kind: "horses"; horses: HorseSummary[] }
  | { kind: "training"; classes: TrainingClassDto[]; sessions: TrainingSessionDto[] }
  | { kind: "groom"; today: GroomTodayDto; supplies?: SupplyItemDto[] }
  | {
      kind: "medical";
      dashboard: MedicalDashboardDto;
      horses?: HorseListItemDto[];
      checkups?: MedicalDashboardDto["checkups"];
      supplies?: SupplyItemDto[];
      notifications?: NotificationDto[];
      activeSessions?: TrainingSessionDto[];
    }
  | { kind: "manager_ops"; data: ManagerTrainerDashboardData }
  | { kind: "trainer_ops"; data: ManagerTrainerDashboardData };

export function RoleDashboard({
  role,
  payload,
  token,
  onRefresh,
}: {
  role: RoleId;
  payload: DashboardPayload;
  token: string;
  onRefresh: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { t } = useI18n();

  if (payload.kind === "manager_ops" || payload.kind === "trainer_ops") {
    return (
      <ManagerTrainerDashboard
        role={role}
        data={payload.data}
        token={token}
        onRefresh={onRefresh}
      />
    );
  }

  if (payload.kind === "horses") {
    const horses = payload.horses.map(mapHorseSummaryToPrototype);
    const attention = horses.filter((horse) =>
      ["MONITOR", "INJURED", "LOCKED"].includes(horse.status),
    );
    return (
      <>
        <View style={uiStyles.metricGrid}>
          <Metric
            label={role === "owner" ? t("Ngựa của tôi") : t("Ngựa theo dõi")}
            value={horses.length}
            hint={role === "owner" ? t("thuộc sở hữu của bạn") : t("toàn câu lạc bộ")}
          />
          <Metric
            label={t("Cần chú ý")}
            value={attention.length}
            hint={t("theo dõi hoặc chấn thương")}
            tone={attention.length ? "warning" : "good"}
          />
          <Metric
            label={t("Đủ điều kiện")}
            value={horses.filter((horse) => horse.status === "FIT").length}
            hint={t("trạng thái sức khỏe")}
            tone="good"
          />
        </View>
        <View style={uiStyles.section}>
          <SectionTitle>{role === "owner" ? "My horses" : "Horses in the club"}</SectionTitle>
          {horses.slice(0, 5).map((horse) => (
            <HorseRow key={horse.id} horse={horse} role={role} />
          ))}
          {!horses.length ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => undefined}
              empty
              emptyLabel="No horses are available for this account."
            />
          ) : null}
        </View>
      </>
    );
  }

  if (payload.kind === "training") {
    const sessions = payload.sessions;
    const live = sessions.filter((session) => session.status === "IN_PROGRESS");
    const upcoming = sessions.filter((session) => session.status === "SCHEDULED");
    return (
      <>
        <View style={uiStyles.metricGrid}>
          <Metric
            label="Classes"
            value={payload.classes.length}
            hint="đang phụ trách"
            tone="good"
          />
          <Metric
            label="Sessions"
            value={sessions.length}
            hint={`${sessions.filter((session) => session.status === "COMPLETED").length} completed`}
          />
          <Metric
            label="Live now"
            value={live.length}
            hint="active sessions"
            tone={live.length ? "warning" : "default"}
          />
        </View>
        <View style={uiStyles.section}>
          <SectionTitle>Upcoming sessions</SectionTitle>
          {upcoming.slice(0, 5).map((session) => (
            <Panel key={session.id}>
              <View style={uiStyles.row}>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={uiStyles.value} numberOfLines={1}>
                    {session.name}
                  </Text>
                  <Text style={uiStyles.muted} numberOfLines={1}>
                    {payload.classes.find((item) => item.id === session.classId)?.code ?? "Class"} ·{" "}
                    {payload.classes.find((item) => item.id === session.classId)?.name ?? ""}
                  </Text>
                </View>
                <Text style={[uiStyles.label, { flexShrink: 0 }]}>
                  {session.status.replaceAll("_", " ")}
                </Text>
              </View>
              <Text style={uiStyles.muted}>
                {formatDateTime(session.scheduledStartAt)}
                {session.plannedDistanceM == null
                  ? ""
                  : ` · ${formatDistance(session.plannedDistanceM)}`}
                {session.surface ? ` · ${session.surface}` : ""}
              </Text>
            </Panel>
          ))}
          {!sessions.length ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => undefined}
              empty
              emptyLabel="No training sessions are available yet."
            />
          ) : null}
        </View>
        <PrimaryButton
          label="Open training schedule"
          icon="calendar-outline"
          onPress={() => router.push("/trainer/training" as Href)}
        />
        <PrimaryButton
          label="Stable overview"
          icon="map-outline"
          onPress={() => router.push("/trainer/stable" as Href)}
        />
      </>
    );
  }

  if (payload.kind === "groom") {
    const tasks = mapGroomTodayToTasks(payload.today);
    const actionable = tasks.filter((task) => task.actionable !== false);
    const done = actionable.filter((task) => task.done).length;
    const progressPercent = actionable.length ? Math.round((done / actionable.length) * 100) : 0;

    const horses = payload.today.horses ?? [];
    const supplies = payload.supplies ?? [];
    const lowStockItems = supplies.filter(
      (s) => s.lowStock || (s.reorderThreshold > 0 && s.quantityOnHand <= s.reorderThreshold),
    );

    const completeTask = async (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task?.sourceId) return;
      if (task.sourceType === "checklist")
        await groomService.tickChecklistItem(token, task.sourceId, true);
      else if (task.sourceType === "training" && task.sourceAction === "check-in")
        await groomService.checkIn(token, task.sourceId);
      else if (task.sourceType === "training" && task.sourceAction === "ready")
        await groomService.markReady(token, task.sourceId);
      else if (task.sourceType === "care")
        await groomService.completeCareSchedule(token, task.sourceId);
      await onRefresh();
    };

    return (
      <>
        {/* Metric Cards Row */}
        <View style={uiStyles.metricGrid}>
          <Metric
            label="Tasks today"
            value={actionable.length}
            hint={formatDate(payload.today.date)}
          />
          <Metric
            label="Completed"
            value={`${done}/${actionable.length}`}
            hint="checklist and care"
            tone={done === actionable.length && actionable.length > 0 ? "good" : "default"}
          />
          <Metric label="Horses in care" value={horses.length} hint="assigned to you" />
        </View>

        {/* Daily Checklist Progress Section */}
        <View style={uiStyles.section}>
          <SectionTitle>Daily progress</SectionTitle>
          <Panel>
            <View style={[uiStyles.row, { marginBottom: space.xs }]}>
              <Text style={uiStyles.value}>Checklist progress</Text>
              <Text style={[uiStyles.value, { color: colors.primary, fontWeight: "800" }]}>
                {done}/{actionable.length} ({progressPercent}%)
              </Text>
            </View>
            <ProgressBar
              value={progressPercent}
              tone={progressPercent === 100 ? colors.fit : colors.primary}
            />
            <Text style={[uiStyles.muted, { marginTop: space.xs }]}>
              {progressPercent === 100
                ? t("All daily checklist tasks completed! Great job.")
                : `${actionable.length - done} ${t("tasks to do")}`}
            </Text>
          </Panel>
        </View>

        {/* Stable Supplies Overview Section */}
        <View style={uiStyles.section}>
          <SectionTitle>Stable supplies</SectionTitle>
          <Panel>
            <View style={[uiStyles.row, { alignItems: "center", marginBottom: space.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="cube-outline" size={20} color={colors.primary} />
                <Text style={[uiStyles.value, { fontSize: 16 }]}>Stable supplies</Text>
              </View>
              {lowStockItems.length > 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: space.sm,
                    paddingVertical: 2,
                    borderRadius: radius.pill,
                    backgroundColor: colors.injuredSoft,
                  }}
                >
                  <Ionicons name="alert-circle" size={13} color={colors.injured} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: colors.injured,
                    }}
                  >
                    {lowStockItems.length} {t("items low")}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: space.sm,
                    paddingVertical: 2,
                    borderRadius: radius.pill,
                    backgroundColor: colors.fitSoft,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={13} color={colors.fit} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: colors.fit,
                    }}
                  >
                    {t("Stock healthy")}
                  </Text>
                </View>
              )}
            </View>

            {/* Quick stats row */}
            <View
              style={{
                flexDirection: "row",
                gap: space.md,
                paddingVertical: space.xs,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: colors.border,
                marginBottom: space.sm,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={uiStyles.muted}>Total supplies</Text>
                <Text style={[uiStyles.value, { fontSize: 18 }]}>{supplies.length}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={uiStyles.muted}>Low stock</Text>
                <Text
                  style={[
                    uiStyles.value,
                    {
                      fontSize: 18,
                      color: lowStockItems.length > 0 ? colors.injured : colors.fit,
                    },
                  ]}
                >
                  {lowStockItems.length}
                </Text>
              </View>
            </View>

            {/* If low stock items, list up to 2 items */}
            {lowStockItems.length > 0 ? (
              <View style={{ gap: space.xs, marginBottom: space.sm }}>
                <Text style={[uiStyles.muted, { fontSize: 12, fontWeight: "600" }]}>
                  {t("Attention required:")}
                </Text>
                {lowStockItems.slice(0, 2).map((item) => (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      backgroundColor: colors.muted,
                      borderRadius: radius.sm,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: colors.foreground,
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.injured,
                        fontWeight: "700",
                      }}
                    >
                      {formatQuantity(item.quantityOnHand, item.unit)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Quick Link to Supplies Screen */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("View inventory")}
              onPress={() => router.push("/groom/inventory" as Href)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: space.xs + 2,
                backgroundColor: colors.surface,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="cube-outline" size={16} color={colors.primary} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.primary,
                }}
              >
                View inventory
              </Text>
            </Pressable>
          </Panel>
        </View>

        {/* Assigned Horses in Care */}
        <View style={uiStyles.section}>
          <SectionTitle>Horses in your care</SectionTitle>
          {horses.length === 0 ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => undefined}
              empty
              emptyLabel="No horses are assigned to you today."
            />
          ) : (
            horses.map((horse) => {
              const checklistItems = horse.checklist?.items ?? [];
              const horseDone = checklistItems.filter((i) => i.done).length;

              return (
                <Pressable
                  key={horse.horseId}
                  accessibilityRole="button"
                  onPress={() => router.push("/groom/tasks" as Href)}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: space.sm,
                    marginBottom: space.xs,
                  }}
                >
                  <View style={[uiStyles.row, { alignItems: "center" }]}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[uiStyles.value, { fontSize: 16 }]} numberOfLines={1}>
                        {horse.horseName}
                      </Text>
                      <Text style={uiStyles.muted} numberOfLines={1}>
                        {[horse.barnName, horse.stallCode].filter(Boolean).join(" · ") ||
                          t("No stall assigned")}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: space.sm,
                        paddingVertical: 3,
                        borderRadius: radius.pill,
                        backgroundColor:
                          checklistItems.length > 0 && horseDone === checklistItems.length
                            ? colors.fitSoft
                            : colors.muted,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color:
                            checklistItems.length > 0 && horseDone === checklistItems.length
                              ? colors.fit
                              : colors.mutedForeground,
                        }}
                      >
                        {horseDone}/{checklistItems.length} {t("done")}
                      </Text>
                    </View>
                  </View>
                  {horse.feedingPlan ? (
                    <Text
                      style={[uiStyles.muted, { fontSize: 12, marginTop: 4 }]}
                      numberOfLines={1}
                    >
                      {t("Feeding plan")}: {horse.feedingPlan.status}
                      {horse.feedingPlan.note ? ` · ${horse.feedingPlan.note}` : ""}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>

        {/* Next Priority Tasks */}
        <View style={uiStyles.section}>
          <SectionTitle>Next tasks</SectionTitle>
          {tasks.slice(0, 3).map((task) => (
            <TaskCard key={task.id} task={task} onComplete={completeTask} />
          ))}
          {!tasks.length ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => undefined}
              empty
              emptyLabel="No tasks assigned for today."
            />
          ) : null}
        </View>
      </>
    );
  }

  if (payload.kind === "medical") {
    return (
      <VetDashboard
        data={{
          dashboard: payload.dashboard,
          horses: payload.horses,
          checkups: payload.checkups,
          supplies: payload.supplies,
          notifications: payload.notifications,
          activeSessions: payload.activeSessions,
        }}
        token={token}
        onRefresh={onRefresh}
      />
    );
  }

  return null;
}
