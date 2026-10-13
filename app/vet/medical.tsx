import { router, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { Chips, Panel, getUiStyles } from "@/components/ui";
import { TimelineItem, Screen, SectionTitle } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { medicalService } from "@/services/medical.service";
import { mapMedicalDashboardCases } from "@/adapters/medical.adapter";
import { formatDate, formatDateTime } from "@/utils/formatters";

export default function Medical() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();
  const loadDashboard = useCallback(() => medicalService.getDashboard(token!), [token]);
  const resource = useApiResource(loadDashboard, Boolean(token));
  const cases = useMemo(
    () => (resource.data ? mapMedicalDashboardCases(resource.data) : []),
    [resource.data],
  );
  const [tab, setTab] = useState("Records");
  const careSchedules = resource.data?.careSchedules ?? [];
  const preventativeSchedules = careSchedules.filter((schedule) =>
    ["VACCINATION", "DEWORMING", "FARRIER"].includes(schedule.type),
  );

  return (
    <Screen
      role="vet"
      title="Medical"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <Chips options={["Records", "Treatment", "Vaccination"]} value={tab} onChange={setTab} />
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {tab === "Records" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Open medical cases</SectionTitle>
          {resource.data && cases.length === 0 ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => undefined}
              empty
              emptyLabel="There are no open medical cases."
            />
          ) : null}
          {cases.map((medicalCase) => (
            <Pressable
              key={medicalCase.id}
              onPress={() =>
                router.push(
                  `/vet/exam/${medicalCase.id}?view=case&horseName=${encodeURIComponent(medicalCase.horseName)}` as Href,
                )
              }
            >
              <Panel>
                <TimelineItem
                  time={medicalCase.openedAtLabel}
                  title={`${medicalCase.horseName} · ${medicalCase.diagnosis}`}
                  detail={`Open case · last visit ${medicalCase.lastVisitAt ? formatDateTime(medicalCase.lastVisitAt) : "not recorded"}`}
                  tone={colors.destructive}
                  last
                />
              </Panel>
            </Pressable>
          ))}
          {resource.data?.pendingRequests.length ? (
            <>
              <SectionTitle>Pending examination requests</SectionTitle>
              {resource.data.pendingRequests.slice(0, 5).map((request) => (
                <Panel key={request.id}>
                  <View style={uiStyles.row}>
                    <Text style={uiStyles.value}>{request.horseName}</Text>
                    <Text style={{ ...uiStyles.label, color: request.urgent ? colors.destructive : colors.monitor }}>
                      {request.urgent ? "Urgent" : "Pending"}
                    </Text>
                  </View>
                  <Text style={uiStyles.muted}>{request.description}</Text>
                  <Text style={uiStyles.label}>{formatDateTime(request.createdAt)}</Text>
                </Panel>
              ))}
            </>
          ) : null}
        </View>
      ) : null}
      {tab === "Treatment" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Due checkups and care</SectionTitle>
          {resource.data?.checkups.map((checkup) => (
            <Panel key={`checkup:${checkup.horseId}`}>
              <View style={uiStyles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={uiStyles.value}>{checkup.horseName} · routine checkup</Text>
                  <Text style={uiStyles.muted}>
                    {checkup.healthStatus.replaceAll("_", " ")} · {checkup.dueStatus.replaceAll("_", " ")}
                  </Text>
                </View>
                <Text style={{ ...uiStyles.label, color: checkup.daysLeft < 0 ? colors.destructive : colors.monitor }}>
                  {checkup.daysLeft < 0 ? `${Math.abs(checkup.daysLeft)} days overdue` : `${checkup.daysLeft} days`}
                </Text>
              </View>
            </Panel>
          ))}
          {careSchedules.map((schedule) => (
            <Panel key={schedule.scheduleId}>
              <View style={uiStyles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={uiStyles.value}>{schedule.horseName} · {schedule.type.replaceAll("_", " ")}</Text>
                  <Text style={uiStyles.muted}>Assigned {schedule.assignedTo ? "to staff" : "to veterinarian"}</Text>
                </View>
                <Text style={uiStyles.label}>{formatDate(schedule.dueDate)}</Text>
              </View>
            </Panel>
          ))}
          {resource.data && !resource.data.checkups.length && !careSchedules.length ? (
            <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="No treatment or care schedules are due soon." />
          ) : null}
        </View>
      ) : null}
      {tab === "Vaccination" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Upcoming preventive care</SectionTitle>
          {preventativeSchedules.map((schedule) => (
            <Panel key={schedule.scheduleId}>
              <TimelineItem
                time={formatDate(schedule.dueDate)}
                title={`${schedule.type.replaceAll("_", " ")} · ${schedule.horseName}`}
                detail={schedule.assignedTo ? "Assigned to staff" : "Awaiting assignment"}
                tone={colors.primary}
                last
              />
            </Panel>
          ))}
          {resource.data && preventativeSchedules.length === 0 ? (
            <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="No vaccination, deworming, or farrier schedules are due soon." />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
