import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Metric, Panel, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { performanceService } from "@/services/performance.service";
import { formatDateTime } from "@/utils/formatters";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function VetParticipantPerformance() {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const params = useLocalSearchParams<{
    id: string;
    horse?: string;
    session?: string;
  }>();
  const participantId = first(params.id) ?? "";
  const horseName = first(params.horse);
  const sessionName = first(params.session);
  const { token } = useAuth();
  const load = useCallback(async () => {
    const [summary, metrics] = await Promise.all([
      performanceService.getParticipantSummary(token!, participantId),
      performanceService.listParticipantMetrics(token!, participantId),
    ]);
    return { summary, metrics };
  }, [participantId, token]);
  const resource = useApiResource(load, Boolean(token && participantId));

  return (
    <Screen
      role="vet"
      title="Session performance"
      subtitle={[horseName, sessionName].filter(Boolean).join(" · ") || "Heart rate and speed"}
      back
      fallbackHref="/vet/alerts"
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
