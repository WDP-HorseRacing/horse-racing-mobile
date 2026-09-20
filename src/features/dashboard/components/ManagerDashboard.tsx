import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { auditLog, clubFinance, horses, inventory, staff } from "@/mocks/raceos";
import { MiniChart } from "@/components/ui/MiniChart";
import { TimelineItem } from "@/components/common/TimelineItem";
import { Metric } from "@/components/ui/Metric";
import { Panel } from "@/components/ui/Panel";
import { SectionTitle } from "@/components/common/SectionTitle";
import { uiStyles } from "@/components/ui/styles";
import { colors } from "@/config/theme";

export function ManagerDashboard() {
  const lowStock = inventory.filter((item) => item.low);
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Active horses" value={horses.length} hint="club-wide" />
        <Metric
          label="Staff on duty"
          value={staff.filter((item) => item.status !== "Off shift").length}
          hint="current shift"
          tone="good"
        />
        <Metric label="Low stock" value={lowStock.length} hint="items" tone="warning" />
        <Metric label="Revenue" value="$104k" hint="September" tone="good" />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Stable operations</SectionTitle>
        {lowStock.map((item) => (
          <View key={item.name} style={uiStyles.warning}>
            <Text style={uiStyles.value}>{item.name}</Text>
            <Text style={uiStyles.muted}>
              {item.stock} {item.unit} remaining · reorder required
            </Text>
          </View>
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Financial trend</SectionTitle>
        <Panel>
          <MiniChart data={clubFinance} valueKey="revenue" />
          <Text style={uiStyles.muted}>Revenue April–September ($k)</Text>
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Recent audit activity</SectionTitle>
        <Panel>
          {auditLog.slice(0, 3).map((entry, index) => (
            <TimelineItem
              key={`${entry.time}-${entry.action}`}
              time={entry.time}
              title={entry.action}
              detail={`${entry.who} · ${entry.object}`}
              tone={index === 0 ? colors.danger : colors.info}
              last={index === 2}
            />
          ))}
        </Panel>
      </View>
    </>
  );
}
