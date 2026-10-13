import { router, type Href } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { HorseRow } from "@/features/horses/components/HorseRow";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { Metric, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { SectionTitle, TimelineItem } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import type { RoleId } from "@/types/raceos";
import { mapHorseSummaryToPrototype, type HorseSummary } from "@/adapters/horse.adapter";
import { mapGroomTodayToTasks, type GroomTodayDto } from "@/adapters/groom.adapter";
import { mapMedicalDashboardCases, type MedicalDashboardDto } from "@/adapters/medical.adapter";
import type { TrainingSessionView } from "@/adapters/training.adapter";
import { groomService } from "@/services/groom.service";
import { formatDate, formatDateTime, formatDistance, formatDurationMs } from "@/utils/formatters";

export type DashboardPayload =
  | { kind: "horses"; horses: HorseSummary[] }
  | { kind: "training"; sessions: TrainingSessionView[] }
  | { kind: "groom"; today: GroomTodayDto }
  | { kind: "medical"; dashboard: MedicalDashboardDto };

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

  if (payload.kind === "horses") {
    const horses = payload.horses.map(mapHorseSummaryToPrototype);
    const attention = horses.filter((horse) => ["MONITOR", "INJURED", "LOCKED"].includes(horse.status));
    return (
      <>
        <View style={uiStyles.metricGrid}>
          <Metric label="Visible horses" value={horses.length} hint="from backend" />
          <Metric label="Need attention" value={attention.length} hint="monitor or injured" tone={attention.length ? "warning" : "good"} />
          <Metric label="Eligible" value={horses.filter((horse) => horse.status === "FIT").length} hint="health status" tone="good" />
        </View>
        <View style={uiStyles.section}>
          <SectionTitle>{role === "owner" ? "My horses" : "Horses in the club"}</SectionTitle>
          {horses.slice(0, 5).map((horse) => <HorseRow key={horse.id} horse={horse} role={role} />)}
          {!horses.length ? (
            <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="No horses are available for this account." />
          ) : null}
        </View>
        <PrimaryButton label="View all horses" icon="grid-outline" onPress={() => router.push(`/${role}/horses` as Href)} />
      </>
    );
  }

  if (payload.kind === "training") {
    const sessions = payload.sessions;
    const live = sessions.filter((session) => session.status === "in_progress");
    const upcoming = sessions.filter((session) => session.status === "scheduled" || session.status === "planned");
    const classes = new Set(sessions.map((session) => session.classId));
    return (
      <>
        <View style={uiStyles.metricGrid}>
          <Metric label="Classes" value={classes.size} hint="from backend" tone="good" />
          <Metric label="Sessions" value={sessions.length} hint={`${sessions.filter((session) => session.status === "completed").length} completed`} />
          <Metric label="Live now" value={live.length} hint="active sessions" tone={live.length ? "warning" : "default"} />
        </View>
        <View style={uiStyles.section}>
          <SectionTitle>Upcoming sessions</SectionTitle>
          {upcoming.slice(0, 5).map((session) => (
            <Panel key={session.id}>
              <View style={uiStyles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={uiStyles.value}>{session.title}</Text>
                  <Text style={uiStyles.muted}>{session.horseName} · {session.className}</Text>
                </View>
                <Text style={uiStyles.label}>{session.status.replaceAll("_", " ")}</Text>
              </View>
              <Text style={uiStyles.muted}>
                {session.scheduledStartLabel}
                {session.distanceM == null ? "" : ` · ${formatDistance(session.distanceM)}`}
                {session.surface ? ` · ${session.surface}` : ""}
              </Text>
              {session.targetTimeMs == null ? null : <Text style={uiStyles.label}>Target {formatDurationMs(session.targetTimeMs)}</Text>}
            </Panel>
          ))}
          {!sessions.length ? (
            <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="No training sessions are available yet." />
          ) : null}
        </View>
        <PrimaryButton label="Open training schedule" icon="calendar-outline" onPress={() => router.push("/trainer/training" as Href)} />
      </>
    );
  }

  if (payload.kind === "groom") {
    const tasks = mapGroomTodayToTasks(payload.today);
    const actionable = tasks.filter((task) => task.actionable !== false);
    const done = actionable.filter((task) => task.done).length;
    const completeTask = async (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task?.sourceId) return;
      if (task.sourceType === "checklist") await groomService.tickChecklistItem(token, task.sourceId, true);
      else if (task.sourceType === "training" && task.sourceAction === "check-in") await groomService.checkIn(token, task.sourceId);
      else if (task.sourceType === "training" && task.sourceAction === "ready") await groomService.markReady(token, task.sourceId);
      else if (task.sourceType === "care") await groomService.completeCareSchedule(token, task.sourceId);
      await onRefresh();
    };
    return (
      <>
        <View style={uiStyles.metricGrid}>
          <Metric label="Tasks today" value={actionable.length} hint={formatDate(payload.today.date)} />
          <Metric label="Completed" value={`${done}/${actionable.length}`} hint="checklist and care" tone="good" />
          <Metric label="Horses in care" value={payload.today.horses.length} hint="assigned to you" />
        </View>
        <View style={uiStyles.section}>
          <SectionTitle>Next tasks</SectionTitle>
          {tasks.slice(0, 3).map((task) => <TaskCard key={task.id} task={task} onComplete={completeTask} />)}
          {!tasks.length ? (
            <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="No tasks assigned for today." />
          ) : null}
        </View>
        <PrimaryButton label="Open all tasks" icon="checkmark-circle-outline" onPress={() => router.push("/groom/tasks" as Href)} />
      </>
    );
  }

  const cases = mapMedicalDashboardCases(payload.dashboard);
  const checkups = payload.dashboard.checkups;
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Open cases" value={cases.length} hint="from medical records" tone={cases.length ? "warning" : "good"} />
        <Metric label="Pending requests" value={payload.dashboard.pendingRequests.length} hint="awaiting review" />
        <Metric label="Checkups due" value={checkups.length} hint="overdue or soon" tone={checkups.length ? "warning" : "good"} />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Open medical cases</SectionTitle>
        {cases.slice(0, 4).map((medicalCase) => (
          <Pressable
            key={medicalCase.id}
            onPress={() => router.push(`/vet/exam/${medicalCase.id}?view=case&horseName=${encodeURIComponent(medicalCase.horseName)}` as Href)}
          >
            <Panel>
              <TimelineItem
                time={medicalCase.openedAtLabel}
                title={`${medicalCase.horseName} · ${medicalCase.diagnosis}`}
                detail={`Open case · next visit ${medicalCase.nextVisitAt ? formatDateTime(medicalCase.nextVisitAt) : "not scheduled"}`}
                tone={colors.destructive}
                last
              />
            </Panel>
          </Pressable>
        ))}
        {!cases.length ? (
          <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="There are no open medical cases." />
        ) : null}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Upcoming checkups</SectionTitle>
        {checkups.slice(0, 4).map((checkup) => (
          <Panel key={checkup.horseId}>
            <View style={uiStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={uiStyles.value}>{checkup.horseName}</Text>
                <Text style={uiStyles.muted}>Due {formatDate(checkup.dueDate)} · {checkup.healthStatus.replaceAll("_", " ")}</Text>
              </View>
              <Text style={{ ...uiStyles.label, color: checkup.daysLeft < 0 ? colors.destructive : colors.monitor }}>
                {checkup.daysLeft < 0 ? `${Math.abs(checkup.daysLeft)} days overdue` : `${checkup.daysLeft} days`}
              </Text>
            </View>
          </Panel>
        ))}
      </View>
      <PrimaryButton label="Open medical workspace" icon="medkit-outline" onPress={() => router.push("/vet/medical" as Href)} />
    </>
  );
}
