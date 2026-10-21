import { type Href, router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import {
  stableService,
  type BarnListItemDto,
  type GroomWorkloadDto,
  type StallDto,
} from "@/services/stable.service";
import { horseService, type HorseHealthStatusDto } from "@/services/horse.service";
import type { HorseListItemDto } from "@/adapters/horse.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatEnum } from "@/utils/formatters";
import { radius, space } from "@/config/theme";
import type { RoleId } from "@/types/raceos";

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

type StablePayload = {
  barns: BarnListItemDto[];
  stalls: StallDto[];
  horses: HorseListItemDto[];
  grooms: GroomWorkloadDto[];
};

export function StableManagementScreen({ role }: { role: RoleId }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();

  const [activeBarnIndex, setActiveBarnIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  // Selected stall for bottom sheet / modal interaction
  const [selectedStall, setSelectedStall] = useState<StallDto | null>(null);

  // Unassigned tab (Section 4.3): 'barn' = pending barn, 'stall' = pending stall
  const [unassignedTab, setUnassignedTab] = useState<"barn" | "stall">("barn");

  // Create Barn modal state (Section 4.1)
  const [showCreateBarnModal, setShowCreateBarnModal] = useState(false);
  const [newBarnName, setNewBarnName] = useState("");
  const [newBarnCapacity, setNewBarnCapacity] = useState("9");
  const [newBarnDescription, setNewBarnDescription] = useState("");
  const [creatingBarn, setCreatingBarn] = useState(false);

  // Create Stall modal state (Section 4.2)
  const [showCreateStallModal, setShowCreateStallModal] = useState(false);
  const [targetBarnForStall, setTargetBarnForStall] = useState<BarnListItemDto | null>(null);
  const [newStallCode, setNewStallCode] = useState("");
  const [newStallType, setNewStallType] = useState<"STANDARD" | "ISOLATION" | "RECOVERY">(
    "STANDARD",
  );
  const [newStallDescription, setNewStallDescription] = useState("");
  const [newStallHasCamera, setNewStallHasCamera] = useState(false);
  const [creatingStall, setCreatingStall] = useState(false);

  const loadStable = useCallback(async (): Promise<StablePayload> => {
    const [barns, grooms] = await Promise.all([
      stableService.listBarns(token!),
      stableService.listGroomWorkload(token!),
    ]);

    const horses =
      role === "trainer"
        ? await horseService
            .list(token!, "", { myBarns: true })
            .catch(() => horseService.list(token!))
        : await horseService.list(token!);

    // Load stalls for all barns
    let stalls: StallDto[] = [];
    try {
      const stallGroups = await Promise.all(
        barns.map((barn) => stableService.listBarnStalls(token!, barn.id)),
      );
      stalls = stallGroups.flat();
    } catch {
      stalls = await stableService.listStalls(token!).catch(() => []);
    }

    return { barns, stalls, horses, grooms };
  }, [token, role]);

  const resource = useApiResource(loadStable, Boolean(token));
  const payload = resource.data;

  // Map horses by stall ID and by barn:stallCode
  const horseMap = useMemo(() => {
    const map = new Map<string, HorseListItemDto>();
    for (const h of payload?.horses ?? []) {
      if (h.location.stall?.id) {
        map.set(`id:${h.location.stall.id}`, h);
      }
      if (h.location.stall?.code && h.location.barn?.id) {
        map.set(`code:${h.location.barn.id}:${h.location.stall.code.toLowerCase()}`, h);
      }
    }
    return map;
  }, [payload?.horses]);

  const getHorseInStall = useCallback(
    (stall: StallDto, barnId: string): HorseListItemDto | undefined => {
      return (
        horseMap.get(`id:${stall.id}`) ?? horseMap.get(`code:${barnId}:${stall.code.toLowerCase()}`)
      );
    },
    [horseMap],
  );

  // Unassigned horses (Awaiting placement)
  const pendingBarnHorses = useMemo(() => {
    return (payload?.horses ?? []).filter(
      (h) => h.location.placementStatus === "PENDING_BARN" || !h.location.barn,
    );
  }, [payload?.horses]);

  const pendingStallHorses = useMemo(() => {
    return (payload?.horses ?? []).filter(
      (h) =>
        h.location.placementStatus === "PENDING_STALL" ||
        (Boolean(h.location.barn) && !h.location.stall),
    );
  }, [payload?.horses]);

  const totalAwaitingPlacement = pendingBarnHorses.length + pendingStallHorses.length;
  const occupiedCount = payload?.stalls.filter((stall) => stall.status === "OCCUPIED").length ?? 0;

  const currentBarn = payload?.barns[activeBarnIndex];
  const currentBarnStalls = useMemo(() => {
    if (!currentBarn) return [];
    return (payload?.stalls ?? []).filter((s) => s.barnId === currentBarn.id);
  }, [payload?.stalls, currentBarn]);

  // Horses in current barn awaiting stall placement
  const pendingInCurrentBarn = useMemo(() => {
    if (!currentBarn) return [];
    return pendingStallHorses.filter((h) => h.location.barn?.id === currentBarn.id);
  }, [pendingStallHorses, currentBarn]);

  const selectedHorseInModal = useMemo(() => {
    if (!selectedStall || !currentBarn) return undefined;
    return getHorseInStall(selectedStall, currentBarn.id);
  }, [selectedStall, currentBarn, getHorseInStall]);

  // Overview stats for current barn
  const barnMetrics = useMemo(() => {
    const total = currentBarnStalls.length;
    const occupied = currentBarnStalls.filter((s) => {
      if (s.status === "OCCUPIED") return true;
      if (!currentBarn) return false;
      return Boolean(getHorseInStall(s, currentBarn.id));
    }).length;
    const vacant = currentBarnStalls.filter((s) => {
      if (s.status !== "AVAILABLE") return false;
      if (!currentBarn) return true;
      return !getHorseInStall(s, currentBarn.id);
    }).length;
    const attention = currentBarnStalls.filter((s) => {
      if (!currentBarn) return false;
      const h = getHorseInStall(s, currentBarn.id);
      return (
        h &&
        (h.healthStatus === "UNDER_OBSERVATION" ||
          h.healthStatus === "INJURED" ||
          h.healthStatus === "QUARANTINED")
      );
    }).length;
    return { total, occupied, vacant, attention };
  }, [currentBarnStalls, currentBarn, getHorseInStall]);

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

  const openCreateBarnModal = () => {
    setNewBarnName("");
    setNewBarnCapacity("9");
    setNewBarnDescription("");
    setShowCreateBarnModal(true);
  };

  const handleCreateBarn = async () => {
    if (!token || !newBarnName.trim()) return;
    const cap = Number(newBarnCapacity);
    if (newBarnCapacity.trim() && (!Number.isInteger(cap) || cap < 1 || cap > 9)) {
      return Alert.alert(t("Capacity is 1–9 stalls"));
    }
    setCreatingBarn(true);
    try {
      const created = await stableService.createBarn(token, {
        name: newBarnName.trim(),
        capacity: newBarnCapacity.trim() ? cap : 9,
        description: newBarnDescription.trim() || undefined,
      });
      await resource.refresh();
      setShowCreateBarnModal(false);
      Alert.alert(t("Create barn"), `${t("Barn")} ${created.name} ${t("done").toLowerCase()}`);
    } catch (error) {
      Alert.alert(t("Create barn"), extractErrorMessage(error));
    } finally {
      setCreatingBarn(false);
    }
  };

  const openCreateStallModal = (barn: BarnListItemDto) => {
    setTargetBarnForStall(barn);
    const barnStalls = (payload?.stalls ?? []).filter((s) => s.barnId === barn.id);
    const suggested = suggestNextStallCode(barn.name, barnStalls);
    setNewStallCode(suggested);
    setNewStallType("STANDARD");
    setNewStallDescription("");
    setNewStallHasCamera(false);
    setShowCreateStallModal(true);
  };

  const handleCreateStall = async () => {
    if (!token || !targetBarnForStall || !newStallCode.trim()) return;
    setCreatingStall(true);
    try {
      await stableService.createStall(token, {
        barnId: targetBarnForStall.id,
        code: newStallCode.trim(),
        type: newStallType,
        description: newStallDescription.trim() || undefined,
        hasCamera: newStallHasCamera,
      });
      await resource.refresh();
      setShowCreateStallModal(false);
      Alert.alert(
        t("Create stall"),
        `${t("Stall")} ${newStallCode.trim()} ${t("done").toLowerCase()}`,
      );
    } catch (error) {
      Alert.alert(t("Create stall"), extractErrorMessage(error));
    } finally {
      setCreatingStall(false);
    }
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
        <AsyncStateView
          isLoading={false}
          error={null}
          onRetry={() => undefined}
          empty
          emptyLabel="No barns are available."
        />
      ) : null}

      {payload && payload.barns.length > 0 ? (
        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          style={{ gap: space.xl }}
        >
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
                  accessibilityLabel="Add barn"
                  onPress={openCreateBarnModal}
                  style={styles.addBarnTabChip}
                >
                  <Ionicons name="add" size={15} color={colors.primary} />
                  <Text style={styles.addBarnTabChipText}>{t("Add barn")}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>

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
                            accessibilityLabel="Add stall"
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

          {/* Section: Awaiting Placement / Pending Horses */}
          <View style={[uiStyles.section, { marginTop: space.md }]}>
            <View style={uiStyles.row}>
              <SectionTitle>{t("Awaiting placement")}</SectionTitle>
              <View style={styles.pendingCountPill}>
                <Text style={styles.pendingCountPillText}>
                  {totalAwaitingPlacement} {t("horses")}
                </Text>
              </View>
            </View>

            {/* Segmented control to prevent overlap and distinguish placement tiers */}
            <View style={styles.segmentContainer}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setUnassignedTab("barn")}
                style={[styles.segmentBtn, unassignedTab === "barn" && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    unassignedTab === "barn" && styles.segmentBtnTextActive,
                  ]}
                >
                  {t("Awaiting barn")} ({pendingBarnHorses.length})
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setUnassignedTab("stall")}
                style={[styles.segmentBtn, unassignedTab === "stall" && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    unassignedTab === "stall" && styles.segmentBtnTextActive,
                  ]}
                >
                  {t("Awaiting stall")} ({pendingStallHorses.length})
                </Text>
              </Pressable>
            </View>

            {unassignedTab === "barn" ? (
              pendingBarnHorses.length === 0 ? (
                <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
                  <Ionicons name="checkmark-circle-outline" size={28} color={colors.primary} />
                  <Text style={[uiStyles.muted, { marginTop: 4 }]}>
                    {t("All horses assigned to barns")}
                  </Text>
                </Panel>
              ) : (
                <View style={{ gap: space.xs }}>
                  {pendingBarnHorses.map((horse) => (
                    <View key={horse.id} style={styles.unassignedCard}>
                      <View style={styles.unassignedCardHeader}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.unassignedHorseName} numberOfLines={1}>
                            {horse.name}
                          </Text>
                          <Text style={uiStyles.muted} numberOfLines={1}>
                            {[horse.breed, horse.gender, horse.microchipId]
                              .filter(Boolean)
                              .join(" · ") || t("No barn assigned")}
                          </Text>
                        </View>
                        {renderHealthBadge(horse.healthStatus)}
                      </View>
                      <View style={styles.unassignedCardFooter}>
                        <View style={styles.unassignedStatusNote}>
                          <Ionicons name="alert-circle-outline" size={13} color={colors.monitor} />
                          <Text
                            style={[styles.unassignedStatusNoteText, { color: colors.monitor }]}
                          >
                            {t("waiting for barn assignment")}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            router.push(`/${role}/horse/${horse.id}/placement` as Href)
                          }
                          style={styles.unassignedActionBtn}
                        >
                          <Ionicons
                            name="business-outline"
                            size={14}
                            color={colors.primaryForeground}
                          />
                          <Text style={styles.unassignedActionBtnText}>{t("Assign barn")}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )
            ) : pendingStallHorses.length === 0 ? (
              <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
                <Ionicons name="checkmark-circle-outline" size={28} color={colors.primary} />
                <Text style={[uiStyles.muted, { marginTop: 4 }]}>
                  {t("All horses assigned to stalls")}
                </Text>
              </Panel>
            ) : (
              <View style={{ gap: space.xs }}>
                {pendingStallHorses.map((horse) => (
                  <View key={horse.id} style={styles.unassignedCard}>
                    <View style={styles.unassignedCardHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.unassignedHorseName} numberOfLines={1}>
                          {horse.name}
                        </Text>
                        <Text style={uiStyles.muted} numberOfLines={1}>
                          {horse.location.barn?.name ?? t("Barn")}:{" "}
                          {[horse.breed, horse.microchipId].filter(Boolean).join(" · ")}
                        </Text>
                      </View>
                      {renderHealthBadge(horse.healthStatus)}
                    </View>
                    <View style={styles.unassignedCardFooter}>
                      <View style={styles.unassignedStatusNote}>
                        <Ionicons name="home-outline" size={13} color={colors.primary} />
                        <Text style={[styles.unassignedStatusNoteText, { color: colors.primary }]}>
                          {horse.location.barn?.name || t("Barn")} ·{" "}
                          {t("waiting for stall placement")}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push(`/${role}/horse/${horse.id}/placement` as Href)}
                        style={styles.unassignedActionBtn}
                      >
                        <Ionicons
                          name="checkmark-outline"
                          size={14}
                          color={colors.primaryForeground}
                        />
                        <Text style={styles.unassignedActionBtnText}>{t("Assign stall")}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Section: Groom Workload (for Trainer and Manager) */}
          <View style={[uiStyles.section, { marginTop: space.md }]}>
            <SectionTitle>Groom workload</SectionTitle>
            {payload.grooms.length ? (
              payload.grooms.map((groom) => (
                <Panel key={groom.groomId}>
                  <View style={uiStyles.row}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[uiStyles.value, { fontSize: 16 }]} numberOfLines={1}>
                        {groom.fullName}
                      </Text>
                      <Text style={uiStyles.muted} numberOfLines={1}>
                        {t("Groom workload")}
                      </Text>
                    </View>
                    <View style={styles.groomBadge}>
                      <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
                      <Text style={styles.groomBadgeText}>
                        {groom.activeHorseCount} {t("active horses")}
                      </Text>
                    </View>
                  </View>
                </Panel>
              ))
            ) : (
              <Text style={uiStyles.muted}>No active Grooms are available for assignment.</Text>
            )}
          </View>
        </View>
      ) : null}

      {/* Interactive Stall Action Modal for Trainer & Manager */}
      <Modal
        visible={Boolean(selectedStall)}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedStall(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedStall(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {selectedStall ? (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeaderRow}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.modalTitle}>
                      {t("Stall")} {selectedStall.code}
                    </Text>
                    <Text style={uiStyles.muted}>
                      {formatEnum(selectedStall.type)}
                      {selectedStall.hasCamera ? ` · ${t("Camera monitoring")}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    onPress={() => setSelectedStall(null)}
                    style={styles.modalCloseBtn}
                  >
                    <Ionicons name="close" size={20} color={colors.foreground} />
                  </Pressable>
                </View>

                {/* If stall is occupied by a horse */}
                {selectedHorseInModal ? (
                  <View style={{ gap: space.sm }}>
                    <View style={styles.modalHorseCard}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.modalHorseName}>{selectedHorseInModal.name}</Text>
                          <Text style={uiStyles.muted}>
                            {[
                              selectedHorseInModal.breed,
                              selectedHorseInModal.gender,
                              selectedHorseInModal.microchipId,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </View>
                        {renderHealthBadge(selectedHorseInModal.healthStatus)}
                      </View>

                      <View style={styles.modalHorseInfoRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={uiStyles.muted}>Aptitude</Text>
                          <Text style={[uiStyles.value, { fontSize: 14 }]}>
                            {selectedHorseInModal.raceAptitude
                              ? formatEnum(selectedHorseInModal.raceAptitude)
                              : "—"}
                          </Text>
                        </View>
                        {selectedHorseInModal.lifecycleStatus ? (
                          <View style={{ flex: 1 }}>
                            <Text style={uiStyles.muted}>Status</Text>
                            <Text style={[uiStyles.value, { fontSize: 14 }]}>
                              {formatEnum(selectedHorseInModal.lifecycleStatus)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Action buttons */}
                    <View style={{ gap: space.xs, marginTop: space.xs }}>
                      <PrimaryButton
                        label="Manage stall and Groom"
                        icon="people-outline"
                        onPress={() => {
                          const horseId = selectedHorseInModal.id;
                          setSelectedStall(null);
                          router.push(`/${role}/horse/${horseId}/placement` as Href);
                        }}
                      />
                      <SecondaryButton
                        label="Open horse profile"
                        icon="open-outline"
                        onPress={() => {
                          const horseId = selectedHorseInModal.id;
                          setSelectedStall(null);
                          router.push(`/${role}/horse/${horseId}` as Href);
                        }}
                      />
                    </View>
                  </View>
                ) : (
                  /* If stall is available / vacant */
                  <View style={{ gap: space.sm }}>
                    <Panel style={{ backgroundColor: colors.fitSoft, borderColor: colors.fit }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.fit} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.fit }}>
                            {selectedStall.status === "AVAILABLE"
                              ? t("Available")
                              : t("Maintenance")}
                          </Text>
                          <Text style={uiStyles.muted}>
                            {selectedStall.status === "AVAILABLE"
                              ? "Ready for horse assignment"
                              : "This stall is unavailable during maintenance."}
                          </Text>
                        </View>
                      </View>
                    </Panel>

                    {/* Pending horses in this barn available to be placed */}
                    {pendingInCurrentBarn.length > 0 ? (
                      <View style={{ gap: space.xs }}>
                        <Text style={styles.subGroupHeader}>
                          {t("Barn assigned, waiting for stall")} ({pendingInCurrentBarn.length})
                        </Text>
                        {pendingInCurrentBarn.map((pendingHorse) => (
                          <View key={pendingHorse.id} style={styles.unassignedHorseCard}>
                            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                              <Text style={styles.unassignedHorseName}>{pendingHorse.name}</Text>
                              <Text style={uiStyles.muted} numberOfLines={1}>
                                {pendingHorse.breed ?? "Horse"}
                              </Text>
                            </View>
                            <PrimaryButton
                              label="Assign stall and Groom"
                              icon="checkmark-outline"
                              onPress={() => {
                                setSelectedStall(null);
                                router.push(`/${role}/horse/${pendingHorse.id}/placement` as Href);
                              }}
                              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
                            />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={{ paddingVertical: space.sm }}>
                        <Text
                          style={[uiStyles.muted, { textAlign: "center", marginBottom: space.sm }]}
                        >
                          No horses are currently waiting for a stall in this barn.
                        </Text>
                        <SecondaryButton
                          label="View all horses"
                          icon="grid-outline"
                          onPress={() => {
                            setSelectedStall(null);
                            router.push(`/${role}/horses` as Href);
                          }}
                        />
                      </View>
                    )}
                  </View>
                )}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      {/* Modal: Create Barn (Section 4.1) */}
      <Modal
        visible={showCreateBarnModal}
        animationType="fade"
        transparent
        onRequestClose={() => !creatingBarn && setShowCreateBarnModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !creatingBarn && setShowCreateBarnModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>{t("Create barn")}</Text>
                <Text style={uiStyles.muted}>{t("Add a new barn zone")}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                disabled={creatingBarn}
                onPress={() => setShowCreateBarnModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={{ gap: space.md }}>
              <Field label={t("Barn name")}>
                <NativeInput
                  value={newBarnName}
                  onChangeText={setNewBarnName}
                  placeholder={t("e.g. Barn D")}
                />
              </Field>

              <Field label={t("Capacity (max stalls)")}>
                <NativeInput
                  value={newBarnCapacity}
                  onChangeText={setNewBarnCapacity}
                  placeholder={t("1–9 stalls (default is 9)")}
                  keyboardType="numeric"
                />
              </Field>

              <Field label={t("Description")}>
                <NativeInput
                  value={newBarnDescription}
                  onChangeText={setNewBarnDescription}
                  placeholder={t("Location, facilities…")}
                  multiline
                />
              </Field>

              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <PrimaryButton
                  label={creatingBarn ? t("Creating…") : t("Create barn")}
                  icon="add"
                  disabled={creatingBarn || !newBarnName.trim()}
                  onPress={() => void handleCreateBarn()}
                />
                <SecondaryButton
                  label={t("Cancel")}
                  disabled={creatingBarn}
                  onPress={() => setShowCreateBarnModal(false)}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Create Stall (Section 4.2) */}
      <Modal
        visible={showCreateStallModal}
        animationType="fade"
        transparent
        onRequestClose={() => !creatingStall && setShowCreateStallModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !creatingStall && setShowCreateStallModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>{t("Create stall")}</Text>
                <Text style={uiStyles.muted}>
                  {t("Add stall to")} {targetBarnForStall?.name}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                disabled={creatingStall}
                onPress={() => setShowCreateStallModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={{ gap: space.md }}>
              <Field label={t("Stall code")}>
                <NativeInput
                  value={newStallCode}
                  onChangeText={setNewStallCode}
                  placeholder="A-01"
                />
              </Field>

              <Field label={t("Stall type")}>
                <Chips
                  options={["STANDARD", "ISOLATION", "RECOVERY"]}
                  value={newStallType}
                  onChange={(val) => setNewStallType(val as any)}
                />
              </Field>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.switchTitle}>{t("Stall has surveillance camera")}</Text>
                  <Text style={uiStyles.muted}>{t("New stalls are available by default")}</Text>
                </View>
                <Switch
                  value={newStallHasCamera}
                  onValueChange={setNewStallHasCamera}
                  disabled={creatingStall}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <Field label={t("Description")}>
                <NativeInput
                  value={newStallDescription}
                  onChangeText={setNewStallDescription}
                  placeholder={t("Notes, camera angle…")}
                  multiline
                />
              </Field>

              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <PrimaryButton
                  label={creatingStall ? t("Creating…") : t("Create stall")}
                  icon="add"
                  disabled={creatingStall || !newStallCode.trim()}
                  onPress={() => void handleCreateStall()}
                />
                <SecondaryButton
                  label={t("Cancel")}
                  disabled={creatingStall}
                  onPress={() => setShowCreateStallModal(false)}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    barnSelectorContainer: {
      marginBottom: space.xs,
    },
    barnSelectorScroll: {
      gap: space.xs,
      paddingVertical: space.xs,
    },
    barnTabChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: space.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    barnTabChipActive: {
      backgroundColor: colors.fitSoft,
      borderColor: colors.primary,
    },
    barnTabChipText: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.foreground,
    },
    barnTabChipTextActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    swipeHintRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      marginBottom: space.sm,
    },
    swipeHintText: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: "500",
    },
    metricGrid: {
      flexDirection: "row",
      gap: space.xs,
      marginBottom: space.md,
    },
    metricCard: {
      flex: 1,
      alignItems: "center",
      paddingVertical: space.sm,
      paddingHorizontal: space.xs,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 2,
    },
    metricValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
    },
    metricLabel: {
      fontSize: 10,
      color: colors.mutedForeground,
      textAlign: "center",
      fontWeight: "600",
    },
    barnHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
      marginBottom: space.xs,
    },
    barnTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.foreground,
    },
    barnTrainerText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    barnAvailableBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    barnAvailableBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    stallsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.sm,
      marginTop: space.xs,
    },
    stallCard: {
      width: "48%",
      minHeight: 126,
      justifyContent: "space-between",
      padding: space.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      gap: space.xs,
    },
    stallTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    stallCodeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.mutedForeground,
    },
    stallCenterContent: {
      flex: 1,
      justifyContent: "center",
      paddingVertical: space.xs,
    },
    stallHorseName: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.foreground,
    },
    stallEmptyTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    stallBottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    stallStatusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: colors.muted,
    },
    stallStatusBadgeOccupied: {
      backgroundColor: colors.surface,
    },
    stallStatusBadgeAvailable: {
      backgroundColor: colors.fitSoft,
    },
    stallStatusBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    healthBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      alignSelf: "flex-start",
      marginTop: 2,
    },
    healthBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    pendingCountPill: {
      paddingHorizontal: space.sm,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.monitorSoft,
    },
    pendingCountPillText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.monitor,
    },
    subGroupHeader: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    unassignedHorseCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    unassignedHorseName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    groomBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
    },
    groomBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: space.lg,
      paddingBottom: space.xl,
      gap: space.md,
      maxHeight: "85%",
    },
    modalHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingBottom: space.sm,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.foreground,
    },
    modalCloseBtn: {
      padding: 4,
    },
    modalHorseCard: {
      padding: space.md,
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      gap: space.sm,
    },
    modalHorseName: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.foreground,
    },
    modalHorseInfoRow: {
      flexDirection: "row",
      gap: space.md,
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    addBarnTabChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: space.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: "dashed",
      backgroundColor: colors.surface,
    },
    addBarnTabChipText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    addStallCard: {
      width: "48%",
      minHeight: 126,
      justifyContent: "center",
      alignItems: "center",
      padding: space.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.primary,
      backgroundColor: colors.fitSoft,
    },
    addStallContent: {
      alignItems: "center",
      gap: 4,
    },
    addStallIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.primary,
      marginBottom: 2,
    },
    addStallTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
      textAlign: "center",
    },
    addStallSubtitle: {
      fontSize: 11,
      color: colors.mutedForeground,
      textAlign: "center",
    },
    segmentContainer: {
      flexDirection: "row",
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      padding: 3,
      gap: 4,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
    },
    segmentBtnActive: {
      backgroundColor: colors.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    segmentBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    segmentBtnTextActive: {
      color: colors.foreground,
      fontWeight: "700",
    },
    unassignedCard: {
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: space.sm,
    },
    unassignedCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    unassignedCardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: space.sm,
    },
    unassignedStatusNote: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    unassignedStatusNoteText: {
      fontSize: 12,
      fontWeight: "600",
    },
    unassignedActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.sm,
    },
    unassignedActionBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primaryForeground,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: space.xs,
      gap: space.md,
    },
    switchTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
    },
  });
