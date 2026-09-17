import { View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { clubFinance, fitnessTrend } from "@/lib/raceos-data";
import { MiniChart } from "@/native/components";
import { Metric, Panel, Screen, SectionTitle, uiStyles } from "@/native/ui";
import { colors } from "@/native/theme";

export default function ManagerReports() {
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
          <MiniChart data={clubFinance} valueKey="cost" color={colors.warning} />
          <Text style={uiStyles.muted}>April–September · $k</Text>
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Stable fitness</SectionTitle>
        <Panel>
          <MiniChart data={fitnessTrend} valueKey="v" color={colors.info} />
          <Text style={uiStyles.muted}>Seven-day performance indicator</Text>
        </Panel>
      </View>
    </Screen>
  );
}
