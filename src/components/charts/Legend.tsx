import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useTheme } from "@/hooks/useTheme";

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  const { colors } = useTheme();
  
  return (
    <View style={styles.container}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: i.color }]} />
          <Text style={[styles.labelText, { color: colors.mutedForeground }]}>
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
    rowGap: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  colorBox: {
    height: 6,
    width: 16,
    borderRadius: 999,
  },
  labelText: {
    fontSize: 11,
  },
});
