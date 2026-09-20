import { View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { horses } from "@/mocks/raceos";
import { useRaceOS } from "@/context/RaceOSContext";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { HorseRow } from "@/features/horses/components/HorseRow";
import { Metric } from "@/components/ui/Metric";
import { PrimaryButton } from "@/components/ui/Button";
import { SectionTitle } from "@/components/common/SectionTitle";
import { getUiStyles } from "@/components/ui/styles";
import { useTheme } from "@/hooks/useTheme";

export function GroomDashboard() {
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
  const { tasks, completeTask } = useRaceOS();
  const done = tasks.filter((task) => task.done).length;
  const next = tasks.find((task) => !task.done);
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Tasks" value={`${done}/${tasks.length}`} hint="today" />
        <Metric
          label="Next"
          value={next?.time ?? "—"}
          hint={next?.horse ?? "All done"}
          tone="warning"
        />
        <Metric label="Flags" value={2} hint="vet instructions" tone="danger" />
      </View>
      {next ? (
        <View style={uiStyles.section}>
          <SectionTitle>Do this next</SectionTitle>
          <TaskCard task={next} onComplete={completeTask} />
        </View>
      ) : null}
      <View style={uiStyles.section}>
        <SectionTitle>Vet instructions</SectionTitle>
        <View style={uiStyles.warning}>
          <Text style={uiStyles.value}>Thunder King</Text>
          <Text style={uiStyles.muted}>Training locked — walk in hand only, 20 min.</Text>
        </View>
        <View style={uiStyles.warning}>
          <Text style={uiStyles.value}>Red Storm</Text>
          <Text style={uiStyles.muted}>Ice bath left fore, 15 min after 08:00.</Text>
        </View>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Horses in your care</SectionTitle>
        {horses.slice(0, 4).map((horse) => (
          <HorseRow key={horse.id} horse={horse} role="groom" />
        ))}
      </View>
      <PrimaryButton
        label="Report an incident"
        icon="camera-outline"
        onPress={() => router.push("/groom/report")}
      />
    </>
  );
}
