import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import type { PerformanceMetricPointDto } from "@/services/performance.service";
import { formatTime } from "@/utils/formatters";

type Mode = "heartRate" | "speed" | "dual";
type Scope = "live" | "all";

type Props = {
  data: PerformanceMetricPointDto[];
  height?: number;
  onStartSimulationRequest?: () => void;
};

export function PerformanceTelemetryChart({
  data,
  height = 190,
  onStartSimulationRequest,
}: Props) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>("heartRate");
  const [scope, setScope] = useState<Scope>("live");
  const [containerWidth, setContainerWidth] = useState(0);

  // Derive sorted chronological metrics
  const sortedMetrics = useMemo(() => {
    return [...data].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
  }, [data]);

  // If live mode is selected, show sliding window of latest 25 points (25 seconds)
  const visibleMetrics = useMemo(() => {
    if (scope === "live" && sortedMetrics.length > 25) {
      return sortedMetrics.slice(-25);
    }
    return sortedMetrics;
  }, [sortedMetrics, scope]);

  // Calculations for Heart Rate & Speed
  const stats = useMemo(() => {
    if (!sortedMetrics.length) {
      return {
        minHr: 0,
        avgHr: 0,
        maxHr: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        normalCount: 0,
        warningCount: 0,
        criticalCount: 0,
      };
    }

    const hrVals = sortedMetrics.map((m) => m.heartRateBpm);
    const speedVals = sortedMetrics.map((m) => m.speedMps);

    const minHr = Math.min(...hrVals);
    const maxHr = Math.max(...hrVals);
    const avgHr = Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length);

    const minSpeed = Math.min(...speedVals);
    const maxSpeed = Math.max(...speedVals);
    const avgSpeed = Number(
      (speedVals.reduce((a, b) => a + b, 0) / speedVals.length).toFixed(2),
    );

    let normalCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    for (const m of sortedMetrics) {
      if (m.heartRateBpm >= 240) criticalCount++;
      else if (m.heartRateBpm >= 180) warningCount++;
      else normalCount++;
    }

    return {
      minHr,
      avgHr,
      maxHr,
      minSpeed,
      avgSpeed,
      maxSpeed,
      normalCount,
      warningCount,
      criticalCount,
    };
  }, [sortedMetrics]);

  // Chart width calculation based on measured container
  const screenWidth = Dimensions.get("window").width;
  const effectiveContainerWidth = containerWidth > 0 ? containerWidth : screenWidth - 32;
  const yAxisLabelWidth = 36;
  const chartWidth = Math.max(120, effectiveContainerWidth - yAxisLabelWidth - 44);

  // Exact mathematically bounded spacing to guarantee NO overflow
  const count = visibleMetrics.length;
  const initialSpacing = 14;
  const endSpacing = 14;
  const availableWidth = Math.max(40, chartWidth - initialSpacing - endSpacing);
  const spacing = count > 1 ? availableWidth / (count - 1) : availableWidth;

  // Step interval for X-axis labels
  const labelInterval = useMemo(() => {
    if (count <= 6) return 1;
    if (count <= 15) return 3;
    if (count <= 30) return 5;
    return Math.ceil(count / 5);
  }, [count]);

  // Map Data for Heart Rate Chart
  const hrChartData = useMemo(() => {
    return visibleMetrics.map((point, index) => {
      const isCritical = point.heartRateBpm >= 240;
      const isWarning = point.heartRateBpm >= 180 && !isCritical;
      const shouldShowLabel =
        index === 0 ||
        index === count - 1 ||
        index % labelInterval === 0;

      return {
        value: point.heartRateBpm,
        label: shouldShowLabel ? formatTime(point.recordedAt) : "",
        dataPointColor: isCritical
          ? colors.destructive
          : isWarning
            ? colors.monitor
            : colors.fit,
        dataPointRadius: isCritical ? 5 : isWarning ? 4 : count > 35 ? 0 : 3,
        textColor: colors.mutedForeground,
        raw: point,
      };
    });
  }, [visibleMetrics, count, labelInterval, colors]);

  // Map Data for Speed Chart
  const speedChartData = useMemo(() => {
    return visibleMetrics.map((point, index) => {
      const shouldShowLabel =
        index === 0 ||
        index === count - 1 ||
        index % labelInterval === 0;

      return {
        value: Number(point.speedMps.toFixed(2)),
        label: shouldShowLabel ? formatTime(point.recordedAt) : "",
        dataPointColor: colors.training,
        dataPointRadius: count > 35 ? 0 : 3,
        textColor: colors.mutedForeground,
        raw: point,
      };
    });
  }, [visibleMetrics, count, labelInterval, colors]);

  // Map Data for Dual Line Chart (Normalized or direct)
  const dualDataHr = hrChartData;
  const dualDataSpeed = useMemo(() => {
    // To show speed meaningfully on a HR chart (0-250), multiply speed by 12 (15 m/s -> 180 equivalent)
    return visibleMetrics.map((point, index) => {
      const shouldShowLabel =
        index === 0 ||
        index === count - 1 ||
        index % labelInterval === 0;

      return {
        value: Number((point.speedMps * 12).toFixed(1)),
        label: shouldShowLabel ? formatTime(point.recordedAt) : "",
        dataPointColor: colors.training,
        dataPointRadius: count > 35 ? 0 : 2,
        textColor: colors.mutedForeground,
        raw: point,
      };
    });
  }, [visibleMetrics, count, labelInterval, colors]);

  // Y-axis scaling for Heart Rate (clean 0 - 280 BPM scale)
  const latestMetric = sortedMetrics[sortedMetrics.length - 1];
  const isLatestCritical = latestMetric ? latestMetric.heartRateBpm >= 240 : false;
  const isLatestWarning = latestMetric ? latestMetric.heartRateBpm >= 180 && !isLatestCritical : false;
  const currentActiveColor = isLatestCritical
    ? colors.destructive
    : isLatestWarning
      ? colors.monitor
      : colors.fit;

  const hrSections = 5;
  const hrMax = Math.max(280, Math.ceil((stats.maxHr + 20) / 20) * 20);
  const hrStep = Math.ceil(hrMax / hrSections);

  // Y-axis scaling for Speed
  const speedMax = Math.max(20, Math.ceil(stats.maxSpeed + 2));
  const speedSections = 4;
  const speedStep = Math.ceil(speedMax / speedSections);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Title & Mode Switcher */}
      <View style={styles.topRow}>
        <View style={styles.titleWithIcon}>
          <Ionicons
            name={
              mode === "heartRate"
                ? "heart-outline"
                : mode === "speed"
                  ? "speedometer-outline"
                  : "analytics-outline"
            }
            size={18}
            color={
              mode === "heartRate"
                ? colors.destructive
                : mode === "speed"
                  ? colors.training
                  : colors.primary
            }
          />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Biểu đồ đo hiệu suất
          </Text>
        </View>

        {/* Mode Segments */}
        <View
          style={[
            styles.segmentContainer,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <Pressable
            onPress={() => setMode("heartRate")}
            style={[
              styles.segmentBtn,
              mode === "heartRate" && {
                backgroundColor: colors.surface,
                borderColor: colors.borderStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    mode === "heartRate" ? colors.foreground : colors.mutedForeground,
                  fontWeight: mode === "heartRate" ? "700" : "500",
                },
              ]}
            >
              ❤️ Nhịp tim
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setMode("speed")}
            style={[
              styles.segmentBtn,
              mode === "speed" && {
                backgroundColor: colors.surface,
                borderColor: colors.borderStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: mode === "speed" ? colors.foreground : colors.mutedForeground,
                  fontWeight: mode === "speed" ? "700" : "500",
                },
              ]}
            >
              ⚡ Vận tốc
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setMode("dual")}
            style={[
              styles.segmentBtn,
              mode === "dual" && {
                backgroundColor: colors.surface,
                borderColor: colors.borderStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: mode === "dual" ? colors.foreground : colors.mutedForeground,
                  fontWeight: mode === "dual" ? "700" : "500",
                },
              ]}
            >
              📊 Cả hai
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Scope Switcher: Live Window vs Full Session */}
      {sortedMetrics.length > 25 ? (
        <View style={styles.scopeRow}>
          <Pressable
            onPress={() => setScope("live")}
            style={[
              styles.scopeBtn,
              scope === "live" && {
                backgroundColor: colors.fitSoft,
                borderColor: colors.primary,
              },
            ]}
          >
            <View
              style={[
                styles.scopeLiveDot,
                { backgroundColor: scope === "live" ? colors.primary : colors.mutedForeground },
              ]}
            />
            <Text
              style={[
                styles.scopeText,
                {
                  color: scope === "live" ? colors.primary : colors.mutedForeground,
                  fontWeight: scope === "live" ? "700" : "500",
                },
              ]}
            >
              Trực tiếp (25s gần nhất)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setScope("all")}
            style={[
              styles.scopeBtn,
              scope === "all" && {
                backgroundColor: colors.surface,
                borderColor: colors.borderStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.scopeText,
                {
                  color: scope === "all" ? colors.foreground : colors.mutedForeground,
                  fontWeight: scope === "all" ? "700" : "500",
                },
              ]}
            >
              Toàn buổi ({sortedMetrics.length} điểm)
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Empty State vs Active Chart */}
      {!sortedMetrics.length ? (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: colors.muted },
            ]}
          >
            <Ionicons name="pulse" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Chưa có dữ liệu cảm biến IoT
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Chưa có điểm đo nhịp tim hay vận tốc nào cho buổi tập này.
          </Text>
          {onStartSimulationRequest && (
            <Pressable
              onPress={onStartSimulationRequest}
              style={[
                styles.emptyActionBtn,
                { backgroundColor: colors.primary },
              ]}
            >
              <Ionicons name="play" size={16} color="#FFFFFF" />
              <Text style={styles.emptyActionBtnText}>
                Bắt đầu phát giả lập ngay
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          {/* Main Chart Graphic */}
          <View style={[styles.chartWrapper, { height: height + 36 }]}>
            {mode === "heartRate" ? (
              <LineChart
                key={`chart-hr-${scope}-${count}-${visibleMetrics[count - 1]?.recordedAt ?? ""}`}
                areaChart
                curved
                curvature={0.15}
                data={hrChartData}
                width={chartWidth}
                height={height}
                spacing={spacing}
                initialSpacing={initialSpacing}
                endSpacing={endSpacing}
                showVerticalLines={false}
                startFillColor={currentActiveColor}
                startOpacity={0.28}
                endFillColor={currentActiveColor}
                endOpacity={0.02}
                color={currentActiveColor}
                thickness={2.5}
                yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 10 }}
                xAxisLabelTextStyle={{
                  color: colors.mutedForeground,
                  fontSize: 10,
                  width: 50,
                  textAlign: "center",
                }}
                yAxisLabelWidth={yAxisLabelWidth}
                yAxisColor={colors.border}
                xAxisColor={colors.border}
                rulesColor={colors.border}
                rulesType="dashed"
                showXAxisIndices={false}
                maxValue={hrMax}
                noOfSections={hrSections}
                stepValue={hrStep}
                isAnimated={false}
                disableScroll
                // Critical Threshold Reference Line (240 BPM)
                showReferenceLine1={true}
                referenceLine1Position={240}
                referenceLine1Config={{
                  color: colors.destructive,
                  thickness: 1.5,
                  type: "dashed",
                  dashWidth: 4,
                  dashGap: 4,
                  width: chartWidth,
                  labelText: "Nguy cấp (240 bpm)",
                  labelTextStyle: {
                    color: colors.destructive,
                    fontSize: 9,
                    fontWeight: "800",
                    top: -14,
                    left: 10,
                  },
                }}
                // Warning Threshold Reference Line (180 BPM)
                showReferenceLine2={true}
                referenceLine2Position={180}
                referenceLine2Config={{
                  color: colors.monitor,
                  thickness: 1.2,
                  type: "dashed",
                  dashWidth: 4,
                  dashGap: 4,
                  width: chartWidth,
                  labelText: "Cảnh báo (180 bpm)",
                  labelTextStyle: {
                    color: colors.monitor,
                    fontSize: 9,
                    fontWeight: "700",
                    top: -14,
                    left: 10,
                  },
                }}
                // Interactive Pointer Tooltip
                pointerConfig={{
                  pointerStripUptoDataPoint: true,
                  pointerStripColor: colors.borderStrong,
                  pointerStripWidth: 1.5,
                  strokeDashArray: [2, 4],
                  pointerColor: colors.primary,
                  radius: 4,
                  pointerLabelWidth: 105,
                  pointerLabelHeight: 46,
                  pointerLabelComponent: (items: any) => {
                    const rawPoint = items[0]?.raw as PerformanceMetricPointDto | undefined;
                    if (!rawPoint) return null;
                    const alertColor =
                      rawPoint.heartRateBpm >= 240
                        ? colors.destructive
                        : rawPoint.heartRateBpm >= 180
                          ? colors.monitor
                          : colors.fit;
                    return (
                      <View
                        style={[
                          styles.tooltip,
                          {
                            backgroundColor: colors.popover,
                            borderColor: alertColor,
                          },
                        ]}
                      >
                        <Text style={[styles.tooltipTime, { color: colors.mutedForeground }]}>
                          {formatTime(rawPoint.recordedAt)}
                        </Text>
                        <Text style={[styles.tooltipValue, { color: alertColor }]}>
                          {rawPoint.heartRateBpm} BPM
                        </Text>
                      </View>
                    );
                  },
                }}
              />
            ) : mode === "speed" ? (
              <LineChart
                key={`chart-speed-${scope}-${count}-${visibleMetrics[count - 1]?.recordedAt ?? ""}`}
                areaChart
                curved
                curvature={0.15}
                data={speedChartData}
                width={chartWidth}
                height={height}
                spacing={spacing}
                initialSpacing={initialSpacing}
                endSpacing={endSpacing}
                showVerticalLines={false}
                startFillColor={colors.training}
                startOpacity={0.3}
                endFillColor={colors.training}
                endOpacity={0.02}
                color={colors.training}
                thickness={2.5}
                yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 10 }}
                xAxisLabelTextStyle={{
                  color: colors.mutedForeground,
                  fontSize: 10,
                  width: 50,
                  textAlign: "center",
                }}
                yAxisLabelWidth={yAxisLabelWidth}
                yAxisColor={colors.border}
                xAxisColor={colors.border}
                rulesColor={colors.border}
                rulesType="dashed"
                showXAxisIndices={false}
                yAxisOffset={0}
                maxValue={speedMax}
                noOfSections={speedSections}
                stepValue={speedStep}
                isAnimated={false}
                disableScroll
                pointerConfig={{
                  pointerStripUptoDataPoint: true,
                  pointerStripColor: colors.borderStrong,
                  pointerStripWidth: 1.5,
                  strokeDashArray: [2, 4],
                  pointerColor: colors.training,
                  radius: 4,
                  pointerLabelWidth: 105,
                  pointerLabelHeight: 46,
                  pointerLabelComponent: (items: any) => {
                    const rawPoint = items[0]?.raw as PerformanceMetricPointDto | undefined;
                    if (!rawPoint) return null;
                    const kmh = (rawPoint.speedMps * 3.6).toFixed(1);
                    return (
                      <View
                        style={[
                          styles.tooltip,
                          {
                            backgroundColor: colors.popover,
                            borderColor: colors.training,
                          },
                        ]}
                      >
                        <Text style={[styles.tooltipTime, { color: colors.mutedForeground }]}>
                          {formatTime(rawPoint.recordedAt)}
                        </Text>
                        <Text style={[styles.tooltipValue, { color: colors.training }]}>
                          {rawPoint.speedMps.toFixed(1)} m/s ({kmh} km/h)
                        </Text>
                      </View>
                    );
                  },
                }}
              />
            ) : (
              <LineChart
                key={`chart-dual-${scope}-${count}-${visibleMetrics[count - 1]?.recordedAt ?? ""}`}
                curved
                curvature={0.15}
                data={dualDataHr}
                data2={dualDataSpeed}
                width={chartWidth}
                height={height}
                spacing={spacing}
                initialSpacing={initialSpacing}
                endSpacing={endSpacing}
                showVerticalLines={false}
                color1={currentActiveColor}
                color2={colors.training}
                thickness1={2.2}
                thickness2={2.2}
                yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 10 }}
                xAxisLabelTextStyle={{
                  color: colors.mutedForeground,
                  fontSize: 10,
                  width: 50,
                  textAlign: "center",
                }}
                yAxisLabelWidth={yAxisLabelWidth}
                yAxisColor={colors.border}
                xAxisColor={colors.border}
                rulesColor={colors.border}
                rulesType="dashed"
                showXAxisIndices={false}
                maxValue={hrMax}
                noOfSections={hrSections}
                stepValue={hrStep}
                isAnimated={false}
                disableScroll
              />
            )}
          </View>

          {/* Zones Legend & Stat Strip */}
          {mode === "heartRate" && (
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.fit }]}
                />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
                  Bình thường (&lt;180)
                </Text>
              </View>

              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.monitor }]}
                />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
                  Cảnh báo (180-239)
                </Text>
              </View>

              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.destructive }]}
                />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
                  Nguy cấp (≥240)
                </Text>
              </View>
            </View>
          )}

          {mode === "dual" && (
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.destructive }]}
                />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
                  Nhịp tim (BPM)
                </Text>
              </View>

              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.training }]}
                />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
                  Vận tốc (m/s scale)
                </Text>
              </View>
            </View>
          )}

          {/* Inline Summary Strip */}
          <View
            style={[
              styles.summaryStrip,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            {mode === "heartRate" ? (
              <>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryText, { color: colors.foreground }]}>
                    Đỉnh:{" "}
                    <Text
                      style={{
                        fontWeight: "700",
                        color: stats.maxHr >= 240 ? colors.destructive : colors.foreground,
                      }}
                    >
                      {stats.maxHr} bpm
                    </Text>
                  </Text>
                </View>
                <Text style={[styles.summaryDivider, { color: colors.borderStrong }]}>
                  •
                </Text>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryText, { color: colors.foreground }]}>
                    TB:{" "}
                    <Text style={{ fontWeight: "700" }}>{stats.avgHr} bpm</Text>
                  </Text>
                </View>
                <Text style={[styles.summaryDivider, { color: colors.borderStrong }]}>
                  •
                </Text>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryText, { color: colors.foreground }]}>
                    Thấp nhất:{" "}
                    <Text style={{ fontWeight: "700" }}>{stats.minHr} bpm</Text>
                  </Text>
                </View>
              </>
            ) : mode === "speed" ? (
              <>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryText, { color: colors.foreground }]}>
                    Tối đa:{" "}
                    <Text style={{ fontWeight: "700", color: colors.training }}>
                      {stats.maxSpeed.toFixed(1)} m/s ({(stats.maxSpeed * 3.6).toFixed(1)} km/h)
                    </Text>
                  </Text>
                </View>
                <Text style={[styles.summaryDivider, { color: colors.borderStrong }]}>
                  •
                </Text>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryText, { color: colors.foreground }]}>
                    TB:{" "}
                    <Text style={{ fontWeight: "700" }}>
                      {stats.avgSpeed.toFixed(1)} m/s ({(stats.avgSpeed * 3.6).toFixed(1)} km/h)
                    </Text>
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryText, { color: colors.foreground }]}>
                    Đỉnh tim:{" "}
                    <Text style={{ fontWeight: "700", color: colors.destructive }}>
                      {stats.maxHr} bpm
                    </Text>
                  </Text>
                </View>
                <Text style={[styles.summaryDivider, { color: colors.borderStrong }]}>
                  •
                </Text>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryText, { color: colors.foreground }]}>
                    Tốc độ đỉnh:{" "}
                    <Text style={{ fontWeight: "700", color: colors.training }}>
                      {stats.maxSpeed.toFixed(1)} m/s
                    </Text>
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  chartWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 4,
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -4,
  },
  scopeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "transparent",
  },
  scopeLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scopeText: {
    fontSize: 11,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.sm,
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: 1,
    gap: 2,
  },
  segmentBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentText: {
    fontSize: 11,
  },
  emptyContainer: {
    paddingVertical: space.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "center",
    maxWidth: 260,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    marginTop: space.sm,
  },
  emptyActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  tooltip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  tooltipTime: {
    fontSize: 9,
    fontWeight: "600",
  },
  tooltipValue: {
    fontSize: 12,
    fontWeight: "800",
  },
  legendContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    flexWrap: "wrap",
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: "500",
  },
  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    rowGap: 6,
    columnGap: space.sm,
    paddingVertical: 8,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 2,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  summaryText: {
    fontSize: 12,
  },
  summaryDivider: {
    fontSize: 12,
  },
});
