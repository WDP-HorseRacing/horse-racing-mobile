import { View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import type { HorseStatus } from "@/lib/raceos-data";
import { radius } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

import type { ThemeColors } from "@/config/theme";

const getStatusPalette = (colors: ThemeColors): Record<HorseStatus, { color: string; background: string }> => ({
  FIT: { color: colors.fit, background: colors.fitSoft },
  "RACE READY": { color: colors.raceReady, background: colors.raceReadySoft },
  TRAINING: { color: colors.training, background: colors.trainingSoft },
  MONITOR: { color: colors.monitor, background: colors.monitorSoft },
  INJURED: { color: colors.injured, background: colors.injuredSoft },
  LOCKED: { color: colors.locked, background: colors.lockedSoft },
});

export function StatusBadge({ status }: { status: HorseStatus }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
  const palette = getStatusPalette(colors)[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeText, { color: palette.color }]}>{status}</Text>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
});
