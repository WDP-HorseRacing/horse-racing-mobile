import React from "react";
import { View, Dimensions } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useTheme } from "@/hooks/useTheme";
import { Text } from "@/components/common/LocalizedText";

export function CompareBars({
  data,
  xKey,
  keys,
  height = 160,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  keys: { key: string; color: string }[];
  height?: number;
}) {
  const { colors } = useTheme();

  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 64;
  
  // Calculate bar width based on number of bars per group and total groups
  const numGroups = data.length;
  const barsPerGroup = keys.length;
  const totalBars = numGroups * barsPerGroup;
  
  const barWidth = Math.max(4, Math.floor(chartWidth / (totalBars * 1.5)));
  const barSpacing = 2; // spacing between bars in a group
  const groupSpacing = barWidth * 1.5; // spacing between groups

  let maxVal = 0;
  
  const mappedData: any[] = [];
  data.forEach((item, index) => {
    const label = String(item[xKey] ?? "");
    const shouldShowLabel = index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 4) === 0;

    keys.forEach((k, kIndex) => {
      const val = Number(item[k.key] ?? 0);
      if (val > maxVal) maxVal = val;
      
      mappedData.push({
        value: val,
        label: kIndex === 0 && shouldShowLabel ? label : "",
        frontColor: k.color,
        spacing: kIndex === keys.length - 1 ? groupSpacing : barSpacing,
        labelWidth: 30, // to center the label roughly under the group
      });
    });
  });

  const noOfSections = 4;
  const stepValue = Math.ceil((maxVal || 100) / noOfSections);
  const calculatedMax = stepValue * noOfSections;

  return (
    <View style={{ height: height + 20, width: "100%" }}>
      <BarChart
        data={mappedData}
        width={chartWidth}
        height={height}
        barWidth={barWidth}
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
