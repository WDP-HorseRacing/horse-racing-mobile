import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Text } from "@/components/common/LocalizedText";
import { KeyValue, SectionTitle } from "@/components/common";
import { MiniChart, Panel, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";

export function SpeedTrendChart({
  metrics,
  color,
}: {
  metrics: { recordedAt: string; speedMps: number }[];
  color: string;
}) {
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const speedData = useMemo(() => {
    return metrics.map((m, idx) => {
      const speedKmh = Number((m.speedMps * 3.6).toFixed(1));
      return {
        value: speedKmh,
        label:
          idx === 0 || idx === metrics.length - 1 || idx % Math.ceil(metrics.length / 4) === 0
            ? `${speedKmh}`
            : "",
        dataPointColor: color,
        speedKmh,
      };
    });
  }, [metrics, color]);

  const stats = useMemo(() => {
    if (!speedData.length) return null;
    const vals = speedData.map((d) => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    return { min, max, avg, count: vals.length };
  }, [speedData]);

  const yBounds = useMemo(() => {
    if (!speedData.length) return { min: 0, max: 60, step: 15, span: 60 };
    const vals = speedData.map((d) => d.value);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const diff = maxVal - minVal;
    const padding = diff === 0 ? Math.max(minVal * 0.1, 2) : Math.max(diff * 0.2, 2);
    const chartMin = Math.max(0, Math.floor(minVal - padding));
    const chartMax = Math.ceil(maxVal + padding);
    const noOfSections = 4;
    const rawSpan = Math.max(chartMax - chartMin, 4);
    const step = Math.max(1, Math.ceil(rawSpan / noOfSections));
    const span = step * noOfSections;
    return { min: chartMin, max: chartMin + span, step, span };
  }, [speedData]);

  const chartWidth = Math.max(120, containerWidth - 45);
  const initialSpacing = 14;
  const endSpacing = 14;
  const count = speedData.length;
  const availableWidth = Math.max(40, chartWidth - initialSpacing - endSpacing);
  const spacing = count > 1 ? availableWidth / (count - 1) : availableWidth;

  return (
    <Panel style={{ gap: space.md, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
            Lịch sử biến thiên vận tốc (km/h)
          </Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
            Tốc độ ghi nhận qua các thời điểm trong bài tập
          </Text>
        </View>
        {stats ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: radius.pill,
              backgroundColor: colors.fitSoft,
              borderWidth: 1,
              borderColor: color,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color }}>
              TB: {stats.avg} km/h
            </Text>
          </View>
        ) : null}
      </View>

      {stats ? (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.border,
              padding: space.sm,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: colors.mutedForeground, fontWeight: "600" }}>TỐI ĐA</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.primary, marginTop: 2 }}>
              {stats.max} km/h
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.border,
              padding: space.sm,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: colors.mutedForeground, fontWeight: "600" }}>TRUNG BÌNH</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.foreground, marginTop: 2 }}>
              {stats.avg} km/h
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.border,
              padding: space.sm,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: colors.mutedForeground, fontWeight: "600" }}>TỐI THIỂU</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.mutedForeground, marginTop: 2 }}>
              {stats.min} km/h
            </Text>
          </View>
        </View>
      ) : null}

      <View
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        style={{ width: "100%", alignItems: "center", marginTop: 4 }}
      >
        {containerWidth > 0 && speedData.length ? (
          <LineChart
            data={speedData}
            width={chartWidth}
            height={160}
            color={color}
            thickness={2.5}
            startFillColor={color}
            endFillColor="transparent"
            startOpacity={0.25}
            endOpacity={0.0}
            areaChart
            curved
            spacing={spacing}
            initialSpacing={initialSpacing}
            endSpacing={endSpacing}
            yAxisColor="transparent"
            xAxisColor={colors.border}
            yAxisTextStyle={{ fontSize: 10, color: colors.mutedForeground }}
            yAxisThickness={0}
            xAxisThickness={1}
            noOfSections={4}
            maxValue={yBounds.max}
            mostNegativeValue={yBounds.min}
            stepValue={yBounds.step}
            xAxisLabelTextStyle={{ fontSize: 9, color: colors.mutedForeground }}
            rulesColor={colors.border}
            rulesType="dashed"
            showVerticalLines={false}
            dataPointsColor={color}
            dataPointsRadius={4}
          />
        ) : null}
      </View>
    </Panel>
  );
}

export function Info({ title, items }: { title: string; items: [string, string][] }) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  return (
    <View style={uiStyles.section}>
      <SectionTitle>{title}</SectionTitle>
      <Panel>
        <KeyValue items={items} />
      </Panel>
    </View>
  );
}

export function ChartSection({
  title,
  data,
  valueKey,
  color,
}: {
  title: string;
  data: Record<string, unknown>[];
  valueKey: string;
  color: string;
}) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  return (
    <View style={uiStyles.section}>
      <SectionTitle>{title}</SectionTitle>
      <Panel>
        <MiniChart data={data} valueKey={valueKey} color={color} />
      </Panel>
    </View>
  );
}
