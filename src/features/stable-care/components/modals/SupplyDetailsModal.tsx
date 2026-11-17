import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import {
  Field,
  NativeInput,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { radius, space } from "@/config/theme";
import { suppliesService } from "@/services/supplies.service";
import { supplyCategoryLabel, type SupplyItemDto } from "@/adapters/supplies.adapter";
import { formatDateTime, formatQuantity } from "@/utils/formatters";
import { showApiError } from "@/utils/errorHandler";
import type { RoleId } from "@/types/raceos";

export type SupplyDetailsModalProps = {
  role: RoleId;
  token: string;
  item: SupplyItemDto;
  onClose: () => void;
};

export function SupplyDetailsModal({
  role,
  token,
  item,
  onClose,
}: SupplyDetailsModalProps) {
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

const getStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    modalRoot: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: space.lg,
      paddingBottom: space.xl,
      maxHeight: "88%",
      borderWidth: 1,
      borderColor: colors.border,
      gap: space.sm,
    },
    sheetHandle: {
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: space.xs,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingBottom: space.xs,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.foreground,
    },
    sheetSubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    sheetCloseBtn: {
      padding: 4,
    },
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
      fontSize: 12,
      fontWeight: "700",
      color: colors.destructive,
    },
  });

export default SupplyDetailsModal;
