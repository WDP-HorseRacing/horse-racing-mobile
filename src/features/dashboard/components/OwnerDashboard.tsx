import { View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { horses, fitnessTrend } from "@/mocks/raceos";
import { MiniChart } from "@/components/ui/MiniChart";
import { TimelineItem } from "@/components/common/TimelineItem";
import { HorseRow } from "@/features/horses/components/HorseRow";
import { Metric, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { SectionTitle } from "@/components/common/SectionTitle";
import { useTheme } from "@/hooks/useTheme";

export function OwnerDashboard() {
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
  const mine = horses.filter((horse) => horse.owner === "Marlow Bloodstock");
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Avg fitness" value="64%" hint="three horses" tone="warning" />
        <Metric label="Race ready" value={0} hint="next Sep 28" />
        <Metric label="Prize YTD" value="$41.5k" hint="season" tone="good" />
      </View>
      <View style={uiStyles.section}>
        {mine.map((horse) => (
          <HorseRow key={horse.id} horse={horse} role="owner" />
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Fitness across your horses</SectionTitle>
        <Panel>
          <MiniChart data={fitnessTrend} valueKey="v" />
          <Text style={uiStyles.muted}>Seven-day fitness trend</Text>
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Latest updates</SectionTitle>
        <Panel>
          <TimelineItem
            time="Today"
            title="Thunder King"
            detail="Training paused by veterinarian — recovery plan started"
            tone={colors.destructive}
          />
          <TimelineItem
            time="Yesterday"
            title="Red Storm"
            detail="Rehabilitation week 3 · recovery 38%"
            tone={colors.monitor}
          />
          <TimelineItem
            time="Saturday"
            title="Pale Comet"
            detail="Foundation work progressing well"
            tone={colors.primary}
            last
          />
        </Panel>
        <PrimaryButton
          label="View Trainer Remarks"
          icon="document-text-outline"
          onPress={() => router.push("/owner/remarks")}
        />
      </View>
    </>
  );
}
