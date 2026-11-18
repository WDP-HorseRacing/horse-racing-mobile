import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { SectionTitle } from "@/components/common";
import { Chips, Field, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { formatEnum, formatWeight } from "@/utils/formatters";
import { formatToDdMmYyyy } from "@/utils/horse-validation";
import { extractErrorMessage } from "@/utils/errorHandler";
import { horseService } from "@/services/horse.service";
import type { RoleId } from "@/types/raceos";
import { Info } from "./HorseTabHelpers";

export type HorseOverviewTabProps = {
  roleId: RoleId;
  horseData: any;
  token: string | null;
  pedigreeResource: {
    isLoading: boolean;
    error: unknown;
    data: any;
    retry: () => void | Promise<unknown>;
  };
  permissionsResource: {
    data?: {
      canAssignBarn?: boolean;
      canAssignStallAndGroom?: boolean;
      canEditProfile?: boolean;
      canChangeLifecycle?: boolean;
      canDelete?: boolean;
      canRestore?: boolean;
      canEditRaceAptitude?: boolean;
    } | null;
  };
  onHorseRefresh: () => Promise<unknown>;
};

export function HorseOverviewTab({
  roleId,
  horseData,
  token,
  pedigreeResource,
  permissionsResource,
  onHorseRefresh,
}: HorseOverviewTabProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  const [raceAptitudeDraft, setRaceAptitudeDraft] = useState<string | null>(null);
  const [savingAptitude, setSavingAptitude] = useState(false);

  const raceAptitudeValue = raceAptitudeDraft ?? horseData?.raceAptitude ?? "";
  const latestWeight = horseData?.latestMeasurements?.find(
    (measurement: { type: string; value: number }) => measurement.type === "WEIGHT",
  )?.value;

  const saveDistanceFocus = async () => {
    if (!token || !horseData || !raceAptitudeValue || savingAptitude) return;
    setSavingAptitude(true);
    try {
      await horseService.update(token, horseData.id, {
        version: horseData.version,
        raceAptitude: raceAptitudeValue as "SPRINTER" | "MILER" | "STAYER",
      });
      setRaceAptitudeDraft(null);
      await onHorseRefresh();
      Alert.alert("Distance focus updated", "Horse profile has been refreshed.");
    } catch (error) {
      Alert.alert("Could not update distance focus", extractErrorMessage(error));
    } finally {
      setSavingAptitude(false);
    }
  };

  return (
    <>
      {horseData.isDeleted ? (
        <Panel>
          <Text>This profile is soft deleted and read-only until restored.</Text>
        </Panel>
      ) : null}
      <Info
        title="Horse profile"
        items={[
          ["Health status", formatEnum(t(horseData.healthStatus))],
          ["Lifecycle", formatEnum(t(horseData.lifecycleStatus))],
          [
            "Gender",
            horseData.gender
              ? formatEnum(t(horseData.gender))
              : t("Not recorded"),
          ],
          [
            "Breed",
            horseData.breed
              ? formatEnum(t(horseData.breed))
              : t("Not recorded"),
          ],
          [
            "Color",
            horseData.color
              ? formatEnum(t(horseData.color))
              : t("Not recorded"),
          ],
          ["Microchip", horseData.microchipId ?? t("Not recorded")],
          [
            "Date of birth",
            horseData.dateOfBirth
              ? formatToDdMmYyyy(horseData.dateOfBirth)
              : t("Not recorded"),
          ],
          ["Owner", horseData.owner?.fullName ?? t("Unassigned")],
          ["Barn", horseData.location?.barn?.name ?? t("Not assigned")],
          ["Stall", horseData.location?.stall?.code ?? t("Not assigned")],
          ["Groom", horseData.groom?.fullName ?? t("Not assigned")],
          [
            "Distance focus",
            horseData.raceAptitude
              ? formatEnum(t(horseData.raceAptitude))
              : t("Not recorded"),
          ],
          ["Latest weight", latestWeight != null ? formatWeight(latestWeight) : t("Not recorded")],
          [
            "Lifecycle reason",
            horseData.lifecycleReason
              ? formatEnum(horseData.lifecycleReason)
              : "—",
          ],
        ]}
      />

      {/* Inlined full Pedigree info */}
      <Panel style={{ gap: space.md }}>
        <SectionTitle>{t("Pedigree information")}</SectionTitle>
        <View style={styles.pedigreeSection}>
          {(() => {
            const ancestors: any[] = pedigreeResource.data?.ancestors ?? [];
            const sire = ancestors.find(
              (a) => a.generation === 1 && a.parentRole === "SIRE",
            );
            const dam = ancestors.find((a) => a.generation === 1 && a.parentRole === "DAM");
            const paternalGrandsire = ancestors.find(
              (a) =>
                a.generation === 2 && a.childId === sire?.id && a.parentRole === "SIRE",
            );
            const paternalGranddam = ancestors.find(
              (a) => a.generation === 2 && a.childId === sire?.id && a.parentRole === "DAM",
            );
            const maternalGrandsire = ancestors.find(
              (a) => a.generation === 2 && a.childId === dam?.id && a.parentRole === "SIRE",
            );
            const maternalGranddam = ancestors.find(
              (a) => a.generation === 2 && a.childId === dam?.id && a.parentRole === "DAM",
            );
            const hasGrandparents = Boolean(
              paternalGrandsire ||
              paternalGranddam ||
              maternalGrandsire ||
              maternalGranddam,
            );
            return (
              <View style={{ gap: space.md, width: "100%" }}>
                <View style={styles.pedigreeRow}>
                  <View style={styles.pedigreeCard}>
                    <Text style={uiStyles.label}>{t("Sire")}</Text>
                    {sire ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={!sire.canOpen}
                        onPress={() =>
                          sire.canOpen && router.push(`/${roleId}/horse/${sire.id}` as Href)
                        }
                      >
                        <Text
                          style={[
                            uiStyles.value,
                            sire.canOpen && {
                              color: colors.primary,
                              textDecorationLine: "underline",
                            },
                          ]}
                        >
                          {sire.name}
                        </Text>
                        <Text style={uiStyles.muted}>
                          {[sire.breed, sire.color].filter(Boolean).join(" · ") ||
                            t("Registered horse")}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={uiStyles.muted}>{t("No sire profile recorded")}</Text>
                    )}
                  </View>
                  <View style={styles.pedigreeCard}>
                    <Text style={uiStyles.label}>{t("Dam")}</Text>
                    {dam ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={!dam.canOpen}
                        onPress={() =>
                          dam.canOpen && router.push(`/${roleId}/horse/${dam.id}` as Href)
                        }
                      >
                        <Text
                          style={[
                            uiStyles.value,
                            dam.canOpen && {
                              color: colors.primary,
                              textDecorationLine: "underline",
                            },
                          ]}
                        >
                          {dam.name}
                        </Text>
                        <Text style={uiStyles.muted}>
                          {[dam.breed, dam.color].filter(Boolean).join(" · ") ||
                            t("Registered horse")}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={uiStyles.muted}>{t("No dam profile recorded")}</Text>
                    )}
                  </View>
                </View>
                {hasGrandparents ? (
                  <View style={{ gap: space.xs, marginTop: 4 }}>
                    <Text style={[uiStyles.label, { fontSize: 12 }]}>
                      {t("Grandparents")}
                    </Text>
                    <View style={styles.grandparentsGrid}>
                      {paternalGrandsire ? (
                        <View style={styles.grandparentItem}>
                          <Text style={styles.gpRole}>{t("Paternal grandsire")}</Text>
                          <Text style={styles.gpName}>{paternalGrandsire.name}</Text>
                        </View>
                      ) : null}
                      {paternalGranddam ? (
                        <View style={styles.grandparentItem}>
                          <Text style={styles.gpRole}>{t("Paternal granddam")}</Text>
                          <Text style={styles.gpName}>{paternalGranddam.name}</Text>
                        </View>
                      ) : null}
                      {maternalGrandsire ? (
                        <View style={styles.grandparentItem}>
                          <Text style={styles.gpRole}>{t("Maternal grandsire")}</Text>
                          <Text style={styles.gpName}>{maternalGrandsire.name}</Text>
                        </View>
                      ) : null}
                      {maternalGranddam ? (
                        <View style={styles.grandparentItem}>
                          <Text style={styles.gpRole}>{t("Maternal granddam")}</Text>
                          <Text style={styles.gpName}>{maternalGranddam.name}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })()}
        </View>
      </Panel>
      <AsyncStateView
        isLoading={pedigreeResource.isLoading}
        error={pedigreeResource.error}
        onRetry={() => void pedigreeResource.retry()}
      />
      <Panel style={{ gap: space.xs }}>
        <SectionTitle>Eligibility</SectionTitle>
        <Text style={uiStyles.value}>
          Training:{" "}
          <Text
            style={{
              color: horseData.eligibility.trainingEligible
                ? colors.fit
                : colors.injured,
              fontWeight: "700",
            }}
          >
            {horseData.eligibility.trainingEligible ? "Eligible" : "Restricted"}
          </Text>
        </Text>
        {horseData.eligibility.trainingReasons.map((reason: string) => (
          <Text
            key={`training-${reason}`}
            style={[uiStyles.muted, { color: colors.mutedForeground }]}
          >
            • {formatEnum(t(reason))}
          </Text>
        ))}
      </Panel>

      {/* Profile Management Actions Grid */}
      <View style={[uiStyles.section, { marginTop: space.sm }]}>
        <SectionTitle>Quản lý & Tác vụ hồ sơ</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {/* Ownership history */}
          <Pressable
            onPress={() => router.push(`/${roleId}/horse/${horseData.id}/ownership` as Href)}
            style={styles.actionGridTile}
          >
            <View style={[styles.actionGridIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
              <Ionicons name="people-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.actionGridTitle}>Lịch sử sở hữu</Text>
              <Text style={styles.actionGridSubtitle} numberOfLines={1}>
                Xem hợp đồng & chủ sở hữu
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>

          {/* Manage barn, stall & Groom */}
          {((permissionsResource.data?.canAssignBarn && roleId === "manager") ||
            (permissionsResource.data?.canAssignStallAndGroom && roleId === "trainer")) &&
          !horseData.isDeleted ? (
            <Pressable
              onPress={() => router.push(`/${roleId}/horse/${horseData.id}/placement` as Href)}
              style={styles.actionGridTile}
            >
              <View style={[styles.actionGridIconWrap, { backgroundColor: "rgba(59, 130, 246, 0.12)" }]}>
                <Ionicons name="business-outline" size={20} color="#3B82F6" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.actionGridTitle}>Chuồng, ô & Groom</Text>
                <Text style={styles.actionGridSubtitle} numberOfLines={1}>
                  Phân công vị trí & nhân sự
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}

          {/* Edit profile */}
          {permissionsResource.data?.canEditProfile &&
          roleId === "manager" &&
          !horseData.isDeleted ? (
            <Pressable
              onPress={() => router.push(`/manager/edit-horse/${horseData.id}` as Href)}
              style={styles.actionGridTile}
            >
              <View style={[styles.actionGridIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                <Ionicons name="create-outline" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.actionGridTitle}>Chỉnh sửa hồ sơ</Text>
                <Text style={styles.actionGridSubtitle} numberOfLines={1}>
                  Cập nhật thông tin & đặc điểm
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}

          {/* Lifecycle, delete or restore */}
          {roleId === "manager" &&
          (permissionsResource.data?.canChangeLifecycle ||
            permissionsResource.data?.canDelete ||
            permissionsResource.data?.canRestore) ? (
            <Pressable
              onPress={() => router.push(`/manager/lifecycle/${horseData.id}` as Href)}
              style={styles.actionGridTile}
            >
              <View style={[styles.actionGridIconWrap, { backgroundColor: "rgba(139, 92, 246, 0.12)" }]}>
                <Ionicons name="repeat-outline" size={20} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.actionGridTitle}>Vòng đời & Khôi phục</Text>
                <Text style={styles.actionGridSubtitle} numberOfLines={1}>
                  Trạng thái hoạt động, giải nghệ
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {permissionsResource.data?.canEditRaceAptitude && !horseData.isDeleted ? (
        <Panel style={{ gap: space.md }}>
          <Field label="Distance focus · Head Trainer">
            <Chips
              options={["SPRINTER", "MILER", "STAYER"]}
              value={raceAptitudeValue}
              onChange={setRaceAptitudeDraft}
            />
          </Field>
          <PrimaryButton
            style={{ marginTop: space.xs }}
            label={savingAptitude ? t("Saving…") : t("Save distance focus")}
            icon="checkmark"
            disabled={savingAptitude || !raceAptitudeValue}
            onPress={() => void saveDistanceFocus()}
          />
        </Panel>
      ) : null}
    </>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    pedigreeSection: { width: "100%", gap: space.sm },
    pedigreeRow: { flexDirection: "row", gap: space.md },
    pedigreeCard: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: 4,
    },
    grandparentsGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
    grandparentItem: {
      width: "48%",
      minWidth: 0,
      backgroundColor: colors.elevated,
      borderRadius: radius.sm,
      padding: space.sm,
      gap: 2,
    },
    gpRole: { fontSize: 11, color: colors.mutedForeground, fontWeight: "600" },
    gpName: { fontSize: 13, color: colors.foreground, fontWeight: "700" },
    actionGridTile: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.sm,
      width: "100%",
    },
    actionGridIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    actionGridTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    actionGridSubtitle: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 2,
    },
  });
