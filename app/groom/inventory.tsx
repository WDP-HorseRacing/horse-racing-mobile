import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { Chips, Field, Metric, NativeInput, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { suppliesService } from "@/services/supplies.service";
import { mapSupplyItem, supplyRequestStatusLabel, type SupplyItemDto, type SupplyRequestDto } from "@/adapters/supplies.adapter";
import { showApiError } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/formatters";
import { radius, space } from "@/config/theme";

export default function GroomInventory() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();
  const [filter, setFilter] = useState("All");
  const [proposingItem, setProposingItem] = useState<SupplyItemDto | null>(null);
  const [requestedQty, setRequestedQty] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState<SupplyRequestDto | null>(null);
  const [isSending, setIsSending] = useState(false);

  const loadInventory = useCallback(async () => {
    const [items, requests] = await Promise.all([
      suppliesService.listItems(token!),
      suppliesService.listRequests(token!),
    ]);
    return { items, requests };
  }, [token]);
  const resource = useApiResource(loadInventory, Boolean(token));
  const items = resource.data?.items ?? [];
  const requests = resource.data?.requests ?? [];
  const filteredItems = items.map(mapSupplyItem)
    .filter((item) => filter === "All" || item.categoryLabel === filter);

  const resetForm = () => {
    setProposingItem(null); setRequestedQty(""); setReason(""); setPriority("Normal"); setSent(null);
  };

  const submitProposal = async () => {
    const quantity = Number(requestedQty);
    if (!token || !proposingItem || !Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert("Invalid quantity", "Enter a quantity greater than zero.");
      return;
    }
    const noteParts = [priority === "Urgent" ? "Priority: urgent." : "Priority: normal.", reason.trim()].filter(Boolean);
    setIsSending(true);
    try {
      const request = await suppliesService.createRequest(token, proposingItem.id, quantity, noteParts.join(" "));
      setSent(request);
      await resource.refresh();
    } catch (error) {
      showApiError(error, "Could not submit supply request");
    } finally {
      setIsSending(false);
    }
  };

  if (sent) {
    return (
      <Screen role="groom" title="Proposal sent" back>
        <View style={{ alignItems: "center", gap: space.sm, borderRadius: radius.md, backgroundColor: colors.fitSoft, padding: space.xl }}>
          <Text style={{ color: colors.primary, fontSize: 34, fontWeight: "900" }}>✓</Text>
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}>Restock requested</Text>
          <Text style={uiStyles.muted}>{sent.item.name} · {sent.quantity} {sent.item.unit}</Text>
          <Text style={uiStyles.muted}>Status: {supplyRequestStatusLabel(sent.status)}</Text>
        </View>
        <PrimaryButton label="Back to inventory" onPress={resetForm} />
      </Screen>
    );
  }

  if (proposingItem) {
    return (
      <Screen role="groom" title="Propose restock" subtitle={proposingItem.name} back>
        <View style={uiStyles.section}>
          <SectionTitle>Current status</SectionTitle>
          <Panel>
            <View style={uiStyles.row}>
              <Text style={uiStyles.muted}>Available quantity</Text>
              <Text style={uiStyles.value}>{proposingItem.quantityOnHand} {proposingItem.unit}</Text>
            </View>
          </Panel>
        </View>
        <Field label="Requested quantity">
          <NativeInput value={requestedQty} onChangeText={setRequestedQty} placeholder={`Quantity in ${proposingItem.unit}`} />
        </Field>
        <View style={uiStyles.section}>
          <SectionTitle>Priority</SectionTitle>
          <Chips options={["Normal", "Urgent"]} value={priority} onChange={setPriority} />
        </View>
        <Field label="Reason (optional)">
          <NativeInput value={reason} onChangeText={setReason} multiline placeholder="Why is this needed now?" />
        </Field>
        <PrimaryButton label={isSending ? "Sending…" : "Submit proposal"} icon="send" onPress={() => void submitProposal()} disabled={isSending} />
        <PrimaryButton label="Cancel" icon="close" onPress={resetForm} />
      </Screen>
    );
  }

  const lowStockCount = items.filter((item) => item.lowStock).length;
  const criticalCount = items.filter((item) => item.quantityOnHand <= 0).length;

  return (
    <Screen
      role="groom"
      title="Inventory"
      subtitle="Club supplies and restock requests"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView isLoading={resource.isLoading} error={resource.error} onRetry={() => void resource.retry()} />
      <View style={uiStyles.metricGrid}>
        <Metric label="Total items" value={items.length} hint="tracked" />
        <Metric label="Low stock" value={lowStockCount} hint="needs reorder" tone="warning" />
        <Metric label="Out of stock" value={criticalCount} hint="critical" tone="danger" />
      </View>
      <Chips options={["All", "Feed", "Supplement", "Medicine", "Equipment"]} value={filter} onChange={setFilter} />
      <View style={uiStyles.section}>
        <SectionTitle>{filter === "All" ? "Available supplies" : filter}</SectionTitle>
        {resource.data && filteredItems.length === 0 ? (
          <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="No supply items match this filter." />
        ) : null}
        {filteredItems.map((item) => (
          <Panel key={item.id}>
            <View style={uiStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={uiStyles.value}>{item.name}</Text>
                <Text style={uiStyles.muted}>{item.categoryLabel}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ ...uiStyles.value, color: item.lowStock ? colors.monitor : colors.primary }}>{item.quantityLabel}</Text>
                <Text style={{ ...uiStyles.muted, color: item.lowStock ? colors.monitor : colors.primary }}>{item.lowStock ? "Low stock" : "In stock"}</Text>
              </View>
            </View>
            <View style={{ height: space.sm }} />
            <PrimaryButton label="Propose restock" icon="add" onPress={() => {
              setProposingItem(item); setRequestedQty(""); setReason(""); setPriority("Normal");
            }} />
          </Panel>
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>My supply requests</SectionTitle>
        {resource.data && requests.length === 0 ? (
          <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="You have no supply requests yet." />
        ) : null}
        {requests.map((request) => (
          <Panel key={request.id}>
            <View style={uiStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={uiStyles.value}>{request.item.name} · {request.quantity} {request.item.unit}</Text>
                <Text style={uiStyles.muted}>{formatDateTime(request.createdAt)}</Text>
              </View>
              <Text style={{ ...uiStyles.label, color: request.status === "REJECTED" ? colors.destructive : colors.primary }}>
                {supplyRequestStatusLabel(request.status)}
              </Text>
            </View>
            {request.note ? <Text style={uiStyles.muted}>{request.note}</Text> : null}
          </Panel>
        ))}
      </View>
    </Screen>
  );
}
