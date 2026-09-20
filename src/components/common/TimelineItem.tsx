import { View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { uiStyles } from "@/components/ui/styles";
import { colors, space } from "@/config/theme";

export function TimelineItem({
  time,
  title,
  detail,
  tone = colors.muted,
  last,
}: {
  time: string;
  title: string;
  detail: string;
  tone?: string;
  last?: boolean;
}) {
  return (
    <View style={styles.timeline}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { backgroundColor: tone }]} />
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineCopy}>
        <View style={uiStyles.row}>
          <Text style={uiStyles.value}>{title}</Text>
          <Text style={uiStyles.muted}>{time}</Text>
        </View>
        <Text style={uiStyles.muted}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { flexDirection: "row", gap: space.md },
  timelineRail: { alignItems: "center", width: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  timelineLine: { width: 1, flex: 1, minHeight: 44, backgroundColor: colors.border, marginTop: 4 },
  timelineCopy: { flex: 1, gap: 3, paddingBottom: space.lg },
});
