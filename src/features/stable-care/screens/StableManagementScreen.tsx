import { type Href, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Chips,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { stableService, type BarnListItemDto, type StallDto } from "@/services/stable.service";
import { horseService, type HorseHealthStatusDto } from "@/services/horse.service";
import {
  stableCareService,
  type ChecklistStatus,
} from "@/services/stable-care.service";
import { usersService } from "@/services/users.service";
import type { StaffDto } from "@/adapters/staff.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatEnum } from "@/utils/formatters";
import { clubDate } from "@/utils/horse-validation";
import { radius, space } from "@/config/theme";
import type { RoleId } from "@/types/raceos";
import { StallActionModal } from "../components/modals/StallActionModal";
import { CreateBarnModal } from "../components/modals/CreateBarnModal";
import { CreateStallModal } from "../components/modals/CreateStallModal";
import { EditBarnModal } from "../components/modals/EditBarnModal";
import { EditStallModal } from "../components/modals/EditStallModal";
import { CareHorseCard } from "../components/CareHorseCard";
import { UnassignedHorsesSection } from "../components/UnassignedHorsesSection";
import { GroomWorkloadSection } from "../components/GroomWorkloadSection";
import { useBarnStalls } from "../hooks/useBarnStalls";
import { useGroomAssignment } from "../hooks/useGroomAssignment";
import { getStableManagementStyles } from "./stable-management.styles";

function suggestNextStallCode(barnName: string, existingStalls: StallDto[]): string {
  const prefixMatch = barnName.match(/Khu\s*([A-Za-z0-9]+)/i);
  const prefix = prefixMatch
    ? `${prefixMatch[1].toUpperCase()}-`
    : `${barnName.slice(0, 1).toUpperCase()}-`;
  let maxNum = 0;
  for (const s of existingStalls) {
    if (s.code.toUpperCase().startsWith(prefix)) {
      const numPart = parseInt(s.code.slice(prefix.length), 10);
      if (!Number.isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(2, "0")}`;
}

export type HorseCareSummary = {
  horseId: string;
  groomName: string | null;
  checklistStatus: ChecklistStatus | "NOT_GENERATED";
  checklistProgress?: { done: number; total: number };
  feedingPlanStatus: "ACTIVE" | "NONE";
  feedingPlanMealsCount?: number;
  openIncidentsCount: number;
};

export function StableManagementScreen({ role }: { role: RoleId }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => getStableManagementStyles(colors), [colors]);
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();

  const [activeBarnIndex, setActiveBarnIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const pagerRef = useRef<ScrollViewInstance>(null);

  // Selected stall for bottom sheet / modal interaction
  const [selectedStall, setSelectedStall] = useState<StallDto | null>(null);

  // Unassigned tab (Section 4.3): 'barn' = pending barn, 'stall' = pending stall, 'groom' = pending groom
  const [unassignedTab, setUnassignedTab] = useState<"barn" | "stall" | "groom">("barn");

  // Modal states
  const [showCreateBarnModal, setShowCreateBarnModal] = useState(false);
  const [showEditBarnModal, setShowEditBarnModal] = useState(false);
  const [editingBarn, setEditingBarn] = useState<BarnListItemDto | null>(null);
  const [showCreateStallModal, setShowCreateStallModal] = useState(false);
  const [targetBarnForStall, setTargetBarnForStall] = useState<BarnListItemDto | null>(null);
  const [newStallCode, setNewStallCode] = useState("");
  const [showEditStallModal, setShowEditStallModal] = useState(false);
  const [editingStall, setEditingStall] = useState<StallDto | null>(null);

  const loadTrainers = useCallback(() => usersService.list(token!), [token]);
  const trainersResource = useApiResource(loadTrainers, Boolean(token && role === "manager"));
  const activeHeadTrainers = useMemo(
    () =>
      (trainersResource.data ?? []).filter(
        (u: StaffDto) => u.role === "HEAD_TRAINER" && u.status === "ACTIVE",
      ),
    [trainersResource.data],
  );

  const loadGroomWorkload = useGroomAssignment(token);
  const {
    resource,
    payload,
    getHorseInStall,
    pendingBarnHorses,
    pendingStallHorses,
    pendingGroomHorses,
    totalAwaitingPlacement,
    occupiedCount,
    currentBarn,
    currentBarnStalls,
    pendingInCurrentBarn,
    horsesInCurrentBarn,
    selectedHorseInModal,
    barnMetrics,
  } = useBarnStalls({
    token,
    role,
    activeBarnIndex,
    selectedStall,
    loadGroomWorkload,
  });

  // Sub-view: "stalls" (Sơ đồ ô chuồng) vs "care" (Tổng quan chăm sóc theo ngựa - Step G1)
  const [barnViewMode, setBarnViewMode] = useState<"stalls" | "care">("stalls");
  const [careSummaries, setCareSummaries] = useState<Record<string, HorseCareSummary>>({});
  const [loadingCare, setLoadingCare] = useState(false);

  const loadCareOverview = useCallback(async () => {
    if (!token || !currentBarn) return;
    const targetHorses = (payload?.horses ?? []).filter(
      (h) => h.location.barn?.id === currentBarn.id,
    );
    if (targetHorses.length === 0) {
      setCareSummaries({});
      return;
    }

    setLoadingCare(true);
    const todayStr = clubDate();

    try {
      const openIncidents = await stableCareService
        .listIncidents(token, { barnId: currentBarn.id, status: "OPEN" })
        .catch(() => []);

      const incidentsByHorse: Record<string, number> = {};
      for (const inc of openIncidents) {
        incidentsByHorse[inc.horseId] = (incidentsByHorse[inc.horseId] ?? 0) + 1;
      }

      const results = await Promise.allSettled(
        targetHorses.map(async (horse) => {
          const [horseDetail, checklists, feedingPlans] = await Promise.all([
            horseService.get(token, horse.id).catch(() => null),
            stableCareService.listChecklists(token, horse.id, todayStr, todayStr).catch(() => []),
            stableCareService.listFeedingPlans(token, horse.id, "ACTIVE").catch(() => []),
          ]);

          const todayChecklist = checklists[0];
          let checklistStatus: ChecklistStatus | "NOT_GENERATED" = "NOT_GENERATED";
          let checklistProgress: { done: number; total: number } | undefined;

          if (todayChecklist) {
            checklistStatus = todayChecklist.status;
            const done = todayChecklist.items.filter((item) => item.done).length;
            checklistProgress = { done, total: todayChecklist.items.length };
          }

          const activePlan = feedingPlans[0];
          const feedingPlanStatus = activePlan ? "ACTIVE" : "NONE";
          const feedingPlanMealsCount = activePlan?.meals?.length ?? 0;

          return {
            horseId: horse.id,
            groomName: horseDetail?.groom?.fullName ?? null,
            checklistStatus,
            checklistProgress,
            feedingPlanStatus,
            feedingPlanMealsCount,
            openIncidentsCount: incidentsByHorse[horse.id] ?? 0,
          } as HorseCareSummary;
        }),
      );

      const summaries: Record<string, HorseCareSummary> = {};
      for (const res of results) {
        if (res.status === "fulfilled") {
          summaries[res.value.horseId] = res.value;
        }
      }
      setCareSummaries((prev) => ({ ...prev, ...summaries }));
    } finally {
      setLoadingCare(false);
    }
  }, [token, currentBarn, payload?.horses]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (barnViewMode === "care") {
      timer = setTimeout(() => {
        void loadCareOverview();
      }, 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [barnViewMode, activeBarnIndex, loadCareOverview]);

  const careCompletedCount = useMemo(() => {
    return horsesInCurrentBarn.filter(
      (h) => careSummaries[h.id]?.checklistStatus === "COMPLETED",
    ).length;
  }, [horsesInCurrentBarn, careSummaries]);

  const careIncidentCount = useMemo(() => {
    return horsesInCurrentBarn.reduce(
      (sum, h) => sum + (careSummaries[h.id]?.openIncidentsCount ?? 0),
      0,
    );
  }, [horsesInCurrentBarn, careSummaries]);

  const handleSelectBarn = (index: number) => {
    setActiveBarnIndex(index);
    if (containerWidth > 0) {
      pagerRef.current?.scrollTo({ x: index * containerWidth, animated: true });
    }
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (containerWidth > 0) {
      const newIndex = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
      if (newIndex >= 0 && newIndex < (payload?.barns.length ?? 0)) {
        setActiveBarnIndex(newIndex);
      }
    }
  };

  const renderHealthBadge = (status: HorseHealthStatusDto) => {
    switch (status) {
      case "INJURED":
        return (
          <View style={[styles.healthBadge, { backgroundColor: colors.injuredSoft }]}>
            <Ionicons name="warning" size={11} color={colors.destructive} />
            <Text style={[styles.healthBadgeText, { color: colors.destructive }]}>
              {t("Injured")}
            </Text>
          </View>
        );
      case "UNDER_OBSERVATION":
        return (
          <View style={[styles.healthBadge, { backgroundColor: colors.monitorSoft }]}>
            <Ionicons name="eye-outline" size={11} color={colors.monitor} />
            <Text style={[styles.healthBadgeText, { color: colors.monitor }]}>
              {t("Under observation")}
            </Text>
          </View>
        );
      case "QUARANTINED":
        return (
          <View style={[styles.healthBadge, { backgroundColor: colors.lockedSoft }]}>
            <Ionicons name="lock-closed" size={11} color={colors.locked} />
            <Text style={[styles.healthBadgeText, { color: colors.locked }]}>
              {t("Quarantined")}
            </Text>
          </View>
        );
      default:
        return (
          <View style={[styles.healthBadge, { backgroundColor: colors.fitSoft }]}>
            <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
            <Text style={[styles.healthBadgeText, { color: colors.primary }]}>{t("Eligible")}</Text>
          </View>
        );
    }
  };

  const renderChecklistCareBadge = (
    status: ChecklistStatus | "NOT_GENERATED",
    progress?: { done: number; total: number },
  ) => {
    switch (status) {
      case "COMPLETED":
        return (
          <View style={[styles.careStatusBadge, { backgroundColor: colors.fitSoft }]}>
            <Ionicons name="checkmark-circle" size={11} color={colors.primary} />
            <Text style={[styles.careStatusBadgeText, { color: colors.primary }]}>
              {t("Completed")} {progress ? `(${progress.done}/${progress.total})` : ""}
            </Text>
          </View>
        );
      case "IN_PROGRESS":
        return (
          <View style={[styles.careStatusBadge, { backgroundColor: colors.monitorSoft }]}>
            <Ionicons name="time" size={11} color={colors.monitor} />
            <Text style={[styles.careStatusBadgeText, { color: colors.monitor }]}>
              {t("In progress")} {progress ? `(${progress.done}/${progress.total})` : ""}
            </Text>
          </View>
        );
      case "INCOMPLETE":
        return (
          <View style={[styles.careStatusBadge, { backgroundColor: colors.injuredSoft }]}>
            <Ionicons name="alert-circle" size={11} color={colors.destructive} />
            <Text style={[styles.careStatusBadgeText, { color: colors.destructive }]}>
              {t("Incomplete")}
            </Text>
          </View>
        );
      case "CANCELLED":
        return (
          <View style={[styles.careStatusBadge, { backgroundColor: colors.elevated }]}>
            <Ionicons name="close-circle" size={11} color={colors.mutedForeground} />
            <Text style={[styles.careStatusBadgeText, { color: colors.mutedForeground }]}>
              {t("Cancelled")}
            </Text>
          </View>
        );
      case "PENDING":
        return (
          <View style={[styles.careStatusBadge, { backgroundColor: colors.elevated }]}>
            <Ionicons name="ellipse-outline" size={11} color={colors.mutedForeground} />
            <Text style={[styles.careStatusBadgeText, { color: colors.mutedForeground }]}>
              {t("Pending")} {progress ? `(0/${progress.total})` : ""}
            </Text>
          </View>
        );
      default:
        return (
          <Text style={[styles.careAspectValue, { color: colors.mutedForeground }]}>
            {t("Not generated")}
          </Text>
        );
    }
  };

  const openCreateBarnModal = () => {
    setShowCreateBarnModal(true);
  };

  const openCreateStallModal = (barn: BarnListItemDto) => {
    setTargetBarnForStall(barn);
    const barnStalls = (payload?.stalls ?? []).filter((s) => s.barnId === barn.id);
    const suggested = suggestNextStallCode(barn.name, barnStalls);
    setNewStallCode(suggested);
    setShowCreateStallModal(true);
  };

  const openEditBarn = (barn: BarnListItemDto) => {
    setEditingBarn(barn);
    setShowEditBarnModal(true);
  };

  const confirmDeleteBarn = (barn: BarnListItemDto) => {
    Alert.alert(
      t("Xóa khu chuồng"),
      `${t("Bạn có chắc muốn xóa")} ${barn.name}? ${t("Thao tác này chỉ thực hiện được khi khu không còn ô chuồng và ngựa.")}`,
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await stableService.deleteBarn(token!, barn.id);
              await resource.refresh();
              setActiveBarnIndex(0);
              Alert.alert(t("Thành công"), t("Đã xóa khu chuồng."));
            } catch (err) {
              Alert.alert(t("Không thể xóa khu"), extractErrorMessage(err));
            }
          },
        },
      ],
    );
  };

  const openEditStallModal = (stall: StallDto) => {
    setEditingStall(stall);
    setShowEditStallModal(true);
  };

  return (
    <Screen
      role={role}
      title="Stable overview"
      subtitle={
        payload
          ? `${payload.barns.length} barns · ${occupiedCount}/${payload.stalls.length} occupied`
          : "Barn, stall and Groom assignments"
      }
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {payload && payload.barns.length === 0 ? (
        <View style={{ gap: space.md, alignItems: "center", paddingVertical: space.xl }}>
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => undefined}
            empty
            emptyLabel={t("No barns are available.")}
          />
          {role === "manager" ? (
            <PrimaryButton
              label={t("Tạo khu chuồng đầu tiên")}
              icon="add"
              onPress={openCreateBarnModal}
            />
          ) : null}
        </View>
      ) : null}

      {payload && payload.barns.length > 0 ? (
        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          style={{ gap: space.xl }}
        >
          {/* Quick link banner for Trainer to manage Diet & Feeding */}
          {role === "trainer" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Manage stable diet")}
              onPress={() => {
                const firstHorse = payload.horses[0];
                if (firstHorse) {
                  router.push(`/trainer/horse/${firstHorse.id}/stable-care` as Href);
                } else {
                  router.push("/trainer/horses" as Href);
                }
              }}
              style={({ pressed }) => [
                styles.trainerCareBanner,
                pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={styles.trainerCareBannerIcon}>
                <Ionicons name="nutrition" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.trainerCareBannerTitle}>{t("Diet & Feeding")}</Text>
                <Text style={uiStyles.muted} numberOfLines={1}>
                  {t("Feeding, scheduled care, daily checklists and surcharges")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable>
          ) : null}

          {/* Barn Selector Horizontal Pills */}
          <View style={styles.barnSelectorContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.barnSelectorScroll}
            >
              {payload.barns.map((barn, index) => {
                const isActive = index === activeBarnIndex;
                return (
                  <Pressable
                    key={barn.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => handleSelectBarn(index)}
                    style={[styles.barnTabChip, isActive && styles.barnTabChipActive]}
                  >
                    <Ionicons
                      name="home"
                      size={14}
                      color={isActive ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[styles.barnTabChipText, isActive && styles.barnTabChipTextActive]}
                      numberOfLines={1}
                    >
                      {barn.name}
                    </Text>
                  </Pressable>
                );
              })}
              {role === "manager" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Add barn")}
                  onPress={openCreateBarnModal}
                  style={styles.addBarnTabChip}
                >
                  <Ionicons name="add" size={15} color={colors.primary} />
                  <Text style={styles.addBarnTabChipText}>{t("Add barn")}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>

          {/* Barn View Mode Segment (Sơ đồ ô chuồng vs Tổng quan chăm sóc khu - Step G1) */}
          <View style={styles.viewModeSegment}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: barnViewMode === "stalls" }}
              onPress={() => setBarnViewMode("stalls")}
              style={[
                styles.viewModeSegmentBtn,
                barnViewMode === "stalls" && styles.viewModeSegmentBtnActive,
              ]}
            >
              <Ionicons
                name="grid-outline"
                size={15}
                color={
                  barnViewMode === "stalls" ? colors.primaryForeground : colors.mutedForeground
                }
              />
              <Text
                style={[
                  styles.viewModeSegmentText,
                  barnViewMode === "stalls" && styles.viewModeSegmentTextActive,
                ]}
              >
                {t("Sơ đồ ô chuồng")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: barnViewMode === "care" }}
              onPress={() => setBarnViewMode("care")}
              style={[
                styles.viewModeSegmentBtn,
                barnViewMode === "care" && styles.viewModeSegmentBtnActive,
              ]}
            >
              <Ionicons
                name="clipboard-outline"
                size={15}
                color={barnViewMode === "care" ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.viewModeSegmentText,
                  barnViewMode === "care" && styles.viewModeSegmentTextActive,
                ]}
              >
                {t("Care overview")}
              </Text>
            </Pressable>
          </View>

          {barnViewMode === "stalls" ? (
            <>
              {/* Swipe Hint */}
              <View style={styles.swipeHintRow}>
            <Ionicons name="swap-horizontal" size={14} color={colors.mutedForeground} />
            <Text style={styles.swipeHintText}>{t("Swipe or tap to switch barn")}</Text>
          </View>

          {/* Barn Overview Metric Cards */}
          {currentBarn ? (
            <View style={styles.metricGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{barnMetrics.total}</Text>
                <Text style={styles.metricLabel}>{t("Total stalls")}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: colors.primary }]}>
                  {barnMetrics.occupied}
                </Text>
                <Text style={styles.metricLabel}>{t("Occupied")}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{barnMetrics.vacant}</Text>
                <Text style={styles.metricLabel}>{t("Vacant")}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text
                  style={[
                    styles.metricValue,
                    barnMetrics.attention > 0 && { color: colors.destructive },
                  ]}
                >
                  {barnMetrics.attention}
                </Text>
                <Text style={styles.metricLabel}>{t("Needs attention")}</Text>
              </View>
            </View>
          ) : null}

          {/* Horizontal Paging for Barn Stalls */}
          {containerWidth > 0 ? (
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              style={{ width: containerWidth }}
              contentContainerStyle={{ paddingBottom: space.sm }}
            >
              {payload.barns.map((barn) => {
                const barnStalls = payload.stalls.filter((s) => s.barnId === barn.id);

                return (
                  <View key={barn.id} style={{ width: containerWidth }}>
                    <View style={uiStyles.section}>
                      {/* Barn Header Row */}
                      <View style={styles.barnHeaderRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.barnTitle}>{barn.name}</Text>
                          {barn.headTrainerFullName ? (
                            <Text style={styles.barnTrainerText}>
                              {t("Head Trainer")}: {barn.headTrainerFullName}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.barnAvailableBadge}>
                          <Ionicons name="home-outline" size={13} color={colors.primary} />
                          <Text style={styles.barnAvailableBadgeText}>
                            {barn.availableStallCount} {t("available")}
                          </Text>
                        </View>
                        {role === "manager" ? (
                          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t("Edit barn")}
                              onPress={() => openEditBarn(barn)}
                              style={styles.barnActionBtn}
                            >
                              <Ionicons name="create-outline" size={16} color={colors.primary} />
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t("Delete barn")}
                              onPress={() => confirmDeleteBarn(barn)}
                              style={styles.barnActionBtn}
                            >
                              <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                            </Pressable>
                          </View>
                        ) : null}
                      </View>

                      {/* Stalls 2-Column Grid */}
                      <View style={styles.stallsGrid}>
                        {barnStalls.map((stall) => {
                          const assignedHorse = getHorseInStall(stall, barn.id);
                          const isOccupied = stall.status === "OCCUPIED" || Boolean(assignedHorse);
                          const isMaintenance = stall.status === "MAINTENANCE";
                          const isAvailable = stall.status === "AVAILABLE" && !assignedHorse;

                          // Dynamic stall container styling based on occupancy and health
                          let stallBorderColor = colors.border;
                          let stallBgColor = colors.surface;
                          if (assignedHorse) {
                            if (assignedHorse.healthStatus === "INJURED") {
                              stallBorderColor = colors.destructive;
                              stallBgColor = colors.injuredSoft;
                            } else if (assignedHorse.healthStatus === "UNDER_OBSERVATION") {
                              stallBorderColor = colors.monitor;
                              stallBgColor = colors.monitorSoft;
                            } else if (assignedHorse.healthStatus === "QUARANTINED") {
                              stallBorderColor = colors.locked;
                              stallBgColor = colors.lockedSoft;
                            } else {
                              stallBorderColor = colors.primary;
                              stallBgColor = colors.fitSoft;
                            }
                          } else if (isMaintenance) {
                            stallBgColor = colors.elevated;
                          }

                          return (
                            <Pressable
                              key={stall.id}
                              accessibilityRole="button"
                              onPress={() => setSelectedStall(stall)}
                              style={[
                                styles.stallCard,
                                {
                                  borderColor: stallBorderColor,
                                  backgroundColor: stallBgColor,
                                },
                              ]}
                            >
                              {/* Top Stall Row */}
                              <View style={styles.stallTopRow}>
                                <Text style={styles.stallCodeText}>
                                  {t("Stall")} {stall.code}
                                </Text>
                                <View
                                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                                >
                                  {stall.hasCamera ? (
                                    <Ionicons
                                      name="videocam-outline"
                                      size={14}
                                      color={colors.mutedForeground}
                                    />
                                  ) : null}
                                  <Ionicons
                                    name="ellipsis-horizontal"
                                    size={14}
                                    color={colors.mutedForeground}
                                  />
                                </View>
                              </View>

                              {/* Center Content: Horse or Vacant Status */}
                              <View style={styles.stallCenterContent}>
                                {assignedHorse ? (
                                  <View style={{ gap: 2 }}>
                                    <Text style={styles.stallHorseName} numberOfLines={1}>
                                      {assignedHorse.name}
                                    </Text>
                                    {renderHealthBadge(assignedHorse.healthStatus)}
                                  </View>
                                ) : (
                                  <View style={{ gap: 2 }}>
                                    <Text
                                      style={[
                                        styles.stallEmptyTitle,
                                        isAvailable && { color: colors.primary },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {isAvailable ? t("Available") : t("Maintenance")}
                                    </Text>
                                    <Text style={uiStyles.muted} numberOfLines={1}>
                                      {formatEnum(stall.type)}
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {/* Bottom Row */}
                              <View style={styles.stallBottomRow}>
                                <View
                                  style={[
                                    styles.stallStatusBadge,
                                    isOccupied && styles.stallStatusBadgeOccupied,
                                    isAvailable && styles.stallStatusBadgeAvailable,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.stallStatusBadgeText,
                                      isOccupied && { color: colors.foreground },
                                      isAvailable && { color: colors.primary },
                                    ]}
                                  >
                                    {isOccupied
                                      ? t("Occupied")
                                      : isAvailable
                                        ? t("Available")
                                        : t("Maintenance")}
                                  </Text>
                                </View>
                                <Ionicons
                                  name="chevron-forward"
                                  size={13}
                                  color={colors.mutedForeground}
                                />
                              </View>
                            </Pressable>
                          );
                        })}

                        {role === "manager" ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("Add stall")}
                            onPress={() => openCreateStallModal(barn)}
                            style={({ pressed }) => [
                              styles.addStallCard,
                              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                            ]}
                          >
                            <View style={styles.addStallContent}>
                              <View style={styles.addStallIconCircle}>
                                <Ionicons name="add" size={22} color={colors.primary} />
                              </View>
                              <Text style={styles.addStallTitle}>{t("Add stall")}</Text>
                              <Text style={styles.addStallSubtitle} numberOfLines={1}>
                                {barn.name}
                              </Text>
                            </View>
                          </Pressable>
                        ) : null}

                        {!barnStalls.length && role !== "manager" ? (
                          <Panel style={{ width: "100%" }}>
                            <Text style={uiStyles.muted}>
                              No stalls are registered in this barn.
                            </Text>
                          </Panel>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : null}
        </>
      ) : (
        /* Care Overview for currentBarn (Step G1: Bảng tổng quan chăm sóc khu theo ngựa) */
        <View style={[uiStyles.section, { gap: space.sm }]}>
          {/* Overview Header row */}
          <View style={styles.careOverviewHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.careOverviewBarnTitle}>
                {currentBarn?.name ?? t("Barn")} · {t("Care overview")}
              </Text>
              <Text style={uiStyles.muted}>
                {t("Checklist, feeding, incidents & groom per horse in this barn")}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Refresh care overview")}
              onPress={() => void loadCareOverview()}
              style={styles.careRefreshBtn}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.primary} />
            </Pressable>
          </View>

          {/* Summary Metric Pills for the Barn's care */}
          <View style={styles.careSummaryMetricsRow}>
            <View style={styles.careSummaryMetricPill}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
              <Text style={styles.careSummaryMetricText}>
                {horsesInCurrentBarn.length} {t("horses")}
              </Text>
            </View>
            <View style={styles.careSummaryMetricPill}>
              <Ionicons name="checkbox-outline" size={14} color={colors.primary} />
              <Text style={styles.careSummaryMetricText}>
                {careCompletedCount}/{horsesInCurrentBarn.length} {t("checklists done")}
              </Text>
            </View>
            <View style={styles.careSummaryMetricPill}>
              <Ionicons
                name="warning-outline"
                size={14}
                color={careIncidentCount > 0 ? colors.destructive : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.careSummaryMetricText,
                  careIncidentCount > 0 && { color: colors.destructive },
                ]}
              >
                {careIncidentCount} {t("incidents")}
              </Text>
            </View>
          </View>

          {/* Loading or Horse List */}
          {loadingCare ? (
            <Panel style={{ paddingVertical: space.lg, alignItems: "center", gap: space.xs }}>
              <Ionicons name="reload-outline" size={24} color={colors.primary} />
              <Text style={uiStyles.muted}>{t("Loading care details...")}</Text>
            </Panel>
          ) : horsesInCurrentBarn.length === 0 ? (
            <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={colors.mutedForeground}
              />
              <Text style={[uiStyles.muted, { marginTop: 4 }]}>
                {t("No horses are currently assigned to this barn.")}
              </Text>
            </Panel>
          ) : (
            <View style={{ gap: space.sm }}>
              {horsesInCurrentBarn.map((horse) => (
                <CareHorseCard
                  key={horse.id}
                  horse={horse}
                  summary={careSummaries[horse.id]}
                  role={role}
                  styles={styles}
                  renderHealthBadge={renderHealthBadge}
                  renderChecklistCareBadge={renderChecklistCareBadge}
                />
              ))}
            </View>
          )}
        </View>
      )}

          <UnassignedHorsesSection
            unassignedTab={unassignedTab}
            setUnassignedTab={setUnassignedTab}
            pendingBarnHorses={pendingBarnHorses}
            pendingStallHorses={pendingStallHorses}
            pendingGroomHorses={pendingGroomHorses}
            totalAwaitingPlacement={totalAwaitingPlacement}
            role={role}
            styles={styles}
            renderHealthBadge={renderHealthBadge}
          />

          <GroomWorkloadSection
            grooms={payload.grooms}
            styles={styles}
          />
        </View>
      ) : null}

      <StallActionModal
        stall={selectedStall}
        onClose={() => setSelectedStall(null)}
        selectedHorseInModal={selectedHorseInModal}
        role={role}
        token={token}
        pendingInCurrentBarn={pendingInCurrentBarn}
        onRefresh={resource.refresh}
        onEditStall={openEditStallModal}
        onStallUpdated={setSelectedStall}
        renderHealthBadge={renderHealthBadge}
      />

      <CreateBarnModal
        visible={showCreateBarnModal}
        onClose={() => setShowCreateBarnModal(false)}
        token={token}
        activeHeadTrainers={activeHeadTrainers}
        onBarnCreated={resource.refresh}
      />

      <CreateStallModal
        visible={showCreateStallModal}
        onClose={() => setShowCreateStallModal(false)}
        targetBarn={targetBarnForStall}
        token={token}
        suggestedCode={newStallCode}
        onStallCreated={resource.refresh}
      />

      <EditBarnModal
        visible={showEditBarnModal}
        onClose={() => setShowEditBarnModal(false)}
        barn={editingBarn}
        token={token}
        activeHeadTrainers={activeHeadTrainers}
        onBarnSaved={resource.refresh}
      />

      <EditStallModal
        visible={showEditStallModal}
        onClose={() => setShowEditStallModal(false)}
        stall={editingStall}
        token={token}
        onStallSaved={resource.refresh}
      />
    </Screen>
  );
}
