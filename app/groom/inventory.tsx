import { useState } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { inventory } from "@/lib/raceos-data";
import { Chips, Metric, Panel, PrimaryButton, Field, NativeInput, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export default function GroomInventory() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);

  const [filter, setFilter] = useState("All");
  const [proposingItem, setProposingItem] = useState<string | null>(null);
  const [requestedQty, setRequestedQty] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const list = inventory.filter((item) =>
    filter === "All" ? true : item.category === filter
  );

  const lowStockCount = inventory.filter((item) => item.low).length;
  const criticalCount = inventory.filter((item) => item.stock === 0).length;

  const submitProposal = () => {
    if (!requestedQty) {
      Alert.alert("Missing information", "Please enter a requested quantity.");
      return;
    }
    setSent(true);
  };

  const resetForm = () => {
    setProposingItem(null);
    setRequestedQty("");
    setReason("");
    setPriority("Normal");
    setSent(false);
  };

  if (sent && proposingItem) {
    return (
      <Screen role="groom" title="Proposal sent" back>
        <View style={styles.success}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.title}>Restock requested</Text>
          <Text style={uiStyles.muted}>
            {proposingItem} · {requestedQty} · {priority} priority
          </Text>
        </View>
        <Panel>
          <Text style={uiStyles.muted}>• Club Manager notified</Text>
          <Text style={uiStyles.muted}>• Awaiting approval and purchase order</Text>
        </Panel>
        <PrimaryButton label="Back to inventory" onPress={resetForm} />
      </Screen>
    );
  }

  if (proposingItem) {
    const item = inventory.find((i) => i.name === proposingItem);
    return (
      <Screen role="groom" title="Propose Restock" subtitle={proposingItem} back>
        <View style={uiStyles.section}>
          <SectionTitle>Current Status</SectionTitle>
          <Panel>
            <View style={uiStyles.row}>
              <Text style={uiStyles.muted}>Current quantity</Text>
              <Text style={uiStyles.value}>
                {item?.stock} {item?.unit}
              </Text>
            </View>
          </Panel>
        </View>

        <Field label="Requested quantity">
          <NativeInput
            value={requestedQty}
            onChangeText={setRequestedQty}
            placeholder={`e.g. 100 ${item?.unit}`}
          />
        </Field>

        <View style={uiStyles.section}>
          <SectionTitle>Priority</SectionTitle>
          <Chips
            options={["Normal", "Urgent"]}
            value={priority}
            onChange={setPriority}
          />
        </View>

        <Field label="Reason (Optional)">
          <NativeInput
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="Why is this needed now?"
          />
        </Field>

        <PrimaryButton label="Submit Proposal" icon="send" onPress={submitProposal} />
        <PrimaryButton label="Cancel" icon="close" onPress={resetForm} />
      </Screen>
    );
  }

  return (
    <Screen role="groom" title="Inventory" subtitle="Stable A">
      <View style={uiStyles.metricGrid}>
        <Metric label="Total items" value={inventory.length} hint="tracked" />
        <Metric label="Low stock" value={lowStockCount} hint="needs reorder" tone="warning" />
        <Metric label="Critical" value={criticalCount} hint="out of stock" tone="danger" />
      </View>

      <Chips
        options={["All", "Feed", "Medicine", "Equipment"]}
        value={filter}
        onChange={setFilter}
      />

      <View style={uiStyles.section}>
        <SectionTitle>{filter === "All" ? "All Supplies" : filter}</SectionTitle>
        {list.map((item) => (
          <Panel key={item.name}>
            <View style={uiStyles.row}>
              <View>
                <Text style={uiStyles.value}>{item.name}</Text>
                <Text style={uiStyles.muted}>{item.category}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    ...uiStyles.value,
                    color: item.low ? colors.monitor : colors.primary,
                  }}
                >
                  {item.stock} {item.unit}
                </Text>
                {item.low ? (
                  <Text style={{ ...uiStyles.muted, color: colors.monitor }}>Low Stock</Text>
                ) : (
                  <Text style={{ ...uiStyles.muted, color: colors.primary }}>In Stock</Text>
                )}
              </View>
            </View>
            <View style={{ height: space.sm }} />
            <PrimaryButton
              label="Propose Restock"
              onPress={() => setProposingItem(item.name)}
            />
          </Panel>
        ))}
      </View>
    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  success: {
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.fitSoft,
    padding: space.xl,
  },
  successIcon: { color: colors.primary, fontSize: 34, fontWeight: "900" },
  title: { color: colors.foreground, fontSize: 20, fontWeight: "800" },
});
