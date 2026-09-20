import { View, Pressable, Alert, StyleSheet } from "react-native";
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
      </View>
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
});
