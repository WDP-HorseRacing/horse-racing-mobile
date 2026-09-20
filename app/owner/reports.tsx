import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { clubFinance, fitnessTrend, speedTrend } from "@/lib/raceos-data";
import { MiniChart , Metric, Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";

export default function OwnerReports() {
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
  return (
    <Screen role="owner" title="Reports" subtitle="September summary">
      <View style={uiStyles.metricGrid}>
        <Metric label="Training cost" value="$10.2k" hint="3 horses" />
        <Metric label="Medical cost" value="$2.4k" hint="+18% vs Aug" tone="warning" />
        <Metric label="Prize revenue" value="$18.5k" hint="1 win, 2 places" tone="good" />
        <Metric label="Net" value="+$5.9k" hint="month to date" tone="good" />
      </View>
      <ReportChart
        title="Costs"
        data={clubFinance}
        valueKey="cost"
        color={colors.monitor}
        caption="Monthly costs ($k)"
      />
      <ReportChart
        title="Revenue"
        data={clubFinance}
        valueKey="revenue"
        color={colors.primary}
        caption="Monthly prize revenue ($k)"
      />
      <ReportChart
        title="Training progress"
        data={fitnessTrend}
        valueKey="v"
        color={colors.training}
        caption="Fitness index"
      />
      <ReportChart
        title="Speed development"
        data={speedTrend}
        valueKey="speed"
        color={colors.primary}
        caption="Top speed km/h"
      />
      <View style={uiStyles.section}>
        <SectionTitle>Medical status</SectionTitle>
        <Panel>
          {[
            ["Thunder King", "Training locked · cardiac review"],
            ["Red Storm", "Rehabilitation · recovery 38%"],
            ["Pale Comet", "No findings · vaccination due"],
          ].map(([horse, status]) => (
            <View key={horse} style={uiStyles.row}>
              <Text style={uiStyles.value}>{horse}</Text>
              <Text style={{ ...uiStyles.muted, flex: 1, textAlign: "right" }}>{status}</Text>
            </View>
          ))}
        </Panel>
      </View>
    </Screen>
  );
}

function ReportChart({
  title,
  data,
  valueKey,
  color,
  caption,
}: {
  title: string;
  data: Record<string, unknown>[];
  valueKey: string;
  color: string;
  caption: string;
}) {
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
  return (
    <View style={uiStyles.section}>
      <SectionTitle>{title}</SectionTitle>
      <Panel>
        <MiniChart data={data} valueKey={valueKey} color={color} />
        <Text style={uiStyles.muted}>{caption}</Text>
      </Panel>
    </View>
  );
}
