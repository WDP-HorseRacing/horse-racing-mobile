import { Image, Pressable, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { radius, space } from "@/config/theme";
import type { Horse, RoleId } from "@/lib/raceos-data";
import { useTheme } from "@/hooks/useTheme";

export function HorseRow({
  horse,
  role,
  photoUrl,
  horseId,
  location,
  aptitude,
  lifecycleStatus,
}: {
  horse: Horse;
  role: RoleId;
  photoUrl?: string | null;
  horseId?: string;
  location?: string;
  aptitude?: string | null;
  lifecycleStatus?: string;
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  return (
    <Pressable
      style={({ pressed }) => [styles.horseRow, pressed && styles.pressed]}
      onPress={() => router.push(`/${role}/horse/${horse.id}` as Href)}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} />
      ) : (
        <View
          style={[
            styles.horseMark,
            {
              backgroundColor:
                horse.status === "LOCKED" || horse.status === "INJURED"
                  ? colors.injuredSoft
                  : colors.fitSoft,
            },
          ]}
        >
          <Ionicons
            name="fitness-outline"
            size={22}
            color={
              horse.status === "LOCKED" || horse.status === "INJURED"
                ? colors.destructive
                : colors.primary
            }
          />
        </View>
      )}
      <View style={styles.horseCopy}>
        <View style={styles.rowTitle}>
          <Text style={styles.horseName}>{horse.name}</Text>
          <StatusBadge status={horse.status} />
        </View>
        {horseId ? <Text style={styles.id}>ID · {horseId}</Text> : null}
        <Text style={styles.rowMeta}>
          {horse.age ? `${horse.age} yo ` : ""}
          {horse.sex} · {location ?? `Stall ${horse.stall}`}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {[lifecycleStatus, aptitude, horse.lastSession].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
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
    photo: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.elevated },
    horseCopy: { flex: 1, gap: 3 },
    rowTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
    horseName: { flexShrink: 1, color: colors.foreground, fontSize: 15, fontWeight: "700" },
    rowMeta: { color: colors.mutedForeground, fontSize: 11 },
    id: { color: colors.mutedForeground, fontSize: 10, fontFamily: "monospace" },
    pressed: { opacity: 0.7 },
  });
