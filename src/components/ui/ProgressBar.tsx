import { View, StyleSheet } from "react-native";
import { radius } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export function ProgressBar({ value, tone }: { value: number; tone?: string }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const activeTone = tone || colors.primary;
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressValue,
          { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: activeTone },
        ]}
      />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  progressTrack: {
    height: 7,
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.elevated,
  },
  progressValue: { height: "100%", borderRadius: radius.pill },
});
