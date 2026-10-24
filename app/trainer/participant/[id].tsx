import { router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Metric, Panel, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { horseService } from "@/services/horse.service";
import { performanceService } from "@/services/performance.service";
import { trainingService } from "@/services/training.service";
import { formatDateTime, formatDurationMs } from "@/utils/formatters";

export default function ParticipantPerformance() {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const {
    id,
    horse,
    session,
    classId: classParam,
    horseId: horseIdParam,
    sessionId: sessionParam,
    sessionType: sessionTypeParam,
    sessionStatus: sessionStatusParam,
    participantStatus: statusParam,
    horseLifecycle: lifecycleParam,
  } = useLocalSearchParams<{
    id: string;
    horse?: string;
    session?: string;
    classId?: string;
    horseId?: string;
    sessionId?: string;
    sessionType?: string;
    sessionStatus?: string;
    participantStatus?: string;
    horseLifecycle?: string;
  }>();
  const participantId = Array.isArray(id) ? id[0] : id;
  const horseName = Array.isArray(horse) ? horse[0] : horse;
  const sessionName = Array.isArray(session) ? session[0] : session;
  const classId = Array.isArray(classParam) ? classParam[0] : classParam;
  const horseId = Array.isArray(horseIdParam) ? horseIdParam[0] : horseIdParam;
  const sessionId = Array.isArray(sessionParam) ? sessionParam[0] : sessionParam;
  const sessionType = Array.isArray(sessionTypeParam) ? sessionTypeParam[0] : sessionTypeParam;
  const sessionStatus = Array.isArray(sessionStatusParam) ? sessionStatusParam[0] : sessionStatusParam;
  const participantStatus = Array.isArray(statusParam) ? statusParam[0] : statusParam;
  const horseLifecycle = Array.isArray(lifecycleParam) ? lifecycleParam[0] : lifecycleParam;
  const { token, user } = useAuth();
  const load = useCallback(async () => {
    const [summary, metrics, evaluation, trialResults, classes, horseProfile] = await Promise.all([
      performanceService.getParticipantSummary(token!, participantId),
      performanceService.listParticipantMetrics(token!, participantId),
      trainingService.getEvaluation(token!, participantId).catch(() => null),
      trainingService.listTrialResults(token!, participantId),
      trainingService.listClasses(token!),
      horseId ? horseService.get(token!, horseId) : Promise.resolve(null),
    ]);
    return {
      summary,
      metrics,
      evaluation,
      trialResults,
      horseLifecycle: horseProfile?.lifecycleStatus ?? horseLifecycle,
      isClassTrainer: classes.some((item) => item.id === classId && item.headTrainerId === user?.userId),
    };
  }, [classId, horseId, horseLifecycle, participantId, token, user?.userId]);
  const resource = useApiResource(load, Boolean(token && participantId));
  const lifecycle = resource.data?.horseLifecycle;
  const readOnlyHorse = lifecycle === "TRANSFERRED" || lifecycle === "DECEASED";
  const completedRun = participantStatus === "COMPLETED" || participantStatus === "STOPPED";
  const canWriteEvaluation = Boolean(
    resource.data?.isClassTrainer &&
      sessionStatus !== "CANCELLED" &&
      completedRun &&
      !readOnlyHorse,
  );
  const canWriteTrialResults = Boolean(
    resource.data?.isClassTrainer &&
      sessionType === "TIME_TRIAL" &&
      (sessionStatus === "IN_PROGRESS" || sessionStatus === "COMPLETED") &&
      (completedRun || participantStatus === "ONGOING") &&
      !readOnlyHorse,
  );

  const evaluationHref = (edit: boolean) => {
    const query = new URLSearchParams({
      horse: horseName ?? "",
      session: sessionName ?? "",
      ...(edit ? { edit: "1" } : {}),
    });
    return `/trainer/eval/${participantId}?${query.toString()}` as Href;
  };
  const trialHref = (params: Record<string, string>) => {
    const query = new URLSearchParams({
      sessionId: sessionId ?? "",
      horse: horseName ?? "",
      ...params,
    });
    return `/trainer/trial-result/${participantId}?${query.toString()}` as Href;
  };

  return (
    <Screen
      role="trainer"
      title="Session performance"
      subtitle={[horseName, sessionName].filter(Boolean).join(" · ") || "Heart rate and speed"}
      back
      fallbackHref="/trainer/training"
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
          <View style={ui.metricGrid}>
            <Metric label="Sensor points" value={resource.data.summary.count} />
            <Metric
              label="Avg heart rate"
              value={
                resource.data.summary.avgHeartRateBpm == null
                  ? "—"
                  : `${resource.data.summary.avgHeartRateBpm} bpm`
              }
            />
            <Metric
              label="Peak heart rate"
              value={
                resource.data.summary.maxHeartRateBpm == null
                  ? "—"
                  : `${resource.data.summary.maxHeartRateBpm} bpm`
              }
              tone={resource.data.summary.criticalCount ? "warning" : "default"}
            />
            <Metric
              label="Avg speed"
              value={
                resource.data.summary.avgSpeedMps == null
                  ? "—"
                  : `${resource.data.summary.avgSpeedMps.toFixed(2)} m/s`
              }
            />
          </View>
          <View style={ui.metricGrid}>
            <Metric
              label="Speed peak"
              value={
                resource.data.summary.maxSpeedMps == null
                  ? "—"
                  : `${resource.data.summary.maxSpeedMps.toFixed(2)} m/s`
              }
            />
            <Metric
              label="Warnings"
              value={resource.data.summary.warningCount}
              tone={resource.data.summary.warningCount ? "warning" : "default"}
            />
            <Metric
              label="Critical"
              value={resource.data.summary.criticalCount}
              tone={resource.data.summary.criticalCount ? "warning" : "default"}
            />
          </View>
          {!resource.data.isClassTrainer ? (
            <Panel>
              <Text style={ui.muted}>
                Mọi Head Trainer có thể xem dữ liệu lượt tập. Chỉ Head Trainer phụ trách lớp được ghi hoặc sửa đánh giá và kết quả.
              </Text>
            </Panel>
          ) : null}
          {readOnlyHorse ? (
            <Panel>
              <Text style={ui.muted}>
                Ngựa đã chuyển nhượng hoặc ghi nhận mất; dữ liệu buổi tập chỉ xem được.
              </Text>
            </Panel>
          ) : null}
          <View style={ui.section}>
            <SectionTitle>Session evaluation</SectionTitle>
            {resource.data.evaluation ? (
              <Panel style={{ gap: 6 }}>
                <Text style={ui.value}>Score {resource.data.evaluation.score}/10</Text>
                <Text style={ui.muted}>{resource.data.evaluation.comment ?? "No trainer note"}</Text>
                <Text style={ui.label}>
                  Updated {formatDateTime(resource.data.evaluation.updatedAt)}
                </Text>
              </Panel>
            ) : (
              <Text style={ui.muted}>No evaluation has been recorded.</Text>
            )}
            {canWriteEvaluation ? (
              <PrimaryButton
                label={resource.data.evaluation ? "Edit evaluation" : "Add evaluation"}
                icon="star-outline"
                onPress={() => router.push(evaluationHref(Boolean(resource.data?.evaluation)))}
              />
            ) : null}
          </View>
          {sessionType === "TIME_TRIAL" ? (
            <View style={ui.section}>
              <SectionTitle>Trial results ({resource.data.trialResults.length})</SectionTitle>
              {resource.data.trialResults.map((result) => (
                <Panel key={result.id} style={{ gap: 6 }}>
                  <Text style={ui.value}>
                    Attempt {result.attemptNo} · {formatDurationMs(result.elapsedMs)}
                  </Text>
                  <Text style={ui.muted}>{result.notes ?? "No notes"}</Text>
                  <Text style={ui.label}>Recorded {formatDateTime(result.recordedAt)}</Text>
                  {canWriteTrialResults ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <SecondaryButton
                        label="Edit result"
                        style={{ flexGrow: 1 }}
                        onPress={() =>
                          router.push(trialHref({ editResult: "1", attemptNo: String(result.attemptNo) }))
                        }
                      />
                      <SecondaryButton
                        label="Manage video"
                        style={{ flexGrow: 1 }}
                        onPress={() =>
                          router.push(
                            trialHref({ videoOnly: "1", attemptNo: String(result.attemptNo) }),
                          )
                        }
                      />
                    </View>
                  ) : null}
                </Panel>
              ))}
              {canWriteTrialResults && resource.data.trialResults.length < 2 ? (
                <PrimaryButton
                  label="Record trial result"
                  icon="timer-outline"
                  onPress={() => router.push(trialHref({}))}
                />
              ) : null}
            </View>
          ) : null}
          <View style={ui.section}>
            <SectionTitle>Recorded metrics</SectionTitle>
            {resource.data.metrics.length ? (
              [...resource.data.metrics]
                .reverse()
                .slice(0, 50)
                .map((point, index) => (
                  <Panel key={`${point.recordedAt}:${index}`} style={{ gap: 5 }}>
                    <View style={ui.row}>
                      <Text style={[ui.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                        {formatDateTime(point.recordedAt)}
                      </Text>
                      <Text
                        style={{
                          ...ui.label,
                          flexShrink: 0,
                          color:
                            point.alertLevel === "CRITICAL"
                              ? colors.destructive
                              : point.alertLevel === "WARNING"
                                ? colors.monitor
                                : colors.primary,
                        }}
                      >
                        {point.alertLevel}
                      </Text>
                    </View>
                    <Text style={ui.muted}>
                      {point.heartRateBpm} bpm · {point.speedMps.toFixed(2)} m/s
                    </Text>
                  </Panel>
                ))
            ) : (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={() => void resource.refresh()}
                empty
                emptyLabel="No sensor data was recorded for this training."
              />
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
