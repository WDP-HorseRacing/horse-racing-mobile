import { router } from "expo-router";
import { View, StyleSheet, Pressable } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useRaceOS } from "@/context/RaceOSContext";
import { Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export default function OwnerRemarks() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  
  const { trainerRemarks, horses } = useRaceOS();
  
  // Filter for Marlow Bloodstock (or current owner)
  const myHorses = horses.filter((h) => h.owner === "Marlow Bloodstock");
  const myHorseIds = new Set(myHorses.map((h) => h.id));
  const myRemarks = trainerRemarks?.filter((r) => myHorseIds.has(r.horseId))
    .sort((a, b) => b.date.localeCompare(a.date)) || [];

  return (
    <Screen role="owner" title="Trainer Remarks" subtitle="Professional observations from your Head Trainer">
      <View style={uiStyles.section}>
        <SectionTitle>Recent Observations</SectionTitle>
        {myRemarks.length > 0 ? (
          myRemarks.map((remark) => {
            const horse = horses.find(h => h.id === remark.horseId);
            return (
              <Pressable
                key={remark.id}
                onPress={() => router.push(`/owner/remark/${remark.id}`)}
                style={styles.card}
              >
                <View style={uiStyles.row}>
                  <View style={styles.dateBox}>
                    <Text style={styles.day}>{remark.date.slice(8)}</Text>
                    <Text style={uiStyles.label}>{remark.date.slice(5, 7)}/{remark.date.slice(2, 4)}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={uiStyles.value}>{horse?.name}</Text>
                    <Text style={uiStyles.muted}>{remark.sessionTitle || remark.context}</Text>
                  </View>
                </View>
                
                <View style={styles.content}>
                  <Text style={uiStyles.label}>From: {remark.trainerName}</Text>
                  <Text style={styles.observation} numberOfLines={2}>
                    "{remark.observation}"
                  </Text>
                </View>
                
                <View style={styles.footer}>
                  <Text style={styles.link}>View details →</Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <Panel>
            <Text style={uiStyles.muted}>No trainer remarks yet</Text>
          </Panel>
        )}
      </View>
    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.md,
  },
  dateBox: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.fitSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  day: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  content: {
    paddingLeft: 44 + space.md,
    gap: 4,
  },
  observation: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  link: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  }
});
