import React, { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { Panel, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { formatEnum } from "@/utils/formatters";
import { extractErrorMessage } from "@/utils/errorHandler";
import { horseService } from "@/services/horse.service";
import { stableService, type StallDto } from "@/services/stable.service";
import type { RoleId } from "@/types/raceos";
import type { HorseListItemDto } from "@/adapters/horse.adapter";

export type StallActionModalProps = {
  stall: StallDto | null;
  onClose: () => void;
  selectedHorseInModal: HorseListItemDto | null | undefined;
  role: RoleId;
  token: string | null;
  pendingInCurrentBarn: HorseListItemDto[];
  onRefresh: () => Promise<unknown>;
  onEditStall: (stall: StallDto) => void;
  onStallUpdated: (stall: StallDto) => void;
  renderHealthBadge: (status: any) => React.ReactNode;
};

export function StallActionModal({
  stall,
  onClose,
  selectedHorseInModal,
  role,
  token,
  pendingInCurrentBarn,
  onRefresh,
  onEditStall,
  onStallUpdated,
  renderHealthBadge,
}: StallActionModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  const [releasingStall, setReleasingStall] = useState(false);

  if (!stall) return null;

  return (
    <Modal
      visible={Boolean(stall)}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <View style={styles.modalHeaderRow}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={styles.modalTitle}>
                {t("Stall")} {stall.code}
              </Text>
              <Text style={uiStyles.muted}>
                {formatEnum(stall.type)}
                {stall.hasCamera ? ` · ${t("Camera monitoring")}` : ""}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Close")}
              onPress={onClose}
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
                {role === "trainer" || role === "manager" ? (
                  <PrimaryButton
                    label="Diet & Feeding"
                    icon="restaurant-outline"
                    onPress={() => {
                      const horseId = selectedHorseInModal.id;
                      onClose();
                      router.push(`/${role}/horse/${horseId}/stable-care` as Href);
                    }}
                  />
                ) : null}
                <SecondaryButton
                  label="Manage stall and Groom"
                  icon="people-outline"
                  onPress={() => {
                    const horseId = selectedHorseInModal.id;
                    onClose();
                    router.push(`/${role}/horse/${horseId}/placement` as Href);
                  }}
                />
                <SecondaryButton
                  label="Open horse profile"
                  icon="open-outline"
                  onPress={() => {
                    const horseId = selectedHorseInModal.id;
                    onClose();
                    router.push(`/${role}/horse/${horseId}` as Href);
                  }}
                />
                {role === "trainer" || role === "manager" ? (
                  <SecondaryButton
                    label={releasingStall ? t("Đang gỡ…") : t("Gỡ khỏi ô")}
                    icon="log-out-outline"
                    disabled={releasingStall}
                    onPress={() => {
                      Alert.alert(
                        t("Gỡ ngựa khỏi ô"),
                        `${t("Bạn có chắc muốn gỡ ngựa")} ${selectedHorseInModal.name} ${t("khỏi ô")} ${stall.code}? ${t("Ngựa sẽ trở về danh sách Chờ xếp ô.")}`,
                        [
                          { text: t("Cancel"), style: "cancel" },
                          {
                            text: t("Gỡ khỏi ô"),
                            style: "destructive",
                            onPress: async () => {
                              setReleasingStall(true);
                              try {
                                await horseService.releaseStall(token!, selectedHorseInModal.id);
                                await onRefresh();
                                onClose();
                                Alert.alert(t("Thành công"), t("Đã gỡ ngựa khỏi ô chuồng."));
                              } catch (err) {
                                Alert.alert(t("Gỡ khỏi ô"), extractErrorMessage(err));
                              } finally {
                                setReleasingStall(false);
                              }
                            },
                          },
                        ],
                      );
                    }}
                  />
                ) : null}
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
                      {stall.status === "AVAILABLE"
                        ? t("Available")
                        : t("Maintenance")}
                    </Text>
                    <Text style={uiStyles.muted}>
                      {stall.status === "AVAILABLE"
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
                          onClose();
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
                      onClose();
                      router.push(`/${role}/horses` as Href);
                    }}
                  />
                </View>
              )}

              {role === "manager" ? (
                <View style={{ gap: space.xs, marginTop: space.sm }}>
                  <SecondaryButton
                    label={t("Sửa thông tin ô")}
                    icon="create-outline"
                    onPress={() => onEditStall(stall)}
                  />
                  {stall.status === "AVAILABLE" ? (
                    <SecondaryButton
                      label={t("Chuyển sang bảo trì")}
                      icon="construct-outline"
                      onPress={async () => {
                        try {
                          const updated = await stableService.updateStall(token!, stall.id, {
                            status: "MAINTENANCE",
                          });
                          await onRefresh();
                          onStallUpdated(updated);
                          Alert.alert(t("Bảo trì ô"), t("Đã chuyển ô chuồng sang trạng thái bảo trì."));
                        } catch (err) {
                          Alert.alert(t("Bảo trì ô"), extractErrorMessage(err));
                        }
                      }}
                    />
                  ) : stall.status === "MAINTENANCE" ? (
                    <SecondaryButton
                      label={t("Kết thúc bảo trì")}
                      icon="checkmark-circle-outline"
                      onPress={async () => {
                        try {
                          const updated = await stableService.updateStall(token!, stall.id, {
                            status: "AVAILABLE",
                          });
                          await onRefresh();
                          onStallUpdated(updated);
                          Alert.alert(t("Kết thúc bảo trì"), t("Ô chuồng đã sẵn sàng đón ngựa."));
                        } catch (err) {
                          Alert.alert(t("Kết thúc bảo trì"), extractErrorMessage(err));
                        }
                      }}
                    />
                  ) : null}
                  <SecondaryButton
                    label={t("Xóa ô chuồng")}
                    icon="trash-outline"
                    onPress={() => {
                      Alert.alert(
                        t("Xóa ô chuồng"),
                        `${t("Bạn có chắc muốn xóa ô chuồng")} ${stall.code}?`,
                        [
                          { text: t("Cancel"), style: "cancel" },
                          {
                            text: t("Delete"),
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await stableService.deleteStall(token!, stall.id);
                                await onRefresh();
                                onClose();
                                Alert.alert(t("Xóa ô chuồng"), t("Đã xóa ô chuồng thành công."));
                              } catch (err) {
                                Alert.alert(t("Xóa ô chuồng"), extractErrorMessage(err));
                              }
                            },
                          },
                        ],
                      );
                    }}
                  />
                </View>
              ) : null}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
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
    subGroupHeader: {
      fontSize: 13,
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
  });

export default StallActionModal;
