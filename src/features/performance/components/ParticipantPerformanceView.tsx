import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Alert, ScrollView, Pressable } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Metric, Panel, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import type {
  ParticipantPerformanceSummaryDto,
  PerformanceMetricPointDto,
} from "@/services/performance.service";
import type { EvaluationDto, TrialResultDto } from "@/services/training.service";
import {
  startSimulation,
  stopSimulation,
  isSimulating,
  sendHeartRateSpike,
  sendTelemetryPoint,
} from "@/features/training/sensor-simulator";
import { subscribeToPerformanceMetrics } from "@/services/realtime.service";
import { formatDateTime, formatDurationMs } from "@/utils/formatters";
import { extractErrorMessage } from "@/utils/errorHandler";
import { IoTSimulatorControlCard } from "./IoTSimulatorControlCard";
import { PerformanceTelemetryChart } from "./PerformanceTelemetryChart";

type Props = {
  role: "trainer" | "vet";
  participantId: string;
  horseName?: string;
  sessionName?: string;
  fallbackHref: Href;
  isLoading: boolean;
  error: unknown;
  isRefreshing: boolean;
  onRefresh: () => Promise<void> | void;
  initialSummary?: ParticipantPerformanceSummaryDto | null;
  initialMetrics?: PerformanceMetricPointDto[];
  // Trainer-specific props
  canWriteEvaluation?: boolean;
  evaluation?: EvaluationDto | null;
  evaluationHref?: (edit: boolean) => Href;
  trialResults?: TrialResultDto[];
  canWriteTrialResults?: boolean;
  trialHref?: (params: Record<string, string>) => Href;
  sessionType?: string;
  noticeText?: string | null;
  readOnlyNotice?: string | null;
};

export function ParticipantPerformanceView({
  role,
  participantId,
  horseName,
  sessionName,
  fallbackHref,
  isLoading,
  error,
  isRefreshing,
  onRefresh,
  initialSummary,
  initialMetrics = [],
  canWriteEvaluation = false,
  evaluation = null,
  evaluationHref,
  trialResults = [],
  canWriteTrialResults = false,
  trialHref,
  sessionType,
  noticeText,
  readOnlyNotice,
}: Props) {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const { token } = useAuth();

  // Local synced state for live metrics & summary
  const [metrics, setMetrics] = useState<PerformanceMetricPointDto[]>(initialMetrics);
  const [summary, setSummary] = useState<ParticipantPerformanceSummaryDto | null>(
    initialSummary ?? null,
  );
  const [isStreaming, setIsStreaming] = useState(() => isSimulating(participantId));
  const [emittedCount, setEmittedCount] = useState(0);
  const [lastPoint, setLastPoint] = useState<PerformanceMetricPointDto | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showAllMetrics, setShowAllMetrics] = useState(false);

  // Sync when initial data updates from API
  useEffect(() => {
    if (initialMetrics.length) {
      setMetrics((prev) => {
        // If we have more live points than initial, merge cleanly
        if (prev.length > initialMetrics.length) return prev;
        return initialMetrics;
      });
      setLastPoint((prev) => prev ?? initialMetrics[initialMetrics.length - 1] ?? null);
    }
  }, [initialMetrics]);

  useEffect(() => {
    if (initialSummary) {
      setSummary((prev) => prev ?? initialSummary);
    }
  }, [initialSummary]);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      stopSimulation(participantId);
    };
  }, [participantId]);

  // Recalculate summary whenever points arrive
  const updateMetricsAndSummary = useCallback(
    (newPoint: PerformanceMetricPointDto) => {
      setMetrics((prev) => {
        const next = [...prev, newPoint];
        // Recalculate summary live
        const hrVals = next.map((p) => p.heartRateBpm);
        const speedVals = next.map((p) => p.speedMps);
        const avgHr = Math.round(hrVals.reduce((a, b) => a + b, 0) / next.length);
        const maxHr = Math.max(...hrVals);
        const avgSpeed = Number((speedVals.reduce((a, b) => a + b, 0) / next.length).toFixed(2));
        const maxSpeed = Number(Math.max(...speedVals).toFixed(2));
        const warningCount = next.filter(
          (p) => p.alertLevel === "WARNING" || (p.heartRateBpm >= 180 && p.heartRateBpm < 240),
        ).length;
        const criticalCount = next.filter(
          (p) => p.alertLevel === "CRITICAL" || p.heartRateBpm >= 240,
        ).length;

        setSummary({
          sessionParticipantId: participantId,
          count: next.length,
          avgHeartRateBpm: avgHr,
          maxHeartRateBpm: maxHr,
          avgSpeedMps: avgSpeed,
          maxSpeedMps: maxSpeed,
          warningCount,
          criticalCount,
          firstRecordedAt: next[0]?.recordedAt ?? null,
          lastRecordedAt: next[next.length - 1]?.recordedAt ?? null,
        });

        return next;
      });
      setLastPoint(newPoint);
      setEmittedCount((c) => c + 1);
    },
    [participantId],
  );

  // Subscribe to live websocket events
  useEffect(() => {
    if (!token || !participantId) return;
    return subscribeToPerformanceMetrics(token, (event) => {
      if (event.sessionParticipantId !== participantId) return;
      const latestPoint = event.points.at(-1);
      if (latestPoint) {
        updateMetricsAndSummary(latestPoint);
      }
    });
  }, [token, participantId, updateMetricsAndSummary]);

  // Simulation controls
  const handleToggleStreaming = useCallback(() => {
    if (isSimulating(participantId)) {
      stopSimulation(participantId);
      setIsStreaming(false);
    } else {
      setIsStreaming(true);
      startSimulation(participantId, token, {
        onTick: (simPoint) => {
          const point: PerformanceMetricPointDto = {
            recordedAt: simPoint.recordedAt,
            heartRateBpm: simPoint.heartRateBpm,
            speedMps: simPoint.speedMps,
            alertLevel:
              simPoint.heartRateBpm >= 240
                ? "CRITICAL"
                : simPoint.heartRateBpm >= 180
                  ? "WARNING"
                  : "NORMAL",
          };
          updateMetricsAndSummary(point);
        },
        onError: (err) => {
          stopSimulation(participantId);
          setIsStreaming(false);
          Alert.alert("Lỗi phát giả lập", extractErrorMessage(err));
        },
      });
    }
  }, [participantId, token, updateMetricsAndSummary]);

  const handleEmitSpike = useCallback(async () => {
    if (!token) return;
    setIsSending(true);
    try {
      const { point } = await sendHeartRateSpike(participantId, token);
      const spikePoint: PerformanceMetricPointDto = {
        recordedAt: point.recordedAt,
        heartRateBpm: point.heartRateBpm,
        speedMps: point.speedMps,
        alertLevel: "CRITICAL",
      };
      updateMetricsAndSummary(spikePoint);
      Alert.alert(
        "⚡ Đã kích hoạt vọt nhịp tim!",
        "Đã gửi thành công xung nhịp tim 248 bpm lên máy chủ. Hệ thống đã kích hoạt mức NGUY CẤP và gửi cảnh báo khẩn cấp tới Bác sĩ & Huấn luyện viên.",
      );
    } catch (err) {
      Alert.alert("Không thể gửi dữ liệu vọt nhịp tim", extractErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  }, [participantId, token, updateMetricsAndSummary]);

  const handleEmitSinglePoint = useCallback(async () => {
    if (!token) return;
    setIsSending(true);
    try {
      const { point } = await sendTelemetryPoint(participantId, undefined, token);
      const regularPoint: PerformanceMetricPointDto = {
        recordedAt: point.recordedAt,
        heartRateBpm: point.heartRateBpm,
        speedMps: point.speedMps,
        alertLevel:
          point.heartRateBpm >= 240
            ? "CRITICAL"
            : point.heartRateBpm >= 180
              ? "WARNING"
              : "NORMAL",
      };
      updateMetricsAndSummary(regularPoint);
    } catch (err) {
      Alert.alert("Không thể gửi điểm đo", extractErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  }, [participantId, token, updateMetricsAndSummary]);

  // Metrics history list
  const displayedMetrics = useMemo(() => {
    const reversed = [...metrics].reverse();
    return showAllMetrics ? reversed : reversed.slice(0, 30);
  }, [metrics, showAllMetrics]);

  // Derived lowest recorded heart rate
  const minHeartRateBpm = useMemo(() => {
    if (!metrics.length) return null;
    return Math.min(...metrics.map((m) => m.heartRateBpm));
  }, [metrics]);

  return (
    <Screen
      role={role}
      title="Hiệu suất buổi tập"
      subtitle={[horseName, sessionName].filter(Boolean).join(" · ") || "Nhịp tim & vận tốc"}
      back
      fallbackHref={fallbackHref}
      refreshing={isRefreshing}
      onRefresh={onRefresh}
    >
      <AsyncStateView isLoading={isLoading} error={error} onRetry={onRefresh} />

      {!isLoading && (
        <View style={{ gap: space.md }}>
          {/* Prominent IoT Telemetry Simulator Control Card */}
          <IoTSimulatorControlCard
            isStreaming={isStreaming}
            emittedCount={emittedCount}
            lastPoint={lastPoint}
            onToggleStreaming={handleToggleStreaming}
            onEmitSpike={handleEmitSpike}
            onEmitSinglePoint={handleEmitSinglePoint}
            isSending={isSending}
          />

          {/* Graphical Telemetry Chart */}
          <PerformanceTelemetryChart
            data={metrics}
            onStartSimulationRequest={handleToggleStreaming}
          />

          {/* Performance Summary Metrics Grid (Balanced 8 items) */}
          <View style={ui.section}>
            <SectionTitle>Tổng quan chỉ số đo</SectionTitle>
            <View style={ui.metricGrid}>
              <Metric
                label="Tổng điểm đo"
                value={summary?.count ?? metrics.length}
              />
              <Metric
                label="Nhịp tim thấp nhất"
                value={
                  minHeartRateBpm == null
                    ? "—"
                    : `${minHeartRateBpm} bpm`
                }
              />
              <Metric
                label="Nhịp tim trung bình"
                value={
                  summary?.avgHeartRateBpm == null
                    ? "—"
                    : `${summary.avgHeartRateBpm} bpm`
                }
              />
              <Metric
                label="Nhịp tim đỉnh (Peak)"
                value={
                  summary?.maxHeartRateBpm == null
                    ? "—"
                    : `${summary.maxHeartRateBpm} bpm`
                }
                tone={
                  summary?.maxHeartRateBpm && summary.maxHeartRateBpm >= 240
                    ? "danger"
                    : summary?.maxHeartRateBpm && summary.maxHeartRateBpm >= 180
                      ? "warning"
                      : "default"
                }
              />
              <Metric
                label="Vận tốc trung bình"
                value={
                  summary?.avgSpeedMps == null
                    ? "—"
                    : `${summary.avgSpeedMps.toFixed(1)} m/s (${(summary.avgSpeedMps * 3.6).toFixed(1)} km/h)`
                }
              />
              <Metric
                label="Vận tốc tối đa"
                value={
                  summary?.maxSpeedMps == null
                    ? "—"
                    : `${summary.maxSpeedMps.toFixed(1)} m/s (${(summary.maxSpeedMps * 3.6).toFixed(1)} km/h)`
                }
              />
              <Metric
                label="Cảnh báo (180-239 bpm)"
                value={summary?.warningCount ?? 0}
                tone={summary?.warningCount ? "warning" : "default"}
              />
              <Metric
                label="Nguy cấp (≥ 240 bpm)"
                value={summary?.criticalCount ?? 0}
                tone={summary?.criticalCount ? "danger" : "default"}
              />
            </View>
          </View>

          {/* Role Notices */}
          {noticeText ? (
            <Panel>
              <Text style={ui.muted}>{noticeText}</Text>
            </Panel>
          ) : null}

          {readOnlyNotice ? (
            <Panel>
              <Text style={ui.muted}>{readOnlyNotice}</Text>
            </Panel>
          ) : null}

          {/* Trainer Evaluation Section */}
          {role === "trainer" && (
            <View style={ui.section}>
              <SectionTitle>Đánh giá buổi tập</SectionTitle>
              {evaluation ? (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    padding: space.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: space.sm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          backgroundColor: colors.fitSoft,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: radius.pill,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Ionicons name="star" size={14} color={colors.primary} />
                        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>
                          {evaluation.score}/10
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                        Đánh giá của HLV
                      </Text>
                    </View>
                    {canWriteEvaluation && evaluationHref ? (
                      <Pressable
                        onPress={() => router.push(evaluationHref(true))}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: radius.pill,
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Ionicons name="create-outline" size={14} color={colors.foreground} />
                        <Text
                          style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}
                        >
                          Sửa
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <Text
                    style={[
                      ui.body,
                      {
                        color: evaluation.comment ? colors.foreground : colors.mutedForeground,
                        fontStyle: evaluation.comment ? "normal" : "italic",
                      },
                    ]}
                  >
                    {evaluation.comment ?? "Không có ghi chú của HLV"}
                  </Text>

                  <Text style={[ui.label, { fontSize: 11 }]}>
                    Cập nhật lúc {formatDateTime(evaluation.updatedAt)}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    padding: space.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: space.sm,
                    alignItems: "center",
                  }}
                >
                  <Text style={ui.muted}>Chưa có bản ghi đánh giá buổi tập nào.</Text>
                  {canWriteEvaluation && evaluationHref ? (
                    <PrimaryButton
                      label="Thêm đánh giá buổi tập"
                      icon="star-outline"
                      style={{ width: "100%", marginTop: 4 }}
                      onPress={() => router.push(evaluationHref(false))}
                    />
                  ) : null}
                </View>
              )}
            </View>
          )}

          {/* Time Trial Results Section */}
          {role === "trainer" && sessionType === "TIME_TRIAL" && (
            <View style={ui.section}>
              <SectionTitle>Kết quả thử tốc độ ({trialResults.length})</SectionTitle>
              {trialResults.map((result) => (
                <Panel key={result.id} style={{ gap: 6 }}>
                  <Text style={ui.value}>
                    Lần chạy {result.attemptNo} · {formatDurationMs(result.elapsedMs)}
                  </Text>
                  <Text style={ui.muted}>{result.notes ?? "Không có ghi chú"}</Text>
                  <Text style={ui.label}>Ghi nhận lúc {formatDateTime(result.recordedAt)}</Text>
                  {canWriteTrialResults && trialHref ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <SecondaryButton
                        label="Sửa kết quả"
                        style={{ flexGrow: 1 }}
                        onPress={() =>
                          router.push(
                            trialHref({ editResult: "1", attemptNo: String(result.attemptNo) }),
                          )
                        }
                      />
                      <SecondaryButton
                        label="Quản lý video"
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
              {canWriteTrialResults && trialHref && trialResults.length < 2 ? (
                <PrimaryButton
                  label="Ghi nhận kết quả thử"
                  icon="timer-outline"
                  onPress={() => router.push(trialHref({}))}
                />
              ) : null}
            </View>
          )}

          {/* Recorded Metrics Timeline Table */}
          <View style={ui.section}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <SectionTitle>Lịch sử điểm đo ({metrics.length})</SectionTitle>
              {metrics.length > 30 && (
                <SecondaryButton
                  label={showAllMetrics ? "Thu gọn (30 điểm)" : `Xem tất cả (${metrics.length})`}
                  onPress={() => setShowAllMetrics((v) => !v)}
                  style={{ paddingVertical: 4, paddingHorizontal: 10 }}
                />
              )}
            </View>

            {displayedMetrics.length ? (
              displayedMetrics.map((point, index) => {
                const isCritical = point.alertLevel === "CRITICAL" || point.heartRateBpm >= 240;
                const isWarning =
                  point.alertLevel === "WARNING" ||
                  (point.heartRateBpm >= 180 && !isCritical);

                const alertBg = isCritical
                  ? colors.injuredSoft
                  : isWarning
                    ? colors.monitorSoft
                    : colors.fitSoft;

                const alertColor = isCritical
                  ? colors.destructive
                  : isWarning
                    ? colors.monitor
                    : colors.fit;

                const alertText = isCritical
                  ? "NGUY CẤP"
                  : isWarning
                    ? "CẢNH BÁO"
                    : "BÌNH THƯỜNG";

                return (
                  <Panel
                    key={`${point.recordedAt}:${index}`}
                    style={{
                      gap: 6,
                      borderLeftWidth: 3,
                      borderLeftColor: alertColor,
                    }}
                  >
                    <View style={ui.row}>
                      <Text style={[ui.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                        {formatDateTime(point.recordedAt)}
                      </Text>
                      <View
                        style={{
                          backgroundColor: alertBg,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: alertColor,
                            letterSpacing: 0.3,
                          }}
                        >
                          {alertText}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: alertColor }}>
                        ❤️ {point.heartRateBpm} bpm
                      </Text>
                      <Text style={ui.muted}>
                        ⚡ {point.speedMps.toFixed(2)} m/s ({(point.speedMps * 3.6).toFixed(1)} km/h)
                      </Text>
                    </View>
                  </Panel>
                );
              })
            ) : (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={onRefresh}
                empty
                emptyLabel="Chưa có dữ liệu cảm biến nào được ghi nhận cho buổi tập này."
              />
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}
