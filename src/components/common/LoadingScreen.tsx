import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useTheme } from "@/hooks/useTheme";

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  label: { fontSize: 13 },
});
