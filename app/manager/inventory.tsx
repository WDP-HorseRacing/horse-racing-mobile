import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { Chips, DangerButton, Field, Metric, NativeInput, Panel, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { suppliesService } from "@/services/supplies.service";
import { mapSupplyItem, supplyCategoryFromLabel, type SupplyItemDto, type SupplyRequestStatus } from "@/adapters/supplies.adapter";
import { showApiError } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/formatters";
import { space } from "@/config/theme";

const CATEGORIES = ["Feed", "Supplement", "Medicine", "Equipment"];

export default function InventoryManagement() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();
  const [filter, setFilter] = useState("All");
  const [editingItem, setEditingItem] = useState<SupplyItemDto | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Feed");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("");
  const [threshold, setThreshold] = useState("");

  const loadInventory = useCallback(async () => {
    const [items, requests] = await Promise.all([
      suppliesService.listItems(token!),
      suppliesService.listRequests(token!),
    ]);
    return { items, requests };
  }, [token]);
  const resource = useApiResource(loadInventory, Boolean(token));
  const inventory = resource.data?.items ?? [];
  const requests = resource.data?.requests ?? [];
  const filteredList = inventory
    .map(mapSupplyItem)
    .filter((item) => filter === "All" || item.categoryLabel === filter);
  const lowStockCount = inventory.filter((item) => item.lowStock).length;
  const criticalCount = inventory.filter((item) => item.quantityOnHand <= 0).length;

  const openAdd = () => {
    setName(""); setCategory("Feed"); setStock("0"); setUnit(""); setThreshold("");
    setEditingItem(null); setIsAdding(true);
  };

  const openEdit = (item: SupplyItemDto) => {
    setName(item.name); setCategory(mapSupplyItem(item).categoryLabel);
    setStock(String(item.quantityOnHand)); setUnit(item.unit);
    setThreshold(String(item.reorderThreshold)); setEditingItem(item); setIsAdding(true);
  };

  const saveItem = async () => {
    const quantity = Number(stock);
    const reorderThreshold = Number(threshold);
    if (!token || !name.trim() || !unit.trim() || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(reorderThreshold) || reorderThreshold < 0) {
      Alert.alert("Missing or invalid information", "Enter a name, unit, and valid non-negative stock and reorder threshold.");
      return;
    }
    setIsSaving(true);
    try {
      if (editingItem) {
        await suppliesService.updateItem(token, editingItem.id, {
          name: name.trim(), category: supplyCategoryFromLabel(category), unit: unit.trim(), reorderThreshold,
        });
        if (quantity !== editingItem.quantityOnHand) {
          await suppliesService.countItem(token, editingItem.id, quantity);
        }
      } else {
        await suppliesService.createItem(token, {
          name: name.trim(), category: supplyCategoryFromLabel(category), unit: unit.trim(),
          quantityOnHand: quantity, reorderThreshold,
        });
      }
      setIsAdding(false);
      await resource.refresh();
    } catch (error) {
      showApiError(error, "Could not save supply item");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = () => {
    if (!editingItem || !token) return;
    Alert.alert("Delete inventory item", `Remove ${editingItem.name} from the active inventory?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        void suppliesService.deleteItem(token, editingItem.id)
          .then(async () => { setIsAdding(false); await resource.refresh(); })
          .catch((error) => showApiError(error, "Could not delete supply item"));
      } },
    ]);
  };

  const changeRequestStatus = async (requestId: string, status: SupplyRequestStatus, reason?: string) => {
    if (!token) return;
    try {
      await suppliesService.updateRequestStatus(token, requestId, status, reason);
      await resource.refresh();
    } catch (error) {
      showApiError(error, "Could not update supply request");
    }
  };

  if (isAdding) {
    return (
      <Screen role="manager" title={editingItem ? "Edit item" : "Add item"} subtitle={editingItem?.name ?? "New inventory item"} back>
        <Field label="Item name"><NativeInput value={name} onChangeText={setName} placeholder="e.g. Vitamin supplement" /></Field>
        <View style={uiStyles.section}>
          <SectionTitle>Category</SectionTitle>
          <Chips options={CATEGORIES} value={category} onChange={setCategory} />
        </View>
        <Field label="Current quantity"><NativeInput value={stock} onChangeText={setStock} placeholder="e.g. 50" /></Field>
        <Field label="Unit"><NativeInput value={unit} onChangeText={setUnit} placeholder="e.g. kg, bottles, boxes" /></Field>
        <Field label="Reorder threshold"><NativeInput value={threshold} onChangeText={setThreshold} placeholder="Warn below this quantity" /></Field>
        <View style={{ height: space.md }} />
        <PrimaryButton label={isSaving ? "Saving…" : editingItem ? "Save changes" : "Add item"} icon="checkmark" onPress={() => void saveItem()} disabled={isSaving} />
        {editingItem ? <DangerButton label="Delete item" icon="trash-outline" onPress={deleteItem} /> : null}
      </Screen>
    );
  }

  return (
    <Screen
      role="manager"
      title="Inventory"
      subtitle="Manage club supplies and requests"
      back
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView isLoading={resource.isLoading} error={resource.error} onRetry={() => void resource.retry()} />
      <View style={uiStyles.metricGrid}>
        <Metric label="Total items" value={inventory.length} hint="tracked" />
        <Metric label="Low stock" value={lowStockCount} hint="needs reorder" tone="warning" />
        <Metric label="Out of stock" value={criticalCount} hint="critical" tone="danger" />
      </View>
      <PrimaryButton label="Add item" icon="add" onPress={openAdd} />
      <Chips options={["All", ...CATEGORIES]} value={filter} onChange={setFilter} />
      <View style={uiStyles.section}>
        <SectionTitle>{filter === "All" ? "All supplies" : filter}</SectionTitle>
        {resource.data && filteredList.length === 0 ? (
          <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="No supply items match this filter." />
        ) : null}
        {filteredList.map((item) => (
          <Pressable key={item.id} onPress={() => openEdit(item)}>
            <Panel>
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
              <Text style={uiStyles.label}>Reorder at {item.reorderThreshold} {item.unit}</Text>
            </Panel>
          </Pressable>
        ))}
      </View>

      <View style={uiStyles.section}>
        <SectionTitle>Supply requests</SectionTitle>
        {resource.data && requests.length === 0 ? (
          <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="There are no supply requests." />
        ) : null}
        {requests.map((request) => (
          <Panel key={request.id} style={{ gap: space.sm }}>
            <View style={uiStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={uiStyles.value}>{request.item.name} · {request.quantity} {request.item.unit}</Text>
                <Text style={uiStyles.muted}>Requested by {request.requester.fullName}</Text>
              </View>
              <Text style={{ ...uiStyles.label, color: request.status === "PENDING" ? colors.monitor : colors.primary }}>
                {request.status.replaceAll("_", " ")}
              </Text>
            </View>
            {request.note ? <Text style={uiStyles.muted}>{request.note}</Text> : null}
            <Text style={uiStyles.label}>{formatDateTime(request.createdAt)}</Text>
            {request.status === "PENDING" ? (
              <View style={{ gap: space.sm }}>
                <PrimaryButton label="Approve request" icon="checkmark" onPress={() => void changeRequestStatus(request.id, "APPROVED")} />
                <DangerButton label="Reject request" icon="close" onPress={() => void changeRequestStatus(request.id, "REJECTED", "Rejected by club manager")} />
              </View>
            ) : request.status === "APPROVED" ? (
              <SecondaryButton label="Mark as fulfilled" icon="cube-outline" onPress={() => void changeRequestStatus(request.id, "FULFILLED")} />
            ) : null}
          </Panel>
        ))}
      </View>
    </Screen>
  );
}
