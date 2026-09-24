import React from "react";
import { View, Dimensions } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useTheme } from "@/hooks/useTheme";
import { Text } from "@/components/common/LocalizedText";

export function LoadBars({
  data,
  xKey,
  yKey,
  height = 120,
  color,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const c = color || colors.training;

  const mappedData = data.map((item, index) => {
    const val = Number(item[yKey] ?? 0);
    const label = String(item[xKey] ?? "");
    const shouldShowLabel = index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 4) === 0;
    
    return {
      value: val,
      label: shouldShowLabel ? label : "",
      frontColor: c,
      topLabelComponent: () => null,
    };
  });

  const values = mappedData.map(d => d.value);
  const maxVal = values.length > 0 ? Math.max(...values) : 100;
  
  const noOfSections = 4;
  const stepValue = Math.ceil(maxVal / noOfSections);
  const calculatedMax = stepValue * noOfSections;

  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 64;
  const barWidth = Math.max(4, Math.floor(chartWidth / (data.length * 2)));

  return (
    <View style={{ height: height + 20, width: "100%" }}>
      <BarChart
        data={mappedData}
        width={chartWidth}
        height={height}
        barWidth={barWidth}
        spacing={barWidth}
        barBorderRadius={4}
        yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.mutedForeground, fontSize: 10 }}
        yAxisColor="transparent"
        xAxisColor="transparent"
        rulesColor={colors.borderStrong}
        rulesType="solid"
        showYAxisIndices={false}
        showXAxisIndices={false}
        maxValue={calculatedMax}
        noOfSections={noOfSections}
        stepValue={stepValue}
        initialSpacing={barWidth}
        isAnimated={false}
        disableScroll
        pointerConfig={{
          pointerStripUptoDataPoint: true,
          pointerStripColor: colors.borderStrong,
          pointerStripWidth: 2,
          strokeDashArray: [2, 5],
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
    </View>
  );
}
