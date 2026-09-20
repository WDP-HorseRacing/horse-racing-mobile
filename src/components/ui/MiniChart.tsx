import { View, StyleSheet } from "react-native";
import { colors } from "@/config/theme";

export function MiniChart({
  data,
  valueKey,
  color = colors.primary,
  height = 110,
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  color?: string;
  height?: number;
}) {
  const values = data.map((item) => Number(item[valueKey] ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    <View style={[styles.chart, { height }]}>
      {values.map((value, index) => {
        const normalized = max === min ? 0.5 : (value - min) / (max - min);
        return (
          <View
            key={`${valueKey}-${index}`}
            style={[
              styles.chartBar,
              { height: Math.max(8, normalized * (height - 12) + 8), backgroundColor: color },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 5 },
  chartBar: { flex: 1, minWidth: 3, borderRadius: 4, opacity: 0.9 },
});
