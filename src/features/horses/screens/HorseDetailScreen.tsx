import { type Href, Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-gifted-charts";
import { Text } from "@/components/common/LocalizedText";
import { fitnessTrend, getHorse, recoveryTrend, speedTrend } from "@/lib/raceos-data";
import type { RoleId } from "@/lib/raceos-data";
import { useRaceOS } from "@/context/RaceOSContext";
import {
  Chips,
  Field,
  MiniChart,
  ProgressBar,
  NativeInput,
  Panel,
  PrimaryButton,
  getUiStyles,
} from "@/components/ui";
import { KeyValue, TimelineItem, Screen, SectionTitle } from "@/components/common";
import { isRole } from "@/features/auth/roles";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { trainingService } from "@/services/training.service";
import {
  formatDateTime,
  formatDistance,
  formatDurationMs,
  formatEnum,
  formatWeight,
} from "@/utils/formatters";
import { horseService } from "@/services/horse.service";
import { mapHorseDetailToPrototype } from "@/adapters/horse.adapter";
import { medicalService } from "@/services/medical.service";
import type { HealthStatusDto } from "@/services/medical.service";
import { isValidRequiredText } from "@/features/medical/medical-validation";
import { performanceService } from "@/services/performance.service";
import { auditService } from "@/services/audit.service";
import { stableCareService } from "@/services/stable-care.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatToDdMmYyyy } from "@/utils/horse-validation";
import { HorseMeasurementsView } from "@/features/horses/components/HorseMeasurementsView";

const tabsByRole: Record<RoleId, string[]> = {
  trainer: ["Overview", "Training", "Health", "Medical", "Nutrition", "Performance"],
  vet: ["Overview", "Training", "Health", "Medical", "Nutrition", "Injuries", "Treatment"],
  groom: ["Overview", "Nutrition"],
  owner: ["Overview", "Training", "Health", "Medical", "Nutrition", "Performance", "Costs"],
  manager: ["Overview", "Health", "Medical", "Nutrition", "Performance", "Costs", "Timeline"],
};

export function HorseDetailScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const {
    role,
    id,
    tab: requestedTab,
  } = useLocalSearchParams<{ role: string; id: string; tab?: string }>();
  const roleId: RoleId = isRole(role) ? role : "trainer";
  const requestedTabValue = Array.isArray(requestedTab) ? requestedTab[0] : requestedTab;
  const raceOS = useRaceOS();
  const [raceAptitudeDraft, setRaceAptitudeDraft] = useState<string | null>(null);
  const [savingAptitude, setSavingAptitude] = useState(false);
  const [healthStatusDraft, setHealthStatusDraft] = useState("");
  const [healthReason, setHealthReason] = useState("");
  const [savingHealth, setSavingHealth] = useState(false);
  const [tab, setTab] = useState(() =>
    requestedTabValue && tabsByRole[roleId].includes(requestedTabValue)
      ? requestedTabValue
      : tabsByRole[roleId][0],
  );
  const { plans, lockedHorseIds } = raceOS;
  const { token } = useAuth();
  const loadHorse = useCallback(() => horseService.get(token!, id), [id, token]);
  const horseResource = useApiResource(loadHorse, Boolean(token) && isUuid(id));
  const loadPermissions = useCallback(() => horseService.getPermissions(token!, id), [id, token]);
  const permissionsResource = useApiResource(loadPermissions, Boolean(token) && isUuid(id));
  const tabs = useMemo(() => {
    const base = tabsByRole[roleId];
    if (!isUuid(id) || !permissionsResource.data) return base;
    return base.filter((item) => {
      if (["Health", "Medical", "Injuries", "Treatment"].includes(item))
        return permissionsResource.data?.canViewMedicalTab === true;
      if (item === "Nutrition") return true;
      if (item === "Performance") return permissionsResource.data?.canViewPerformanceTab === true;
      if (item === "Training") return permissionsResource.data?.canViewTrainingTab === true;
      if (item === "Costs") return permissionsResource.data?.canViewMedicalTab === true;
      return true;
    });
  }, [id, permissionsResource.data, roleId]);
  const visibleTab = tabs.includes(tab) ? tab : (tabs[0] ?? "Overview");
  const raceAptitudeValue = raceAptitudeDraft ?? horseResource.data?.raceAptitude ?? "MILER";
  const loadPedigree = useCallback(() => horseService.getPedigree(token!, id), [id, token]);
  const pedigreeResource = useApiResource(
    loadPedigree,
    Boolean(token) && isUuid(id) && visibleTab === "Overview",
  );
  const loadPhoto = useCallback(() => horseService.getPhotoUrl(token!, id), [id, token]);
  const photoResource = useApiResource(
    loadPhoto,
    Boolean(token && isUuid(id) && horseResource.data?.mediaId),
  );
  const loadHorseSessions = useCallback(
    () => trainingService.listHorseSessions(token!, id),
    [id, token],
  );
  const trainingResource = useApiResource(
    loadHorseSessions,
    Boolean(
      token &&
      isUuid(id) &&
      permissionsResource.data?.canViewTrainingTab &&
      visibleTab === "Training",
    ),
  );
  const loadMedicalData = useCallback(async () => {
    const [cases, records, injuries, healthHistory, locks, careSchedules] = await Promise.all([
      medicalService.listHorseCases(token!, id),
      medicalService.listHorseRecords(token!, id),
      medicalService.listInjuries(token!, id),
      medicalService.listHealthHistory(token!, id),
      medicalService.listTrainingLocks(token!, id),
      medicalService.listCareSchedules(token!, id),
    ]);
    return { cases, records, injuries, healthHistory, locks, careSchedules };
  }, [id, token]);
  const medicalResource = useApiResource(
    loadMedicalData,
    Boolean(
      token &&
      isUuid(id) &&
      permissionsResource.data?.canViewMedicalTab &&
      (visibleTab === "Health" ||
        visibleTab === "Medical" ||
        visibleTab === "Injuries" ||
        visibleTab === "Treatment" ||
        visibleTab === "Costs"),
    ),
  );
  const loadSurcharges = useCallback(
    () => stableCareService.listSurcharges(token!, id),
    [id, token],
  );
  const surchargesResource = useApiResource(
    loadSurcharges,
    Boolean(
      token &&
        isUuid(id) &&
        ["manager", "owner", "trainer"].includes(roleId) &&
        (visibleTab === "Costs" || visibleTab === "Nutrition"),
    ),
  );
  const loadPerformanceData = useCallback(async () => {
    const [sessions, workload] = await Promise.all([
      performanceService.listHorseSessions(token!, id),
      performanceService.getHorseWorkload(token!, id),
    ]);
    if (roleId === "owner")
      return { summary: null, sessions, workload, thresholds: null, alerts: [] };
    const [summary, thresholds, alertPage] = await Promise.all([
      performanceService.getHorseSummary(token!, id),
      performanceService.getThresholds(token!, id),
      performanceService.listHorseAlerts(token!, id, { page: 1, limit: 20 }),
    ]);
    return { summary, sessions, workload, thresholds, alerts: alertPage.items };
  }, [id, roleId, token]);
  const performanceResource = useApiResource(
    loadPerformanceData,
    Boolean(
      token &&
      isUuid(id) &&
      permissionsResource.data?.canViewPerformanceTab &&
      visibleTab === "Performance",
    ),
  );
  const loadCareInstructions = useCallback(
    () => medicalService.getCareInstructions(token!, id),
    [id, token],
  );
  const careResource = useApiResource(
    loadCareInstructions,
    Boolean(token && isUuid(id) && visibleTab === "Care"),
  );
  const loadAuditLog = useCallback(
    () => auditService.list(token!, 20, { entityId: id }),
    [id, token],
  );
  const auditResource = useApiResource(
    loadAuditLog,
    Boolean(token && isUuid(id) && roleId === "manager" && visibleTab === "Timeline"),
  );
  const refreshFunctionsRef = useRef<(() => Promise<void>)[]>([]);
  const focusedOnce = useRef(false);
  useEffect(() => {
    refreshFunctionsRef.current = [
      horseResource.revalidate,
      permissionsResource.revalidate,
      trainingResource.revalidate,
      pedigreeResource.revalidate,
      medicalResource.revalidate,
      performanceResource.revalidate,
      careResource.revalidate,
      auditResource.revalidate,
    ];
  }, [
    careResource.revalidate,
    auditResource.revalidate,
    horseResource.revalidate,
    medicalResource.revalidate,
    pedigreeResource.revalidate,
    performanceResource.revalidate,
    permissionsResource.revalidate,
    trainingResource.revalidate,
  ]);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current)
        void Promise.all(refreshFunctionsRef.current.map((refresh) => refresh()));
      else focusedOnce.current = true;
      return undefined;
    }, []),
  );

  const saveHealthStatus = async () => {
    if (
      !token ||
      !horseResource.data ||
      !healthStatusDraft ||
      !isValidRequiredText(healthReason, 500) ||
      savingHealth
    )
      return;
    setSavingHealth(true);
    try {
      await medicalService.updateHealthStatus(token, horseResource.data.id, {
        healthStatus: healthStatusDraft as HealthStatusDto,
        reason: healthReason.trim(),
      });
      setHealthStatusDraft("");
      setHealthReason("");
      await Promise.all([horseResource.refresh(), medicalResource.refresh()]);
      Alert.alert("Health status updated", "Lịch sử trạng thái sức khỏe đã được làm mới.");
    } catch (error) {
      Alert.alert("Could not update health status", extractErrorMessage(error));
    } finally {
      setSavingHealth(false);
    }
  };
  const mockHorse = raceOS.horses.find((item) => item.id === id) ?? getHorse(id);
  const horse = horseResource.data ? mapHorseDetailToPrototype(horseResource.data) : mockHorse;
  const plan = plans.find((item) => item.horseId === horse.id && item.status === "active");
  const currentPhase =
    plan?.phases.find((phase) =>
      phase.sessions.some((session) => ["scheduled", "in_progress"].includes(session.status)),
    ) ?? plan?.phases[0];
  const nextSession = currentPhase?.sessions.find((session) =>
    ["planned", "scheduled", "in_progress"].includes(session.status),
  );
  const locked =
    lockedHorseIds.includes(horse.id) || Boolean(horseResource.data?.activeTrainingLock);
  if (!isRole(role)) return <Redirect href="/" />;
  if (isUuid(id) && !horseResource.data) {
    return (
      <Screen
        role={roleId}
        title="Horse profile"
        back
        fallbackHref={`/${roleId}/horses` as any}
        refreshing={
          horseResource.isRefreshing ||
          trainingResource.isRefreshing ||
          permissionsResource.isRefreshing
        }
        onRefresh={() =>
          void Promise.all([
            horseResource.refresh(),
            trainingResource.refresh(),
            permissionsResource.refresh(),
          ])
        }
      >
        <AsyncStateView
          isLoading={horseResource.isLoading}
          error={horseResource.error}
          onRetry={() => void horseResource.retry()}
        />
      </Screen>
    );
  }
  return (
    <Screen
      role={roleId}
      title={horse.name}
      subtitle={`${t(
        (
          {
            manager: "Manager",
            trainer: "Trainer",
            vet: "Vet",
            groom: "Groom",
            owner: "Owner",
          } as const
        )[roleId],
      )} · ${t(horseResource.data ? "Club profile" : "Demo profile")}`}
      back
      fallbackHref={`/${roleId}/horses` as any}
      refreshing={
        horseResource.isRefreshing ||
        trainingResource.isRefreshing ||
        permissionsResource.isRefreshing ||
        medicalResource.isRefreshing ||
        performanceResource.isRefreshing ||
        careResource.isRefreshing
      }
      onRefresh={() =>
        void Promise.all([
          horseResource.refresh(),
          trainingResource.refresh(),
          permissionsResource.refresh(),
          medicalResource.refresh(),
          performanceResource.refresh(),
          careResource.refresh(),
        ])
      }
    >
      <AsyncStateView
        isLoading={false}
        error={horseResource.error}
        onRetry={() => void horseResource.retry()}
      />
      <AsyncStateView
        isLoading={false}
        error={permissionsResource.error}
        onRetry={() => void permissionsResource.retry()}
      />
      <Panel style={{ gap: space.sm, padding: space.md, borderRadius: radius.lg }}>
        {/* Top Header: Avatar + Horse Identity */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
          {/* Avatar / Portrait or Shield Badge */}
          {horseResource.data && photoResource.data?.url ? (
            <Image
              source={{ uri: photoResource.data.url }}
              accessibilityLabel={`${horse.name} portrait`}
              style={{ width: 68, height: 68, borderRadius: 16 }}
            />
          ) : (
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 16,
                backgroundColor: colors.fitSoft,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: `${colors.primary}33`,
              }}
            >
              <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
            </View>
          )}

          {/* Horse Identity Details */}
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>
                {horse.name}
              </Text>
              <View
                style={{
                  backgroundColor: colors.fitSoft,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: radius.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    fontWeight: "700",
                    color: colors.primary,
                  }}
                >
                  #{horse.id.slice(0, 8)}
                </Text>
              </View>
            </View>

            {/* Microchip */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="hardware-chip-outline" size={13} color={colors.mutedForeground} />
              <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "monospace" }}>
                Chip: {horseResource.data?.microchipId ? `...${horseResource.data.microchipId.slice(-6)}` : "Chưa gắn chip"}
              </Text>
            </View>

            {/* Age, Sex, Breed, Color */}
            <Text style={{ fontSize: 12, color: colors.mutedForeground }} numberOfLines={1}>
              {horse.age ? `${horse.age} tuổi · ` : ""}
              {horseResource.data?.gender
                ? formatEnum(horseResource.data.gender)
                : horse.sex === "M" || horse.sex === "Stallion"
                  ? "Đực"
                  : horse.sex === "F" || horse.sex === "Mare"
                    ? "Cái"
                    : "Thiến"}{" "}
              · {horseResource.data?.breed ? formatEnum(horseResource.data.breed) : horse.breed} ·{" "}
              {horseResource.data?.color ? formatEnum(horseResource.data.color) : horse.color}
            </Text>

            {/* Health & Status Badges */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              {horseResource.data?.healthStatus ? (
                <View
                  style={{
                    backgroundColor:
                      horseResource.data.healthStatus === "INJURED"
                        ? colors.injuredSoft
                        : horseResource.data.healthStatus === "UNDER_OBSERVATION"
                          ? colors.monitorSoft
                          : colors.fitSoft,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.pill,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color:
                        horseResource.data.healthStatus === "INJURED"
                          ? colors.destructive
                          : horseResource.data.healthStatus === "UNDER_OBSERVATION"
                            ? colors.monitor
                            : colors.fit,
                    }}
                  >
                    {formatEnum(horseResource.data.healthStatus)}
                  </Text>
                </View>
              ) : null}

              <View
                style={{
                  backgroundColor: colors.fitSoft,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radius.pill,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
                  {formatEnum(horseResource.data?.lifecycleStatus ?? "ACTIVE")}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Passport Quick Info Box (Rows: Sức khỏe, Vị trí chuồng, Chủ sở hữu, Groom chăm sóc) */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: space.sm,
            paddingVertical: space.xs,
            gap: 6,
            marginTop: 4,
          }}
        >
          {/* Row 1: Tình trạng sức khỏe */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 2,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <Ionicons name="medkit-outline" size={15} color={colors.fit} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.mutedForeground }}>
                Tình trạng sức khỏe:
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color:
                    horseResource.data?.healthStatus === "INJURED"
                      ? colors.destructive
                      : horseResource.data?.healthStatus === "UNDER_OBSERVATION"
                        ? colors.monitor
                        : colors.fit,
                }}
              >
                {horseResource.data ? formatEnum(horseResource.data.healthStatus) : "Ổn định"}
              </Text>
            </View>
          </View>

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />

          {/* Row 2: Vị trí chuồng & Ô */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 2,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <Ionicons name="location-outline" size={15} color={colors.training} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.mutedForeground }}>
                Vị trí chuồng & ô:
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.foreground,
                flex: 1,
                textAlign: "right",
              }}
              numberOfLines={1}
            >
              {horseResource.data?.location?.barn?.name ?? "Chưa xếp khu"}
              {horseResource.data?.location?.stall?.code
                ? ` · Ô ${horseResource.data.location.stall.code}`
                : horse.stall
                  ? ` · Ô ${horse.stall}`
                  : ""}
            </Text>
          </View>

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />

          {/* Row 3: Chủ sở hữu */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 2,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <Ionicons name="person-circle-outline" size={15} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.mutedForeground }}>
                Chủ sở hữu:
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.foreground,
                flex: 1,
                textAlign: "right",
              }}
              numberOfLines={1}
            >
              {horseResource.data?.owner?.fullName ?? horse.owner ?? "Chưa rõ"}
            </Text>
          </View>

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />

          {/* Row 4: Groom chăm sóc */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 2,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.mutedForeground }}>
                Groom chăm sóc:
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.foreground,
                flex: 1,
                textAlign: "right",
              }}
              numberOfLines={1}
            >
              {horseResource.data?.groom?.fullName ?? "Chưa phân công"}
            </Text>
          </View>
        </View>
      </Panel>
      <Chips options={tabs} value={visibleTab} onChange={setTab} />
      {visibleTab === "Overview" ? (
        <>
          {horseResource.data ? (
            <>
              {horseResource.data.isDeleted ? (
                <Panel>
                  <Text>This profile is soft deleted and read-only until restored.</Text>
                </Panel>
              ) : null}
              <Info
                title="Horse profile"
                items={[
                  ["Health status", formatEnum(t(horseResource.data.healthStatus))],
                  ["Lifecycle", formatEnum(t(horseResource.data.lifecycleStatus))],
                  [
                    "Gender",
                    horseResource.data.gender
                      ? formatEnum(t(horseResource.data.gender))
                      : t("Not recorded"),
                  ],
                  [
                    "Breed",
                    horseResource.data.breed
                      ? formatEnum(t(horseResource.data.breed))
                      : t("Not recorded"),
                  ],
                  [
                    "Color",
                    horseResource.data.color
                      ? formatEnum(t(horseResource.data.color))
                      : t("Not recorded"),
                  ],
                  ["Microchip", horseResource.data.microchipId ?? t("Not recorded")],
                  [
                    "Date of birth",
                    horseResource.data.dateOfBirth
                      ? formatToDdMmYyyy(horseResource.data.dateOfBirth)
                      : t("Not recorded"),
                  ],
                  ["Owner", horseResource.data.owner?.fullName ?? t("Unassigned")],
                  ["Barn", horseResource.data.location?.barn?.name ?? t("Not assigned")],
                  ["Stall", horseResource.data.location?.stall?.code ?? t("Not assigned")],
                  ["Groom", horseResource.data.groom?.fullName ?? t("Not assigned")],
                  [
                    "Distance focus",
                    horseResource.data.raceAptitude
                      ? formatEnum(t(horseResource.data.raceAptitude))
                      : t("Not recorded"),
                  ],
                  ["Latest weight", horse.weight ? formatWeight(horse.weight) : t("Not recorded")],
                  [
                    "Lifecycle reason",
                    horseResource.data.lifecycleReason
                      ? formatEnum(horseResource.data.lifecycleReason)
                      : "—",
                  ],
                ]}
              />

              {/* Inlined full Pedigree info */}
              <Panel style={{ gap: space.md }}>
                <SectionTitle>{t("Pedigree information")}</SectionTitle>
                <View style={styles.pedigreeSection}>
                  {(() => {
                    const ancestors = pedigreeResource.data?.ancestors ?? [];
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
                      color: horseResource.data.eligibility.trainingEligible
                        ? colors.fit
                        : colors.injured,
                      fontWeight: "700",
                    }}
                  >
                    {horseResource.data.eligibility.trainingEligible ? "Eligible" : "Restricted"}
                  </Text>
                </Text>
                {horseResource.data.eligibility.trainingReasons.map((reason) => (
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
                    onPress={() => router.push(`/${roleId}/horse/${horse.id}/ownership` as Href)}
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
                  !horseResource.data.isDeleted ? (
                    <Pressable
                      onPress={() => router.push(`/${roleId}/horse/${horse.id}/placement` as Href)}
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
                  !horseResource.data.isDeleted ? (
                    <Pressable
                      onPress={() => router.push(`/manager/edit-horse/${horse.id}` as Href)}
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
                      onPress={() => router.push(`/manager/lifecycle/${horse.id}` as Href)}
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

              {permissionsResource.data?.canEditRaceAptitude && !horseResource.data.isDeleted ? (
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
                    label={savingAptitude ? "Saving…" : "Save distance focus"}
                    icon="checkmark"
                    disabled={savingAptitude || !raceAptitudeValue}
                    onPress={() =>
                      void (async () => {
                        setSavingAptitude(true);
                        try {
                          await horseService.update(token!, horse.id, {
                            version: horseResource.data!.version,
                            raceAptitude: raceAptitudeValue as "SPRINTER" | "MILER" | "STAYER",
                          });
                          setRaceAptitudeDraft(null);
                          await horseResource.refresh();
                          Alert.alert("Distance focus updated", "Horse profile has been refreshed.");
                        } catch (error) {
                          Alert.alert("Could not update distance focus", extractErrorMessage(error));
                        } finally {
                          setSavingAptitude(false);
                        }
                      })()
                    }
                  />
                </Panel>
              ) : null}
            </>
          ) : (
            <>
              <Info
                title="Identity & pedigree"
                items={[
                  ["Sire", horse.sire],
                  ["Dam", horse.dam],
                  ["Age", `${horse.age} years`],
                  ["Weight", horse.weight ? formatWeight(horse.weight) : "—"],
                  ["Breed", horse.breed],
                  ["Stall", horse.stall],
                ]}
              />
              <Panel style={{ gap: 8, marginTop: 4 }}>
                <View style={uiStyles.row}>
                  <Text style={[uiStyles.value, { fontSize: 14 }]}>Dữ liệu thể lực & hiệu suất</Text>
                  <Pressable onPress={() => setTab("Performance")}>
                    <Text style={{ ...uiStyles.label, color: colors.primary, fontWeight: "700" }}>
                      Xem tab Hiệu suất →
                    </Text>
                  </Pressable>
                </View>
                <Text style={uiStyles.muted}>
                  Dữ liệu tốc độ, nhịp tim và tổng kết buổi tập từ backend được hiển thị chi tiết trong tab Hiệu suất.
                </Text>
              </Panel>
            </>
          )}
          {!horseResource.data && roleId === "manager" ? (
            <>
              <PrimaryButton
                label="Edit horse profile"
                icon="create-outline"
                onPress={() => router.push(`/manager/edit-horse/${horse.id}`)}
              />
              <PrimaryButton
                label="Manage ownership"
                icon="people-outline"
                onPress={() => router.push(`/manager/owners/${horse.id}`)}
              />
            </>
          ) : null}
        </>
      ) : null}
      {visibleTab === "Training" ? (
        <>
          <AsyncStateView
            isLoading={trainingResource.isLoading}
            error={trainingResource.error}
            onRetry={() => void trainingResource.retry()}
          />
          {trainingResource.data?.length ? (
            <View style={uiStyles.section}>
              <SectionTitle>Class sessions</SectionTitle>
              {trainingResource.data.map((session) => (
                <Pressable
                  key={session.id}
                  disabled={roleId !== "trainer"}
                  onPress={() => {
                    const params = new URLSearchParams({
                      horse: session.horseName,
                      session: session.title,
                      classId: session.classId,
                      sessionId: session.sessionId,
                      sessionType: session.type === "time_trial" ? "TIME_TRIAL" : "REGULAR",
                      sessionStatus: session.sessionStatus,
                      participantStatus: session.participantStatus,
                      horseLifecycle: horseResource.data?.lifecycleStatus ?? "ACTIVE",
                    });
                    router.push(`/trainer/participant/${session.participantId}?${params.toString()}` as Href);
                  }}
                >
                  <Panel>
                    <View style={uiStyles.row}>
                      <View style={styles.flex}>
                        <Text style={uiStyles.value} numberOfLines={1}>
                          {session.title}
                        </Text>
                        <Text style={uiStyles.muted} numberOfLines={1}>
                          {session.className} · {session.planName}
                        </Text>
                      </View>
                      <Text style={[uiStyles.label, { flexShrink: 0 }]}>
                        {session.status === "cancelled_by_lock"
                          ? t("Cancelled by training lock")
                          : session.status === "ineligible"
                            ? t("Not eligible")
                            : session.status.replaceAll("_", " ")}
                      </Text>
                    </View>
                    <Text style={uiStyles.muted}>
                      {session.scheduledStartLabel}
                      {session.distanceM == null ? "" : ` · ${formatDistance(session.distanceM)}`}
                      {session.surface ? ` · ${session.surface}` : ""}
                    </Text>
                    {session.cancelReason ? (
                      <Text style={uiStyles.muted}>{session.cancelReason}</Text>
                    ) : null}
                    {session.trials.length ? (
                      <Text style={uiStyles.label}>
                        Trial: {session.trials.map((trial) => trial.elapsedLabel).join(" · ")}
                      </Text>
                    ) : null}
                    {session.targetTimeMs != null ? (
                      <Text style={uiStyles.label}>
                        Target {formatDurationMs(session.targetTimeMs)}
                      </Text>
                    ) : null}
                    {session.evaluation?.comment ? (
                      <Text style={uiStyles.muted}>{session.evaluation.comment}</Text>
                    ) : null}
                  </Panel>
                </Pressable>
              ))}
            </View>
          ) : trainingResource.data ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => undefined}
              empty
              emptyLabel="This horse has no class sessions."
            />
          ) : !trainingResource.isLoading && !trainingResource.error && !isUuid(id) ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => undefined}
              empty
              emptyLabel="Danh sách buổi tập được đồng bộ cho các hồ sơ ngựa của câu lạc bộ."
            />
          ) : null}
        </>
      ) : null}
      {visibleTab === "Care" && horseResource.data ? (
        <>
          <AsyncStateView
            isLoading={careResource.isLoading}
            error={careResource.error}
            onRetry={() => void careResource.retry()}
          />
          {careResource.data ? (
            <Info
              title="Current care instructions"
              items={[
                [
                  "Instructions",
                  careResource.data.current?.careInstructions ?? "No active care instructions",
                ],
                [
                  "Last examined",
                  careResource.data.current
                    ? new Date(careResource.data.current.examDate).toLocaleString()
                    : "—",
                ],
              ]}
            />
          ) : null}
          <PrimaryButton
            label="View care schedules"
            icon="calendar-outline"
            onPress={() =>
              router.push(`/${roleId}/medical/care?horseId=${horseResource.data!.id}` as Href)
            }
          />
        </>
      ) : null}
      {visibleTab === "Health" && horseResource.data ? (
        <>
          <Info
            title="Tình trạng sức khỏe & Tập luyện"
            items={[
              ["Trạng thái sức khỏe", formatEnum(horseResource.data.healthStatus)],
              [
                "Điều kiện tập luyện",
                horseResource.data.eligibility.trainingEligible
                  ? "Đủ điều kiện"
                  : horseResource.data.eligibility.trainingReasons
                      .map((reason) => formatEnum(t(reason)))
                      .join(", ") || "Hạn chế",
              ],
            ]}
          />
          <HorseMeasurementsView
            horseId={id}
            roleId={roleId}
            canRecord={permissionsResource.data?.canRecordMeasurement}
            canDelete={permissionsResource.data?.canDeleteMeasurement}
            onUpdated={() => {
              void horseResource.refresh();
            }}
          />
        </>
      ) : null}

      {visibleTab === "Medical" && horseResource.data ? (
        <>
          <AsyncStateView
            isLoading={medicalResource.isLoading}
            error={medicalResource.error}
            onRetry={() => void medicalResource.retry()}
          />

          {/* Action Header: Yêu cầu khám thú y (Trainer, Groom, Manager) */}
          {["trainer", "groom", "manager"].includes(roleId) && !horseResource.data.isDeleted ? (
            <PrimaryButton
              label="Yêu cầu khám thú y"
              icon="medkit-outline"
              onPress={() =>
                router.push(`/${roleId}/medical/requests?horseId=${horse.id}` as Href)
              }
            />
          ) : null}

          {/* Vet Action Bar */}
          {roleId === "vet" ? (
            <View style={{ gap: space.sm }}>
              <PrimaryButton
                label="Ghi nhận lần khám bệnh mới"
                icon="medkit-outline"
                onPress={() => router.push(`/vet/medical/visit?horseId=${horse.id}` as Href)}
              />
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/vet/lock/${horse.id}` as Href)}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color={horseResource.data.activeTrainingLock ? colors.destructive : colors.foreground}
                  />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                    {horseResource.data.activeTrainingLock ? "Quản lý khóa tập" : "Khóa tập luyện"}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/vet/medical/care?horseId=${horse.id}` as Href)}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                    Lịch chăm sóc
                  </Text>
                </Pressable>
              </View>

              {permissionsResource.data?.canChangeHealth ? (
                <Panel style={{ gap: space.sm, marginTop: 4 }}>
                  <SectionTitle>Cập nhật trạng thái sức khỏe</SectionTitle>
                  <Chips
                    options={["ELIGIBLE", "UNDER_OBSERVATION", "INJURED", "QUARANTINED"]}
                    value={healthStatusDraft || horseResource.data.healthStatus}
                    onChange={setHealthStatusDraft}
                  />
                  {healthStatusDraft && healthStatusDraft !== horseResource.data.healthStatus ? (
                    <>
                      <Field label="Lý do thay đổi trạng thái">
                        <NativeInput
                          value={healthReason}
                          onChangeText={setHealthReason}
                          multiline
                          placeholder="Nêu rõ lý do lâm sàng hoặc tình trạng chấn thương..."
                        />
                      </Field>
                      <PrimaryButton
                        style={{ marginTop: space.xs }}
                        label={savingHealth ? "Đang lưu…" : "Lưu trạng thái sức khỏe"}
                        disabled={savingHealth || !isValidRequiredText(healthReason, 500)}
                        onPress={() => void saveHealthStatus()}
                      />
                    </>
                  ) : null}
                </Panel>
              ) : null}
            </View>
          ) : null}

          {medicalResource.data ? (
            <View style={{ gap: space.md, marginTop: space.xs }}>
              {/* SECTION: Bệnh án điều trị (Medical Cases) */}
              <View style={uiStyles.section}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <SectionTitle>Bệnh án điều trị</SectionTitle>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {medicalResource.data.cases.items.length} ca bệnh
                  </Text>
                </View>

                {medicalResource.data.cases.items.length ? (
                  medicalResource.data.cases.items.map((medicalCase) => {
                    const isOpen = medicalCase.status === "OPEN";
                    return (
                      <Pressable
                        key={medicalCase.id}
                        onPress={() =>
                          router.push(`/${roleId}/medical/cases/${medicalCase.id}` as Href)
                        }
                      >
                        <Panel style={{ gap: space.xs, padding: space.md }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  backgroundColor: isOpen ? "rgba(239, 68, 68, 0.12)" : colors.surface,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Ionicons
                                  name={isOpen ? "fitness" : "checkmark-done-circle"}
                                  size={18}
                                  color={isOpen ? colors.destructive : colors.fit}
                                />
                              </View>
                              <Text style={[uiStyles.value, { fontSize: 15, fontWeight: "700" }]} numberOfLines={1}>
                                {medicalCase.initialDiagnosis}
                              </Text>
                            </View>

                            <View
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: radius.pill,
                                backgroundColor: isOpen ? "rgba(239, 68, 68, 0.12)" : colors.elevated,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "700",
                                  color: isOpen ? colors.destructive : colors.mutedForeground,
                                }}
                              >
                                {isOpen ? "ĐANG ĐIỀU TRỊ" : "ĐÃ ĐÓNG"}
                              </Text>
                            </View>
                          </View>

                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                            <Text style={uiStyles.muted}>
                              Mở: {new Date(medicalCase.openedAt).toLocaleDateString()}
                              {medicalCase.closedAt
                                ? ` · Đóng: ${new Date(medicalCase.closedAt).toLocaleDateString()}`
                                : ""}
                            </Text>
                          </View>

                          {medicalCase.finalConclusion ? (
                            <Text style={{ fontSize: 13, color: colors.foreground, marginTop: 2 }}>
                              Kết luận: {medicalCase.finalConclusion}
                            </Text>
                          ) : null}

                          {"totalCost" in medicalCase && medicalCase.totalCost != null ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                              <Ionicons name="cash-outline" size={13} color={colors.primary} />
                              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                                Chi phí: {medicalCase.totalCost.toLocaleString("vi-VN")} VND
                              </Text>
                            </View>
                          ) : null}
                        </Panel>
                      </Pressable>
                    );
                  })
                ) : (
                  <AsyncStateView
                    isLoading={false}
                    error={null}
                    onRetry={() => void medicalResource.retry()}
                    empty
                    emptyLabel="Chưa có bệnh án y tế nào được ghi nhận."
                  />
                )}
              </View>

              {/* SECTION: Lịch sử các lần khám (Medical Visits) */}
              <View style={uiStyles.section}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <SectionTitle>Lịch sử các lần khám</SectionTitle>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {medicalResource.data.records.length} lần khám
                  </Text>
                </View>

                {medicalResource.data.records.length ? (
                  medicalResource.data.records.slice(0, 12).map((record) => {
                    const isIssue = record.conclusion === "ISSUE";
                    return (
                      <Pressable
                        key={record.id}
                        onPress={() => router.push(`/${roleId}/medical/visits/${record.id}` as Href)}
                      >
                        <Panel style={{ gap: space.xs, padding: space.md }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  backgroundColor: isIssue ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Ionicons
                                  name={isIssue ? "warning-outline" : "medkit-outline"}
                                  size={18}
                                  color={isIssue ? colors.destructive : colors.primary}
                                />
                              </View>
                              <Text style={[uiStyles.value, { fontSize: 14, fontWeight: "700" }]} numberOfLines={1}>
                                {record.conclusion === "ISSUE"
                                  ? (record.diagnosis || "Phát hiện vấn đề sức khỏe")
                                  : (record.diagnosis || record.kind?.replaceAll("_", " ") || "Khám định kỳ bình thường")}
                              </Text>
                            </View>

                            <View
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: radius.pill,
                                backgroundColor: isIssue ? "rgba(239, 68, 68, 0.12)" : colors.fitSoft,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "700",
                                  color: isIssue ? colors.destructive : colors.fit,
                                }}
                              >
                                {record.resultingStatus || (isIssue ? "Cần theo dõi" : "Bình thường")}
                              </Text>
                            </View>
                          </View>

                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                            <Text style={uiStyles.muted}>
                              {new Date(record.examDate).toLocaleString()}
                              {record.voidedAt ? ` · Đã hủy: ${record.voidReason ?? ""}` : ""}
                            </Text>
                          </View>

                          {/* Prescriptions preview */}
                          {record.prescriptions && record.prescriptions.length > 0 ? (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                backgroundColor: colors.surface,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: radius.sm,
                                borderWidth: 1,
                                borderColor: colors.border,
                                marginTop: 4,
                              }}
                            >
                              <Ionicons name="medical-outline" size={13} color={colors.primary} />
                              <Text style={{ fontSize: 12, color: colors.foreground, flex: 1 }} numberOfLines={1}>
                                <Text style={{ fontWeight: "700" }}>Đơn thuốc ({record.prescriptions.length}): </Text>
                                {record.prescriptions.map((p) => p.medicine).join(", ")}
                              </Text>
                            </View>
                          ) : null}

                          {record.careInstructions ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                              <Ionicons name="clipboard-outline" size={12} color={colors.mutedForeground} />
                              <Text style={[uiStyles.muted, { fontSize: 12 }]} numberOfLines={2}>
                                {record.careInstructions}
                              </Text>
                            </View>
                          ) : null}
                        </Panel>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={uiStyles.muted}>Chưa có lần khám thú y nào được ghi nhận.</Text>
                )}
              </View>

              {/* SECTION: Lịch chăm sóc & điều trị */}
              <View style={uiStyles.section}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <SectionTitle>Lịch trình chăm sóc y tế</SectionTitle>
                  <Pressable
                    onPress={() => router.push(`/${roleId}/medical/care?horseId=${horse.id}` as Href)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                      Mở chi tiết →
                    </Text>
                  </Pressable>
                </View>

                {(medicalResource.data.careSchedules ?? []).length ? (
                  (medicalResource.data.careSchedules ?? []).map((schedule) => (
                    <Panel key={schedule.id} style={{ gap: space.xs, padding: space.md }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={[uiStyles.value, { fontSize: 14, fontWeight: "700", flex: 1 }]} numberOfLines={1}>
                          {schedule.type.replaceAll("_", " ")}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: radius.pill,
                            backgroundColor:
                              schedule.status === "COMPLETED"
                                ? colors.fitSoft
                                : schedule.status === "CANCELLED"
                                  ? colors.elevated
                                  : "rgba(245, 158, 11, 0.12)",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color:
                                schedule.status === "COMPLETED"
                                  ? colors.fit
                                  : schedule.status === "CANCELLED"
                                    ? colors.mutedForeground
                                    : "#F59E0B",
                            }}
                          >
                            {schedule.status.replaceAll("_", " ")}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                        <Text style={uiStyles.muted}>
                          Đến hạn: {new Date(schedule.dueAt).toLocaleString()}
                          {schedule.completedAt ? ` · Xong: ${new Date(schedule.completedAt).toLocaleDateString()}` : ""}
                        </Text>
                      </View>
                      {schedule.notes ? <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>{schedule.notes}</Text> : null}
                    </Panel>
                  ))
                ) : (
                  <Text style={uiStyles.muted}>Chưa có lịch trình chăm sóc nào.</Text>
                )}
              </View>

              {/* SECTION: Lịch sử thay đổi trạng thái sức khỏe */}
              <View style={uiStyles.section}>
                <SectionTitle>Lịch sử trạng thái sức khỏe</SectionTitle>
                {medicalResource.data.healthHistory.length ? (
                  medicalResource.data.healthHistory.map((item, index) => (
                    <Panel key={`${item.changedAt}-${index}`} style={{ gap: space.xs, padding: space.md }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: radius.pill,
                            backgroundColor: colors.elevated,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>
                            {item.from ?? "Khởi tạo"} → {item.to}
                          </Text>
                        </View>
                        <Text style={[uiStyles.muted, { fontSize: 11 }]}>
                          {new Date(item.changedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      {item.reason ? (
                        <Text style={{ fontSize: 13, color: colors.foreground, marginTop: 2 }}>
                          Lý do: {item.reason}
                        </Text>
                      ) : null}
                    </Panel>
                  ))
                ) : (
                  <Text style={uiStyles.muted}>Chưa có ghi nhận thay đổi trạng thái sức khỏe.</Text>
                )}
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {/* SECTION: Dinh dưỡng & Chăm sóc chuồng (Nutrition Tab) */}
      {(visibleTab === "Nutrition" || (roleId === "groom" && visibleTab === "Care")) && horseResource.data ? (
        <View style={{ gap: space.md }}>
          {/* Quick Access: Chuồng trại & Dinh dưỡng */}
          <View style={uiStyles.section}>
            <SectionTitle>Chăm sóc chuồng trại & Dinh dưỡng</SectionTitle>
            <View style={{ gap: space.sm }}>
              <Pressable
                onPress={() =>
                  router.push(`/${roleId}/horse/${horse.id}/stable-care?tab=Feeding plan` as Href)
                }
                style={styles.actionGridTile}
              >
                <View style={[styles.actionGridIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                  <Ionicons name="leaf-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.actionGridTitle}>Khẩu phần & Kế hoạch dinh dưỡng</Text>
                  <Text style={styles.actionGridSubtitle} numberOfLines={1}>
                    Xem lịch ăn 4 bữa & khẩu phần ngũ cốc, cỏ khô
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </Pressable>

              <Pressable
                onPress={() =>
                  router.push(`/${roleId}/horse/${horse.id}/stable-care?tab=Care tasks` as Href)
                }
                style={styles.actionGridTile}
              >
                <View style={[styles.actionGridIconWrap, { backgroundColor: "rgba(59, 130, 246, 0.12)" }]}>
                  <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.actionGridTitle}>Nhiệm vụ chăm sóc định kỳ</Text>
                  <Text style={styles.actionGridSubtitle} numberOfLines={1}>
                    Chải lông, tắm rửa, kiểm tra móng & xoa bóp
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </Pressable>

              {["manager", "trainer", "groom"].includes(roleId) ? (
                <Pressable
                  onPress={() =>
                    router.push(`/${roleId}/horse/${horse.id}/stable-care?tab=Daily checklist` as Href)
                  }
                  style={styles.actionGridTile}
                >
                  <View style={[styles.actionGridIconWrap, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                    <Ionicons name="checkbox-outline" size={20} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.actionGridTitle}>Checklist chăm sóc hàng ngày</Text>
                    <Text style={styles.actionGridSubtitle} numberOfLines={1}>
                      Điểm danh & xác nhận công việc chuồng
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Care Surcharges (Phụ phí chăm sóc) */}
          {["manager", "trainer", "owner"].includes(roleId) ? (
            <View style={uiStyles.section}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <SectionTitle>Phụ phí chăm sóc đặc biệt</SectionTitle>
                <Pressable
                  onPress={() =>
                    router.push(`/${roleId}/horse/${horse.id}/stable-care?tab=Surcharges` as Href)
                  }
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                    Quản lý phụ phí →
                  </Text>
                </Pressable>
              </View>

              <AsyncStateView
                isLoading={surchargesResource.isLoading}
                error={surchargesResource.error}
                onRetry={() => void surchargesResource.retry()}
                empty={
                  !surchargesResource.isLoading &&
                  !surchargesResource.error &&
                  (surchargesResource.data?.length ?? 0) === 0
                }
                emptyLabel="Không có phụ phí chăm sóc nào đang áp dụng cho ngựa này."
              />

              {(surchargesResource.data ?? []).map((surcharge) => (
                <Panel key={surcharge.id} style={{ gap: space.xs, padding: space.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: "rgba(16, 185, 129, 0.12)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="cash-outline" size={18} color={colors.primary} />
                      </View>
                      <Text style={[uiStyles.value, { fontSize: 14 }]} numberOfLines={1}>
                        {surcharge.description}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>
                      {surcharge.dailyAmount.toLocaleString("vi-VN")} đ / ngày
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                    <Text style={uiStyles.muted}>
                      {surcharge.startDate} → {surcharge.endDate}
                    </Text>
                    <Text style={uiStyles.muted}>·</Text>
                    <Text style={uiStyles.muted}>
                      {surcharge.appliedByName ? `Bởi ${surcharge.appliedByName}` : "Chờ duyệt"}
                    </Text>
                  </View>
                </Panel>
              ))}

              <PrimaryButton
                label={roleId === "manager" ? "Thêm hoặc điều chỉnh phụ phí" : "Xem chi tiết phụ phí"}
                icon="cash-outline"
                onPress={() =>
                  router.push(`/${roleId}/horse/${horse.id}/stable-care?tab=Surcharges` as Href)
                }
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {visibleTab === "Injuries" && horseResource.data ? (
        <>
          <AsyncStateView
            isLoading={medicalResource.isLoading}
            error={medicalResource.error}
            onRetry={() => void medicalResource.retry()}
          />
          {medicalResource.data?.injuries.length ? (
            medicalResource.data.injuries.map((injury) => {
              const latestEvent = injury.history.at(-1);
              const eventRecordId = latestEvent?.medicalRecordId ?? injury.firstMedicalRecordId;

              return (
                <Pressable
                  key={injury.id}
                  onPress={() =>
                    router.push(
                      latestEvent?.caseId
                        ? (`/${roleId}/medical/cases/${latestEvent.caseId}` as Href)
                        : (`/${roleId}/medical/visits/${eventRecordId}` as Href),
                    )
                  }
                >
                  <Panel>
                    <Text style={uiStyles.value}>
                      {injury.bodyRegion} · {injury.injuryType}
                    </Text>
                    <Text style={uiStyles.muted}>
                      {injury.currentRecoveryStatus.replaceAll("_", " ")} ·{" "}
                      {new Date(latestEvent?.examDate ?? injury.firstExamDate).toLocaleDateString()}
                    </Text>
                    {latestEvent?.notes ? <Text>{latestEvent.notes}</Text> : null}
                    <Text style={{ ...uiStyles.label, color: colors.primary }}>
                      {latestEvent?.caseId ? "Open treatment case" : "Open examination"}
                    </Text>
                  </Panel>
                </Pressable>
              );
            })
          ) : medicalResource.data ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => void medicalResource.retry()}
              empty
              emptyLabel="No injury markers are recorded."
            />
          ) : null}
        </>
      ) : null}
      {visibleTab === "Treatment" && horseResource.data ? (
        <>
          <AsyncStateView
            isLoading={medicalResource.isLoading}
            error={medicalResource.error}
            onRetry={() => void medicalResource.retry()}
          />
          <View style={uiStyles.section}>
            <SectionTitle>Training restrictions</SectionTitle>
            {medicalResource.data?.locks.length ? (
              medicalResource.data.locks.map((lock) => (
                <Panel key={lock.id}>
                  <Text style={uiStyles.value}>{lock.status.replaceAll("_", " ")}</Text>
                  <Text>{lock.reason}</Text>
                  <Text style={uiStyles.muted}>Locked by staff {lock.lockedBy.slice(0, 8)}</Text>
                  <Text style={uiStyles.muted}>
                    Start {new Date(lock.lockStart).toLocaleDateString()}
                    {lock.lockEnd
                      ? ` · expected end ${new Date(lock.lockEnd).toLocaleDateString()}`
                      : ""}
                  </Text>
                  {lock.releasedAt ? (
                    <Text style={uiStyles.muted}>
                      Released {new Date(lock.releasedAt).toLocaleString()}
                      {lock.releasedBy ? ` · staff ${lock.releasedBy.slice(0, 8)}` : ""}
                    </Text>
                  ) : null}
                  {lock.releaseConclusion ? <Text>{lock.releaseConclusion}</Text> : null}
                </Panel>
              ))
            ) : medicalResource.data ? (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={() => void medicalResource.retry()}
                empty
                emptyLabel="No veterinary training locks are recorded."
              />
            ) : null}
          </View>
          {medicalResource.data?.cases.items.map((medicalCase) => (
            <Pressable
              key={medicalCase.id}
              onPress={() => router.push(`/${roleId}/medical/cases/${medicalCase.id}` as Href)}
            >
              <Panel>
                <Text style={uiStyles.value}>{medicalCase.initialDiagnosis}</Text>
                <Text style={uiStyles.muted}>
                  {medicalCase.status} · {medicalCase.finalConclusion ?? "Treatment ongoing"}
                </Text>
              </Panel>
            </Pressable>
          ))}
        </>
      ) : null}
      {visibleTab === "Performance" && horseResource.data ? (
        <>
          <AsyncStateView
            isLoading={performanceResource.isLoading}
            error={performanceResource.error}
            onRetry={() => void performanceResource.retry()}
          />
          {performanceResource.data ? (
            <>
              {performanceResource.data.summary ? (
                <>
                  {/* Hero Vitals 4-Grid */}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: space.xs }}>
                    {/* Card 1: Số buổi đã theo dõi */}
                    <View style={styles.perfTile}>
                      <View style={[styles.perfIconBox, { backgroundColor: colors.fitSoft }]}>
                        <Ionicons name="barbell-outline" size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.perfValue}>
                          {performanceResource.data.summary.sessionsTracked}
                        </Text>
                        <Text style={styles.perfLabel} numberOfLines={1}>Buổi hoàn thành</Text>
                      </View>
                    </View>

                    {/* Card 2: Nhịp tim gần nhất */}
                    <View style={styles.perfTile}>
                      <View style={[styles.perfIconBox, { backgroundColor: colors.injuredSoft }]}>
                        <Ionicons name="pulse" size={18} color={colors.destructive} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.perfValue, { color: colors.destructive }]}>
                          {performanceResource.data.summary.latestMetric?.heartRateBpm ?? "—"}
                          {performanceResource.data.summary.latestMetric ? " bpm" : ""}
                        </Text>
                        <Text style={styles.perfLabel} numberOfLines={1}>Nhịp tim gần nhất</Text>
                      </View>
                    </View>

                    {/* Card 3: Vận tốc gần nhất */}
                    <View style={styles.perfTile}>
                      <View style={[styles.perfIconBox, { backgroundColor: "#e0f2fe" }]}>
                        <Ionicons name="speedometer-outline" size={18} color="#0284c7" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.perfValue, { color: "#0284c7" }]}>
                          {performanceResource.data.summary.latestMetric
                            ? `${(performanceResource.data.summary.latestMetric.speedMps * 3.6).toFixed(1)} km/h`
                            : "—"}
                        </Text>
                        <Text style={styles.perfLabel} numberOfLines={1}>Tốc độ gần nhất</Text>
                      </View>
                    </View>

                    {/* Card 4: Đánh giá HLV */}
                    <View style={styles.perfTile}>
                      <View style={[styles.perfIconBox, { backgroundColor: "#fef3c7" }]}>
                        <Ionicons name="star" size={18} color="#f59e0b" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.perfValue, { color: "#d97706" }]}>
                          {performanceResource.data.summary.latestEvaluation
                            ? `${performanceResource.data.summary.latestEvaluation.score}/10`
                            : "—"}
                        </Text>
                        <Text style={styles.perfLabel} numberOfLines={1}>
                          {(() => {
                            const s = performanceResource.data.summary.latestEvaluation?.score;
                            const c = performanceResource.data.summary.latestEvaluation?.comment?.toLowerCase();
                            if (c === "good") return "Tốt";
                            if (c === "excellent") return "Xuất sắc";
                            if (c === "average" || c === "fair") return "Khá";
                            if (c === "poor") return "Cần cải thiện";
                            if (s && s >= 9) return "Xuất sắc";
                            if (s && s >= 7) return "Tốt";
                            if (s && s >= 5) return "Khá";
                            return "Đánh giá phong độ";
                          })()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Trainer Comment Quote Card */}
                  {performanceResource.data.summary.latestEvaluation?.comment ? (
                    <Panel style={styles.perfCommentCard}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="chatbubble-ellipses" size={15} color={colors.primary} />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                          Nhận xét từ Huấn luyện viên
                        </Text>
                      </View>
                      <Text style={styles.perfCommentText}>
                        "{(() => {
                          const c = performanceResource.data.summary.latestEvaluation.comment;
                          const trimmed = c.trim().toLowerCase();
                          if (trimmed === "good") return "Ngựa hoàn thành bài tập tốt, nhịp thở ổn định và đáp ứng tốt với các bước nước đại.";
                          if (trimmed === "excellent") return "Phong độ xuất sắc! Ngựa duy trì tốc độ và nhịp tim tối ưu trong suốt cự ly.";
                          if (trimmed === "average" || trimmed === "fair") return "Đạt yêu cầu cơ bản. Cần chú ý điều chỉnh nhịp thở ở giai đoạn tăng tốc.";
                          if (trimmed === "poor") return "Thể lực có dấu hiệu suy giảm sớm. Cần theo dõi thêm và giảm cường độ.";
                          return c;
                        })()}"
                      </Text>
                    </Panel>
                  ) : null}

                  {/* Speed history line chart */}
                  {performanceResource.data.summary.recentMetrics.length > 1 ? (
                    <SpeedTrendChart
                      metrics={performanceResource.data.summary.recentMetrics}
                      color="#0284c7"
                    />
                  ) : null}
                </>
              ) : (
                <Panel>
                  <Text style={uiStyles.muted}>
                    Chủ ngựa nhận tóm tắt hiệu suất theo từng buổi tập. Dữ liệu cảm biến thời gian thực giới hạn cho nhân sự quản lý & HLV.
                  </Text>
                </Panel>
              )}

              {/* Workload Progress Section */}
              {performanceResource.data.workload ? (
                <View style={uiStyles.section}>
                  <SectionTitle>
                    Khối lượng tập luyện ({performanceResource.data.workload.from ?? "—"} → {performanceResource.data.workload.to ?? "—"})
                  </SectionTitle>
                  <Panel style={{ gap: space.sm }}>
                    <View style={uiStyles.row}>
                      <View>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground, fontWeight: "600" }}>
                          Cự ly tích lũy
                        </Text>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground, marginTop: 2 }}>
                          {(performanceResource.data.workload.actualDistanceM ?? 0).toLocaleString()} m
                          <Text style={{ fontSize: 12, fontWeight: "500", color: colors.mutedForeground }}>
                            {" "}/ {(performanceResource.data.workload.plannedDistanceM ?? 0).toLocaleString()} m kế hoạch
                          </Text>
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "800" }}>
                          {performanceResource.data.workload.plannedDistanceM
                            ? `${Math.round(((performanceResource.data.workload.actualDistanceM ?? 0) / performanceResource.data.workload.plannedDistanceM) * 100)}%`
                            : "—"}
                        </Text>
                      </View>
                    </View>

                    <ProgressBar
                      value={
                        performanceResource.data.workload.plannedDistanceM
                          ? Math.min(
                              100,
                              Math.round(
                                ((performanceResource.data.workload.actualDistanceM ?? 0) /
                                  performanceResource.data.workload.plannedDistanceM) *
                                  100,
                              ),
                            )
                          : 0
                      }
                    />

                    <View style={styles.workloadChipsRow}>
                      <View style={styles.workloadChip}>
                        <Ionicons name="time-outline" size={13} color={colors.primary} />
                        <Text style={styles.workloadChipText}>
                          {Math.round((performanceResource.data.workload.actualDurationSeconds ?? 0) / 60)} phút tập
                        </Text>
                      </View>
                      <View style={styles.workloadChip}>
                        <Ionicons name="checkmark-done-circle-outline" size={13} color={colors.fit} />
                        <Text style={styles.workloadChipText}>
                          {performanceResource.data.workload.sessionsCompleted ?? 0} buổi xong
                        </Text>
                      </View>
                      <View style={styles.workloadChip}>
                        <Ionicons name="flame-outline" size={13} color="#f59e0b" />
                        <Text style={styles.workloadChipText}>
                          {performanceResource.data.workload.byIntensity?.LIGHT ?? 0} nhẹ · {performanceResource.data.workload.byIntensity?.HEAVY ?? 0} nặng
                        </Text>
                      </View>
                    </View>
                  </Panel>
                </View>
              ) : null}

              {/* Biometric Thresholds */}
              {performanceResource.data.thresholds ? (
                <View style={uiStyles.section}>
                  <SectionTitle>Ngưỡng an toàn cảm biến & sinh trắc học</SectionTitle>
                  <Panel style={{ gap: space.xs }}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                      Áp dụng quy chuẩn theo dõi sức khỏe của câu lạc bộ:
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                      <View style={[styles.thresholdBadge, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}>
                        <Ionicons name="warning-outline" size={14} color="#d97706" />
                        <Text style={[styles.thresholdValue, { color: "#d97706" }]}>
                          {performanceResource.data.thresholds.limits.heartRateWarningBpm} bpm
                        </Text>
                        <Text style={styles.thresholdLabel}>Cảnh báo nhịp tim</Text>
                      </View>

                      <View style={[styles.thresholdBadge, { backgroundColor: colors.injuredSoft, borderColor: "#fecaca" }]}>
                        <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                        <Text style={[styles.thresholdValue, { color: colors.destructive }]}>
                          {performanceResource.data.thresholds.limits.heartRateCriticalBpm} bpm
                        </Text>
                        <Text style={styles.thresholdLabel}>Nguy cấp nhịp tim</Text>
                      </View>

                      <View style={[styles.thresholdBadge, { backgroundColor: "#e0f2fe", borderColor: "#bae6fd" }]}>
                        <Ionicons name="flash-outline" size={14} color="#0284c7" />
                        <Text style={[styles.thresholdValue, { color: "#0284c7" }]}>
                          {(performanceResource.data.thresholds.limits.maxSpeedMps * 3.6).toFixed(0)} km/h
                        </Text>
                        <Text style={styles.thresholdLabel}>Tốc độ tối đa</Text>
                      </View>
                    </View>
                  </Panel>
                </View>
              ) : null}

              {/* Sensor Alerts */}
              {performanceResource.data.alerts.length ? (
                <View style={uiStyles.section}>
                  <SectionTitle>Cảnh báo cảm biến gần đây ({performanceResource.data.alerts.length})</SectionTitle>
                  {performanceResource.data.alerts.map((alert, index) => (
                    <Panel
                      key={`${alert.sessionParticipantId}:${alert.recordedAt}:${index}`}
                      style={{
                        borderLeftWidth: 4,
                        borderLeftColor:
                          alert.alertLevel === "CRITICAL" ? colors.destructive : colors.monitor,
                        gap: 4,
                      }}
                    >
                      <View style={uiStyles.row}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons
                            name={alert.alertLevel === "CRITICAL" ? "warning" : "alert-circle-outline"}
                            size={14}
                            color={alert.alertLevel === "CRITICAL" ? colors.destructive : colors.monitor}
                          />
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "800",
                              color:
                                alert.alertLevel === "CRITICAL" ? colors.destructive : colors.monitor,
                            }}
                          >
                            {alert.alertLevel === "CRITICAL" ? "NGUY CẤP" : "CẢNH BÁO"}
                          </Text>
                        </View>
                        <Text style={[uiStyles.label, { flexShrink: 0 }]}>
                          {formatDateTime(alert.recordedAt)}
                        </Text>
                      </View>
                      <Text style={[uiStyles.value, { fontSize: 14 }]}>
                        {alert.sessionName ?? "Buổi tập"}
                      </Text>
                      <Text style={uiStyles.muted}>
                        Nhịp tim đo được: <Text style={{ fontWeight: "700", color: colors.foreground }}>{alert.heartRateBpm} bpm</Text> · Vận tốc:{" "}
                        <Text style={{ fontWeight: "700", color: colors.foreground }}>{(alert.speedMps * 3.6).toFixed(1)} km/h</Text>
                      </Text>
                    </Panel>
                  ))}
                </View>
              ) : null}

              {/* Session Performance Summaries */}
              <View style={uiStyles.section}>
                <SectionTitle>Nhật ký hiệu suất từng buổi tập ({performanceResource.data.sessions.length})</SectionTitle>
                {performanceResource.data.sessions.length ? (
                  performanceResource.data.sessions.map((session) => (
                    <Panel key={session.sessionId} style={{ gap: space.xs }}>
                      <View style={uiStyles.row}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                          <Text style={[uiStyles.value, { fontSize: 14 }]}>
                            {formatDateTime(session.scheduledAt)}
                          </Text>
                        </View>
                        {session.alertCount ? (
                          <View
                            style={{
                              backgroundColor: colors.injuredSoft,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: radius.pill,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.destructive }}>
                              {session.alertCount} cảnh báo
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={{
                              backgroundColor: colors.fitSoft,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: radius.pill,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primary }}>
                              Ổn định
                            </Text>
                          </View>
                        )}
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          backgroundColor: colors.surface,
                          borderRadius: radius.sm,
                          padding: space.xs,
                          gap: space.md,
                          marginTop: 2,
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="pulse" size={12} color={colors.destructive} />
                            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Nhịp tim (bpm)</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                            TB {session.avgHeartRateBpm} · Max {session.maxHeartRateBpm}
                          </Text>
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="speedometer-outline" size={12} color="#0284c7" />
                            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Vận tốc (km/h)</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                            TB {(session.avgSpeedMps * 3.6).toFixed(1)} · Max {(session.maxSpeedMps * 3.6).toFixed(1)}
                          </Text>
                        </View>
                      </View>
                    </Panel>
                  ))
                ) : (
                  <AsyncStateView
                    isLoading={false}
                    error={null}
                    onRetry={() => void performanceResource.retry()}
                    empty
                    emptyLabel="Chưa có dữ liệu tổng kết hiệu suất buổi tập nào."
                  />
                )}
              </View>
            </>
          ) : null}
        </>
      ) : null}
      {visibleTab === "Costs" && horseResource.data ? (
        <>
          <AsyncStateView
            isLoading={medicalResource.isLoading}
            error={medicalResource.error}
            onRetry={() => void medicalResource.retry()}
          />
          {medicalResource.data ? (
            <View style={{ gap: space.md }}>
              {/* Cost Summary Header Cards */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                <View
                  style={{
                    flex: 1,
                    minWidth: "47%",
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: space.md,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        backgroundColor: "rgba(16, 185, 129, 0.12)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="cash-outline" size={16} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.mutedForeground }}>
                      Tổng chi phí y tế
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
                    {medicalResource.data.cases.totalCost != null
                      ? `${medicalResource.data.cases.totalCost.toLocaleString("vi-VN")} đ`
                      : "0 đ"}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                    {medicalResource.data.cases.items.length} ca bệnh đã ghi nhận
                  </Text>
                </View>

                {["manager", "owner", "trainer"].includes(roleId) ? (
                  <View
                    style={{
                      flex: 1,
                      minWidth: "47%",
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: space.md,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          backgroundColor: "rgba(59, 130, 246, 0.12)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="receipt-outline" size={16} color="#3B82F6" />
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.mutedForeground }}>
                        Phụ phí hàng ngày
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: colors.primary }}>
                      {(surchargesResource.data ?? [])
                        .reduce((sum, s) => sum + s.dailyAmount, 0)
                        .toLocaleString("vi-VN")}{" "}
                      đ/ngày
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                      {surchargesResource.data?.length ?? 0} khoản phụ phí đang tính
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Medical Cases Cost Breakdown */}
              <View style={uiStyles.section}>
                <SectionTitle>Chi phí các ca điều trị y tế</SectionTitle>
                {medicalResource.data.cases.items.length ? (
                  medicalResource.data.cases.items.map((medicalCase) => {
                    const isOpen = medicalCase.status === "OPEN";
                    return (
                      <Pressable
                        key={medicalCase.id}
                        onPress={() =>
                          router.push(`/${roleId}/medical/cases/${medicalCase.id}` as Href)
                        }
                      >
                        <Panel style={{ gap: space.xs, padding: space.md }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={[uiStyles.value, { fontSize: 14, fontWeight: "700", flex: 1, minWidth: 0 }]} numberOfLines={1}>
                              {medicalCase.initialDiagnosis}
                            </Text>
                            <View
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: radius.pill,
                                backgroundColor: isOpen ? "rgba(239, 68, 68, 0.12)" : colors.elevated,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: "700",
                                  color: isOpen ? colors.destructive : colors.mutedForeground,
                                }}
                              >
                                {isOpen ? "ĐANG ĐIỀU TRỊ" : "ĐÃ ĐÓNG"}
                              </Text>
                            </View>
                          </View>

                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                            <Text style={uiStyles.muted}>
                              {medicalCase.closedAt
                                ? `Đóng: ${new Date(medicalCase.closedAt).toLocaleDateString()}`
                                : `Mở: ${new Date(medicalCase.openedAt).toLocaleDateString()}`}
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>
                              {medicalCase.totalCost != null
                                ? `${medicalCase.totalCost.toLocaleString("vi-VN")} đ`
                                : "Chưa chốt"}
                            </Text>
                          </View>
                        </Panel>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={uiStyles.muted}>Chưa có ca điều trị y tế phát sinh chi phí.</Text>
                )}
              </View>

              {/* Care Surcharges Section */}
              {["manager", "owner", "trainer"].includes(roleId) ? (
                <View style={uiStyles.section}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <SectionTitle>Phụ phí chuồng & chăm sóc đặc biệt</SectionTitle>
                    <Pressable
                      onPress={() =>
                        router.push(`/${roleId}/horse/${horse.id}/stable-care?tab=Surcharges` as Href)
                      }
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                        Quản lý phụ phí →
                      </Text>
                    </Pressable>
                  </View>

                  <AsyncStateView
                    isLoading={surchargesResource.isLoading}
                    error={surchargesResource.error}
                    onRetry={() => void surchargesResource.retry()}
                    empty={
                      !surchargesResource.isLoading &&
                      !surchargesResource.error &&
                      (surchargesResource.data?.length ?? 0) === 0
                    }
                    emptyLabel="Không có khoản phụ phí nào ghi nhận cho ngựa này."
                  />

                  {(surchargesResource.data ?? []).map((surcharge) => (
                    <Panel key={surcharge.id} style={{ gap: space.xs, padding: space.md }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={[uiStyles.value, { fontSize: 14, fontWeight: "700", flex: 1, minWidth: 0 }]} numberOfLines={1}>
                          {surcharge.description}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>
                          {surcharge.dailyAmount.toLocaleString("vi-VN")} đ / ngày
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                        <Text style={uiStyles.muted}>
                          {surcharge.startDate} → {surcharge.endDate}
                        </Text>
                        <Text style={uiStyles.muted}>·</Text>
                        <Text style={uiStyles.muted}>
                          {surcharge.appliedByName ? `Bởi ${surcharge.appliedByName}` : "Chờ duyệt"}
                        </Text>
                      </View>
                    </Panel>
                  ))}

                  <PrimaryButton
                    label={roleId === "manager" ? "Thêm hoặc điều chỉnh phụ phí" : "Xem chi tiết phụ phí"}
                    icon="cash-outline"
                    onPress={() =>
                      router.push(`/${roleId}/horse/${horse.id}/stable-care?tab=Surcharges` as Href)
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
      {visibleTab === "Care" && !horseResource.data ? (
        <>
          <Info
            title="Current care plan"
            items={[
              ["Plan objective", plan?.objective ?? "No active care plan"],
              ["Next care task", nextSession?.title ?? "Not scheduled"],
              ["Assigned groom", nextSession?.assignedGroom ?? "—"],
            ]}
          />
          <ChartSection
            title="Care trend"
            data={fitnessTrend}
            valueKey="load"
            color={colors.training}
          />
        </>
      ) : null}
      {!horseResource.data &&
      (["Health", "Medical", "Injuries", "Treatment"] as string[]).includes(visibleTab) ? (
        <>
          <Info
            title="Vitals & status"
            items={[
              ["Status", locked ? "LOCKED" : horse.status],
              ["Temperature", "38.2 °C"],
              ["Resting HR", `${horse.hr} bpm`],
              ["Respiration", "16 /min"],
              ["Weight", `${horse.weight} kg`],
              ["Hydration", "Normal"],
            ]}
          />
          <View style={uiStyles.section}>
            <SectionTitle>Recovery</SectionTitle>
            <Panel>
              <View style={uiStyles.row}>
                <Text style={uiStyles.value}>Left hind leg · monitoring</Text>
                <Text style={uiStyles.value}>{horse.recovery ?? 100}%</Text>
              </View>
              <View style={{ height: space.md }} />
              <ProgressBar value={horse.recovery ?? 100} tone={colors.monitor} />
              <MiniChart data={recoveryTrend} valueKey="v" color={colors.monitor} />
            </Panel>
          </View>
          {roleId === "vet" ? (
            <>
              <PrimaryButton
                label="Record examination"
                onPress={() => router.push(`/vet/medical/visit?horseId=${horse.id}` as Href)}
              />
              <PrimaryButton
                label="Open injury mapping"
                onPress={() => router.push(`/vet/injury/${horse.id}`)}
              />
              <PrimaryButton
                label="Lock training"
                icon="lock-closed"
                onPress={() => router.push(`/vet/lock/${horse.id}`)}
              />
            </>
          ) : null}
        </>
      ) : null}
      {visibleTab === "Performance" && !horseResource.data ? (
        <>
          <ChartSection
            title="Top speed"
            data={speedTrend}
            valueKey="speed"
            color={colors.primary}
          />
          <ChartSection
            title="Peak heart rate"
            data={speedTrend}
            valueKey="hr"
            color={colors.destructive}
          />
          <ChartSection
            title="Weekly distance"
            data={fitnessTrend}
            valueKey="load"
            color={colors.training}
          />
        </>
      ) : null}
      {visibleTab === "Costs" && !horseResource.data ? (
        <Info
          title="Cost of ownership"
          items={[
            ["Training / month", "$3,400"],
            ["Medical / month", "$820"],
            ["Feed & bedding", "$610"],
            ["Prize earnings YTD", "$41,500"],
          ]}
        />
      ) : null}
      {visibleTab === "Timeline" && !horseResource.data ? (
        <View style={uiStyles.section}>
          <SectionTitle>Timeline</SectionTitle>
          <Panel>
            <TimelineItem
              time="10:41"
              title="Trainer published recovery plan"
              detail="800 m · 50% · light · soft surface"
              tone={colors.primary}
            />
            <TimelineItem
              time="10:24"
              title="Training locked by veterinarian"
              detail="Abnormal heart-rate response"
              tone={colors.destructive}
            />
            <TimelineItem
              time="10:06"
              title="System raised HR alert"
              detail="188 bpm sustained 42 s"
              tone={colors.training}
            />
            <TimelineItem
              time="06:20"
              title="Training session executed"
              detail="1,600 m · moderate · dirt"
            />
            <TimelineItem
              time="06:00"
              title="Groom completed preparation"
              detail="Sensor vest fitted by Mai Tran"
              last
            />
          </Panel>
        </View>
      ) : null}
      {visibleTab === "Timeline" && roleId === "manager" && horseResource.data ? (
        <View style={uiStyles.section}>
          <SectionTitle>Horse activity</SectionTitle>
          <AsyncStateView
            isLoading={auditResource.isLoading}
            error={auditResource.error}
            onRetry={() => void auditResource.retry()}
            empty={Boolean(auditResource.data && auditResource.data.length === 0)}
            emptyLabel="No audit activity is recorded for this horse."
          />
          {auditResource.data?.length ? (
            <Panel>
              {auditResource.data.map((entry, index) => (
                <TimelineItem
                  key={entry.id}
                  time={formatDateTime(entry.createdAt)}
                  title={`${entry.action} · ${formatEnum(entry.entityType)}`}
                  detail={[
                    entry.actor?.fullName ?? "System",
                    entry.feature ? formatEnum(entry.feature) : null,
                    entry.reason,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  tone={index === 0 ? colors.primary : colors.training}
                  last={index === (auditResource.data?.length ?? 0) - 1}
                />
              ))}
            </Panel>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function SpeedTrendChart({
  metrics,
  color,
}: {
  metrics: { recordedAt: string; speedMps: number }[];
  color: string;
}) {
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const speedData = useMemo(() => {
    return metrics.map((m, idx) => {
      const speedKmh = Number((m.speedMps * 3.6).toFixed(1));
      return {
        value: speedKmh,
        label:
          idx === 0 || idx === metrics.length - 1 || idx % Math.ceil(metrics.length / 4) === 0
            ? `${speedKmh}`
            : "",
        dataPointColor: color,
        speedKmh,
      };
    });
  }, [metrics, color]);

  const stats = useMemo(() => {
    if (!speedData.length) return null;
    const vals = speedData.map((d) => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    return { min, max, avg, count: vals.length };
  }, [speedData]);

  const yBounds = useMemo(() => {
    if (!speedData.length) return { min: 0, max: 60, step: 15, span: 60 };
    const vals = speedData.map((d) => d.value);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const diff = maxVal - minVal;
    const padding = diff === 0 ? Math.max(minVal * 0.1, 2) : Math.max(diff * 0.2, 2);
    const chartMin = Math.max(0, Math.floor(minVal - padding));
    const chartMax = Math.ceil(maxVal + padding);
    const noOfSections = 4;
    const rawSpan = Math.max(chartMax - chartMin, 4);
    const step = Math.max(1, Math.ceil(rawSpan / noOfSections));
    const span = step * noOfSections;
    return { min: chartMin, max: chartMin + span, step, span };
  }, [speedData]);

  const chartWidth = Math.max(120, containerWidth - 45);
  const initialSpacing = 14;
  const endSpacing = 14;
  const count = speedData.length;
  const availableWidth = Math.max(40, chartWidth - initialSpacing - endSpacing);
  const spacing = count > 1 ? availableWidth / (count - 1) : availableWidth;

  return (
    <Panel style={{ gap: space.md, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
            Lịch sử biến thiên vận tốc (km/h)
          </Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
            Tốc độ ghi nhận qua các thời điểm trong bài tập
          </Text>
        </View>
        {stats ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: radius.pill,
              backgroundColor: colors.fitSoft,
              borderWidth: 1,
              borderColor: color,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color }}>
              TB: {stats.avg} km/h
            </Text>
          </View>
        ) : null}
      </View>

      {stats ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            alignItems: "center",
            backgroundColor: colors.elevated,
            borderRadius: radius.sm,
            paddingVertical: 8,
            paddingHorizontal: 4,
          }}
        >
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Cao nhất</Text>
            <Text style={{ fontSize: 13, fontWeight: "800", color }}>
              {stats.max} km/h
            </Text>
          </View>
          <View style={{ width: 1, height: 18, backgroundColor: colors.border }} />
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Trung bình</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
              {stats.avg} km/h
            </Text>
          </View>
          <View style={{ width: 1, height: 18, backgroundColor: colors.border }} />
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Thấp nhất</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
              {stats.min} km/h
            </Text>
          </View>
          <View style={{ width: 1, height: 18, backgroundColor: colors.border }} />
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Số điểm đo</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
              {stats.count}
            </Text>
          </View>
        </View>
      ) : null}

      <View
        style={{
          width: "100%",
          height: 150,
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {speedData.length >= 2 && chartWidth > 0 ? (
          <LineChart
            data={speedData}
            width={chartWidth}
            height={120}
            spacing={spacing}
            initialSpacing={initialSpacing}
            endSpacing={endSpacing}
            disableScroll
            color={color}
            thickness={2.5}
            startFillColor={color}
            endFillColor={color}
            startOpacity={0.25}
            endOpacity={0.02}
            areaChart
            curved
            curveType={0}
            isAnimated
            animationDuration={600}
            noOfSections={4}
            maxValue={yBounds.span}
            yAxisOffset={yBounds.min}
            stepValue={yBounds.step}
            yAxisColor={colors.border}
            xAxisColor={colors.border}
            yAxisLabelWidth={34}
            yAxisTextStyle={{ fontSize: 9, color: colors.mutedForeground }}
            xAxisLabelTextStyle={{ fontSize: 9, color: colors.mutedForeground }}
            rulesColor={colors.border}
            rulesType="dashed"
            showVerticalLines={false}
            dataPointsColor={color}
            dataPointsRadius={4}
          />
        ) : null}
      </View>
    </Panel>
  );
}

function Info({ title, items }: { title: string; items: [string, string][] }) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  return (
    <View style={uiStyles.section}>
      <SectionTitle>{title}</SectionTitle>
      <Panel>
        <KeyValue items={items} />
      </Panel>
    </View>
  );
}
function ChartSection({
  title,
  data,
  valueKey,
  color,
}: {
  title: string;
  data: Record<string, unknown>[];
  valueKey: string;
  color: string;
}) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  return (
    <View style={uiStyles.section}>
      <SectionTitle>{title}</SectionTitle>
      <Panel>
        <MiniChart data={data} valueKey={valueKey} color={color} />
      </Panel>
    </View>
  );
}

function isUuid(value: string | string[] | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
const getStyles = (colors: any) =>
  StyleSheet.create({
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
    hero: { gap: space.lg },
    flex: { flex: 1, minWidth: 0, gap: 4 },
    name: { color: colors.foreground, fontSize: 25, fontWeight: "800" },
    photo: { width: 72, height: 72, borderRadius: 16, backgroundColor: colors.elevated },
    horseId: { color: colors.mutedForeground, fontSize: 10, fontFamily: "monospace" },
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
    perfTile: {
      flex: 1,
      minWidth: "47%",
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    perfIconBox: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    perfValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
    },
    perfLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
      marginTop: 1,
    },
    perfCommentCard: {
      gap: space.xs,
      backgroundColor: colors.surface,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      padding: space.sm,
    },
    perfCommentText: {
      fontSize: 13,
      fontStyle: "italic",
      color: colors.foreground,
      lineHeight: 19,
    },
    workloadChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: space.xs,
    },
    workloadChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
    },
    workloadChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.foreground,
    },
    thresholdBadge: {
      flex: 1,
      alignItems: "center",
      padding: space.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      gap: 2,
    },
    thresholdValue: {
      fontSize: 13,
      fontWeight: "800",
      marginTop: 2,
    },
    thresholdLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.mutedForeground,
      textAlign: "center",
    },
  });

export default HorseDetailScreen;

