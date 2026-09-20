import { View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import type { HorseStatus } from "@/lib/raceos-data";
import { colors, radius } from "@/config/theme";

const statusPalette: Record<HorseStatus, { color: string; background: string }> = {
  FIT: { color: colors.primary, background: colors.primarySoft },
  "RACE READY": { color: colors.primary, background: colors.primarySoft },
  TRAINING: { color: colors.info, background: colors.infoSoft },
  MONITOR: { color: colors.warning, background: colors.warningSoft },
  INJURED: { color: colors.danger, background: colors.dangerSoft },
  LOCKED: { color: colors.danger, background: colors.dangerSoft },
};

export function StatusBadge({ status }: { status: HorseStatus }) {
  const palette = statusPalette[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeText, { color: palette.color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
});
