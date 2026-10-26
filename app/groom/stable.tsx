import { type Href, router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Panel, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { groomService } from "@/services/groom.service";
import { stableService, type BarnListItemDto, type StallDto } from "@/services/stable.service";
import { horseService, type HorseHealthStatusDto } from "@/services/horse.service";
import type { HorseListItemDto } from "@/adapters/horse.adapter";
import type { GroomTodayDto } from "@/adapters/groom.adapter";
import { formatEnum, formatQuantity } from "@/utils/formatters";
import { radius, space } from "@/config/theme";

type StablePayload = {
  barns: BarnListItemDto[];
  stalls: StallDto[];
  today: GroomTodayDto;
  allHorses: HorseListItemDto[];
};

export default function Stable() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();

  const [activeBarnIndex, setActiveBarnIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const pagerRef = useRef<ScrollViewInstance>(null);

  const loadStable = useCallback(async (): Promise<StablePayload> => {
    const [barns, stalls, today, allHorses] = await Promise.all([
      stableService.listBarns(token!),
      stableService.listStalls(token!),
      groomService.getToday(token!),
      horseService.list(token!),
    ]);
    return { barns, stalls, today, allHorses };
  }, [token]);

  const resource = useApiResource(loadStable, Boolean(token));
  useRefreshOnFocus(resource.revalidate);
  const payload = resource.data;

  // Map horses by location to find which horse is in which stall
  const horseMap = useMemo(() => {
    const map = new Map<string, HorseListItemDto>();
    for (const h of payload?.allHorses ?? []) {
      if (h.location.stall?.code && h.location.barn?.id) {
        map.set(`${h.location.barn.id}:${h.location.stall.code.toLowerCase()}`, h);
      }
    }
    return map;
  }, [payload?.allHorses]);

  // Unassigned horses (Awaiting placement)
  const pendingBarnHorses = useMemo(() => {
    return (payload?.allHorses ?? []).filter((h) => h.location.placementStatus === "PENDING_BARN");
  }, [payload?.allHorses]);

  const pendingStallHorses = useMemo(() => {
    return (payload?.allHorses ?? []).filter((h) => h.location.placementStatus === "PENDING_STALL");
  }, [payload?.allHorses]);

  const totalAwaitingPlacement = pendingBarnHorses.length + pendingStallHorses.length;

  const occupiedCount = payload?.stalls.filter((stall) => stall.status === "OCCUPIED").length ?? 0;

  const currentBarn = payload?.barns[activeBarnIndex];
  const currentBarnStalls = useMemo(() => {
    if (!currentBarn) return [];
    return (payload?.stalls ?? []).filter((s) => s.barnId === currentBarn.id);
  }, [payload?.stalls, currentBarn]);

  // Overview stats for current barn
  const barnMetrics = useMemo(() => {
    const total = currentBarnStalls.length;
    const occupied = currentBarnStalls.filter((s) => s.status === "OCCUPIED").length;
    const vacant = currentBarnStalls.filter((s) => s.status === "AVAILABLE").length;
    const attention = currentBarnStalls.filter((s) => {
      if (s.status !== "OCCUPIED" || !currentBarn) return false;
      const h = horseMap.get(`${currentBarn.id}:${s.code.toLowerCase()}`);
      return (
        h &&
        (h.healthStatus === "UNDER_OBSERVATION" ||
          h.healthStatus === "INJURED" ||
          h.healthStatus === "QUARANTINED")
      );
    }).length;
    return { total, occupied, vacant, attention };
  }, [currentBarnStalls, currentBarn, horseMap]);

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

  return (
    <Screen
      role="groom"
      title="Stable"
      subtitle={
        payload
          ? `${payload.barns.length} barns · ${occupiedCount}/${payload.stalls.length} occupied`
          : "Barn and stall assignments"
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
                          const assignedHorse = horseMap.get(
                            `${barn.id}:${stall.code.toLowerCase()}`,
                          );
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
                              disabled={!assignedHorse}
                              onPress={() =>
                                assignedHorse &&
                                router.push(`/groom/horse/${assignedHorse.id}` as Href)
                              }
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
                                {stall.hasCamera ? (
                                  <Ionicons
                                    name="videocam-outline"
                                    size={14}
                                    color={colors.mutedForeground}
                                  />
                                ) : null}
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
                              </View>
                            </Pressable>
                          );
                        })}

                        {!barnStalls.length ? (
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

          {/* Section: Awaiting Placement / Unassigned Horses */}
          <View style={[uiStyles.section, { marginTop: space.md }]}>
            <View style={uiStyles.row}>
              <SectionTitle>{t("Awaiting placement")}</SectionTitle>
              <View style={styles.pendingCountPill}>
                <Text style={styles.pendingCountPillText}>
                  {totalAwaitingPlacement} {t("horses")}
                </Text>
              </View>
            </View>

            {totalAwaitingPlacement === 0 ? (
              <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
                <Ionicons name="checkmark-circle-outline" size={32} color={colors.primary} />
                <Text style={[uiStyles.muted, { marginTop: 4 }]}>{t("All placed")}</Text>
              </Panel>
            ) : (
              <View style={{ gap: space.sm }}>
                {/* Horses with No Barn */}
                {pendingBarnHorses.length > 0 ? (
                  <View style={{ gap: space.xs }}>
                    <Text style={styles.subGroupHeader}>
                      {t("No barn assigned yet")} ({pendingBarnHorses.length})
                    </Text>
                    {pendingBarnHorses.map((horse) => (
                      <Pressable
                        key={horse.id}
                        accessibilityRole="button"
                        onPress={() => router.push(`/groom/horse/${horse.id}` as Href)}
                        style={styles.unassignedHorseCard}
                      >
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={styles.unassignedHorseName}>{horse.name}</Text>
                          <Text style={uiStyles.muted} numberOfLines={1}>
                            {[horse.breed, horse.gender, horse.microchipId]
                              .filter(Boolean)
                              .join(" · ") || t("No barn assigned")}
                          </Text>
                        </View>
                        {renderHealthBadge(horse.healthStatus)}
                        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {/* Horses with Barn but No Stall */}
                {pendingStallHorses.length > 0 ? (
                  <View style={{ gap: space.xs, marginTop: space.xs }}>
                    <Text style={styles.subGroupHeader}>
                      {t("Barn assigned, waiting for stall")} ({pendingStallHorses.length})
                    </Text>
                    {pendingStallHorses.map((horse) => (
                      <Pressable
                        key={horse.id}
                        accessibilityRole="button"
                        onPress={() => router.push(`/groom/horse/${horse.id}` as Href)}
                        style={styles.unassignedHorseCard}
                      >
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={styles.unassignedHorseName}>{horse.name}</Text>
                          <Text style={uiStyles.muted} numberOfLines={1}>
                            {horse.location.barn?.name ?? t("Barn")}: {t("No stall assigned")}
                          </Text>
                        </View>
                        {renderHealthBadge(horse.healthStatus)}
                        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* Feeding Round Section */}
          <View style={[uiStyles.section, { marginTop: space.md }]}>
            <SectionTitle>Feeding round · {payload.today.date}</SectionTitle>
            {payload.today.horses
              .filter((horse) => horse.feedingPlan?.meals.length)
              .map((horse) => (
                <Panel key={horse.horseId}>
                  <View style={uiStyles.row}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={uiStyles.value} numberOfLines={1}>
                        {horse.horseName}
                      </Text>
                      <Text style={uiStyles.muted} numberOfLines={1}>
                        {[horse.barnName, horse.stallCode].filter(Boolean).join(" · ") ||
                          "Location not assigned"}
                      </Text>
                    </View>
                  </View>
                  {horse.feedingPlan?.meals.map((meal) => (
                    <View key={`${horse.horseId}:${meal.meal}`} style={styles.meal}>
                      <Text style={uiStyles.label}>{meal.meal.replaceAll("_", " ")}</Text>
                      <Text style={uiStyles.muted}>
                        {meal.items
                          .map((item) => `${item.name} ${formatQuantity(item.quantity, item.unit)}`)
                          .join(" · ")}
                      </Text>
                    </View>
                  ))}
                </Panel>
              ))}
            {!payload.today.horses.some((horse) => horse.feedingPlan?.meals.length) ? (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={() => undefined}
                empty
                emptyLabel="No feeding plans are available for your assigned horses."
              />
            ) : null}
          </View>
        </View>
      ) : null}
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
      marginBottom: 2,
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
    meal: {
      gap: 3,
      marginTop: space.md,
      paddingTop: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
