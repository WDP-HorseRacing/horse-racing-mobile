import { useCallback, useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { Chips, ProgressBar , Panel, getUiStyles } from "@/components/ui";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { Screen, SectionTitle } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { groomService } from "@/services/groom.service";
import { mapGroomTodayToTasks } from "@/adapters/groom.adapter";

export default function GroomTasks() {
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
  const { token } = useAuth();
  const loadToday = useCallback(() => groomService.getToday(token!), [token]);
  const resource = useApiResource(loadToday, Boolean(token));
  const tasks = resource.data ? mapGroomTodayToTasks(resource.data) : [];
  const [filter, setFilter] = useState("All");
  const list = tasks.filter((task) =>
    filter === "All"
      ? true
      : filter === "Open"
        ? !task.done
        : filter === "Done"
          ? task.done
          : task.kind === filter,
  );
  const trackedTasks = tasks.filter((task) => task.actionable !== false);
  const done = trackedTasks.filter((task) => task.done).length;
  const progress = trackedTasks.length ? Math.round((done / trackedTasks.length) * 100) : 0;

  const completeTask = async (id: string) => {
    const task = tasks.find((item) => item.id === id);
    if (!task?.sourceId) return;
    if (task.sourceType === "checklist") await groomService.tickChecklistItem(token!, task.sourceId, true);
    else if (task.sourceType === "training" && task.sourceAction === "check-in") {
      await groomService.checkIn(token!, task.sourceId);
    } else if (task.sourceType === "training" && task.sourceAction === "ready") {
      await groomService.markReady(token!, task.sourceId);
    } else if (task.sourceType === "care") {
      await groomService.completeCareSchedule(token!, task.sourceId);
    }
    await resource.refresh();
  };

  return (
    <Screen
      role="groom"
      title="Tasks"
      subtitle={resource.isLoading ? "Loading today's tasks…" : `${done} of ${trackedTasks.length} complete`}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={false}
      />
      {resource.data && tasks.length === 0 ? (
        <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="No tasks assigned for today." />
      ) : null}
      {resource.data ? <>
      <Panel>
        <View style={uiStyles.row}>
          <Text style={uiStyles.value}>{"Today's progress"}</Text>
          <Text style={uiStyles.value}>{progress}%</Text>
        </View>
        <View style={{ height: 10 }} />
        <ProgressBar value={progress} />
      </Panel>
      <Chips
        options={["All", "Open", "Done", "Feeding", "Training", "Recovery", "Grooming"]}
        value={filter}
        onChange={setFilter}
      />
      <View style={uiStyles.section}>
        <SectionTitle>{filter === "All" ? "Full day" : filter}</SectionTitle>
        {list.map((task) => (
          <TaskCard key={task.id} task={task} onComplete={completeTask} />
        ))}
      </View>
      </> : null}
    </Screen>
  );
}
