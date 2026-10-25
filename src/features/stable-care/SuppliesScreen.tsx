import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  ProgressBar,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { radius, space } from "@/config/theme";
import {
  supplyCategoryLabel,
  supplyRequestStatusLabel,
  type SupplyCategory,
  type SupplyItemDto,
  type SupplyRequestDto,
  type SupplyRequestStatus,
} from "@/adapters/supplies.adapter";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { suppliesService } from "@/services/supplies.service";
import type { RoleId } from "@/types/raceos";
import { formatDateTime, formatQuantity } from "@/utils/formatters";
import { showApiError } from "@/utils/errorHandler";
import { normalizeVietnamese } from "@/utils/horse-validation";

type ScreenMode =
  | "item-create"
  | "item-edit"
  | "receive"
  | "use"
  | "request"
  | "request-edit"
  | "reject"
  | "fulfill"
  | "cancel-request"
  | null;

const CATEGORIES: SupplyCategory[] = ["FEED", "SUPPLEMENT", "MEDICINE", "EQUIPMENT"];
const EMPLOYEE_ROLES = ["manager", "trainer", "vet", "groom"] as const;

function matchesCategory(
  item: SupplyItemDto,
  catFilter: string,
  t?: (key: string) => string,
): boolean {
  if (!catFilter || catFilter === "All" || catFilter === "Tất cả") return true;
  if (catFilter === "Low stock" || catFilter === "Sắp hết") return item.lowStock;

  const filterLower = catFilter.trim().toLowerCase();
  const itemCatLower = item.category.trim().toLowerCase();
  if (itemCatLower === filterLower) return true;

  const label = supplyCategoryLabel(item.category);
  if (label.toLowerCase() === filterLower) return true;

  if (t) {
    if (t(label).toLowerCase() === filterLower) return true;
    if (t(item.category).toLowerCase() === filterLower) return true;
  }

  return false;
}

type InventoryPayload = { items: SupplyItemDto[]; requests: SupplyRequestDto[] };
const EMPTY_ITEMS: SupplyItemDto[] = [];
const EMPTY_REQUESTS: SupplyRequestDto[] = [];

const USE_QUICK_AMOUNTS = [1, 2, 5, 10];
const USE_NOTE_SUGGESTIONS = [
  "Breakfast",
  "Dinner",
  "Routine care",
  "Prescribed",
  "Stable cleaning",
];
const REQUEST_REASON_SUGGESTIONS = ["Low stock risk", "Demand increase", "Next week reserve"];

export function SuppliesScreen({ role }: { role: RoleId }) {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const { t } = useI18n();
  const { token } = useAuth();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const isManager = role === "manager";
  const canUse = EMPLOYEE_ROLES.includes(role as (typeof EMPLOYEE_ROLES)[number]);
  const canRequest = role === "trainer" || role === "groom" || role === "vet";
  const canViewRequests = isManager || canRequest;

  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Stock");
  const [requestFilter, setRequestFilter] = useState("All");

  const [mode, setMode] = useState<ScreenMode>(null);
  const [selectedItem, setSelectedItem] = useState<SupplyItemDto | null>(null);
  const [detailsItem, setDetailsItem] = useState<SupplyItemDto | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<SupplyRequestDto | null>(null);

  // Form states
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
  const requests = resource.data?.requests ?? EMPTY_REQUESTS;

  const visibleItems = useMemo(() => {
    const text = search.trim().toLowerCase();
    const normText = normalizeVietnamese(text);
    return items.filter((item) => {
      const categoryMatches = matchesCategory(item, category, t);
      const nameMatches =
        !text ||
        item.name.toLowerCase().includes(text) ||
        (normText ? normalizeVietnamese(item.name).includes(normText) : false);
      return categoryMatches && nameMatches;
    });
  }, [category, items, search, t]);

  const visibleRequests = useMemo(() => {
    if (requestFilter === "All") return requests;
    return requests.filter((r) => r.status === requestFilter);
  }, [requests, requestFilter]);

  const lowStockCount = items.filter((item) => item.lowStock).length;
  const pendingRequestsCount = requests.filter((r) => r.status === "PENDING").length;

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
    setQuantity("");
    setNote(request?.note ?? "");
    setMode(request ? "request-edit" : "request");
  };

  const closeForm = () => {
    setMode(null);
    setSelectedItem(null);
    setSelectedRequest(null);
    setSaving(false);
  };

  const refresh = async () => {
    await resource.refresh();
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
        if (amount > selectedItem.quantityOnHand) {
          Alert.alert("Check usage", "Quantity used cannot exceed available stock.");
          return;
        }
        if (!note.trim()) {
          Alert.alert(t("Check usage"), t("Usage note is required."));
          return;
        }
        await suppliesService.use(token, selectedItem.id, {
          quantity: amount,
          note: note.trim(),
        });
      } else if (mode === "request" && selectedItem) {
        await suppliesService.createRequest(token, selectedItem.id, note.trim() || undefined);
      } else if (mode === "request-edit" && selectedRequest) {
        await suppliesService.editRequest(token, selectedRequest.id, {
          note: note.trim() || undefined,
        });
      } else if (mode === "reject" && selectedRequest) {
        if (!requestReason.trim()) {
          Alert.alert("Reason required", "Enter a reason before rejecting this request.");
          return;
        }
        await suppliesService.updateRequestStatus(token, selectedRequest.id, "REJECTED", {
          reason: requestReason.trim(),
        });
      } else if (mode === "fulfill" && selectedRequest) {
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
          Alert.alert("Check quantity", "Enter a positive quantity issued.");
          return;
        }
        if (!Number.isInteger(price) || price < 0 || price > 1_000_000_000) {
          Alert.alert("Check unit price", "Enter the actual whole VND price paid for each unit.");
          return;
        }
        await suppliesService.updateRequestStatus(token, selectedRequest.id, "FULFILLED", {
          quantity: amount,
          unitPrice: price,
        });
      } else if (mode === "cancel-request" && selectedRequest) {
        if (!requestReason.trim()) {
          Alert.alert(t("Lý do bắt buộc"), t("Vui lòng nhập lý do hủy đề xuất đã duyệt."));
          return;
        }
        await suppliesService.updateRequestStatus(token, selectedRequest.id, "CANCELLED", {
          reason: requestReason.trim(),
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

  const getCategoryIcon = (cat: SupplyCategory) => {
    switch (cat) {
      case "FEED":
        return "nutrition-outline";
      case "SUPPLEMENT":
        return "fitness-outline";
      case "MEDICINE":
        return "medkit-outline";
      case "EQUIPMENT":
        return "hammer-outline";
    }
  };

  const getCategoryTone = (cat: SupplyCategory) => {
    switch (cat) {
      case "FEED":
        return { bg: colors.fitSoft, text: colors.fit };
      case "SUPPLEMENT":
        return { bg: colors.trainingSoft, text: colors.training };
      case "MEDICINE":
        return { bg: colors.injuredSoft, text: colors.injured };
      case "EQUIPMENT":
        return { bg: colors.muted, text: colors.foreground };
    }
  };

  // Remaining calculations for usage modal
  const usedAmount = Number(quantity || 0);
  const availableQty = selectedItem?.quantityOnHand ?? 0;
  const remainingStock = Math.round((availableQty - usedAmount) * 100) / 100;
  const isUsageOver = usedAmount > availableQty;
  const isUsageBelowThreshold =
    remainingStock <= (selectedItem?.reorderThreshold ?? 0) && remainingStock >= 0;

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

      {/* Top Metrics */}
      <View style={ui.metricGrid}>
        <Metric label="Supply items" value={items.length} />
        <Metric label="Low stock" value={lowStockCount} tone={lowStockCount ? "warning" : "good"} />
        {canViewRequests ? (
          <Metric
            label="Pending supply requests"
            value={pendingRequestsCount}
            tone={pendingRequestsCount ? "warning" : "good"}
          />
        ) : null}
      </View>

      {/* Main Tab Switcher */}
      {canViewRequests ? (
        <View style={styles.tabBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setTab("Stock")}
            style={[styles.tabButton, tab === "Stock" && styles.tabButtonActive]}
          >
            <Ionicons
              name="cube-outline"
              size={18}
              color={tab === "Stock" ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.tabButtonText, tab === "Stock" && styles.tabButtonTextActive]}>
              {t("Stock")} ({items.length})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setTab("Requests")}
            style={[styles.tabButton, tab === "Requests" && styles.tabButtonActive]}
          >
            <Ionicons
              name="clipboard-outline"
              size={18}
              color={tab === "Requests" ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.tabButtonText, tab === "Requests" && styles.tabButtonTextActive]}>
              {t("Requests")} ({pendingRequestsCount})
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* TAB 1: STOCK LIST */}
      {tab === "Stock" ? (
        <>
          {isManager ? (
            <PrimaryButton label="Add supply" icon="add" onPress={() => openItemForm()} />
          ) : null}

          {/* Search Field */}
          <Field label="Search by name">
            <NativeInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("Search supplies")}
            />
          </Field>

          {/* Category Chips */}
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

            {visibleItems.map((item) => {
              const catTone = getCategoryTone(item.category);
              const maxGauge = Math.max(item.reorderThreshold * 2, item.quantityOnHand, 1);
              const stockRatio = Math.round((item.quantityOnHand / maxGauge) * 100);

              return (
                <View key={item.id} style={styles.supplyCard}>
                  {/* Card Header: Category & Stock Status */}
                  <View style={styles.supplyCardHeader}>
                    <View style={[styles.categoryBadge, { backgroundColor: catTone.bg }]}>
                      <Ionicons
                        name={getCategoryIcon(item.category) as any}
                        size={13}
                        color={catTone.text}
                      />
                      <Text style={[styles.categoryBadgeText, { color: catTone.text }]}>
                        {t(supplyCategoryLabel(item.category))}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        item.lowStock ? styles.statusBadgeLow : styles.statusBadgeGood,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: item.lowStock ? colors.monitor : colors.fit },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: item.lowStock ? colors.monitor : colors.fit },
                        ]}
                      >
                        {t(item.lowStock ? "Low stock" : "In stock")}
                      </Text>
                    </View>
                  </View>

                  {/* Title & Threshold */}
                  <Pressable
                    onPress={() => setDetailsItem(item)}
                    style={styles.supplyCardMain}
                  >
                    <Text style={styles.supplyName}>{item.name}</Text>
                    <View style={styles.thresholdRow}>
                      <Ionicons name="repeat-outline" size={13} color={colors.mutedForeground} />
                      <Text style={styles.supplyThreshold}>
                        {t("reorder threshold")}: {formatQuantity(item.reorderThreshold, item.unit)}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Stock Level Metric & Gauge */}
                  <Pressable
                    onPress={() => setDetailsItem(item)}
                    style={styles.stockLevelContainer}
                  >
                    <View style={styles.stockLevelRow}>
                      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                        <Text
                          style={[
                            styles.stockLevelQty,
                            item.lowStock && { color: colors.monitor },
                          ]}
                        >
                          {item.quantityOnHand}
                        </Text>
                        <Text style={styles.stockLevelUnit}>{item.unit}</Text>
                      </View>
                      <Text style={styles.stockLevelRatio}>
                        {item.quantityOnHand > 0 ? `${stockRatio}%` : "0%"}
                      </Text>
                    </View>
                    <ProgressBar
                      value={stockRatio}
                      tone={item.lowStock ? colors.monitor : colors.primary}
                    />
                  </Pressable>

                  {/* Action Area: 2-Tier Modern Layout */}
                  <View style={styles.cardActionsContainer}>
                    {/* TIER 1: Stock Movements */}
                    <View style={styles.cardMovementRow}>
                      {isManager ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t("Receive")}
                          onPress={() => openMovement(item, "receive")}
                          style={styles.receiveActionBtn}
                        >
                          <Ionicons name="download-outline" size={16} color={colors.primary} />
                          <Text style={styles.receiveActionBtnText} numberOfLines={1}>
                            {t("Receive")}
                          </Text>
                        </Pressable>
                      ) : null}

                      {canUse ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t("Use")}
                          onPress={() => openMovement(item, "use")}
                          style={[
                            styles.useActionBtn,
                            !isManager && {
                              flex: canRequest ? 1 : undefined,
                              width: canRequest ? undefined : "100%",
                            },
                          ]}
                        >
                          <Ionicons
                            name="remove-circle-outline"
                            size={16}
                            color={colors.foreground}
                          />
                          <Text style={styles.useActionBtnText} numberOfLines={1}>
                            {t("Use")}
                          </Text>
                        </Pressable>
                      ) : null}

                      {!isManager && canRequest ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t("Propose restock")}
                          onPress={() => openRequest(item)}
                          style={styles.requestActionBtn}
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={16}
                            color={colors.primary}
                          />
                          <Text style={styles.requestActionBtnText} numberOfLines={1}>
                            {t("Propose restock")}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {/* TIER 2: Management & Details */}
                    <View style={styles.cardManagementRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("Stock details")}
                        onPress={() => setDetailsItem(item)}
                        style={styles.detailsActionBtn}
                      >
                        <Ionicons
                          name="document-text-outline"
                          size={15}
                          color={colors.foreground}
                        />
                        <Text style={styles.detailsActionBtnText} numberOfLines={1}>
                          {t("Stock details")}
                        </Text>
                      </Pressable>

                      {isManager ? (
                        <>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("Edit")}
                            onPress={() => openItemForm(item)}
                            style={styles.editActionBtn}
                          >
                            <Ionicons
                              name="create-outline"
                              size={15}
                              color={colors.foreground}
                            />
                            <Text style={styles.editActionBtnText} numberOfLines={1}>
                              {t("Edit")}
                            </Text>
                          </Pressable>

                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("Delete")}
                            onPress={() => removeItem(item)}
                            style={styles.deleteActionBtn}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={15}
                              color={colors.destructive}
                            />
                            <Text style={styles.deleteActionBtnText} numberOfLines={1}>
                              {t("Delete")}
                            </Text>
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        /* TAB 2: REQUESTS LIST */
        <View style={ui.section}>
          <SectionTitle>{isManager ? "Restock requests" : "My requests"}</SectionTitle>

          {/* Request Status Filter Chips */}
          <Chips
            options={["All", "PENDING", "APPROVED", "FULFILLED", "REJECTED", "CANCELLED"]}
            value={requestFilter}
            onChange={setRequestFilter}
          />

          {resource.data && visibleRequests.length === 0 ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => void resource.refresh()}
              empty
              emptyLabel="There are no supply requests."
            />
          ) : null}

          {visibleRequests.map((request) => {
            const isPending = request.status === "PENDING";
            const isApproved = request.status === "APPROVED";
            const isFulfilled = request.status === "FULFILLED";
            const isCancelled = request.status === "CANCELLED";

            const statusBorderColor = isPending
              ? colors.monitor
              : isApproved
                ? colors.training
                : isFulfilled
                  ? colors.fit
                  : colors.destructive;

            return (
              <View
                key={request.id}
                style={[styles.requestCard, { borderLeftColor: statusBorderColor }]}
              >
                {/* Header: Item & Status Badge */}
                <View style={styles.requestCardHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.requestItemTitle}>{request.item.name}</Text>
                    {request.quantity ? (
                      <Text style={styles.requestQuantityBadge}>
                        {formatQuantity(request.quantity, request.item.unit)}
                      </Text>
                    ) : (
                      <Text
                        style={[
                          styles.requestQuantityBadge,
                          { color: colors.mutedForeground, fontStyle: "italic" },
                        ]}
                      >
                        {t("Propose restock")}
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      styles.requestStatusBadge,
                      {
                        backgroundColor: isPending
                          ? colors.monitorSoft
                          : isApproved
                            ? colors.trainingSoft
                            : isFulfilled
                              ? colors.fitSoft
                              : colors.injuredSoft,
                      },
                    ]}
                  >
                    <Text style={[styles.requestStatusText, { color: statusBorderColor }]}>
                      {t(supplyRequestStatusLabel(request.status))}
                    </Text>
                  </View>
                </View>

                {/* Metadata */}
                <View style={styles.requestMetaRow}>
                  <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
                  <Text style={styles.requestMetaText}>
                    {formatDateTime(request.createdAt)} · {request.requester.fullName}
                  </Text>
                </View>

                {/* Note */}
                {request.note ? (
                  <View style={styles.requestNoteBox}>
                    <Ionicons name="chatbubble-outline" size={13} color={colors.mutedForeground} />
                    <Text style={styles.requestNoteText}>{request.note}</Text>
                  </View>
                ) : null}

                {/* Rejection Reason */}
                {request.rejectionReason ? (
                  <View style={styles.rejectionReasonBox}>
                    <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                    <Text style={styles.rejectionReasonText}>{request.rejectionReason}</Text>
                  </View>
                ) : null}

                {/* Cancellation Reason */}
                {request.cancellationReason ? (
                  <View style={styles.rejectionReasonBox}>
                    <Ionicons name="close-circle-outline" size={14} color={colors.destructive} />
                    <Text style={styles.rejectionReasonText}>
                      {t("Lý do hủy:")} {request.cancellationReason}
                      {request.cancelledAt ? ` · ${formatDateTime(request.cancelledAt)}` : ""}
                    </Text>
                  </View>
                ) : null}

                {/* Reviewer / Fulfiller details */}
                {request.reviewedAt ? (
                  <Text style={styles.requestFootnote}>
                    {t("Reviewed")} {formatDateTime(request.reviewedAt)}
                    {request.reviewer ? ` · ${request.reviewer.fullName}` : ""}
                  </Text>
                ) : null}

                {request.fulfilledAt ? (
                  <Text style={styles.requestFootnote}>
                    {t("Issued")} {formatDateTime(request.fulfilledAt)}
                  </Text>
                ) : null}

                {/* Manager Actions */}
                {isManager && isPending ? (
                  <View style={styles.requestActionRow}>
                    <PrimaryButton
                      label="Approve"
                      icon="checkmark"
                      style={{ flex: 1 }}
                      onPress={() => void requestAction(request, "APPROVED")}
                    />
                    <DangerButton
                      label="Reject"
                      icon="close"
                      style={{ flex: 1 }}
                      onPress={() => {
                        setSelectedRequest(request);
                        setRequestReason("");
                        setMode("reject");
                      }}
                    />
                  </View>
                ) : null}

                {isManager && isApproved ? (
                  <View style={styles.requestActionRow}>
                    <PrimaryButton
                      label="Confirm issue"
                      icon="cube-outline"
                      style={{ flex: 1 }}
                      onPress={() => {
                        setSelectedRequest(request);
                        setQuantity(
                          request.quantity && Number(request.quantity) > 0
                            ? String(request.quantity)
                            : "1",
                        );
                        setUnitPrice("0");
                        setMode("fulfill");
                      }}
                    />
                    <DangerButton
                      label="Cancel request"
                      icon="close"
                      style={{ flex: 1 }}
                      onPress={() => {
                        setSelectedRequest(request);
                        setRequestReason("");
                        setMode("cancel-request");
                      }}
                    />
                  </View>
                ) : null}

                {/* Groom Action: Edit pending request */}
                {canRequest && isPending && request.requestedBy === request.requester.id ? (
                  <SecondaryButton
                    label="Edit pending request"
                    icon="create-outline"
                    onPress={() => openRequest(request.item, request)}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: CHI TIẾT TỒN KHO (STOCK DETAILS BOTTOM SHEET)          */}
      {/* ============================================================== */}
      {detailsItem ? (
        <SupplyDetailsModal
          role={role}
          token={token ?? ""}
          item={detailsItem}
          onClose={() => setDetailsItem(null)}
        />
      ) : null}

      {/* ============================================================== */}
      {/* MODAL 2: GHI NHẬN XUẤT DÙNG (RECORD SUPPLY USE MODAL)           */}
      {/* ============================================================== */}
      <Modal
        visible={mode === "use" && Boolean(selectedItem)}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Close")}
            onPress={closeForm}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sheetTitle}>{t("Record supply use")}</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>
                  {selectedItem?.name} ({t(supplyCategoryLabel(selectedItem?.category ?? "FEED"))})
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                onPress={closeForm}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: space.md }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Available Stock Banner */}
              <View style={styles.infoBanner}>
                <Ionicons name="cube" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoBannerLabel}>{t("Available in stock:")}</Text>
                  <Text style={styles.infoBannerValue}>
                    {formatQuantity(availableQty, selectedItem?.unit ?? "unit")}
                  </Text>
                </View>
              </View>

              {/* Quantity Input */}
              <Field label={`${t("Quantity to use")} (${selectedItem?.unit ?? "unit"})`}>
                <NativeInput
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                />
              </Field>

              {/* Quick Stepper Chips */}
              <View style={styles.quickChipsContainer}>
                <Text style={styles.quickChipsLabel}>{t("Quick add")}:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickChipsScroll}
                >
                  {USE_QUICK_AMOUNTS.map((amt) => (
                    <Pressable
                      key={amt}
                      accessibilityRole="button"
                      onPress={() => setQuantity(String(amt))}
                      style={styles.quickChip}
                    >
                      <Text style={styles.quickChipText}>+{amt}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setQuantity(String(availableQty))}
                    style={[styles.quickChip, styles.quickChipMax]}
                  >
                    <Text style={styles.quickChipTextMax}>{t("Use all")}</Text>
                  </Pressable>
                </ScrollView>
              </View>

              {/* Real-time Remaining Calculation & Alert Box */}
              {usedAmount > 0 ? (
                <View
                  style={[
                    styles.calcBox,
                    isUsageOver && styles.calcBoxDanger,
                    isUsageBelowThreshold && !isUsageOver && styles.calcBoxWarning,
                  ]}
                >
                  <View style={ui.row}>
                    <Text style={styles.calcLabel}>{t("Remaining after use:")}</Text>
                    <Text
                      style={[
                        styles.calcValue,
                        isUsageOver && { color: colors.destructive },
                        isUsageBelowThreshold && !isUsageOver && { color: colors.monitor },
                      ]}
                    >
                      {formatQuantity(Math.max(0, remainingStock), selectedItem?.unit ?? "")}
                    </Text>
                  </View>

                  {isUsageOver ? (
                    <View style={styles.calcWarningRow}>
                      <Ionicons name="alert-circle" size={15} color={colors.destructive} />
                      <Text style={styles.calcWarningDangerText}>
                        {t("Exceeds available stock")}
                      </Text>
                    </View>
                  ) : isUsageBelowThreshold ? (
                    <View style={styles.calcWarningRow}>
                      <Ionicons name="warning" size={15} color={colors.monitor} />
                      <Text style={styles.calcWarningText}>
                        {t("Stock below threshold warning")}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Usage Note & Suggestion Chips */}
              <Field label={`${t("Ghi chú xuất dùng (bắt buộc)")} *`}>
                <NativeInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  placeholder={t("Usage reason or horse name")}
                />
                {!note.trim() ? (
                  <Text style={styles.fieldError}>
                    {t("Vui lòng nhập ghi chú hoặc lý do xuất dùng.")}
                  </Text>
                ) : null}
              </Field>

              <View style={styles.quickChipsContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickChipsScroll}
                >
                  {USE_NOTE_SUGGESTIONS.map((sug) => (
                    <Pressable
                      key={sug}
                      accessibilityRole="button"
                      onPress={() => setNote((prev) => (prev ? `${prev}; ${t(sug)}` : t(sug)))}
                      style={styles.quickNoteChip}
                    >
                      <Text style={styles.quickNoteChipText}>+ {t(sug)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Modal Action Buttons */}
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <PrimaryButton
                  label={saving ? "Saving…" : "Confirm usage"}
                  icon="checkmark"
                  onPress={() => void save()}
                  disabled={saving || isUsageOver || usedAmount <= 0 || !note.trim()}
                />
                <SecondaryButton label="Cancel" icon="close" onPress={closeForm} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 3: ĐỀ XUẤT NHẬP THÊM (PROPOSE RESTOCK MODAL)             */}
      {/* ============================================================== */}
      <Modal
        visible={
          (mode === "request" || mode === "request-edit") &&
          Boolean(selectedItem || selectedRequest)
        }
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Close")}
            onPress={closeForm}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sheetTitle}>{t("Propose restock")}</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>
                  {selectedItem?.name ?? selectedRequest?.item.name}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                onPress={closeForm}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: space.md }}
              keyboardShouldPersistTaps="handled"
            >
              {selectedItem ? (
                <View style={styles.infoBanner}>
                  <Ionicons name="cube-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoBannerLabel}>{t("Available in stock:")}</Text>
                    <Text style={styles.infoBannerValue}>
                      {formatQuantity(selectedItem.quantityOnHand, selectedItem.unit)}
                      <Text style={[styles.infoBannerLabel, { fontWeight: "normal" }]}>
                        {"  ·  "}
                        {t("reorder threshold")}{" "}
                        {formatQuantity(selectedItem.reorderThreshold, selectedItem.unit)}
                      </Text>
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Note / Reason */}
              <Field label={t("Restock reason (optional)")}>
                <NativeInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  placeholder={t("Reason or note")}
                />
              </Field>

              <View style={styles.quickChipsContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickChipsScroll}
                >
                  {REQUEST_REASON_SUGGESTIONS.map((sug) => (
                    <Pressable
                      key={sug}
                      accessibilityRole="button"
                      onPress={() => setNote((prev) => (prev ? `${prev}; ${t(sug)}` : t(sug)))}
                      style={styles.quickNoteChip}
                    >
                      <Text style={styles.quickNoteChipText}>+ {t(sug)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Actions */}
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <PrimaryButton
                  label={saving ? "Saving…" : "Submit request"}
                  icon="paper-plane-outline"
                  onPress={() => void save()}
                  disabled={saving}
                />
                <SecondaryButton label="Cancel" icon="close" onPress={closeForm} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 4: MANAGER MODALS (CREATE, EDIT, RECEIVE, REJECT, FULFILL, CANCEL) */}
      {/* ============================================================== */}
      <Modal
        visible={
          mode === "item-create" ||
          mode === "item-edit" ||
          mode === "receive" ||
          mode === "reject" ||
          mode === "fulfill" ||
          mode === "cancel-request"
        }
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Close")}
            onPress={closeForm}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>
                  {t(
                    mode === "item-create"
                      ? "Add supply item"
                      : mode === "item-edit"
                        ? "Edit supply item"
                        : mode === "receive"
                          ? "Receive stock"
                          : mode === "reject"
                            ? "Reject request"
                            : mode === "cancel-request"
                              ? "Hủy đề xuất đã duyệt"
                              : "Confirm supply issued",
                  )}
                </Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>
                  {selectedItem?.name ?? selectedRequest?.item.name}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                onPress={closeForm}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: space.md }}
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
                    <NativeInput
                      value={unit}
                      onChangeText={setUnit}
                      placeholder="kg, bottle, roll"
                    />
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
                  ) : null}
                </>
              ) : null}

              {mode === "receive" ? (
                <>
                  <Field label={`Quantity received (${selectedItem?.unit ?? "unit"})`}>
                    <NativeInput
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="decimal-pad"
                    />
                  </Field>
                  <Field label="Actual unit price (VND)">
                    <NativeInput
                      value={unitPrice}
                      onChangeText={setUnitPrice}
                      keyboardType="numeric"
                    />
                  </Field>
                  <Field label="Note (optional)">
                    <NativeInput value={note} onChangeText={setNote} multiline />
                  </Field>
                </>
              ) : null}

              {mode === "reject" || mode === "cancel-request" ? (
                <Field
                  label={
                    mode === "reject"
                      ? t("Rejection reason (required)")
                      : `${t("Lý do hủy (bắt buộc)")} *`
                  }
                >
                  <NativeInput
                    value={requestReason}
                    onChangeText={setRequestReason}
                    multiline
                    placeholder={
                      mode === "reject"
                        ? t("Nhập lý do từ chối...")
                        : t("Nhập lý do hủy (vd: Nhà cung cấp hết hàng...)")
                    }
                  />
                </Field>
              ) : null}

              {mode === "fulfill" ? (
                <>
                  <Panel>
                    <Text style={ui.muted}>
                      {selectedRequest?.item.name}
                      {selectedRequest?.quantity
                        ? ` · requested ${selectedRequest.quantity} ${selectedRequest.item.unit}`
                        : ""}
                    </Text>
                  </Panel>
                  <Field
                    label={`${t("Quantity issued")} (${selectedRequest?.item.unit ?? "unit"})`}
                  >
                    <NativeInput
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="decimal-pad"
                      placeholder="0.0"
                    />
                  </Field>
                  <Field label="Actual unit price paid (VND)">
                    <NativeInput
                      value={unitPrice}
                      onChangeText={setUnitPrice}
                      keyboardType="numeric"
                    />
                  </Field>
                </>
              ) : null}

              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <PrimaryButton
                  label={saving ? "Saving…" : "Save"}
                  icon="checkmark"
                  onPress={() => void save()}
                  disabled={
                    saving ||
                    ((mode === "reject" || mode === "cancel-request") && !requestReason.trim())
                  }
                />
                <SecondaryButton label="Cancel" icon="close" onPress={closeForm} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

// ====================================================================
// SUB-COMPONENT: SUPPLY DETAILS BOTTOM SHEET MODAL
// ====================================================================
function SupplyDetailsModal({
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
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [detailsTab, setDetailsTab] = useState<"lots" | "ledger">("lots");
  const { user } = useAuth();
  const [cancellingUsageId, setCancellingUsageId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const load = useCallback(async () => {
    const [lots, movements] = await Promise.all([
      suppliesService.listLots(token, item.id),
      suppliesService.listMovements(token, item.id),
    ]);
    return { lots, movements };
  }, [item.id, token]);

  const resource = useApiResource(load, Boolean(token));
  const showPrice = role === "manager";

  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    panY.setValue(0);
  }, [panY]);

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 0,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            panY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 60 || gesture.vy > 0.5) {
            Animated.timing(panY, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              panY.setValue(0);
              onClose();
            });
          } else {
            Animated.spring(panY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [onClose, panY],
  );

  const headerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            panY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 60 || gesture.vy > 0.5) {
            Animated.timing(panY, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              panY.setValue(0);
              onClose();
            });
          } else {
            Animated.spring(panY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [onClose, panY],
  );

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Close")}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: panY }] }]}>
          <View
            style={{ width: "100%", alignItems: "center", paddingTop: 4, paddingBottom: 8 }}
            {...handlePanResponder.panHandlers}
          >
            <View style={styles.sheetHandle} />
          </View>

          {/* Sheet Header */}
          <View style={styles.sheetHeader} {...headerPanResponder.panHandlers}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sheetTitle}>{item.name}</Text>
              <Text style={styles.sheetSubtitle}>
                {t(supplyCategoryLabel(item.category))} · {item.quantityOnHand} {item.unit}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Close")}
              onPress={onClose}
              style={styles.sheetCloseBtn}
            >
              <Ionicons name="close" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          {/* Quick Metrics Bar */}
          <View style={styles.detailsStatsRow}>
            <View style={styles.detailsStatBox}>
              <Text style={styles.detailsStatLabel} numberOfLines={1}>
                {t("In stock")}
              </Text>
              <Text style={styles.detailsStatValue} numberOfLines={1}>
                {formatQuantity(item.quantityOnHand, item.unit)}
              </Text>
            </View>

            <View style={styles.detailsStatBox}>
              <Text style={styles.detailsStatLabel} numberOfLines={1}>
                {t("reorder threshold")}
              </Text>
              <Text style={styles.detailsStatValue} numberOfLines={1}>
                {formatQuantity(item.reorderThreshold, item.unit)}
              </Text>
            </View>

            <View style={styles.detailsStatBox}>
              <Text style={styles.detailsStatLabel} numberOfLines={1}>
                {t("Status")}
              </Text>
              <Text
                style={[
                  styles.detailsStatValue,
                  { color: item.lowStock ? colors.monitor : colors.fit },
                ]}
                numberOfLines={1}
              >
                {t(item.lowStock ? "Low stock" : "In stock")}
              </Text>
            </View>
          </View>

          {/* Sub-tab Switcher: Lots vs Movements */}
          <View style={styles.detailsTabBar}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDetailsTab("lots")}
              style={[styles.detailsTabBtn, detailsTab === "lots" && styles.detailsTabBtnActive]}
            >
              <Ionicons
                name="layers-outline"
                size={16}
                color={detailsTab === "lots" ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.detailsTabBtnText,
                  detailsTab === "lots" && styles.detailsTabBtnTextActive,
                ]}
              >
                {t("Lots (FIFO)")}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setDetailsTab("ledger")}
              style={[styles.detailsTabBtn, detailsTab === "ledger" && styles.detailsTabBtnActive]}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={16}
                color={detailsTab === "ledger" ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.detailsTabBtnText,
                  detailsTab === "ledger" && styles.detailsTabBtnTextActive,
                ]}
              >
                {t("Stock history")}
              </Text>
            </Pressable>
          </View>

          {/* Content Scroll View */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: space.xl, gap: space.sm }}
          >
            <AsyncStateView
              isLoading={resource.isLoading}
              error={resource.error}
              onRetry={() => void resource.retry()}
            />

            {/* LOTS TAB */}
            {detailsTab === "lots" ? (
              <View style={{ gap: space.sm }}>
                {(resource.data?.lots ?? []).map((lot) => {
                  const lotRatio = Math.round((lot.remaining / lot.quantity) * 100);

                  return (
                    <View key={lot.id} style={styles.lotItemCard}>
                      <View style={ui.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.lotDateText}>{formatDateTime(lot.createdAt)}</Text>
                          <Text style={styles.lotQtyText}>
                            {lot.remaining} / {lot.quantity} {item.unit}
                          </Text>
                        </View>
                        {showPrice ? (
                          <Text style={styles.lotPriceText}>
                            {lot.unitPrice.toLocaleString("vi-VN")} VND/{item.unit}
                          </Text>
                        ) : null}
                      </View>
                      <ProgressBar value={lotRatio} tone={colors.primary} />
                    </View>
                  );
                })}

                {resource.data && resource.data.lots.length === 0 ? (
                  <View style={styles.emptyDetailsBox}>
                    <Ionicons name="layers-outline" size={32} color={colors.mutedForeground} />
                    <Text style={styles.emptyDetailsText}>{t("No lots recorded.")}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* LEDGER TAB */}
            {detailsTab === "ledger" ? (
              <View style={{ gap: space.sm }}>
                {(resource.data?.movements ?? []).map((movement) => {
                  const isPositive = movement.delta > 0;
                  const isUsage = movement.type === "USAGE";
                  const isReversal = movement.type === "USAGE_REVERSAL";
                  const isCancelled = Boolean(movement.cancelled);
                  const isCreatorWithin24h =
                    movement.creator?.id === user?.userId &&
                    Date.now() - new Date(movement.createdAt).getTime() <= 24 * 60 * 60 * 1000;
                  const canCancelUsage =
                    isUsage &&
                    !isCancelled &&
                    Boolean(movement.usageId) &&
                    (role === "manager" || isCreatorWithin24h);

                  return (
                    <View key={movement.id} style={styles.movementItemCard}>
                      <View style={ui.row}>
                        <View style={styles.movementTypeBadge}>
                          <Ionicons
                            name={
                              isReversal
                                ? "arrow-undo-circle"
                                : isPositive
                                  ? "arrow-down-circle"
                                  : "arrow-up-circle"
                            }
                            size={16}
                            color={isReversal ? colors.primary : isPositive ? colors.fit : colors.monitor}
                          />
                          <Text style={styles.movementTypeText}>
                            {isReversal ? t("Hoàn tồn") : movement.type.replaceAll("_", " ")}
                          </Text>
                        </View>

                        <View style={{ alignItems: "flex-end" }}>
                          <Text
                            style={[
                              styles.movementDeltaText,
                              { color: isPositive ? colors.fit : colors.destructive },
                            ]}
                          >
                            {isPositive ? "+" : ""}
                            {movement.delta} {item.unit}
                          </Text>
                          <Text style={styles.movementBalanceText}>
                            {t("Balance after")}: {movement.balanceAfter} {item.unit}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.movementMetaRow}>
                        <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
                        <Text style={styles.movementMetaText}>
                          {formatDateTime(movement.createdAt)} · {movement.creator.fullName}
                        </Text>
                      </View>

                      {movement.note ? (
                        <View style={styles.movementNoteBox}>
                          <Text style={styles.movementNoteText}>{movement.note}</Text>
                        </View>
                      ) : null}

                      {showPrice && movement.amount !== null ? (
                        <Text style={styles.movementPriceText}>
                          {movement.amount.toLocaleString("vi-VN")} VND ·{" "}
                          {movement.unitPrice?.toLocaleString("vi-VN")} VND/unit
                        </Text>
                      ) : null}

                      {isCancelled ? (
                        <View
                          style={{
                            backgroundColor: colors.injuredSoft,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: radius.pill,
                            alignSelf: "flex-start",
                            marginTop: space.xs,
                          }}
                        >
                          <Text style={{ color: colors.destructive, fontSize: 11, fontWeight: "700" }}>
                            {t("Lần xuất đã bị hủy")}
                          </Text>
                        </View>
                      ) : null}

                      {canCancelUsage ? (
                        <View style={{ marginTop: space.xs, alignSelf: "flex-end" }}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("Hủy lần xuất này")}
                            style={({ pressed }) => [
                              styles.cancelIssueBtn,
                              pressed && styles.cancelIssueBtnPressed,
                            ]}
                            onPress={() => {
                              setCancellingUsageId(movement.usageId);
                              setCancelReason("");
                            }}
                          >
                            <Ionicons name="arrow-undo-outline" size={14} color={colors.destructive} />
                            <Text style={styles.cancelIssueBtnText}>
                              {t("Hủy lần xuất này")}
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                {resource.data && resource.data.movements.length === 0 ? (
                  <View style={styles.emptyDetailsBox}>
                    <Ionicons
                      name="swap-vertical-outline"
                      size={32}
                      color={colors.mutedForeground}
                    />
                    <Text style={styles.emptyDetailsText}>{t("No stock movements recorded.")}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          {/* Modal for canceling usage */}
          {cancellingUsageId ? (
            <Modal
              visible
              transparent
              animationType="fade"
              onRequestClose={() => setCancellingUsageId(null)}
            >
              <View style={styles.modalRoot}>
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => setCancellingUsageId(null)}
                />
                <View style={[styles.sheet, { maxHeight: 320 }]}>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>{t("Hủy lần xuất dùng ghi nhầm")}</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setCancellingUsageId(null)}
                      style={styles.sheetCloseBtn}
                    >
                      <Ionicons name="close" size={20} color={colors.foreground} />
                    </Pressable>
                  </View>
                  <Field label={`${t("Lý do hủy lần xuất (bắt buộc)")} *`}>
                    <NativeInput
                      value={cancelReason}
                      onChangeText={setCancelReason}
                      multiline
                      placeholder={t("Nhập lý do hủy...")}
                    />
                  </Field>
                  <View style={{ gap: space.sm, marginTop: space.sm }}>
                    <PrimaryButton
                      label={submittingCancel ? t("Đang hủy…") : t("Xác nhận hủy lần xuất")}
                      icon="checkmark"
                      disabled={submittingCancel || !cancelReason.trim()}
                      onPress={async () => {
                        if (!cancellingUsageId || !cancelReason.trim()) return;
                        setSubmittingCancel(true);
                        try {
                          await suppliesService.cancelUsage(
                            token,
                            cancellingUsageId,
                            cancelReason.trim(),
                          );
                          setCancellingUsageId(null);
                          setCancelReason("");
                          await resource.refresh();
                          Alert.alert(t("Thành công"), t("Đã hủy lần xuất và hoàn trả tồn kho."));
                        } catch (error) {
                          showApiError(error, t("Không thể hủy lần xuất"));
                        } finally {
                          setSubmittingCancel(false);
                        }
                      }}
                    />
                    <SecondaryButton
                      label={t("Cancel")}
                      icon="close"
                      onPress={() => setCancellingUsageId(null)}
                    />
                  </View>
                </View>
              </View>
            </Modal>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ====================================================================
// STYLES
// ====================================================================
const getStyles = (colors: any) =>
  StyleSheet.create({
    // Tab bar
    tabBar: {
      flexDirection: "row",
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
      gap: 4,
    },
    tabButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.sm,
    },
    tabButtonActive: {
      backgroundColor: colors.fitSoft,
    },
    tabButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    tabButtonTextActive: {
      color: colors.primary,
      fontWeight: "700",
    },

    // Supply Card
    supplyCard: {
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: 10,
      marginBottom: space.sm,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    supplyCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    categoryBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    statusBadgeGood: {
      backgroundColor: colors.fitSoft,
    },
    statusBadgeLow: {
      backgroundColor: colors.monitorSoft,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    supplyCardMain: {
      gap: 3,
    },
    supplyName: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.foreground,
      letterSpacing: -0.2,
    },
    thresholdRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    supplyThreshold: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontWeight: "500",
    },
    stockLevelContainer: {
      backgroundColor: colors.elevated,
      borderRadius: radius.sm,
      padding: space.sm,
      gap: 6,
    },
    stockLevelRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    stockLevelQty: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.foreground,
    },
    stockLevelUnit: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.mutedForeground,
      marginLeft: 4,
    },
    stockLevelRatio: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.mutedForeground,
    },

    // Action buttons inside card - Modern 2-Tier Layout
    cardActionsContainer: {
      gap: 8,
      paddingTop: space.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    cardMovementRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    receiveActionBtn: {
      flex: 1,
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    receiveActionBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    useActionBtn: {
      flex: 1,
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    useActionBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    requestActionBtn: {
      flex: 1,
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    requestActionBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    cardManagementRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    detailsActionBtn: {
      flex: 1.3,
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    detailsActionBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
    editActionBtn: {
      flex: 0.95,
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editActionBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
    deleteActionBtn: {
      flex: 0.75,
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.injuredSoft,
      borderWidth: 1,
      borderColor: colors.destructive,
    },
    deleteActionBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.destructive,
    },

    // Request Card
    requestCard: {
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      padding: space.md,
      gap: space.sm,
      marginBottom: space.sm,
    },
    requestCardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: space.sm,
    },
    requestItemTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    requestQuantityBadge: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
      marginTop: 2,
    },
    requestStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    requestStatusText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    requestMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    requestMetaText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    requestNoteBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      padding: space.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
    },
    requestNoteText: {
      flex: 1,
      fontSize: 13,
      color: colors.foreground,
      lineHeight: 18,
    },
    rejectionReasonBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      padding: space.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.injuredSoft,
    },
    rejectionReasonText: {
      flex: 1,
      fontSize: 13,
      color: colors.destructive,
      lineHeight: 18,
    },
    requestFootnote: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    requestActionRow: {
      flexDirection: "row",
      gap: space.sm,
      marginTop: space.xs,
    },

    // Modal Bottom Sheet
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0, 0, 0, 0.48)",
    },
    sheet: {
      maxHeight: "88%",
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
      paddingBottom: space.xl,
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      marginTop: 2,
      marginBottom: space.md,
      borderRadius: radius.pill,
      backgroundColor: colors.borderStrong,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: space.md,
    },
    sheetTitle: {
      fontSize: 19,
      fontWeight: "700",
      color: colors.foreground,
    },
    sheetSubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    sheetCloseBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: colors.elevated,
    },

    // Info Banner
    infoBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoBannerLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    infoBannerValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
      marginTop: 2,
    },

    // Quick Chips
    quickChipsContainer: {
      gap: 6,
    },
    quickChipsLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    quickChipsScroll: {
      flexDirection: "row",
      gap: 6,
      paddingVertical: 2,
    },
    quickChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickChipMax: {
      backgroundColor: colors.fitSoft,
      borderColor: colors.primary,
    },
    quickChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.foreground,
    },
    quickChipTextMax: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    quickNoteChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickNoteChipText: {
      fontSize: 12,
      color: colors.foreground,
    },

    // Live Calculation Box
    calcBox: {
      padding: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    calcBoxWarning: {
      backgroundColor: colors.monitorSoft,
      borderColor: colors.monitor,
    },
    calcBoxDanger: {
      backgroundColor: colors.injuredSoft,
      borderColor: colors.destructive,
    },
    calcLabel: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    calcValue: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.foreground,
    },
    calcWarningRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 2,
    },
    calcWarningText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.monitor,
    },
    calcWarningDangerText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.destructive,
    },

    // Details Modal Stats
    detailsStatsRow: {
      flexDirection: "row",
      gap: space.sm,
      marginBottom: space.sm,
    },
    detailsStatBox: {
      flex: 1,
      minHeight: 56,
      justifyContent: "center",
      padding: space.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    detailsStatLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
      textTransform: "capitalize",
    },
    detailsStatValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
      marginTop: 2,
    },

    // Details Sub-tabs
    detailsTabBar: {
      flexDirection: "row",
      borderRadius: radius.sm,
      backgroundColor: colors.elevated,
      padding: 3,
      gap: 3,
      marginBottom: space.sm,
    },
    detailsTabBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 7,
      borderRadius: radius.sm,
    },
    detailsTabBtnActive: {
      backgroundColor: colors.surface,
      elevation: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    detailsTabBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    detailsTabBtnTextActive: {
      color: colors.primary,
      fontWeight: "700",
    },

    // Lots & Movements cards inside details
    lotItemCard: {
      padding: space.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    lotDateText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    lotQtyText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    lotPriceText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    emptyDetailsBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: space.xl,
      gap: space.xs,
    },
    emptyDetailsText: {
      fontSize: 13,
      color: colors.mutedForeground,
    },

    movementItemCard: {
      padding: space.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    movementTypeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    movementTypeText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    movementDeltaText: {
      fontSize: 14,
      fontWeight: "800",
    },
    movementBalanceText: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    movementMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    movementMetaText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    movementNoteBox: {
      padding: 6,
      borderRadius: 4,
      backgroundColor: colors.muted,
      marginTop: 2,
    },
    movementNoteText: {
      fontSize: 12,
      color: colors.foreground,
      lineHeight: 16,
    },
    movementPriceText: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    fieldError: {
      fontSize: 12,
      color: colors.destructive,
      marginTop: 4,
    },
    cancelIssueBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.injuredSoft,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.25)",
    },
    cancelIssueBtnPressed: {
      opacity: 0.75,
      transform: [{ scale: 0.98 }],
    },
    cancelIssueBtnText: {
      color: colors.destructive,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: -0.1,
    },
  });
