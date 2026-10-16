import { router, type Href, useLocalSearchParams, Redirect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Chips, Metric, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { isRole } from "@/features/auth/roles";
import { medicalService, type HealthStatusDto } from "@/services/medical.service";
import { stableService } from "@/services/stable.service";
import type { MedicalDashboardDto } from "@/adapters/medical.adapter";
import { formatDate, formatDateTime } from "@/utils/formatters";
import type { RoleId } from "@/types/raceos";

const healthOptions = [
  "All health states",
  "QUARANTINED",
  "INJURED",
  "UNDER_OBSERVATION",
  "ELIGIBLE",
];

export function MedicalWorkspaceScreen({ initialRole }: { initialRole?: RoleId }) {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role = initialRole ?? (isRole(roleParam) ? roleParam : null);
  const { token } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const [barnId, setBarnId] = useState("");
  const [health, setHealth] = useState("All health states");
  const loadBarns = useCallback(() => stableService.listBarns(token!), [token]);
  const barnsResource = useApiResource(
    loadBarns,
    Boolean(token && role && ["vet", "manager", "trainer"].includes(role)),
  );
  const barnOptions = useMemo(
    () => (barnsResource.data ?? []).map(({ id, name }) => ({ id, name })),
    [barnsResource.data],
  );
  const load = useCallback(() => {
    const filters = {
      ...(barnId ? { barnId } : {}),
      ...(health === "All health states" ? {} : { healthStatus: health as HealthStatusDto }),
    };
    return medicalService.getDashboard(token!, filters);
  }, [barnId, health, token]);
  const resource = useApiResource(
    load,
    Boolean(token && role && ["vet", "manager", "trainer"].includes(role)),
  );
  useRefreshOnFocus(resource.refresh);

  const horsesByBarn = useMemo(() => {
    const groups = new Map<string, MedicalDashboardDto["herd"]["horses"]>();
    for (const horse of resource.data?.herd.horses ?? []) {
      const key = horse.barnId ?? "unassigned";
      groups.set(key, [...(groups.get(key) ?? []), horse]);
    }
    return [...groups.entries()];
  }, [resource.data]);

  if (!role) return <Redirect href="/" />;
  if (!["vet", "manager", "trainer"].includes(role)) {
    return <Redirect href={(role === "groom" ? "/groom/medical/requests" : `/${role}`) as Href} />;
  }

  return (
    <Screen
      role={role}
      title="Medical overview"
      subtitle={
        role === "trainer"
          ? "Horses in your assigned barns"
          : role === "manager"
            ? "Club-wide health and care"
            : "Veterinary workspace"
      }
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {resource.data ? (
        <>
          <View style={uiStyles.metricGrid}>
            <Metric
              label="Open cases"
              value={resource.data.openCases.length}
              hint="active treatment"
              tone={resource.data.openCases.length ? "warning" : "good"}
            />
            <Metric
              label="Requests waiting"
              value={resource.data.pendingRequests.length}
              hint="urgent requests first"
              tone={
                resource.data.pendingRequests.some((request) => request.urgent)
                  ? "warning"
                  : "default"
              }
            />
            <Metric
              label="Checkups due"
              value={resource.data.checkups.length}
              hint="overdue or next 3 days"
              tone={
                resource.data.checkups.some((checkup) => checkup.daysLeft < 0)
                  ? "warning"
                  : "default"
              }
            />
          </View>

          <View style={uiStyles.section}>
            <SectionTitle>Filter herd</SectionTitle>
            <AsyncStateView
              isLoading={barnsResource.isLoading}
              error={barnsResource.error}
              onRetry={() => void barnsResource.retry()}
            />
            <Chips
              options={["All barns", ...barnOptions.map((barn) => barn.name)]}
              value={
                barnId
                  ? (barnOptions.find((barn) => barn.id === barnId)?.name ?? "All barns")
                  : "All barns"
              }
              onChange={(label) =>
                setBarnId(barnOptions.find((barn) => barn.name === label)?.id ?? "")
              }
            />
            <Chips options={healthOptions} value={health} onChange={setHealth} />
            {Object.entries(resource.data.herd.counts).map(([status, count]) => (
              <View key={status} style={uiStyles.row}>
                <Text style={uiStyles.label}>{status.replaceAll("_", " ")}</Text>
                <Text style={uiStyles.value}>{count}</Text>
              </View>
            ))}
          </View>

          <View style={uiStyles.section}>
            <SectionTitle>Herd by barn and stall</SectionTitle>
            {horsesByBarn.map(([groupId, horses]) => (
              <Panel key={groupId}>
                <Text style={uiStyles.value}>
                  {groupId === "unassigned"
                    ? "No barn assigned"
                    : (barnOptions.find((barn) => barn.id === groupId)?.name ??
                      `Barn ${groupId.slice(0, 8)}`)}
                </Text>
                {horses.map((horse) => (
                  <Pressable
                    key={horse.horseId}
                    onPress={() => router.push(`/${role}/horse/${horse.horseId}` as Href)}
                    style={{ paddingVertical: 8 }}
                  >
                    <View style={uiStyles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={uiStyles.value}>{horse.horseName}</Text>
                        <Text style={uiStyles.muted}>
                          {horse.stallCode ? `Stall ${horse.stallCode}` : "No stall assigned"}
                        </Text>
                      </View>
                      <Text
                        style={{
                          ...uiStyles.label,
                          color:
                            horse.healthStatus === "ELIGIBLE" ? colors.primary : colors.destructive,
                        }}
                      >
                        {horse.healthStatus.replaceAll("_", " ")}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </Panel>
            ))}
            {!resource.data.herd.horses.length ? (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={() => undefined}
                empty
                emptyLabel="No horses match these filters."
              />
            ) : null}
          </View>

          <View style={uiStyles.section}>
            <SectionTitle>Open treatment cases</SectionTitle>
            {resource.data.openCases.map((item) => (
              <Pressable
                key={item.caseId}
                onPress={() => router.push(`/${role}/medical/cases/${item.caseId}` as Href)}
              >
                <Panel>
                  <Text style={uiStyles.value}>
                    {item.horseName} · {item.initialDiagnosis}
                  </Text>
                  <Text style={uiStyles.muted}>
                    Opened {formatDateTime(item.openedAt)} · last visit{" "}
                    {item.lastVisitAt ? formatDateTime(item.lastVisitAt) : "not recorded"}
                  </Text>
                  <Text style={uiStyles.label}>
                    {item.nextVisitAt
                      ? `Follow-up ${formatDateTime(item.nextVisitAt)}`
                      : "No follow-up scheduled"}
                  </Text>
                </Panel>
              </Pressable>
            ))}
            {!resource.data.openCases.length ? (
              <Text style={uiStyles.muted}>No cases are open.</Text>
            ) : null}
          </View>

          <View style={uiStyles.section}>
            <SectionTitle>Urgent-first examination queue</SectionTitle>
            {resource.data.pendingRequests.slice(0, 5).map((request) => (
              <Pressable
                key={request.id}
                onPress={() => router.push(`/${role}/medical/requests` as Href)}
              >
                <Panel>
                  <View style={uiStyles.row}>
                    <Text style={uiStyles.value}>{request.horseName}</Text>
                    <Text
                      style={{
                        ...uiStyles.label,
                        color: request.urgent ? colors.destructive : colors.monitor,
                      }}
                    >
                      {request.urgent ? "Urgent" : "Pending"}
                    </Text>
                  </View>
                  <Text style={uiStyles.muted}>{request.description}</Text>
                  <Text style={uiStyles.label}>{formatDateTime(request.createdAt)}</Text>
                </Panel>
              </Pressable>
            ))}
            {!resource.data.pendingRequests.length ? (
              <Text style={uiStyles.muted}>No pending requests.</Text>
            ) : null}
          </View>

          <View style={uiStyles.section}>
            <SectionTitle>Checkups and care due</SectionTitle>
            {resource.data.checkups.map((checkup) => (
              <Pressable
                key={checkup.horseId}
                onPress={() => router.push(`/${role}/medical/checkups` as Href)}
              >
                <Panel>
                  <View style={uiStyles.row}>
                    <Text style={uiStyles.value}>{checkup.horseName}</Text>
                    <Text
                      style={{
                        ...uiStyles.label,
                        color: checkup.daysLeft < 0 ? colors.destructive : colors.monitor,
                      }}
                    >
                      {checkup.daysLeft < 0
                        ? `${Math.abs(checkup.daysLeft)} days overdue`
                        : `${checkup.daysLeft} days`}
                    </Text>
                  </View>
                  <Text style={uiStyles.muted}>
                    {checkup.healthStatus.replaceAll("_", " ")} · due {formatDate(checkup.dueDate)}
                  </Text>
                  <Text style={uiStyles.label}>
                    {checkup.appointment
                      ? `Appointment ${formatDateTime(checkup.appointment.scheduledAt)}`
                      : "No appointment"}
                  </Text>
                </Panel>
              </Pressable>
            ))}
            {resource.data.careSchedules.map((schedule) => (
              <Pressable
                key={schedule.scheduleId}
                onPress={() =>
                  router.push(`/${role}/medical/care?horseId=${schedule.horseId}` as Href)
                }
              >
                <Panel>
                  <Text style={uiStyles.value}>
                    {schedule.horseName} · {schedule.type.replaceAll("_", " ")}
                  </Text>
                  <Text style={uiStyles.muted}>
                    Due {formatDate(schedule.dueDate)} ·{" "}
                    {schedule.assignedTo
                      ? `assigned staff ${schedule.assignedTo.slice(0, 8)}`
                      : "unassigned"}
                  </Text>
                </Panel>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <PrimaryButton
        label="Full examination queue"
        icon="list-outline"
        onPress={() => router.push(`/${role}/medical/requests` as Href)}
      />
      <PrimaryButton
        label="Periodic checkups"
        icon="calendar-outline"
        onPress={() => router.push(`/${role}/medical/checkups` as Href)}
      />
      {role === "manager" ? (
        <PrimaryButton
          label="Medical cost report"
          icon="cash-outline"
          onPress={() => router.push(`/${role}/medical/costs` as Href)}
        />
      ) : null}
    </Screen>
  );
}
