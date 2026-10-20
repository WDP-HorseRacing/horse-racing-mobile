import { type Href, Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Metric, Panel, getUiStyles } from "@/components/ui";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { isRole, roles } from "@/features/auth/roles";
import type { RoleId, Task } from "@/types/raceos";
import type { GroomTodayDto } from "@/adapters/groom.adapter";
import { mapGroomTodayToTasks } from "@/adapters/groom.adapter";
import type { MedicalDashboardDto } from "@/adapters/medical.adapter";
import { formatDate, formatDateTime, formatDistance } from "@/utils/formatters";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { groomService } from "@/services/groom.service";
import { horseService } from "@/services/horse.service";
import { medicalService } from "@/services/medical.service";
import { racingService } from "@/services/racing.service";
import { trainingService } from "@/services/training.service";
import { usersService } from "@/services/users.service";
import { suppliesService } from "@/services/supplies.service";
import { mapOwnerRaceResult, type OwnerRaceResultView } from "@/adapters/racing.adapter";
import type { TrainingSessionView } from "@/adapters/training.adapter";
import type { SupplyItemDto, SupplyRequestDto } from "@/adapters/supplies.adapter";
import type { HorseListItemDto } from "@/adapters/horse.adapter";
import type { StaffDto } from "@/adapters/staff.adapter";

type WorkPayload =
  | { role: "groom"; today: GroomTodayDto }
  | { role: "trainer"; sessions: TrainingSessionView[] }
  | { role: "vet"; dashboard: MedicalDashboardDto }
  | { role: "owner"; results: OwnerRaceResultView[] }
  | {
      role: "manager";
      horses: HorseListItemDto[];
      staff: StaffDto[];
      items: SupplyItemDto[];
      requests: SupplyRequestDto[];
    };

export default function Work() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const validRole: RoleId | null = isRole(role) ? role : null;
  const { token } = useAuth();
  const load = useCallback(() => loadRoleWork(token!, validRole!), [token, validRole]);
  const resource = useApiResource(load, Boolean(token && validRole));

  if (!validRole) return <Redirect href="/" />;

  const completeTask = async (taskId: string) => {
    if (resource.data?.role !== "groom") return;
    const task = mapGroomTodayToTasks(resource.data.today).find((item) => item.id === taskId);
    if (!task?.sourceId) return;
    await completeGroomTask(token!, task);
    await resource.refresh();
  };

  return (
    <Screen
      role={validRole}
      title={roles[validRole].workLabel}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {resource.data?.role === "groom" ? (
        <GroomWork today={resource.data.today} onComplete={completeTask} />
      ) : null}

      {resource.data?.role === "trainer" ? <TrainerWork sessions={resource.data.sessions} /> : null}

      {resource.data?.role === "vet" ? <VetWork dashboard={resource.data.dashboard} /> : null}

      {resource.data?.role === "owner" ? <OwnerWork results={resource.data.results} /> : null}

      {resource.data?.role === "manager" ? (
        <ManagerWork
          horses={resource.data.horses}
          staff={resource.data.staff}
          items={resource.data.items}
          requests={resource.data.requests}
        />
      ) : null}
    </Screen>
  );
}

async function loadRoleWork(token: string, role: RoleId): Promise<WorkPayload> {
  switch (role) {
    case "groom":
      return { role, today: await groomService.getToday(token) };
    case "trainer":
      return { role, sessions: await trainingService.listAllVisibleSessions(token) };
    case "vet":
      return { role, dashboard: await medicalService.getDashboard(token) };
    case "owner": {
      const horses = await horseService.list(token);
      const resultsByHorse = await Promise.all(
        horses.map(async (horse) => {
          const results = await racingService.listHorseResults(token, horse.id);
          return results.map((result) => mapOwnerRaceResult(horse.id, horse.name, result));
        }),
      );
      return {
        role,
        results: resultsByHorse.flat().sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
      };
    }
    case "manager": {
      const [horses, staff, items, requests] = await Promise.all([
        horseService.list(token),
        usersService.list(token),
        suppliesService.listItems(token),
        suppliesService.listRequests(token),
      ]);
      return { role, horses, staff, items, requests };
    }
    default:
      throw new Error("Unsupported role for work dashboard.");
  }
}

async function completeGroomTask(token: string, task: Task) {
  if (!task.sourceId) return;
  if (task.sourceType === "checklist") {
    await groomService.tickChecklistItem(token, task.sourceId, true);
  } else if (task.sourceType === "training" && task.sourceAction === "check-in") {
    await groomService.checkIn(token, task.sourceId);
  } else if (task.sourceType === "training" && task.sourceAction === "ready") {
    await groomService.markReady(token, task.sourceId);
  } else if (task.sourceType === "care") {
    await groomService.completeCareSchedule(token, task.sourceId);
  }
}

function GroomWork({
  today,
  onComplete,
}: {
  today: GroomTodayDto;
  onComplete: (id: string) => Promise<void>;
}) {
  const uiStyles = getUiStyles(useTheme().colors);
  const tasks = mapGroomTodayToTasks(today);
  const actionable = tasks.filter((task) => task.actionable !== false);
  const completed = actionable.filter((task) => task.done).length;
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Tasks today" value={actionable.length} hint={formatDate(today.date)} />
        <Metric
          label="Completed"
          value={`${completed}/${actionable.length}`}
          hint="checklist and care"
          tone="good"
        />
        <Metric label="Horses in care" value={today.horses.length} hint="assigned to you" />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Today</SectionTitle>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onComplete={onComplete} />
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

function TrainerWork({ sessions }: { sessions: TrainingSessionView[] }) {
  const uiStyles = getUiStyles(useTheme().colors);
  const upcoming = sessions.filter(
    (session) => !["completed", "cancelled"].includes(session.status),
  );
  return (
    <View style={uiStyles.section}>
      <SectionTitle>Upcoming training sessions</SectionTitle>
      {upcoming.map((session) => (
        <Pressable
          key={session.participantId}
          onPress={() =>
            router.push(`/trainer/plan/${session.classId}/session/${session.sessionId}` as Href)
          }
        >
          <Panel>
            <View style={uiStyles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={uiStyles.value} numberOfLines={1}>
                  {session.title} · {session.horseName}
                </Text>
                <Text style={uiStyles.muted} numberOfLines={1}>
                  {session.className} · {session.scheduledStartLabel}
                </Text>
              </View>
              <Text style={[uiStyles.label, { flexShrink: 0 }]}>
                {session.status.replaceAll("_", " ")}
              </Text>
            </View>
            <Text style={uiStyles.muted}>
              {session.distanceM == null ? "Distance not set" : formatDistance(session.distanceM)}
              {session.surface ? ` · ${session.surface}` : ""}
            </Text>
          </Panel>
        </Pressable>
      ))}
      {!upcoming.length ? (
        <AsyncStateView
          isLoading={false}
          error={null}
          onRetry={() => undefined}
          empty
          emptyLabel="No upcoming training sessions."
        />
      ) : null}
    </View>
  );
}

function VetWork({ dashboard }: { dashboard: MedicalDashboardDto }) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const total =
    dashboard.openCases.length + dashboard.pendingRequests.length + dashboard.checkups.length;
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric
          label="Open cases"
          value={dashboard.openCases.length}
          hint="medical dashboard"
          tone={dashboard.openCases.length ? "warning" : "good"}
        />
        <Metric
          label="Pending requests"
          value={dashboard.pendingRequests.length}
          hint="awaiting review"
        />
        <Metric
          label="Checkups due"
          value={dashboard.checkups.length}
          hint="overdue or soon"
          tone={dashboard.checkups.length ? "warning" : "default"}
        />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Medical work queue</SectionTitle>
        {dashboard.pendingRequests.map((request) => (
          <Panel key={`request:${request.id}`}>
            <View style={uiStyles.row}>
              <Text style={[uiStyles.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                {request.horseName}
              </Text>
              <Text
                style={{
                  ...uiStyles.label,
                  flexShrink: 0,
                  color: request.urgent ? colors.destructive : colors.monitor,
                }}
              >
                {request.urgent ? "Urgent" : "Pending"}
              </Text>
            </View>
            <Text style={uiStyles.muted}>{request.description}</Text>
            <Text style={uiStyles.label}>{formatDateTime(request.createdAt)}</Text>
          </Panel>
        ))}
        {dashboard.openCases.map((medicalCase) => (
          <Pressable
            key={`case:${medicalCase.caseId}`}
            onPress={() => router.push(`/vet/medical/cases/${medicalCase.caseId}` as Href)}
          >
            <Panel>
              <Text style={uiStyles.value}>
                {medicalCase.horseName} · {medicalCase.initialDiagnosis}
              </Text>
              <Text style={uiStyles.muted}>Open case · {formatDateTime(medicalCase.openedAt)}</Text>
            </Panel>
          </Pressable>
        ))}
        {dashboard.checkups.map((checkup) => (
          <Panel key={`checkup:${checkup.horseId}`}>
            <View style={uiStyles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={uiStyles.value} numberOfLines={1}>
                  {checkup.horseName} · checkup
                </Text>
                <Text style={uiStyles.muted} numberOfLines={1}>
                  {checkup.healthStatus.replaceAll("_", " ")} ·{" "}
                  {checkup.dueStatus.replaceAll("_", " ")}
                </Text>
              </View>
              <Text style={[uiStyles.label, { flexShrink: 0 }]}>
                {checkup.daysLeft < 0
                  ? `${Math.abs(checkup.daysLeft)} days overdue`
                  : `${checkup.daysLeft} days`}
              </Text>
            </View>
          </Panel>
        ))}
        {!total ? (
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => undefined}
            empty
            emptyLabel="No medical tasks are due."
          />
        ) : null}
      </View>
    </>
  );
}

function OwnerWork({ results }: { results: OwnerRaceResultView[] }) {
  const uiStyles = getUiStyles(useTheme().colors);
  return (
    <View style={uiStyles.section}>
      <SectionTitle>Race results for your horses</SectionTitle>
      {results.map((result) => (
        <Panel key={result.registrationId}>
          <View style={uiStyles.row}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={uiStyles.value} numberOfLines={1}>
                {result.horseName}
              </Text>
              <Text style={uiStyles.muted} numberOfLines={1}>
                {result.raceName} · {result.scheduledAtLabel}
              </Text>
              <Text style={uiStyles.label}>{result.registrationStatus.replaceAll("_", " ")}</Text>
            </View>
            <Text style={[uiStyles.value, { flexShrink: 0 }]}>
              {result.placing ? `#${result.placing}` : "—"}
            </Text>
          </View>
        </Panel>
      ))}
      {!results.length ? (
        <AsyncStateView
          isLoading={false}
          error={null}
          onRetry={() => undefined}
          empty
          emptyLabel="No race results have been recorded for your horses."
        />
      ) : null}
    </View>
  );
}

function ManagerWork({
  horses,
  staff,
  items,
  requests,
}: {
  horses: HorseListItemDto[];
  staff: StaffDto[];
  items: SupplyItemDto[];
  requests: SupplyRequestDto[];
}) {
  const uiStyles = getUiStyles(useTheme().colors);
  const lowStock = items.filter((item) => item.lowStock);
  const pendingRequests = requests.filter((request) => request.status === "PENDING");
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Horses" value={horses.length} hint="visible to the club" />
        <Metric label="Staff" value={staff.length} hint="accounts from backend" />
        <Metric
          label="Low stock"
          value={lowStock.length}
          hint="below reorder threshold"
          tone={lowStock.length ? "warning" : "good"}
        />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Operational exceptions</SectionTitle>
        {lowStock.map((item) => (
          <Panel key={`stock:${item.id}`}>
            <View style={uiStyles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={uiStyles.value} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={uiStyles.muted} numberOfLines={1}>
                  {item.category.replaceAll("_", " ")} · reorder at {item.reorderThreshold}{" "}
                  {item.unit}
                </Text>
              </View>
              <Text style={[uiStyles.label, { flexShrink: 0 }]}>
                {item.quantityOnHand} {item.unit}
              </Text>
            </View>
          </Panel>
        ))}
        {pendingRequests.map((request) => (
          <Panel key={`request:${request.id}`}>
            <Text style={uiStyles.value}>{request.item.name} · supply request</Text>
            <Text style={uiStyles.muted}>
              {request.quantity} {request.item.unit} requested by {request.requester.fullName}
            </Text>
          </Panel>
        ))}
        {!lowStock.length && !pendingRequests.length ? (
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => undefined}
            empty
            emptyLabel="No inventory exceptions or pending supply requests."
          />
        ) : null}
      </View>
    </>
  );
}
