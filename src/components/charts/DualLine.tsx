import React from "react";
import { View, Dimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "@/hooks/useTheme";
import { Text } from "@/components/common/LocalizedText";

export function DualLine({
  data,
  xKey,
  keys,
  height = 150,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  keys: { key: string; color: string }[];
  height?: number;
}) {
  const { colors } = useTheme();

  // We support up to 3 lines with gifted charts (data, data2, data3)
  // For DualLine we usually only have 2.
  const key1 = keys[0];
  const key2 = keys[1];

  const mapData = (k: string | undefined) => {
    if (!k) return [];
    return data.map((item, index) => {
      const val = Number(item[k] ?? 0);
      const label = String(item[xKey] ?? "");
      const shouldShowLabel = index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 4) === 0;
      
      return {
        value: val,
        label: shouldShowLabel ? label : "",
        hideDataPoint: true,
      };
    });
  };

  const data1 = mapData(key1?.key);
  const data2 = mapData(key2?.key);

  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 64; 

  const allValues = [...data1.map(d => d.value), ...data2.map(d => d.value)];
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 100;
  
  // Gifted charts uses stepValue, noOfSections instead of domain [min, max]
  const noOfSections = 4;
  const stepValue = Math.ceil(maxVal / noOfSections);
  const calculatedMax = stepValue * noOfSections;

  return (
    <View style={{ height: height + 20, width: "100%" }}>
      <LineChart
        data={data1}
        data2={data2.length > 0 ? data2 : undefined}
        width={chartWidth}
        height={height}
        color1={key1?.color}
        color2={key2?.color}
        thickness={2}
        hideDataPoints
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
        initialSpacing={0}
        endSpacing={0}
        isAnimated={false}
        disableScroll
        // Tooltip pointer configuration
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
                  {items[0]?.value} {items[1] ? `| ${items[1]?.value}` : ''}
                </Text>
              </View>
            );
          },
        }}
      />
    </View>
  );
}
