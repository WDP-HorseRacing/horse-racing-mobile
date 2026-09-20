import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { clubFinance, fitnessTrend } from "@/lib/raceos-data";
import { MiniChart , Metric, Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";

export default function ManagerReports() {
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
  return (
    <Screen role="manager" title="Club reports" subtitle="September performance">
      <View style={uiStyles.metricGrid}>
        <Metric label="Revenue" value="$104k" hint="September" tone="good" />
        <Metric label="Operating cost" value="$90k" hint="September" tone="warning" />
        <Metric label="Net" value="$14k" hint="month to date" tone="good" />
        <Metric label="Stable fitness" value="78%" hint="+3 pts" tone="good" />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Revenue trend</SectionTitle>
        <Panel>
          <MiniChart data={clubFinance} valueKey="revenue" color={colors.primary} />
          <Text style={uiStyles.muted}>April–September · $k</Text>
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Cost trend</SectionTitle>
        <Panel>
          <MiniChart data={clubFinance} valueKey="cost" color={colors.monitor} />
          <Text style={uiStyles.muted}>April–September · $k</Text>
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Stable fitness</SectionTitle>
        <Panel>
          <MiniChart data={fitnessTrend} valueKey="v" color={colors.training} />
          <Text style={uiStyles.muted}>Seven-day performance indicator</Text>
        </Panel>
      </View>
    </Screen>
  );
}
