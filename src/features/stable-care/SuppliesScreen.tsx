import { useCallback, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Chips,
  DangerButton,
  Field,
  Metric,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { space } from "@/config/theme";
import {
  supplyCategoryLabel,
  supplyRequestStatusLabel,
  type SupplyCategory,
  type SupplyItemDto,
  type SupplyRequestDto,
  type SupplyRequestStatus,
} from "@/adapters/supplies.adapter";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { suppliesService } from "@/services/supplies.service";
import type { RoleId } from "@/types/raceos";
import { formatDateTime, formatQuantity } from "@/utils/formatters";
import { showApiError } from "@/utils/errorHandler";

type ScreenMode =
  | "item-create"
  | "item-edit"
  | "receive"
  | "use"
  | "request"
  | "request-edit"
  | "reject"
  | "fulfill"
  | null;
const CATEGORIES: SupplyCategory[] = ["FEED", "SUPPLEMENT", "MEDICINE", "EQUIPMENT"];
const EMPLOYEE_ROLES = ["manager", "trainer", "vet", "groom"] as const;

type InventoryPayload = { items: SupplyItemDto[]; requests: SupplyRequestDto[] };
const EMPTY_ITEMS: SupplyItemDto[] = [];

export function SuppliesScreen({ role }: { role: RoleId }) {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const { token } = useAuth();
  const isManager = role === "manager";
  const canUse = EMPLOYEE_ROLES.includes(role as (typeof EMPLOYEE_ROLES)[number]);
  const canRequest = role === "trainer" || role === "groom";
  const canViewRequests = isManager || canRequest;
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Stock");
  const [mode, setMode] = useState<ScreenMode>(null);
  const [selectedItem, setSelectedItem] = useState<SupplyItemDto | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<SupplyRequestDto | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [threshold, setThreshold] = useState("0");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("0");
  const [note, setNote] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [itemCategory, setItemCategory] = useState<SupplyCategory>("FEED");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<InventoryPayload> => {
    const [items, requests] = await Promise.all([
      suppliesService.listItems(token!),
      canViewRequests ? suppliesService.listRequests(token!) : Promise.resolve([]),
    ]);
    return { items, requests };
  }, [canViewRequests, token]);
  const resource = useApiResource(load, Boolean(token));
  const items = resource.data?.items ?? EMPTY_ITEMS;
  const requests = resource.data?.requests ?? [];
  const visibleItems = useMemo(() => {
    const text = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const categoryMatches =
        category === "All" ||
        (category === "Low stock" ? item.lowStock : item.category === category);
      return categoryMatches && (!text || item.name.toLocaleLowerCase().includes(text));
    });
  }, [category, items, search]);
  const lowStockCount = items.filter((item) => item.lowStock).length;

  const openItemForm = (item?: SupplyItemDto) => {
    setSelectedItem(item ?? null);
    setName(item?.name ?? "");
    setUnit(item?.unit ?? "");
    setThreshold(String(item?.reorderThreshold ?? 0));
    setQuantity(item ? "" : "0");
    setUnitPrice("0");
    setItemCategory(item?.category ?? "FEED");
    setMode(item ? "item-edit" : "item-create");
  };
  const openMovement = (item: SupplyItemDto, kind: "receive" | "use") => {
    setSelectedItem(item);
    setQuantity("");
    setUnitPrice("0");
    setNote("");
    setMode(kind);
  };
  const openRequest = (item?: SupplyItemDto, request?: SupplyRequestDto) => {
    setSelectedItem(item ?? null);
    setSelectedRequest(request ?? null);
    setQuantity(request ? String(request.quantity) : "");
    setNote(request?.note ?? "");
    setMode(request ? "request-edit" : "request");
  };
  const closeForm = () => {
    setMode(null);
    setSelectedRequest(null);
  };
  const refresh = async () => {
    await resource.refresh();
    setSelectedItem(null);
    closeForm();
  };

  const save = async () => {
    if (!token || saving) return;
    const amount = Number(quantity);
    const limit = Number(threshold);
    const price = Number(unitPrice);
    setSaving(true);
    try {
      if (mode === "item-create" || mode === "item-edit") {
        if (
          !name.trim() ||
          !unit.trim() ||
          !Number.isFinite(limit) ||
          limit < 0 ||
          limit > 1_000_000_000
        ) {
          Alert.alert(
            "Check supply details",
            "Enter a name, unit, and non-negative reorder threshold.",
          );
          return;
        }
        if (mode === "item-create") {
          const openingAmount = Number(quantity);
          if (
            !Number.isFinite(openingAmount) ||
            openingAmount < 0 ||
            openingAmount > 1_000_000_000 ||
            !Number.isInteger(price) ||
            price < 0 ||
            price > 1_000_000_000
          ) {
            Alert.alert(
              "Check opening stock",
              "Enter a non-negative starting quantity and a whole VND unit price.",
            );
            return;
          }
          await suppliesService.createItem(token, {
            name: name.trim(),
            category: itemCategory,
            unit: unit.trim(),
            quantityOnHand: openingAmount,
            openingUnitPrice: price,
            reorderThreshold: limit,
          });
        } else if (selectedItem) {
          await suppliesService.updateItem(token, selectedItem.id, {
            name: name.trim(),
            category: itemCategory,
            unit: unit.trim(),
            reorderThreshold: limit,
          });
        }
      } else if (mode === "receive" && selectedItem) {
        if (
          !Number.isFinite(amount) ||
          amount <= 0 ||
          amount > 1_000_000_000 ||
          !Number.isInteger(price) ||
          price < 0 ||
          price > 1_000_000_000
        ) {
          Alert.alert(
            "Check receipt",
            "Enter a positive quantity and a whole, non-negative VND unit price.",
          );
          return;
        }
        await suppliesService.receive(token, selectedItem.id, {
          quantity: amount,
          unitPrice: price,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
      } else if (mode === "use" && selectedItem) {
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
          Alert.alert("Check usage", "Enter a quantity greater than zero.");
          return;
        }
        await suppliesService.use(token, selectedItem.id, {
          quantity: amount,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
      } else if (mode === "request" && selectedItem) {
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
          Alert.alert("Check request", "Enter a quantity greater than zero.");
          return;
        }
        await suppliesService.createRequest(token, selectedItem.id, amount, note);
      } else if (mode === "request-edit" && selectedRequest) {
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
          Alert.alert("Check request", "Enter a quantity greater than zero.");
          return;
        }
        await suppliesService.editRequest(token, selectedRequest.id, { quantity: amount, note });
      } else if (mode === "reject" && selectedRequest) {
        if (!requestReason.trim()) {
          Alert.alert("Reason required", "Enter a reason before rejecting this request.");
          return;
        }
        await suppliesService.updateRequestStatus(token, selectedRequest.id, "REJECTED", {
          reason: requestReason.trim(),
        });
      } else if (mode === "fulfill" && selectedRequest) {
        if (!Number.isInteger(price) || price < 0 || price > 1_000_000_000) {
          Alert.alert("Check unit price", "Enter the actual whole VND price paid for each unit.");
          return;
        }
        await suppliesService.updateRequestStatus(token, selectedRequest.id, "FULFILLED", {
          unitPrice: price,
        });
      }
      await refresh();
    } catch (error) {
      showApiError(error, "Could not save inventory change");
    } finally {
      setSaving(false);
    }
  };

  const requestAction = async (request: SupplyRequestDto, status: SupplyRequestStatus) => {
    if (!token) return;
    if (status === "REJECTED" || status === "FULFILLED") {
      setSelectedRequest(request);
      setRequestReason("");
      setQuantity("");
      setUnitPrice("0");
      setMode(status === "REJECTED" ? "reject" : "fulfill");
      return;
    }
    try {
      await suppliesService.updateRequestStatus(token, request.id, status);
      await resource.refresh();
    } catch (error) {
      showApiError(error, "Could not update supply request");
    }
  };

  const removeItem = (item: SupplyItemDto) => {
    if (!token) return;
    Alert.alert("Delete supply item", `Delete ${item.name} from the active inventory?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void suppliesService
            .deleteItem(token, item.id)
            .then(() => resource.refresh())
            .catch((error) => showApiError(error, "Could not delete supply item"));
        },
      },
    ]);
  };

  if (mode) {
    const title =
      mode === "item-create"
        ? "Add supply item"
        : mode === "item-edit"
          ? "Edit supply item"
          : mode === "receive"
            ? "Receive stock"
            : mode === "use"
              ? "Record supply use"
              : mode === "request"
                ? "Propose restock"
                : mode === "request-edit"
                  ? "Edit pending request"
                  : mode === "reject"
                    ? "Reject request"
                    : "Confirm supply issued";
    return (
      <Screen
        role={role}
        title={title}
        subtitle={selectedItem?.name ?? selectedRequest?.item.name}
        back
      >
        {mode === "item-create" || mode === "item-edit" ? (
          <>
            <Field label="Item name">
              <NativeInput value={name} onChangeText={setName} placeholder="e.g. Oat feed" />
            </Field>
            <View style={ui.section}>
              <SectionTitle>Category</SectionTitle>
              <Chips
                options={CATEGORIES.map(supplyCategoryLabel)}
                value={supplyCategoryLabel(itemCategory)}
                onChange={(value) =>
                  setItemCategory(
                    CATEGORIES.find((item) => supplyCategoryLabel(item) === value) ?? "FEED",
                  )
                }
              />
            </View>
            <Field label="Unit">
              <NativeInput value={unit} onChangeText={setUnit} placeholder="kg, bottle, roll" />
            </Field>
            <Field label="Low stock threshold">
              <NativeInput
                value={threshold}
                onChangeText={setThreshold}
                keyboardType="decimal-pad"
              />
            </Field>
            {mode === "item-create" ? (
              <>
                <Field label="Opening quantity">
                  <NativeInput
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                  />
                </Field>
                <Field label="Opening unit price (VND)">
                  <NativeInput
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    keyboardType="numeric"
                  />
                </Field>
              </>
            ) : (
              <Panel>
                <Text style={ui.muted}>
                  Stock changes are recorded through receipts and usage entries.
                </Text>
              </Panel>
            )}
          </>
        ) : null}
        {mode === "receive" ? (
          <>
            <Field label={`Quantity received (${selectedItem?.unit ?? "unit"})`}>
              <NativeInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
            </Field>
            <Field label="Actual unit price (VND)">
              <NativeInput value={unitPrice} onChangeText={setUnitPrice} keyboardType="numeric" />
            </Field>
            <Field label="Note (optional)">
              <NativeInput value={note} onChangeText={setNote} multiline />
            </Field>
          </>
        ) : null}
        {mode === "use" ? (
          <>
            <Panel>
              <Text style={ui.value}>
                Available: {selectedItem?.quantityOnHand} {selectedItem?.unit}
              </Text>
            </Panel>
            <Field label={`Quantity used (${selectedItem?.unit ?? "unit"})`}>
              <NativeInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
            </Field>
            <Field label="Usage note">
              <NativeInput
                value={note}
                onChangeText={setNote}
                multiline
                placeholder="Where or why was it used?"
              />
            </Field>
          </>
        ) : null}
        {mode === "request" || mode === "request-edit" ? (
          <>
            <Field label={`Requested quantity (${selectedItem?.unit ?? "unit"})`}>
              <NativeInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
            </Field>
            <Field label="Note (optional)">
              <NativeInput value={note} onChangeText={setNote} multiline />
            </Field>
          </>
        ) : null}
        {mode === "reject" ? (
          <Field label="Rejection reason (required)">
            <NativeInput value={requestReason} onChangeText={setRequestReason} multiline />
          </Field>
        ) : null}
        {mode === "fulfill" ? (
          <>
            <Panel>
              <Text style={ui.muted}>
                {selectedRequest?.item.name} · requested {selectedRequest?.quantity}{" "}
                {selectedRequest?.item.unit}
              </Text>
            </Panel>
            <Field label="Actual unit price paid (VND)">
              <NativeInput value={unitPrice} onChangeText={setUnitPrice} keyboardType="numeric" />
            </Field>
          </>
        ) : null}
        <PrimaryButton
          label={saving ? "Saving…" : "Save"}
          icon="checkmark"
          onPress={() => void save()}
          disabled={saving}
        />
        <SecondaryButton label="Cancel" icon="close" onPress={closeForm} />
      </Screen>
    );
  }

  return (
    <Screen
      role={role}
      title="Supplies"
      subtitle="Shared club stock and restock requests"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      <View style={ui.metricGrid}>
        <Metric label="Supply items" value={items.length} />
        <Metric label="Low stock" value={lowStockCount} tone={lowStockCount ? "warning" : "good"} />
        {isManager ? (
          <Metric
            label="Pending requests"
            value={requests.filter((request) => request.status === "PENDING").length}
          />
        ) : null}
      </View>
      {canViewRequests ? (
        <Chips options={["Stock", "Requests"]} value={tab} onChange={setTab} />
      ) : null}
      {tab === "Stock" ? (
        <>
          {isManager ? (
            <PrimaryButton label="Add supply" icon="add" onPress={() => openItemForm()} />
          ) : null}
          <Field label="Search by name">
            <NativeInput value={search} onChangeText={setSearch} placeholder="Search supplies" />
          </Field>
          <Chips
            options={["All", "Low stock", ...CATEGORIES.map(supplyCategoryLabel)]}
            value={category}
            onChange={setCategory}
          />
          <View style={ui.section}>
            <SectionTitle>Shared club stock</SectionTitle>
            {resource.data && visibleItems.length === 0 ? (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={() => void resource.refresh()}
                empty
                emptyLabel="No supplies match this filter."
              />
            ) : null}
            {visibleItems.map((item) => (
              <View key={item.id}>
                <Panel style={{ gap: space.sm }}>
                  <View style={ui.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={ui.value}>{item.name}</Text>
                      <Text style={ui.muted}>
                        {supplyCategoryLabel(item.category)} · reorder at{" "}
                        {formatQuantity(item.reorderThreshold, item.unit)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[ui.value, item.lowStock && { color: colors.monitor }]}>
                        {formatQuantity(item.quantityOnHand, item.unit)}
                      </Text>
                      <Text style={ui.label}>{item.lowStock ? "Low stock" : "In stock"}</Text>
                    </View>
                  </View>
                  <View style={ui.row}>
                    <SecondaryButton
                      label="Stock details"
                      icon="list-outline"
                      onPress={() => setSelectedItem(item)}
                    />
                    {canUse ? (
                      <SecondaryButton
                        label="Record use"
                        icon="remove-circle-outline"
                        onPress={() => openMovement(item, "use")}
                      />
                    ) : null}
                    {canRequest ? (
                      <SecondaryButton
                        label="Request"
                        icon="add-circle-outline"
                        onPress={() => openRequest(item)}
                      />
                    ) : null}
                    {isManager ? (
                      <SecondaryButton
                        label="Receive"
                        icon="download-outline"
                        onPress={() => openMovement(item, "receive")}
                      />
                    ) : null}
                  </View>
                  {isManager ? (
                    <View style={ui.row}>
                      <SecondaryButton
                        label="Edit details"
                        icon="create-outline"
                        onPress={() => openItemForm(item)}
                      />
                      <DangerButton
                        label="Delete"
                        icon="trash-outline"
                        onPress={() => removeItem(item)}
                      />
                    </View>
                  ) : null}
                </Panel>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={ui.section}>
          <SectionTitle>{isManager ? "Restock requests" : "My requests"}</SectionTitle>
          {resource.data && requests.length === 0 ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => void resource.refresh()}
              empty
              emptyLabel="There are no supply requests."
            />
          ) : null}
          {requests.map((request) => (
            <Panel key={request.id} style={{ gap: space.sm }}>
              <View style={ui.row}>
                <View style={{ flex: 1 }}>
                  <Text style={ui.value}>
                    {request.item.name} · {formatQuantity(request.quantity, request.item.unit)}
                  </Text>
                  <Text style={ui.muted}>
                    {isManager
                      ? `Requested by ${request.requester.fullName}`
                      : formatDateTime(request.createdAt)}
                  </Text>
                </View>
                <Text
                  style={[
                    ui.label,
                    {
                      color:
                        request.status === "REJECTED"
                          ? colors.destructive
                          : request.status === "PENDING"
                            ? colors.monitor
                            : colors.primary,
                    },
                  ]}
                >
                  {supplyRequestStatusLabel(request.status)}
                </Text>
              </View>
              {request.note ? <Text style={ui.muted}>{request.note}</Text> : null}
              {request.rejectionReason ? (
                <Text style={[ui.muted, { color: colors.destructive }]}>
                  Reason: {request.rejectionReason}
                </Text>
              ) : null}
              {request.reviewedAt ? (
                <Text style={ui.label}>
                  Reviewed {formatDateTime(request.reviewedAt)}
                  {request.reviewer ? ` · ${request.reviewer.fullName}` : ""}
                </Text>
              ) : null}
              {request.fulfilledAt ? (
                <Text style={ui.label}>Issued {formatDateTime(request.fulfilledAt)}</Text>
              ) : null}
              {isManager && request.status === "PENDING" ? (
                <View style={ui.row}>
                  <PrimaryButton
                    label="Approve"
                    icon="checkmark"
                    onPress={() => void requestAction(request, "APPROVED")}
                  />
                  <DangerButton
                    label="Reject"
                    icon="close"
                    onPress={() => {
                      setSelectedRequest(request);
                      setRequestReason("");
                      setMode("reject");
                    }}
                  />
                </View>
              ) : null}
              {isManager && request.status === "APPROVED" ? (
                <PrimaryButton
                  label="Confirm issue"
                  icon="cube-outline"
                  onPress={() => {
                    setSelectedRequest(request);
                    setUnitPrice("0");
                    setMode("fulfill");
                  }}
                />
              ) : null}
              {canRequest &&
              request.requestedBy === request.requester.id &&
              request.status === "PENDING" ? (
                <SecondaryButton
                  label="Edit pending request"
                  icon="create-outline"
                  onPress={() => openRequest(request.item, request)}
                />
              ) : null}
            </Panel>
          ))}
        </View>
      )}

      {selectedItem && !mode ? (
        <SupplyDetails
          role={role}
          token={token ?? ""}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </Screen>
  );
}

function SupplyDetails({
  role,
  token,
  item,
  onClose,
}: {
  role: RoleId;
  token: string;
  item: SupplyItemDto;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const load = useCallback(async () => {
    const [lots, movements] = await Promise.all([
      suppliesService.listLots(token, item.id),
      suppliesService.listMovements(token, item.id),
    ]);
    return { lots, movements };
  }, [item.id, token]);
  const resource = useApiResource(load, Boolean(token));
  const showPrice = role === "manager";
  return (
    <View style={{ gap: space.sm }}>
      <Panel style={{ gap: space.sm }}>
        <View style={ui.row}>
          <Text style={ui.value}>{item.name}</Text>
          <SecondaryButton label="Close" icon="close" onPress={onClose} />
        </View>
        <Text style={ui.muted}>
          {supplyCategoryLabel(item.category)} · {item.quantityOnHand} {item.unit} · reorder
          threshold {item.reorderThreshold}
        </Text>
        <AsyncStateView
          isLoading={resource.isLoading}
          error={resource.error}
          onRetry={() => void resource.retry()}
        />
        <SectionTitle>Lots · FIFO order</SectionTitle>
        {(resource.data?.lots ?? []).map((lot) => (
          <View key={lot.id} style={ui.row}>
            <Text style={ui.muted}>
              {formatDateTime(lot.createdAt)} · {lot.remaining}/{lot.quantity} {item.unit}
            </Text>
            {showPrice ? (
              <Text style={ui.label}>{lot.unitPrice.toLocaleString("vi-VN")} VND/unit</Text>
            ) : null}
          </View>
        ))}
        {resource.data?.lots.length === 0 ? <Text style={ui.muted}>No lots recorded.</Text> : null}
        <SectionTitle>Stock ledger · newest first</SectionTitle>
        {(resource.data?.movements ?? []).map((movement) => (
          <View
            key={movement.id}
            style={{
              gap: 3,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: space.sm,
            }}
          >
            <View style={ui.row}>
              <Text style={ui.value}>{movement.type.replaceAll("_", " ")}</Text>
              <Text style={ui.label}>
                {movement.delta > 0 ? "+" : ""}
                {movement.delta} · balance {movement.balanceAfter}
              </Text>
            </View>
            <Text style={ui.muted}>
              {formatDateTime(movement.createdAt)} · {movement.creator.fullName}
            </Text>
            {movement.note ? <Text style={ui.muted}>{movement.note}</Text> : null}
            {showPrice && movement.amount !== null ? (
              <Text style={ui.label}>
                {movement.amount.toLocaleString("vi-VN")} VND ·{" "}
                {movement.unitPrice?.toLocaleString("vi-VN")} VND/unit
              </Text>
            ) : null}
          </View>
        ))}
        {resource.data?.movements.length === 0 ? (
          <Text style={ui.muted}>No stock movements recorded.</Text>
        ) : null}
      </Panel>
    </View>
  );
}
