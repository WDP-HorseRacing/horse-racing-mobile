import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen } from "@/components/common";
import { Chips, Field, NativeInput, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { isRole } from "@/features/auth/roles";
import { horseService } from "@/services/horse.service";
import { medicalService } from "@/services/medical.service";
import { stableCareService } from "@/services/stable-care.service";
import type { ExamRequestDto } from "@/adapters/medical.adapter";
import type { HorseListItemDto } from "@/adapters/horse.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/formatters";
import { isValidRequiredText } from "@/features/medical/medical-validation";
import { radius, space } from "@/config/theme";
import { formatIncidentSource, isQaTestContent } from "@/utils/textCleaner";

type RequestStatus = "PENDING" | "EXAMINED" | "DISMISSED";

const statusTabs: { key: RequestStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "PENDING", label: "Đang chờ khám", icon: "time-outline" },
  { key: "EXAMINED", label: "Đã khám", icon: "checkmark-circle-outline" },
  { key: "DISMISSED", label: "Đã bỏ qua", icon: "close-circle-outline" },
];

export default function ExaminationRequests() {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [status, setStatus] = useState<RequestStatus>("PENDING");
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ExamRequestDto | null>(null);
  const [modalAction, setModalAction] = useState<"urgency" | "dismiss" | null>(null);
  const [actionTarget, setActionTarget] = useState<ExamRequestDto | null>(null);

  // Attached incident photo viewer states
  const [incidentPhotos, setIncidentPhotos] = useState<Record<string, string | null>>({});
  const [, setLoadingIncidentId] = useState<string | null>(null);
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);

  // Cache per status to make tab switching instantaneous and smooth
  const [cache, setCache] = useState<
    Partial<Record<string, { items: ExamRequestDto[]; totalPages: number; total: number }>>
  >({});
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [selectedHorse, setSelectedHorse] = useState<HorseListItemDto | null>(null);
  const [horsePickerVisible, setHorsePickerVisible] = useState(false);
  const [horseSearch, setHorseSearch] = useState("");

  // Action states
  const [urgencyReason, setUrgencyReason] = useState("");
  const [dismissReason, setDismissReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Horses list for creating requests
  const [allHorses, setAllHorses] = useState<HorseListItemDto[]>([]);
  const [loadingHorses, setLoadingHorses] = useState(false);

  const canCreate = role === "vet" || role === "manager" || role === "trainer";
  const isVet = role === "vet";

  const fetchTabRequests = useCallback(
    async (
      targetStatus: RequestStatus,
      targetPage: number,
      targetUrgent = filterUrgent,
      isSilent = false,
    ) => {
      if (!token) return;
      if (!isSilent) setLoadingStatus(true);
      setError(null);
      try {
        const response = await medicalService.listExamRequests(token, {
          page: targetPage,
          limit: 20,
          status: targetStatus,
          ...(targetUrgent ? { urgent: true } : {}),
        });
        const cacheKey = `${targetStatus}_${targetUrgent ? "urgent" : "all"}`;
        setCache((prev) => ({
          ...prev,
          [cacheKey]: {
            items: response.items,
            totalPages: response.meta.totalPages ?? 1,
            total: response.meta.total ?? response.items.length,
          },
        }));
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setLoadingStatus(false);
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [token, filterUrgent],
  );

  const viewIncidentPhoto = async (incidentId: string) => {
    if (!token) return;
    if (incidentPhotos[incidentId] !== undefined) {
      if (incidentPhotos[incidentId]) {
        setEnlargedPhotoUrl(incidentPhotos[incidentId]);
      } else {
        Alert.alert(t("Không có ảnh"), t("Sự cố này không có ảnh đính kèm."));
      }
      return;
    }
    setLoadingIncidentId(incidentId);
    try {
      const incident = await stableCareService.getIncident(token, incidentId);
      setIncidentPhotos((prev) => ({ ...prev, [incidentId]: incident.photoUrl }));
      if (incident.photoUrl) {
        setEnlargedPhotoUrl(incident.photoUrl);
      } else {
        Alert.alert(t("Không có ảnh"), t("Sự cố này không có ảnh đính kèm."));
      }
    } catch (err) {
      Alert.alert(t("Lỗi tải ảnh sự cố"), extractErrorMessage(err));
    } finally {
      setLoadingIncidentId(null);
    }
  };

  // Initial load
  useEffect(() => {
    let cancelled = false;
    if (token) {
      void Promise.resolve().then(() => {
        if (!cancelled) void fetchTabRequests("PENDING", 1, false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [fetchTabRequests, token]);

  // Tab switch handler: instantaneous display if cached, background refresh
  const handleTabChange = (nextStatus: RequestStatus) => {
    setStatus(nextStatus);
    setPage(1);
    setSelected(null);
    const cacheKey = `${nextStatus}_${filterUrgent ? "urgent" : "all"}`;
    const hasCached = Boolean(cache[cacheKey]);
    void fetchTabRequests(nextStatus, 1, filterUrgent, hasCached);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTabRequests(status, page, filterUrgent, true);
  };

  useRefreshOnFocus(async () => {
    await fetchTabRequests(status, page, filterUrgent, true);
  });

  // Load horses when create modal opens
  const openCreateModal = async () => {
    setShowCreateModal(true);
    if (!allHorses.length && token) {
      setLoadingHorses(true);
      try {
        const list = await horseService.list(token, "", {
          lifecycleStatus: "ACTIVE",
          includeDeleted: false,
          myBarns: role === "trainer",
        });
        setAllHorses(list);
      } catch (err) {
        Alert.alert("Không thể tải danh sách ngựa", extractErrorMessage(err));
      } finally {
        setLoadingHorses(false);
      }
    }
  };

  const runMutation = async (action: () => Promise<unknown>, successMsg: string) => {
    setSaving(true);
    try {
      await action();
      setSelected(null);
      setUrgencyReason("");
      setDismissReason("");
      await fetchTabRequests(status, page, true);
      // Invalidate pending tab if not currently on it
      if (status !== "PENDING") {
        void fetchTabRequests("PENDING", 1, true);
      }
      Alert.alert("Thành công", successMsg);
    } catch (err) {
      Alert.alert("Lỗi thao tác", extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const createRequest = async () => {
    if (!token || !selectedHorse || !isValidRequiredText(description, 2000)) {
      Alert.alert(
        "Thiếu thông tin yêu cầu",
        "Vui lòng chọn ngựa và nhập mô tả triệu chứng (tối đa 2,000 ký tự).",
      );
      return;
    }
    setSaving(true);
    try {
      await medicalService.createExamRequest(token, selectedHorse.id, {
        description: description.trim(),
        urgent,
      });
      setDescription("");
      setUrgent(false);
      setSelectedHorse(null);
      setShowCreateModal(false);
      if (status === "PENDING" && page === 1) {
        await fetchTabRequests("PENDING", 1, true);
      } else {
        handleTabChange("PENDING");
      }
      Alert.alert("Đã gửi yêu cầu", "Yêu cầu khám đã được thêm vào hàng đợi.");
    } catch (err) {
      Alert.alert("Không thể tạo yêu cầu", extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submitDismiss = async () => {
    if (!token || !actionTarget || !isValidRequiredText(dismissReason, 500)) {
      Alert.alert("Vui lòng nhập lý do", "Lý do bỏ qua không được để trống (tối đa 500 ký tự).");
      return;
    }
    await runMutation(async () => {
      await medicalService.dismissExamRequest(token, actionTarget.id, dismissReason.trim());
      setModalAction(null);
      setActionTarget(null);
    }, "Đã bỏ qua yêu cầu khám.");
  };

  const submitChangeUrgency = async () => {
    if (!token || !actionTarget || !isValidRequiredText(urgencyReason, 500)) {
      Alert.alert(
        "Vui lòng nhập lý do",
        "Lý do thay đổi mức độ không được để trống (tối đa 500 ký tự).",
      );
      return;
    }
    const newUrgent = !actionTarget.urgent;
    await runMutation(async () => {
      await medicalService.changeExamRequestUrgency(token, actionTarget.id, {
        urgent: newUrgent,
        reason: urgencyReason.trim(),
      });
      setModalAction(null);
      setActionTarget(null);
    }, newUrgent ? "Đã nâng cấp yêu cầu thành CẤP CỨU." : "Đã hạ cấp yêu cầu về mức THƯỜNG.");
  };

  const currentKey = `${status}_${filterUrgent ? "urgent" : "all"}`;
  const currentData = cache[currentKey] ?? cache[status];
  const items = useMemo(() => {
    const raw = currentData?.items ?? [];
    return raw.filter((item) => !isQaTestContent(item.description));
  }, [currentData]);
  const totalPages = currentData?.totalPages ?? 1;
  const hasMore = totalPages > page;
  const hasPrevious = page > 1;

  const filteredHorses = useMemo(() => {
    const q = horseSearch.trim().toLowerCase();
    if (!q) return allHorses.slice(0, 30);
    return allHorses
      .filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.microchipId && h.microchipId.toLowerCase().includes(q)) ||
          (h.location?.barn?.name && h.location.barn.name.toLowerCase().includes(q)),
      )
      .slice(0, 30);
  }, [allHorses, horseSearch]);

  if (!role) return <Redirect href="/" />;
  if (!["vet", "manager", "trainer", "groom"].includes(role)) {
    return <Redirect href={`/${role}` as Href} />;
  }

  return (
    <Screen
      role={role}
      title="Yêu cầu khám bệnh"
      subtitle={
        role === "groom"
          ? "Danh sách yêu cầu khám của ngựa bạn phụ trách"
          : "Hàng đợi yêu cầu khám và phân loại mức độ khẩn"
      }
      refreshing={refreshing}
      onRefresh={handleRefresh}
    >
      {/* Header action bar */}
      {canCreate ? (
        <View style={styles.createBar}>
          <PrimaryButton
            label="Tạo yêu cầu khám mới"
            icon="add-circle-outline"
            onPress={() => void openCreateModal()}
          />
        </View>
      ) : null}

      {/* Modern custom segmented tab selector */}
      <View style={styles.tabContainer}>
        {statusTabs.map((tab) => {
          const isActive = status === tab.key;
          const count =
            cache[`${tab.key}_${filterUrgent ? "urgent" : "all"}`]?.total ?? cache[tab.key]?.total;
          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabChange(tab.key)}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
            >
              <View style={styles.tabContentGroup}>
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={isActive ? "#ffffff" : colors.mutedForeground}
                />
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
                {typeof count === "number" && count > 0 ? (
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Urgency sub-filter */}
      <View style={{ marginBottom: space.sm }}>
        <Chips
          options={["Tất cả mức độ", "Chỉ yêu cầu khẩn"]}
          value={filterUrgent ? "Chỉ yêu cầu khẩn" : "Tất cả mức độ"}
          onChange={(val) => {
            const next = val === "Chỉ yêu cầu khẩn";
            setFilterUrgent(next);
            setPage(1);
            setSelected(null);
            void fetchTabRequests(status, 1, next);
          }}
        />
      </View>

      {/* Initial load or error state */}
      {initialLoading && !currentData ? (
        <AsyncStateView
          isLoading={true}
          error={null}
          onRetry={() => void fetchTabRequests(status, page)}
        />
      ) : error && !items.length ? (
        <AsyncStateView
          isLoading={false}
          error={error}
          onRetry={() => void fetchTabRequests(status, page)}
        />
      ) : null}

      {/* Subtle indicator when revalidating in background without flickering */}
      {loadingStatus && currentData ? (
        <View style={styles.revalidatingBar}>
          <Text style={styles.revalidatingText}>Đang cập nhật danh sách…</Text>
        </View>
      ) : null}

      {/* Empty State */}
      {!initialLoading && !loadingStatus && items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="clipboard-outline" size={44} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>Không có yêu cầu nào</Text>
          <Text style={styles.emptySubtitle}>
            {status === "PENDING"
              ? "Hiện tại không có yêu cầu chờ khám nào trong hàng đợi."
              : status === "EXAMINED"
                ? "Chưa có yêu cầu nào đã hoàn thành khám."
                : "Không có yêu cầu nào bị bỏ qua."}
          </Text>
        </View>
      ) : null}

      {/* Request Cards List */}
      <View style={styles.cardsList}>
        {items.map((request) => {
          const isSelected = selected?.id === request.id;
          const isPending = request.status === "PENDING";
          const isUrgent = request.urgent;

          return (
            <View
              key={request.id}
              style={[
                styles.card,
                isUrgent && isPending && styles.cardUrgent,
                isSelected && styles.cardSelected,
              ]}
            >
              <Pressable
                onPress={() => {
                  setSelected(isSelected ? null : request);
                  setUrgencyReason("");
                  setDismissReason("");
                }}
                style={styles.cardHeaderPressable}
              >
                {/* Header row: Horse identity & Urgency Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.horseIdentityRow}>
                    <View
                      style={[
                        styles.horseAvatar,
                        isUrgent && isPending ? styles.horseAvatarUrgent : null,
                      ]}
                    >
                      <Ionicons
                        name="paw-outline"
                        size={16}
                        color={isUrgent && isPending ? colors.destructive : colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.horseName} numberOfLines={1}>
                        {request.horseName}
                      </Text>
                      <Text style={styles.sourceText}>
                        Nguồn: {formatIncidentSource(request.source)} ·{" "}
                        {formatDateTime(request.createdAt)}
                      </Text>
                    </View>
                  </View>

                  {/* Urgency Badge */}
                  {isPending ? (
                    <View
                      style={[
                        styles.urgencyBadge,
                        isUrgent ? styles.urgencyBadgeUrgent : styles.urgencyBadgeNormal,
                      ]}
                    >
                      <Ionicons
                        name={isUrgent ? "warning" : "information-circle-outline"}
                        size={12}
                        color={isUrgent ? colors.destructive : colors.foreground}
                      />
                      <Text
                        style={[
                          styles.urgencyBadgeText,
                          isUrgent ? styles.urgencyBadgeTextUrgent : null,
                        ]}
                      >
                        {isUrgent ? "CẤP CỨU" : "THƯỜNG"}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.statusCompletedBadge}>
                      <Text style={styles.statusCompletedText}>
                        {request.status === "EXAMINED" ? "ĐÃ KHÁM" : "ĐÃ BỎ QUA"}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Description Box */}
                <View style={styles.symptomBox}>
                  <Ionicons
                    name="chatbox-ellipses-outline"
                    size={14}
                    color={colors.primary}
                    style={{ marginTop: 2 }}
                  />
                  <Text style={styles.symptomText}>{request.description}</Text>
                </View>

                {/* Requester / Dismissal details */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    Người yêu cầu:{" "}
                    {request.requestedBy
                      ? `Nhân sự ${request.requestedBy.slice(0, 8)}`
                      : "Hệ thống tự động"}
                  </Text>
                </View>

                {request.incidentId ? (
                  <View style={styles.incidentRow}>
                    <View style={styles.incidentBadge}>
                      <Ionicons name="warning-outline" size={14} color={colors.monitor} />
                      <Text style={styles.incidentBadgeText}>
                        Từ sự cố #{request.incidentId.slice(0, 8)}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.viewPhotoBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        void viewIncidentPhoto(request.incidentId!);
                      }}
                    >
                      <Ionicons name="image-outline" size={14} color={colors.primary} />
                      <Text style={styles.viewPhotoBtnText}>Xem ảnh sự cố</Text>
                    </Pressable>
                  </View>
                ) : null}

                {request.dismissReason ? (
                  <View style={styles.dismissBox}>
                    <Text style={styles.dismissLabel}>Lý do bỏ qua:</Text>
                    <Text style={styles.dismissText}>{request.dismissReason}</Text>
                  </View>
                ) : null}

                {/* Compact Action Buttons */}
                {isVet && isPending ? (
                  <View style={{ flexDirection: "row", gap: space.xs, marginTop: space.sm, paddingTop: space.xs, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Khám bệnh"
                        icon="medkit-outline"
                        onPress={() =>
                          router.push(
                            `/${role}/medical/visit?horseId=${request.horseId}&requestId=${request.id}` as Href,
                          )
                        }
                      />
                    </View>
                    <SecondaryButton
                      label="Bỏ qua"
                      icon="close-circle-outline"
                      onPress={() => {
                        setActionTarget(request);
                        setDismissReason("");
                        setModalAction("dismiss");
                      }}
                    />
                    <SecondaryButton
                      label={isUrgent ? "Hạ cấp" : "Cấp cứu"}
                      icon={isUrgent ? "arrow-down-circle-outline" : "warning-outline"}
                      onPress={() => {
                        setActionTarget(request);
                        setUrgencyReason("");
                        setModalAction("urgency");
                      }}
                    />
                  </View>
                ) : null}

                {(role === "manager" || role === "trainer") ? (
                  <View style={{ marginTop: space.sm }}>
                    <SecondaryButton
                      label="Xem hồ sơ ngựa"
                      icon="document-text-outline"
                      onPress={() => router.push(`/${role}/horse/${request.horseId}` as Href)}
                    />
                  </View>
                ) : null}

                {request.medicalRecordId ? (
                  <View style={{ marginTop: space.sm }}>
                    <PrimaryButton
                      label="Xem biên bản khám đã lưu"
                      icon="clipboard-outline"
                      onPress={() =>
                        router.push(`/${role}/medical/visits/${request.medicalRecordId}` as Href)
                      }
                    />
                  </View>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Pagination */}
      {totalPages > 1 ? (
        <View style={styles.paginationRow}>
          {hasPrevious ? (
            <SecondaryButton
              label="Trang trước"
              style={{ flex: 1 }}
              onPress={() => {
                setSelected(null);
                const prev = Math.max(1, page - 1);
                setPage(prev);
                void fetchTabRequests(status, prev);
              }}
            />
          ) : null}
          <Text style={styles.pageIndicator}>
            Trang {page} / {totalPages}
          </Text>
          {hasMore ? (
            <SecondaryButton
              label="Trang sau"
              style={{ flex: 1 }}
              onPress={() => {
                setSelected(null);
                const next = page + 1;
                setPage(next);
                void fetchTabRequests(status, next);
              }}
            />
          ) : null}
        </View>
      ) : null}

      {/* CREATE REQUEST MODAL */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Tạo yêu cầu khám mới</Text>
                <Text style={styles.modalSubtitle}>
                  Gửi yêu cầu kiểm tra sức khỏe ngựa đến bác sĩ thú y
                </Text>
              </View>
              <Pressable onPress={() => setShowCreateModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.xl }}>
              {/* Selected Horse Card */}
              <View>
                <Text style={styles.inputSectionLabel}>Ngựa cần khám *</Text>
                {selectedHorse ? (
                  <View style={styles.selectedHorseCard}>
                    <View style={styles.selectedHorseAvatar}>
                      <Ionicons name="paw" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedHorseName}>{selectedHorse.name}</Text>
                      <Text style={styles.selectedHorseDetail}>
                        {selectedHorse.location?.barn?.name ?? "Chưa xếp khu"}
                        {selectedHorse.location?.stall?.code
                          ? ` · Ô ${selectedHorse.location.stall.code}`
                          : ""}
                        {selectedHorse.microchipId ? ` · Chip: ${selectedHorse.microchipId}` : ""}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setHorsePickerVisible(true)}
                      style={styles.changeHorseButton}
                    >
                      <Text style={styles.changeHorseText}>Đổi ngựa</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setHorsePickerVisible(true)}
                    style={styles.chooseHorseTrigger}
                  >
                    <Ionicons name="search-outline" size={18} color={colors.primary} />
                    <Text style={styles.chooseHorseTriggerText}>
                      {loadingHorses ? "Đang tải danh sách ngựa…" : "Nhấn để chọn ngựa cần khám…"}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                  </Pressable>
                )}
              </View>

              {/* Symptoms Description */}
              <Field label="Triệu chứng & Chi tiết quan sát *">
                <NativeInput
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  placeholder="Mô tả dấu hiệu bất thường, hành vi hoặc vị trí nghi tổn thương..."
                  style={{ minHeight: 90 }}
                />
              </Field>

              {/* Urgency Level Selector */}
              <View>
                <Text style={styles.inputSectionLabel}>Mức độ khẩn cấp</Text>
                <View style={styles.urgencyChoiceRow}>
                  <Pressable
                    onPress={() => setUrgent(false)}
                    style={[
                      styles.urgencyChoiceCard,
                      !urgent && styles.urgencyChoiceCardActiveNormal,
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color={!urgent ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.urgencyChoiceTitle,
                        !urgent && styles.urgencyChoiceTitleActive,
                      ]}
                    >
                      Thường
                    </Text>
                    <Text style={styles.urgencyChoiceSubtitle}>
                      Khám theo lịch định kỳ hoặc hàng đợi thông thường
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setUrgent(true)}
                    style={[
                      styles.urgencyChoiceCard,
                      urgent && styles.urgencyChoiceCardActiveUrgent,
                    ]}
                  >
                    <Ionicons
                      name="alert-circle"
                      size={20}
                      color={urgent ? colors.destructive : colors.mutedForeground}
                    />
                    <Text
                      style={[styles.urgencyChoiceTitle, urgent && styles.urgencyChoiceTitleUrgent]}
                    >
                      Cấp cứu
                    </Text>
                    <Text style={styles.urgencyChoiceSubtitle}>
                      Ưu tiên khám ngay, thông báo khẩn cho bác sĩ
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                <PrimaryButton
                  label={saving ? "Đang gửi…" : "Gửi yêu cầu khám"}
                  icon="paper-plane-outline"
                  disabled={saving || !selectedHorse || !description.trim()}
                  onPress={() => void createRequest()}
                />
                <SecondaryButton label="Hủy bỏ" onPress={() => setShowCreateModal(false)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* HORSE PICKER MODAL */}
      <Modal visible={horsePickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Chọn ngựa</Text>
                <Text style={styles.modalSubtitle}>
                  Tìm kiếm theo tên ngựa, số chip hoặc khu chuồng
                </Text>
              </View>
              <Pressable
                onPress={() => setHorsePickerVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <Field label="Tìm kiếm ngựa">
              <NativeInput
                value={horseSearch}
                onChangeText={setHorseSearch}
                placeholder="Nhập tên ngựa, số chip..."
                autoFocus
              />
            </Field>

            <ScrollView contentContainerStyle={{ gap: 6, paddingVertical: space.sm }}>
              {filteredHorses.map((h) => {
                const isCurrent = selectedHorse?.id === h.id;
                return (
                  <Pressable
                    key={h.id}
                    onPress={() => {
                      setSelectedHorse(h);
                      setHorsePickerVisible(false);
                    }}
                    style={[styles.horseListItem, isCurrent && styles.horseListItemActive]}
                  >
                    <View style={styles.horseListAvatar}>
                      <Ionicons
                        name="paw"
                        size={16}
                        color={isCurrent ? colors.primary : colors.foreground}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.horseListName, isCurrent && { color: colors.primary }]}>
                        {h.name}
                      </Text>
                      <Text style={styles.horseListLocation}>
                        {h.location?.barn?.name ?? "Chưa xếp khu"}
                        {h.location?.stall?.code ? ` · Ô ${h.location.stall.code}` : ""}
                        {h.microchipId ? ` · Chip: ${h.microchipId}` : ""}
                      </Text>
                    </View>
                    {isCurrent ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}

              {!filteredHorses.length ? (
                <View style={{ padding: space.lg, alignItems: "center" }}>
                  <Text style={uiStyles.muted}>
                    {loadingHorses ? "Đang tải danh sách ngựa..." : "Không tìm thấy ngựa phù hợp."}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal enlarged incident photo */}
      <Modal
        visible={Boolean(enlargedPhotoUrl)}
        animationType="fade"
        transparent
        onRequestClose={() => setEnlargedPhotoUrl(null)}
      >
        <View style={styles.photoModalOverlay}>
          <View style={styles.photoModalCard}>
            <View style={styles.photoModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="image" size={18} color={colors.primary} />
                <Text style={styles.photoModalTitle}>Ảnh sự cố đính kèm</Text>
              </View>
              <Pressable
                onPress={() => setEnlargedPhotoUrl(null)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>
            {enlargedPhotoUrl ? (
              <Image
                source={{ uri: enlargedPhotoUrl }}
                style={styles.photoPreviewImg}
                resizeMode="contain"
              />
            ) : null}
            <SecondaryButton
              label="Đóng ảnh"
              icon="close-outline"
              onPress={() => setEnlargedPhotoUrl(null)}
            />
          </View>
        </View>
      </Modal>

      {/* ACTION MODAL (Dismiss or Urgency) */}
      <Modal
        visible={Boolean(modalAction && actionTarget)}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setModalAction(null);
          setActionTarget(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {modalAction === "dismiss"
                    ? "Bỏ qua yêu cầu khám"
                    : actionTarget?.urgent
                      ? "Hạ cấp mức độ yêu cầu"
                      : "Nâng lên mức CẤP CỨU"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Ngựa: {actionTarget?.horseName}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setModalAction(null);
                  setActionTarget(null);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <Field
              label={
                modalAction === "dismiss"
                  ? "Lý do bỏ qua yêu cầu *"
                  : "Lý do thay đổi mức độ khẩn cấp *"
              }
            >
              <NativeInput
                value={modalAction === "dismiss" ? dismissReason : urgencyReason}
                onChangeText={modalAction === "dismiss" ? setDismissReason : setUrgencyReason}
                multiline
                placeholder={
                  modalAction === "dismiss"
                    ? "Nhập lý do bỏ qua (ví dụ: đã khám tại chuồng, trùng lặp...)"
                    : "Nhập lý do thay đổi mức độ khẩn cấp..."
                }
                style={{ minHeight: 80 }}
                autoFocus
              />
            </Field>

            <View style={{ gap: space.sm, marginTop: space.sm }}>
              <PrimaryButton
                label={
                  saving
                    ? "Đang lưu…"
                    : modalAction === "dismiss"
                      ? "Xác nhận bỏ qua"
                      : "Xác nhận đổi mức độ"
                }
                disabled={
                  saving ||
                  !(modalAction === "dismiss" ? dismissReason.trim() : urgencyReason.trim())
                }
                onPress={() => {
                  if (modalAction === "dismiss") {
                    void submitDismiss();
                  } else {
                    void submitChangeUrgency();
                  }
                }}
              />
              <SecondaryButton
                label="Đóng"
                onPress={() => {
                  setModalAction(null);
                  setActionTarget(null);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    createBar: {
      marginBottom: space.sm,
    },
    tabContainer: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
      marginBottom: space.sm,
    },
    tabButton: {
      flex: 1,
      minWidth: 0,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
      borderRadius: 10,
    },
    tabButtonActive: {
      backgroundColor: colors.primary,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 2,
      elevation: 2,
    },
    tabContentGroup: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      maxWidth: "100%",
    },
    tabText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
      textAlign: "center",
      flexShrink: 1,
    },
    tabTextActive: {
      color: "#ffffff",
      fontWeight: "700",
    },
    tabBadge: {
      paddingHorizontal: 4,
      height: 16,
      minWidth: 16,
      borderRadius: 8,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    tabBadgeActive: {
      backgroundColor: "rgba(255,255,255,0.25)",
    },
    tabBadgeText: {
      fontSize: 9,
      fontWeight: "700",
      color: colors.foreground,
    },
    tabBadgeTextActive: {
      color: "#ffffff",
    },
    revalidatingBar: {
      paddingVertical: 4,
      alignItems: "center",
      backgroundColor: colors.fitSoft,
      borderRadius: radius.sm,
      marginBottom: space.xs,
    },
    revalidatingText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: "500",
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      padding: space.xl,
      gap: space.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: space.sm,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      marginTop: space.xs,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      maxWidth: 280,
    },
    cardsList: {
      gap: space.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    cardUrgent: {
      borderColor: colors.destructive,
      backgroundColor: colors.injuredSoft,
    },
    cardSelected: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    cardHeaderPressable: {
      padding: space.md,
      gap: space.xs,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    horseIdentityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      flex: 1,
    },
    horseAvatar: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    horseAvatarUrgent: {
      backgroundColor: colors.injuredSoft,
    },
    horseName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    sourceText: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    urgencyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    urgencyBadgeUrgent: {
      backgroundColor: colors.injuredSoft,
      borderWidth: 1,
      borderColor: colors.destructive,
    },
    urgencyBadgeNormal: {
      backgroundColor: colors.muted,
    },
    urgencyBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.foreground,
    },
    urgencyBadgeTextUrgent: {
      color: colors.destructive,
    },
    statusCompletedBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
    },
    statusCompletedText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.mutedForeground,
    },
    symptomBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      marginTop: 4,
    },
    symptomText: {
      fontSize: 13,
      color: colors.foreground,
      lineHeight: 18,
      flex: 1,
    },
    metaRow: {
      marginTop: 2,
    },
    metaText: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    dismissBox: {
      backgroundColor: colors.muted,
      padding: space.sm,
      borderRadius: radius.sm,
      marginTop: 4,
    },
    dismissLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedForeground,
    },
    dismissText: {
      fontSize: 12,
      color: colors.foreground,
      marginTop: 2,
    },
    expandRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: 4,
    },
    expandText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.primary,
    },
    actionDrawer: {
      padding: space.md,
      paddingTop: 0,
      gap: space.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    inlineActionBox: {
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      gap: space.xs,
    },
    inlineActionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 2,
    },
    paginationRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.md,
      marginTop: space.sm,
    },
    pageIndicator: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontWeight: "600",
    },
    // MODAL STYLES
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: space.lg,
      maxHeight: "90%",
      gap: space.md,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingBottom: space.sm,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    modalCloseButton: {
      padding: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
    },
    inputSectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
      marginBottom: 6,
    },
    chooseHorseTrigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: space.md,
    },
    chooseHorseTriggerText: {
      fontSize: 14,
      color: colors.mutedForeground,
      flex: 1,
    },
    selectedHorseCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.md,
      padding: space.md,
    },
    selectedHorseAvatar: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    selectedHorseName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    selectedHorseDetail: {
      fontSize: 12,
      color: colors.primary,
      marginTop: 2,
    },
    changeHorseButton: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
    },
    changeHorseText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    urgencyChoiceRow: {
      flexDirection: "row",
      gap: space.sm,
    },
    urgencyChoiceCard: {
      flex: 1,
      padding: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      gap: 3,
    },
    urgencyChoiceCardActiveNormal: {
      borderColor: colors.primary,
      backgroundColor: colors.fitSoft,
      borderWidth: 2,
    },
    urgencyChoiceCardActiveUrgent: {
      borderColor: colors.destructive,
      backgroundColor: colors.injuredSoft,
      borderWidth: 2,
    },
    urgencyChoiceTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    urgencyChoiceTitleActive: {
      color: colors.primary,
    },
    urgencyChoiceTitleUrgent: {
      color: colors.destructive,
    },
    urgencyChoiceSubtitle: {
      fontSize: 11,
      color: colors.mutedForeground,
      lineHeight: 14,
    },
    // HORSE LIST ITEM
    horseListItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
    },
    horseListItemActive: {
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    horseListAvatar: {
      width: 30,
      height: 30,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    horseListName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    horseListLocation: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    incidentRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: space.xs,
      paddingTop: space.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    incidentBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    incidentBadgeText: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.foreground,
    },
    viewPhotoBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    viewPhotoBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    photoModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: space.lg,
    },
    photoModalCard: {
      width: "100%",
      maxHeight: "85%",
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: space.md,
      gap: space.md,
    },
    photoModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    photoModalTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    photoPreviewImg: {
      width: "100%",
      height: 320,
      borderRadius: radius.md,
      backgroundColor: "#000",
    },
  });
}
