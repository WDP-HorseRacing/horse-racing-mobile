import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { useRaceOS } from "@/context/RaceOSContext";
import { Chips, ProgressBar, TaskCard } from "@/native/components";
import { Panel, Screen, SectionTitle, uiStyles } from "@/native/ui";

export default function GroomTasks() {
  const { tasks, completeTask } = useRaceOS();
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
  const done = tasks.filter((task) => task.done).length;
  const progress = Math.round((done / tasks.length) * 100);
  return (
    <Screen role="groom" title="Tasks" subtitle={`${done} of ${tasks.length} complete`}>
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
    </Screen>
  );
}
