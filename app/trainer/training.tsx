import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { Screen, SectionTitle } from "@/components/common";
import { Chips, Metric, Panel, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";
import { trainingService } from "@/services/training.service";
import type { TrainingSessionView } from "@/adapters/training.adapter";
import { formatDistance, formatDurationMs } from "@/utils/formatters";

export default function TrainerTraining() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();
  const { t } = useI18n();
  const loadSessions = useCallback(() => trainingService.listAllVisibleSessions(token!), [token]);
  const resource = useApiResource(loadSessions, Boolean(token));
  const sessions = resource.data ?? [];
  const [tab, setTab] = useState("Schedule");
  const upcoming = sessions.filter(
    (session) => session.status !== "completed" && session.status !== "cancelled",
  );
  const live = sessions.filter((session) => session.status === "in_progress");
  const completed = sessions.filter((session) => session.status === "completed").length;
  const classes = useMemo(() => {
    const grouped = new Map<string, { name: string; planName: string; sessions: TrainingSessionView[]; horses: Set<string> }>();
    for (const session of sessions) {
      const item = grouped.get(session.classId) ?? {
        name: session.className,
        planName: session.planName,
        sessions: [],
        horses: new Set<string>(),
      };
      item.sessions.push(session);
      item.horses.add(session.horseId);
      grouped.set(session.classId, item);
    }
    return [...grouped.entries()].map(([id, item]) => ({ id, ...item }));
  }, [sessions]);

  return (
    <Screen
      role="trainer"
      title="Training"
      subtitle="Classes schedule one session for each enrolled horse"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <View style={uiStyles.metricGrid}>
        <Metric label="Classes" value={classes.length} hint={t("from backend")} tone="good" />
        <Metric label="Sessions" value={sessions.length} hint={`${completed} ${t("completed")}`} />
        <Metric
          label="Live now"
          value={live.length}
          hint={t("sensor sessions")}
          tone={live.length ? "warning" : "default"}
        />
        <Metric
          label="Horses covered"
          value={new Set(sessions.map((session) => session.horseId)).size}
          hint={t("from backend")}
        />
      </View>
      <Chips options={["Schedule", "Classes", "Live"]} value={tab} onChange={setTab} />

      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {!resource.isLoading && !resource.error && resource.data && sessions.length === 0 ? (
        <AsyncStateView
          isLoading={false}
          error={null}
          onRetry={() => undefined}
          empty
          emptyLabel="No training sessions are available for your horses."
        />
      ) : null}

      {resource.data && tab === "Schedule" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Upcoming sessions</SectionTitle>
          {upcoming.slice(0, 30).map((session) => (
            <TrainingSessionRow key={session.id} session={session} />
          ))}
        </View>
      ) : null}
      {resource.data && tab === "Classes" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Backend training classes</SectionTitle>
          {classes.map((trainingClass) => (
            <Panel key={trainingClass.id}>
              <Text style={uiStyles.value}>{trainingClass.name}</Text>
              <Text style={uiStyles.muted}>{trainingClass.planName}</Text>
              <Text style={uiStyles.label}>
                {trainingClass.horses.size} horses · {trainingClass.sessions.length} sessions
              </Text>
            </Panel>
          ))}
        </View>
      ) : null}
      {resource.data && tab === "Live" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Live training sessions</SectionTitle>
          {live.length ? (
            live.map((session) => <TrainingSessionRow key={session.id} session={session} />)
          ) : (
            <Panel>
              <Text style={uiStyles.value}>{t("No session is live")}</Text>
              <Text style={uiStyles.muted}>
                {t("Scheduled sessions will appear here when sensor streaming begins.")}
              </Text>
            </Panel>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function TrainingSessionRow({ session }: { session: TrainingSessionView }) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  return (
    <Panel>
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
        {session.intensity ? ` · ${session.intensity}` : ""}
      </Text>
      {session.surface || session.location ? (
        <Text style={uiStyles.label}>{[session.surface, session.location].filter(Boolean).join(" · ")}</Text>
      ) : null}
      {session.trials.length ? (
        <Text style={uiStyles.label}>
          Trial {session.trials.map((trial) => `#${trial.attemptNo} ${trial.elapsedLabel}`).join(" · ")}
        </Text>
      ) : null}
      {session.targetTimeMs != null ? (
        <Text style={uiStyles.label}>Target {formatDurationMs(session.targetTimeMs)}</Text>
      ) : null}
      {session.evaluation?.comment ? (
        <Text style={uiStyles.muted}>{session.evaluation.evaluatorName ?? "Trainer"}: {session.evaluation.comment}</Text>
      ) : null}
    </Panel>
  );
}
