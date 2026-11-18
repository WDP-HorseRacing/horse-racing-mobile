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
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Chips,
  Field,
  Metric,
  NativeInput,
  Panel,
  ProgressBar,
  getUiStyles,
} from "@/components/ui";
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
import { SupplyDetailsModal } from "../components/modals/SupplyDetailsModal";
import { RecordSupplyUseModal } from "../components/modals/RecordSupplyUseModal";
import { ProposeRestockModal } from "../components/modals/ProposeRestockModal";
import { SupplyManagerActionModal } from "../components/modals/SupplyManagerActionModal";
import { ManagerSuppliesView } from "../components/supplies/ManagerSuppliesView";
import { StaffSuppliesView } from "../components/supplies/StaffSuppliesView";
import { getSuppliesStyles } from "./supplies.styles";

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
// Keep stock-in and restock-request UI hidden until stock lots support expiry dates.
const STOCK_IN_UI_ENABLED = false;
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
  const styles = useMemo(() => getSuppliesStyles(colors), [colors]);

  const isManager = role === "manager";
  const canUse = EMPLOYEE_ROLES.includes(role as (typeof EMPLOYEE_ROLES)[number]);
  const canCreateSupply = isManager && STOCK_IN_UI_ENABLED;
  const canRequest =
    STOCK_IN_UI_ENABLED && (role === "trainer" || role === "groom" || role === "vet");
  const canViewRequests = STOCK_IN_UI_ENABLED && (isManager || canRequest);

  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Stock");
  const [requestFilter, setRequestFilter] = useState("All");

  const [mode, setMode] = useState<ScreenMode>(null);
  const [selectedItem, setSelectedItem] = useState<SupplyItemDto | null>(null);
  const [detailsItem, setDetailsItem] = useState<SupplyItemDto | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<SupplyRequestDto | null>(null);

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
    setMode(item ? "item-edit" : "item-create");
  };

  const openMovement = (item: SupplyItemDto, kind: "use" = "use") => {
    setSelectedItem(item);
    setMode(kind);
  };

  const openRequest = (item?: SupplyItemDto, request?: SupplyRequestDto) => {
    setSelectedItem(item ?? null);
    setSelectedRequest(request ?? null);
    setMode(request ? "request-edit" : "request");
  };

  const closeForm = () => {
    setMode(null);
    setSelectedItem(null);
    setSelectedRequest(null);
  };

  const refresh = async () => {
    await resource.refresh();
    closeForm();
  };

  const requestAction = async (request: SupplyRequestDto, status: SupplyRequestStatus) => {
    if (!token) return;
    if (status === "REJECTED" || status === "FULFILLED") {
      setSelectedRequest(request);
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



  return (
    <Screen
      role={role}
      title="Supplies"
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
      {tab === "Stock" || !canViewRequests ? (
        <>
          {canCreateSupply ? (
            <ManagerSuppliesView mode="add" onAdd={() => openItemForm()} />
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
                    {isManager ? (
                      <ManagerSuppliesView
                        mode="stock-actions"
                        item={item}
                        canUse={canUse}
                        styles={styles}
                        t={t}
                        colors={colors}
                        onUse={(supply) => openMovement(supply, "use")}
                      />
                    ) : (
                      <StaffSuppliesView
                        mode="stock-actions"
                        item={item}
                        canUse={canUse}
                        canRequest={canRequest}
                        styles={styles}
                        colors={colors}
                        t={t}
                        onUse={(supply) => openMovement(supply, "use")}
                        onPropose={(supply) => openRequest(supply)}
                      />
                    )}

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
                        <ManagerSuppliesView
                          mode="item-actions"
                          item={item}
                          styles={styles}
                          t={t}
                          colors={colors}
                          onEdit={openItemForm}
                          onDelete={removeItem}
                        />
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
                {isManager ? (
                  <ManagerSuppliesView
                    mode="request-actions"
                    request={request}
                    styles={styles}
                    onApprove={() => void requestAction(request, "APPROVED")}
                    onReject={() => {
                      setSelectedRequest(request);
                      setMode("reject");
                    }}
                    onFulfill={() => {
                      setSelectedRequest(request);
                      setMode("fulfill");
                    }}
                    onCancel={() => {
                      setSelectedRequest(request);
                      setMode("cancel-request");
                    }}
                  />
                ) : null}

                {/* Groom Action: Edit pending request */}
                {!isManager ? (
                  <StaffSuppliesView
                    mode="request-actions"
                    request={request}
                    canRequest={canRequest}
                    onEditRequest={(itemRequest) => openRequest(itemRequest.item, itemRequest)}
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

      <RecordSupplyUseModal
        visible={mode === "use"}
        item={selectedItem}
        token={token ?? ""}
        styles={styles}
        onClose={closeForm}
        onSuccess={() => void resource.refresh()}
      />

      <ProposeRestockModal
        visible={mode === "request" || mode === "request-edit"}
        mode={mode === "request" || mode === "request-edit" ? mode : null}
        item={selectedItem}
        request={selectedRequest}
        token={token ?? ""}
        styles={styles}
        onClose={closeForm}
        onSuccess={() => void resource.refresh()}
      />

      <SupplyManagerActionModal
        visible={
          mode === "item-create" ||
          mode === "item-edit" ||
          mode === "reject" ||
          mode === "fulfill" ||
          mode === "cancel-request"
        }
        mode={
          mode === "item-create" ||
          mode === "item-edit" ||
          mode === "reject" ||
          mode === "fulfill" ||
          mode === "cancel-request"
            ? mode
            : null
        }
        item={selectedItem}
        request={selectedRequest}
        token={token ?? ""}
        styles={styles}
        onClose={closeForm}
        onSuccess={() => void resource.refresh()}
      />
    </Screen>
  );
}

// ====================================================================
// STYLES
// ====================================================================
