import { Image, Pressable, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { radius, space } from "@/config/theme";
import type { Horse, RoleId } from "@/lib/raceos-data";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { formatWeight } from "@/utils/formatters";

export function HorseRow({
  horse,
  role,
  photoUrl,
  horseId: _horseId,
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
  const { t } = useI18n();

  const genderLabel = horse.sex ? t(horse.sex) : null;
  const ageLabel = horse.age ? `${horse.age} ${t("yo") === "yo" ? "tuổi" : t("yo")}` : null;
  const aptitudeLabel = aptitude ? t(aptitude) : horse.raceAptitude ? t(horse.raceAptitude) : null;
  const weightLabel = horse.weight && horse.weight > 0 ? formatWeight(horse.weight) : null;
  const displayLocation =
    location ??
    (horse.stall && horse.stall !== "Not assigned" ? `Ô ${horse.stall}` : t("Pending stall"));

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
          <Text style={styles.horseName} numberOfLines={1} ellipsizeMode="tail">
            {horse.name}
          </Text>
          <StatusBadge status={horse.status} />
        </View>

        {/* Vital metadata tags */}
        <View style={styles.metaRow}>
          {genderLabel ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{genderLabel}</Text>
            </View>
          ) : null}
          {ageLabel ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{ageLabel}</Text>
            </View>
          ) : null}
          {aptitudeLabel ? (
            <View style={[styles.metaPill, styles.metaPillHighlight]}>
              <Text style={[styles.metaPillText, styles.metaPillTextHighlight]}>
                {aptitudeLabel}
              </Text>
            </View>
          ) : null}
          {weightLabel ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{weightLabel}</Text>
            </View>
          ) : null}
          {lifecycleStatus && lifecycleStatus !== "ACTIVE" ? (
            <View style={[styles.metaPill, { backgroundColor: colors.injuredSoft }]}>
              <Text style={[styles.metaPillText, { color: colors.destructive }]}>
                {t(lifecycleStatus)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Location row */}
        <View style={styles.locationRow}>
          <Ionicons name="home-outline" size={13} color={colors.mutedForeground} />
          <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
            {displayLocation}
          </Text>
        </View>
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
      width: 48,
      height: 48,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    photo: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.elevated,
      flexShrink: 0,
    },
    horseCopy: { flex: 1, minWidth: 0, gap: 5 },
    rowTitle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    horseName: { flex: 1, minWidth: 0, color: colors.foreground, fontSize: 16, fontWeight: "700" },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      alignItems: "center",
    },
    metaPill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.elevated,
    },
    metaPillHighlight: {
      backgroundColor: colors.fitSoft,
    },
    metaPillText: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.foreground,
    },
    metaPillTextHighlight: {
      color: colors.primary,
      fontWeight: "600",
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 1,
    },
    locationText: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: "500",
    },
    pressed: { opacity: 0.75 },
  });
