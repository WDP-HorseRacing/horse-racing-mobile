import { View, Pressable, Alert, StyleSheet } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { Panel } from "@/components/ui/Panel";
import { getUiStyles } from "@/components/ui/styles";
import { radius, space } from "@/config/theme";
import type { Task } from "@/lib/raceos-data";
import { useTheme } from "@/hooks/useTheme";

export function TaskCard({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const uiStyles = getUiStyles(colors);
    const [expanded, setExpanded] = useState(false);

  return (
    <Panel style={[styles.task, task.done && styles.done]}>
      <View style={styles.taskTop}>
        <Text style={styles.time}>{task.time}</Text>
        <View style={styles.flex}>
          <Text style={uiStyles.value}>{task.horse}</Text>
          <Text style={uiStyles.muted}>
            {task.title} · {task.detail}
          </Text>
        </View>
        {task.dietaryRation ? (
          <Pressable onPress={() => setExpanded(!expanded)} style={styles.rationToggle}>
            <Text style={styles.rationToggleText}>Dietary Ration</Text>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {expanded && task.dietaryRation ? (
        <View style={styles.rationContainer}>
          <Text style={uiStyles.value}>Dietary Ration</Text>
          <Text style={uiStyles.muted}>{task.dietaryRation.feedingTime} · {task.time}</Text>
          <View style={styles.rationItems}>
            {task.dietaryRation.items.map((item, index) => (
              <View key={index} style={uiStyles.row}>
                <Text style={uiStyles.muted}>{item.name}</Text>
                <Text style={uiStyles.value}>{item.quantity} {item.unit}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        disabled={task.done}
        onPress={() => {
          onComplete(task.id);
          Alert.alert("Task completed", "Logged to the horse timeline.");
        }}
        style={[styles.complete, task.done && styles.completeDone]}
      >
        <Text style={[styles.completeText, task.done && styles.completeTextDone]}>
          {task.done ? "Completed" : "Complete"}
        </Text>
      </Pressable>
    </Panel>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  task: { gap: space.md },
  taskTop: { flexDirection: "row", gap: space.md },
  flex: { flex: 1, gap: 4 },
  time: { color: colors.mutedForeground, fontSize: 13, width: 45, fontVariant: ["tabular-nums"] },
  done: { opacity: 0.6 },
  complete: {
    minHeight: 45,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  completeDone: { backgroundColor: colors.fitSoft },
  completeText: { color: "#FFFFFF", fontWeight: "800" },
  completeTextDone: { color: colors.primary },
  rationToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rationToggleText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  rationContainer: {
    gap: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rationItems: {
    gap: 6,
    paddingTop: 4,
  },
});
