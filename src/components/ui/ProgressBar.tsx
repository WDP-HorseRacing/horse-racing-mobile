import { View, StyleSheet } from "react-native";
import { colors, radius } from "@/config/theme";

export function ProgressBar({ value, tone = colors.primary }: { value: number; tone?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressValue,
          { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: tone },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 7,
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.elevated,
  },
  progressValue: { height: "100%", borderRadius: radius.pill },
});
