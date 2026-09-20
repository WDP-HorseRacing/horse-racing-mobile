import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { auditLog, inventory, staff } from "@/lib/raceos-data";
import { Chips , Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { TimelineItem , Screen, SectionTitle } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";

export default function Operations() {
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
  const [tab, setTab] = useState("Inventory");
  return (
    <Screen role="manager" title="Operations">
      <PrimaryButton
        label="Register new horse"
        icon="add"
        onPress={() => router.push("/manager/register-horse")}
      />
      <Chips options={["Inventory", "Staff & RBAC", "Audit log"]} value={tab} onChange={setTab} />
      {tab === "Inventory" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Stock levels</SectionTitle>
          {inventory.map((item) => (
            <Panel key={item.name}>
              <View style={uiStyles.row}>
                <View>
                  <Text style={uiStyles.value}>{item.name}</Text>
                  <Text style={uiStyles.muted}>{item.category}</Text>
                </View>
                <Text
                  style={{ ...uiStyles.value, color: item.low ? colors.monitor : colors.primary }}
                >
                  {item.stock} {item.unit}
                </Text>
              </View>
              {item.low ? (
                <Text style={{ ...uiStyles.muted, color: colors.monitor }}>Reorder required</Text>
              ) : null}
            </Panel>
          ))}
        </View>
      ) : null}
      {tab === "Staff & RBAC" ? (
        <View style={uiStyles.section}>
          <SectionTitle>People and permissions</SectionTitle>
          {staff.map((person) => (
            <Panel key={person.name}>
              <View style={uiStyles.row}>
                <View>
                  <Text style={uiStyles.value}>{person.name}</Text>
                  <Text style={uiStyles.muted}>
                    {person.role} · {person.scope}
                  </Text>
                </View>
                <Text
                  style={{
                    ...uiStyles.muted,
                    color: person.status === "Off shift" ? colors.mutedForeground : colors.primary,
                  }}
                >
                  {person.status}
                </Text>
              </View>
            </Panel>
          ))}
        </View>
      ) : null}
      {tab === "Audit log" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Recent activity</SectionTitle>
          <Panel>
            {auditLog.map((entry, index) => (
              <TimelineItem
                key={`${entry.time}-${entry.action}`}
                time={entry.time}
                title={entry.action}
                detail={`${entry.who} · ${entry.object} · ${entry.result}`}
                tone={index < 2 ? colors.destructive : colors.training}
                last={index === auditLog.length - 1}
              />
            ))}
          </Panel>
        </View>
      ) : null}
    </Screen>
  );
}
