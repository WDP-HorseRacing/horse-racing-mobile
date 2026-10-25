import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Chips, Metric, Panel, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { trainingService, type TrainingSessionDto } from "@/services/training.service";
import { formatDate, formatDateTime } from "@/utils/formatters";
import { formatTrainingStatus } from "@/features/training/training-utils";
import { formatSessionType, formatIntensity } from "./plans";

type TrainingHubPayload = {
  classes: Awaited<ReturnType<typeof trainingService.listClasses>>;
  plans: Awaited<ReturnType<typeof trainingService.listPlans>>;
  sessions: TrainingSessionDto[];
};

export default function TrainerTraining() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const { token } = useAuth();
  const [tab, setTab] = useState("Classes");
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

  return (
    <Screen
      role="trainer"
      title="Training"
      subtitle="Plans, classes and scheduled sessions"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <View style={ui.metricGrid}>
        <Metric label="Active classes" value={activeClasses.length} tone="good" />
        <Metric label="Training plans" value={payload?.plans.length ?? "—"} />
        <Metric label="Scheduled sessions" value={scheduledSessions.length} />
        <Metric
          label="Live sessions"
          value={liveSessions.length}
          tone={liveSessions.length ? "warning" : "default"}
        />
      </View>

      <View style={{ gap: 10 }}>
        <PrimaryButton
          label="Create training class"
          icon="add-circle-outline"
          onPress={() => router.push("/trainer/class/new" as Href)}
        />
        <SecondaryButton
          label="Manage training plans"
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
          <SectionTitle>Training classes</SectionTitle>
          {payload.classes.length ? (
            payload.classes.map((trainingClass) => (
              <Pressable
                key={trainingClass.id}
                onPress={() => router.push(`/trainer/plan/${trainingClass.id}` as Href)}
              >
                <Panel style={{ gap: 8 }}>
                  <View style={ui.row}>
                    <Text style={[ui.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                      {trainingClass.name}
                    </Text>
                    <Text
                      style={[
                        ui.label,
                        { flexShrink: 0 },
                        trainingClass.status === "ACTIVE" && { color: colors.primary },
                      ]}
                    >
                      {formatTrainingStatus(trainingClass.status)}
                    </Text>
                  </View>
                  <Text style={ui.muted}>
                    {trainingClass.code} · {formatDate(trainingClass.startDate)} –{" "}
                    {formatDate(trainingClass.endDate)}
                  </Text>
                  <Text style={ui.label}>
                    {payload.plans.find((plan) => plan.id === trainingClass.planId)?.name ??
                      "Class plan"}{" "}
                    · {trainingClass.maxHorses} horse capacity
                  </Text>
                </Panel>
              </Pressable>
            ))
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
        <View style={ui.section}>
          <SectionTitle>Scheduled and live sessions</SectionTitle>
          {[...liveSessions, ...scheduledSessions]
            .sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt))
            .map((session) => {
              const trainingClass = payload.classes.find((item) => item.id === session.classId);
              return (
                <Pressable
                  key={session.id}
                  onPress={() =>
                    router.push(`/trainer/plan/${session.classId}/session/${session.id}` as Href)
                  }
                >
                  <Panel style={{ gap: 6 }}>
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
                      {trainingClass?.code ?? "Class"} · {formatDateTime(session.scheduledStartAt)}
                    </Text>
                    <Text style={ui.label}>
                      {formatSessionType(session.sessionType, t)} ·{" "}
                      {session.plannedDistanceM.toLocaleString()} m · {formatIntensity(session.intensity, t)}
                    </Text>
                  </Panel>
                </Pressable>
              );
            })}
          {liveSessions.length + scheduledSessions.length === 0 ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => void resource.refresh()}
              empty
              emptyLabel="There are no scheduled sessions in your classes."
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
