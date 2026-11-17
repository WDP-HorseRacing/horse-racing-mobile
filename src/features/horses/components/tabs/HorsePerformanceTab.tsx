import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { SectionTitle } from "@/components/common";
import { Panel, ProgressBar, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import { formatDateTime } from "@/utils/formatters";
import { fitnessTrend, speedTrend } from "@/lib/raceos-data";
import { ChartSection, SpeedTrendChart } from "./HorseTabHelpers";

export type HorsePerformanceTabProps = {
  isRealData: boolean;
  performanceResource: {
    isLoading: boolean;
    error: unknown;
    data: any;
    retry: () => void | Promise<unknown>;
  };
};

export function HorsePerformanceTab({
  isRealData,
  performanceResource,
}: HorsePerformanceTabProps) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  if (!isRealData) {
    return (
      <>
        <ChartSection
          title="Top speed"
          data={speedTrend}
          valueKey="speed"
          color={colors.primary}
        />
        <ChartSection
          title="Peak heart rate"
          data={speedTrend}
          valueKey="hr"
          color={colors.destructive}
        />
        <ChartSection
          title="Weekly distance"
          data={fitnessTrend}
          valueKey="load"
          color={colors.training}
        />
      </>
    );
  }

  return (
    <>
      <AsyncStateView
        isLoading={performanceResource.isLoading}
        error={performanceResource.error}
        onRetry={() => void performanceResource.retry()}
      />
      {performanceResource.data ? (
        <>
          {performanceResource.data.summary ? (
            <>
              {/* Hero Vitals 4-Grid */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: space.xs }}>
                {/* Card 1: Số buổi đã theo dõi */}
                <View style={styles.perfTile}>
                  <View style={[styles.perfIconBox, { backgroundColor: colors.fitSoft }]}>
                    <Ionicons name="barbell-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.perfValue}>
                      {performanceResource.data.summary.sessionsTracked}
                    </Text>
                    <Text style={styles.perfLabel} numberOfLines={1}>Buổi hoàn thành</Text>
                  </View>
                </View>

                {/* Card 2: Nhịp tim gần nhất */}
                <View style={styles.perfTile}>
                  <View style={[styles.perfIconBox, { backgroundColor: colors.injuredSoft }]}>
                    <Ionicons name="pulse" size={18} color={colors.destructive} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.perfValue, { color: colors.destructive }]}>
                      {performanceResource.data.summary.latestMetric?.heartRateBpm ?? "—"}
                      {performanceResource.data.summary.latestMetric ? " bpm" : ""}
                    </Text>
                    <Text style={styles.perfLabel} numberOfLines={1}>Nhịp tim gần nhất</Text>
                  </View>
                </View>

                {/* Card 3: Vận tốc gần nhất */}
                <View style={styles.perfTile}>
                  <View style={[styles.perfIconBox, { backgroundColor: "#e0f2fe" }]}>
                    <Ionicons name="speedometer-outline" size={18} color="#0284c7" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.perfValue, { color: "#0284c7" }]}>
                      {performanceResource.data.summary.latestMetric
                        ? `${(performanceResource.data.summary.latestMetric.speedMps * 3.6).toFixed(1)} km/h`
                        : "—"}
                    </Text>
                    <Text style={styles.perfLabel} numberOfLines={1}>Tốc độ gần nhất</Text>
                  </View>
                </View>

                {/* Card 4: Đánh giá HLV */}
                <View style={styles.perfTile}>
                  <View style={[styles.perfIconBox, { backgroundColor: "#fef3c7" }]}>
                    <Ionicons name="star" size={18} color="#f59e0b" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.perfValue, { color: "#d97706" }]}>
                      {performanceResource.data.summary.latestEvaluation
                        ? `${performanceResource.data.summary.latestEvaluation.score}/10`
                        : "—"}
                    </Text>
                    <Text style={styles.perfLabel} numberOfLines={1}>
                      {(() => {
                        const s = performanceResource.data.summary.latestEvaluation?.score;
                        const c = performanceResource.data.summary.latestEvaluation?.comment?.toLowerCase();
                        if (c === "good") return "Tốt";
                        if (c === "excellent") return "Xuất sắc";
                        if (c === "average" || c === "fair") return "Khá";
                        if (c === "poor") return "Cần cải thiện";
                        if (s && s >= 9) return "Xuất sắc";
                        if (s && s >= 7) return "Tốt";
                        if (s && s >= 5) return "Khá";
                        return "Đánh giá phong độ";
                      })()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Trainer Comment Quote Card */}
              {performanceResource.data.summary.latestEvaluation?.comment ? (
                <Panel style={styles.perfCommentCard}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="chatbubble-ellipses" size={15} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                      Nhận xét từ Huấn luyện viên
                    </Text>
                  </View>
                  <Text style={styles.perfCommentText}>
                    "{(() => {
                      const c = performanceResource.data.summary.latestEvaluation.comment;
                      const trimmed = c.trim().toLowerCase();
                      if (trimmed === "good") return "Ngựa hoàn thành bài tập tốt, nhịp thở ổn định và đáp ứng tốt với các bước nước đại.";
                      if (trimmed === "excellent") return "Phong độ xuất sắc! Ngựa duy trì tốc độ và nhịp tim tối ưu trong suốt cự ly.";
                      if (trimmed === "average" || trimmed === "fair") return "Đạt yêu cầu cơ bản. Cần chú ý điều chỉnh nhịp thở ở giai đoạn tăng tốc.";
                      if (trimmed === "poor") return "Thể lực có dấu hiệu suy giảm sớm. Cần theo dõi thêm và giảm cường độ.";
                      return c;
                    })()}"
                  </Text>
                </Panel>
              ) : null}

              {/* Speed history line chart */}
              {performanceResource.data.summary.recentMetrics.length > 1 ? (
                <SpeedTrendChart
                  metrics={performanceResource.data.summary.recentMetrics}
                  color="#0284c7"
                />
              ) : null}
            </>
          ) : (
            <Panel>
              <Text style={uiStyles.muted}>
                Chủ ngựa nhận tóm tắt hiệu suất theo từng buổi tập. Dữ liệu cảm biến thời gian thực giới hạn cho nhân sự quản lý & HLV.
              </Text>
            </Panel>
          )}

          {/* Workload Progress Section */}
          {performanceResource.data.workload ? (
            <View style={uiStyles.section}>
              <SectionTitle>
                Khối lượng tập luyện ({performanceResource.data.workload.from ?? "—"} → {performanceResource.data.workload.to ?? "—"})
              </SectionTitle>
              <Panel style={{ gap: space.sm }}>
                <View style={uiStyles.row}>
                  <View>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, fontWeight: "600" }}>
                      Cự ly tích lũy
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground, marginTop: 2 }}>
                      {(performanceResource.data.workload.actualDistanceM ?? 0).toLocaleString()} m
                      <Text style={{ fontSize: 12, fontWeight: "500", color: colors.mutedForeground }}>
                        {" "}/ {(performanceResource.data.workload.plannedDistanceM ?? 0).toLocaleString()} m kế hoạch
                      </Text>
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "800" }}>
                      {performanceResource.data.workload.plannedDistanceM
                        ? `${Math.round(((performanceResource.data.workload.actualDistanceM ?? 0) / performanceResource.data.workload.plannedDistanceM) * 100)}%`
                        : "—"}
                    </Text>
                  </View>
                </View>

                <ProgressBar
                  value={
                    performanceResource.data.workload.plannedDistanceM
                      ? Math.min(
                          100,
                          Math.round(
                            ((performanceResource.data.workload.actualDistanceM ?? 0) /
                              performanceResource.data.workload.plannedDistanceM) *
                              100,
                          ),
                        )
                      : 0
                  }
                />

                <View style={styles.workloadChipsRow}>
                  <View style={styles.workloadChip}>
                    <Ionicons name="time-outline" size={13} color={colors.primary} />
                    <Text style={styles.workloadChipText}>
                      {Math.round((performanceResource.data.workload.actualDurationSeconds ?? 0) / 60)} phút tập
                    </Text>
                  </View>
                  <View style={styles.workloadChip}>
                    <Ionicons name="checkmark-done-circle-outline" size={13} color={colors.fit} />
                    <Text style={styles.workloadChipText}>
                      {performanceResource.data.workload.sessionsCompleted ?? 0} buổi xong
                    </Text>
                  </View>
                  <View style={styles.workloadChip}>
                    <Ionicons name="flame-outline" size={13} color="#f59e0b" />
                    <Text style={styles.workloadChipText}>
                      {performanceResource.data.workload.byIntensity?.LIGHT ?? 0} nhẹ · {performanceResource.data.workload.byIntensity?.HEAVY ?? 0} nặng
                    </Text>
                  </View>
                </View>
              </Panel>
            </View>
          ) : null}

          {/* Biometric Thresholds */}
          {performanceResource.data.thresholds ? (
            <View style={uiStyles.section}>
              <SectionTitle>Ngưỡng an toàn cảm biến & sinh trắc học</SectionTitle>
              <Panel style={{ gap: space.xs }}>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                  Áp dụng quy chuẩn theo dõi sức khỏe của câu lạc bộ:
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <View style={[styles.thresholdBadge, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}>
                    <Ionicons name="warning-outline" size={14} color="#d97706" />
                    <Text style={[styles.thresholdValue, { color: "#d97706" }]}>
                      {performanceResource.data.thresholds.limits.heartRateWarningBpm} bpm
                    </Text>
                    <Text style={styles.thresholdLabel}>Cảnh báo nhịp tim</Text>
                  </View>

                  <View style={[styles.thresholdBadge, { backgroundColor: colors.injuredSoft, borderColor: "#fecaca" }]}>
                    <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                    <Text style={[styles.thresholdValue, { color: colors.destructive }]}>
                      {performanceResource.data.thresholds.limits.heartRateCriticalBpm} bpm
                    </Text>
                    <Text style={styles.thresholdLabel}>Nguy cấp nhịp tim</Text>
                  </View>

                  <View style={[styles.thresholdBadge, { backgroundColor: "#e0f2fe", borderColor: "#bae6fd" }]}>
                    <Ionicons name="flash-outline" size={14} color="#0284c7" />
                    <Text style={[styles.thresholdValue, { color: "#0284c7" }]}>
                      {(performanceResource.data.thresholds.limits.maxSpeedMps * 3.6).toFixed(0)} km/h
                    </Text>
                    <Text style={styles.thresholdLabel}>Tốc độ tối đa</Text>
                  </View>
                </View>
              </Panel>
            </View>
          ) : null}

          {/* Sensor Alerts */}
          {performanceResource.data.alerts?.length ? (
            <View style={uiStyles.section}>
              <SectionTitle>Cảnh báo cảm biến gần đây ({performanceResource.data.alerts.length})</SectionTitle>
              {performanceResource.data.alerts.map((alert: any, index: number) => (
                <Panel
                  key={`${alert.sessionParticipantId}:${alert.recordedAt}:${index}`}
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor:
                      alert.alertLevel === "CRITICAL" ? colors.destructive : colors.monitor,
                    gap: 4,
                  }}
                >
                  <View style={uiStyles.row}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons
                        name={alert.alertLevel === "CRITICAL" ? "warning" : "alert-circle-outline"}
                        size={14}
                        color={alert.alertLevel === "CRITICAL" ? colors.destructive : colors.monitor}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color:
                            alert.alertLevel === "CRITICAL" ? colors.destructive : colors.monitor,
                        }}
                      >
                        {alert.alertLevel === "CRITICAL" ? "NGUY CẤP" : "CẢNH BÁO"}
                      </Text>
                    </View>
                    <Text style={[uiStyles.label, { flexShrink: 0 }]}>
                      {formatDateTime(alert.recordedAt)}
                    </Text>
                  </View>
                  <Text style={[uiStyles.value, { fontSize: 14 }]}>
                    {alert.sessionName ?? "Buổi tập"}
                  </Text>
                  <Text style={uiStyles.muted}>
                    Nhịp tim đo được: <Text style={{ fontWeight: "700", color: colors.foreground }}>{alert.heartRateBpm} bpm</Text> · Vận tốc:{" "}
                    <Text style={{ fontWeight: "700", color: colors.foreground }}>{(alert.speedMps * 3.6).toFixed(1)} km/h</Text>
                  </Text>
                </Panel>
              ))}
            </View>
          ) : null}

          {/* Session Performance Summaries */}
          <View style={uiStyles.section}>
            <SectionTitle>Nhật ký hiệu suất từng buổi tập ({performanceResource.data.sessions?.length ?? 0})</SectionTitle>
            {performanceResource.data.sessions?.length ? (
              performanceResource.data.sessions.map((session: any) => (
                <Panel key={session.sessionId} style={{ gap: space.xs }}>
                  <View style={uiStyles.row}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                      <Text style={[uiStyles.value, { fontSize: 14 }]}>
                        {formatDateTime(session.scheduledAt)}
                      </Text>
                    </View>
                    {session.alertCount ? (
                      <View
                        style={{
                          backgroundColor: colors.injuredSoft,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: radius.pill,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.destructive }}>
                          {session.alertCount} cảnh báo
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          backgroundColor: colors.fitSoft,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: radius.pill,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primary }}>
                          Ổn định
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      backgroundColor: colors.surface,
                      borderRadius: radius.sm,
                      padding: space.xs,
                      gap: space.md,
                      marginTop: 2,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="pulse" size={12} color={colors.destructive} />
                        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Nhịp tim (bpm)</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                        TB {session.avgHeartRateBpm} · Max {session.maxHeartRateBpm}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="speedometer-outline" size={12} color="#0284c7" />
                        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Vận tốc (km/h)</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                        TB {(session.avgSpeedMps * 3.6).toFixed(1)} · Max {(session.maxSpeedMps * 3.6).toFixed(1)}
                      </Text>
                    </View>
                  </View>
                </Panel>
              ))
            ) : (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={() => void performanceResource.retry()}
                empty
                emptyLabel="Chưa có dữ liệu tổng kết hiệu suất buổi tập nào."
              />
            )}
          </View>
        </>
      ) : null}
    </>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    perfTile: {
      flex: 1,
      minWidth: "47%",
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    perfIconBox: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    perfValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
    },
    perfLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
      marginTop: 1,
    },
    perfCommentCard: {
      gap: space.xs,
      backgroundColor: colors.surface,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      padding: space.sm,
    },
    perfCommentText: {
      fontSize: 13,
      fontStyle: "italic",
      color: colors.foreground,
      lineHeight: 19,
    },
    workloadChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: space.xs,
    },
    workloadChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
    },
    workloadChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.foreground,
    },
    thresholdBadge: {
      flex: 1,
      alignItems: "center",
      padding: space.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      gap: 2,
    },
    thresholdValue: {
      fontSize: 13,
      fontWeight: "800",
      marginTop: 2,
    },
    thresholdLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.mutedForeground,
      textAlign: "center",
    },
  });
