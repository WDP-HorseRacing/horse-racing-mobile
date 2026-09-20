import { Pressable, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { colors, radius, space } from "@/config/theme";
import type { Horse, RoleId } from "@/lib/raceos-data";

export function HorseRow({ horse, role }: { horse: Horse; role: RoleId }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.horseRow, pressed && styles.pressed]}
      onPress={() => router.push(`/${role}/horse/${horse.id}` as Href)}
    >
      <View
        style={[
          styles.horseMark,
          {
            backgroundColor:
              horse.status === "LOCKED" || horse.status === "INJURED"
                ? colors.dangerSoft
                : colors.primarySoft,
          },
        ]}
      >
        <Ionicons
          name="fitness-outline"
          size={22}
          color={
            horse.status === "LOCKED" || horse.status === "INJURED" ? colors.danger : colors.primary
          }
        />
      </View>
      <View style={styles.horseCopy}>
        <View style={styles.rowTitle}>
          <Text style={styles.horseName}>{horse.name}</Text>
          <StatusBadge status={horse.status} />
        </View>
        <Text style={styles.rowMeta}>
          {horse.age} yo {horse.sex} · Stall {horse.stall}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {horse.lastSession}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  horseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  horseMark: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  horseCopy: { flex: 1, gap: 3 },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  horseName: { flexShrink: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  rowMeta: { color: colors.muted, fontSize: 11 },
  pressed: { opacity: 0.7 },
});
