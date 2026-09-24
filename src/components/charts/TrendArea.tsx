import React from "react";
import { View, Dimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "@/hooks/useTheme";
import { Text } from "@/components/common/LocalizedText";

export function TrendArea({
  data,
  xKey,
  yKey,
  color,
  height = 130,
  domain,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  domain?: [number, number];
}) {
  const { colors } = useTheme();
  const c = color || colors.fit;

  // Map data for Gifted Charts: { value: number, label: string }
  const mappedData = data.map((item, index) => {
    const val = Number(item[yKey] ?? 0);
    const label = String(item[xKey] ?? "");
    // Only show label for every Nth item to avoid crowding the X-Axis
    const shouldShowLabel = index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 4) === 0;
    
    return {
      value: val,
      label: shouldShowLabel ? label : "",
      hideDataPoint: true,
    };
  });

  // Calculate domain for Y Axis
  const values = mappedData.map(d => d.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  
  const minVal = domain?.[0] !== undefined && typeof domain[0] === 'number' ? domain[0] : (dataMin > 20 ? dataMin - 20 : 0);
  const maxVal = domain?.[1] !== undefined && typeof domain[1] === 'number' ? domain[1] : dataMax + 20;

  // Gifted charts uses stepValue, noOfSections instead of domain [min, max]
  const noOfSections = 4;
  const stepValue = Math.ceil((maxVal - minVal) / noOfSections);
  const calculatedMax = minVal + stepValue * noOfSections;

  // Use onLayout to get exact container width
  const [containerWidth, setContainerWidth] = React.useState(0);
  // Gifted charts 'width' prop is just for the chart area (excluding Y axis)
  const yAxisLabelWidth = 35;
  const chartWidth = Math.max(0, containerWidth - yAxisLabelWidth - 10);

  return (
    <View 
      style={{ height: height + 20, width: "100%" }} 
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 && (
        <LineChart
          areaChart
          data={mappedData}
          width={chartWidth}
        height={height}
        startFillColor={c}
        startOpacity={0.35}
        endFillColor={c}
        endOpacity={0.02}
        color={c}
        thickness={2}
        hideDataPoints
        yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.mutedForeground, fontSize: 10 }}
        yAxisColor="transparent"
        xAxisColor="transparent"
        rulesColor={colors.borderStrong}
        rulesType="solid"
        showXAxisIndices={false}
        yAxisOffset={minVal}
        maxValue={calculatedMax - minVal}
        noOfSections={noOfSections}
        stepValue={stepValue}
        isAnimated={false}
        disableScroll
        // Tooltip pointer configuration
        pointerConfig={{
          pointerStripUptoDataPoint: true,
          pointerStripColor: colors.borderStrong,
          pointerStripWidth: 2,
          strokeDashArray: [2, 5],
          pointerColor: c,
          radius: 4,
          pointerLabelWidth: 80,
          pointerLabelHeight: 30,
          pointerLabelComponent: (items: any) => {
            return (
              <View
                style={{
                  backgroundColor: colors.popover,
                  padding: 4,
                  paddingHorizontal: 8,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.popoverForeground, fontSize: 12, fontWeight: 'bold' }}>
                  {items[0].value}
                </Text>
              </View>
            );
          },
        }}
      />
      )}
    </View>
  );
}
