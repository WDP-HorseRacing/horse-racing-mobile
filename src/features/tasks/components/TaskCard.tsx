import { View, Pressable, Alert, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { Panel } from "@/components/ui/Panel";
import { getUiStyles } from "@/components/ui/styles";
import { radius, space } from "@/config/theme";
import type { Task } from "@/types/raceos";
import { useTheme } from "@/hooks/useTheme";

export function TaskCard({
  task,
  onComplete,
}: {
  task: Task;
  onComplete: (id: string) => void | boolean | Promise<void | boolean>;
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  return (
    <Panel style={[styles.task, task.done && styles.done]}>
      <View style={styles.taskTop}>
        <Text style={styles.time}>{task.time}</Text>
        <View style={styles.flex}>
          <Text style={uiStyles.value} numberOfLines={1} ellipsizeMode="tail">
            {task.horse}
          </Text>
          <Text style={uiStyles.muted}>
            {task.title} · {task.detail}
          </Text>
        </View>
      </View>

      <Pressable
        disabled={task.done || task.actionable === false}
        onPress={async () => {
          try {
            const completed = await onComplete(task.id);
            if (completed !== false) {
              Alert.alert("Task updated", "The task status has been refreshed.");
            }
          } catch (error) {
            Alert.alert(
              "Could not update task",
              error instanceof Error ? error.message : "Please try again.",
            );
          }
        }}
        style={[styles.complete, (task.done || task.actionable === false) && styles.completeDone]}
      >
        <Text style={[styles.completeText, task.done && styles.completeTextDone]}>
          {task.done
            ? "Completed"
            : task.actionable === false
              ? "Plan only"
              : (task.actionLabel ?? "Complete")}
        </Text>
      </Pressable>
    </Panel>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    task: { gap: space.md },
    taskTop: { flexDirection: "row", gap: space.md },
    flex: { flex: 1, minWidth: 0, gap: 4 },
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
