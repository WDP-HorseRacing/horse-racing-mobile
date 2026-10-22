import { type Href, Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { fitnessTrend, getHorse, raceResults, recoveryTrend, speedTrend } from "@/lib/raceos-data";
import type { RoleId } from "@/lib/raceos-data";
import { useRaceOS } from "@/context/RaceOSContext";
import {
  Chips,
  Field,
  MiniChart,
  ProgressBar,
  Metric,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
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
import { racingService } from "@/services/racing.service";
import { auditService } from "@/services/audit.service";
import { extractErrorMessage } from "@/utils/errorHandler";

const tabsByRole: Record<RoleId, string[]> = {
  trainer: ["Overview", "Training", "Health", "Performance", "Racing"],
  vet: ["Overview", "Training", "Health", "Injuries", "Treatment"],
  groom: ["Overview", "Care"],
  owner: ["Overview", "Training", "Health", "Performance", "Racing", "Costs"],
  manager: ["Overview", "Health", "Performance", "Racing", "Costs", "Timeline"],
};

export default function HorseProfile() {
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
  const [thresholdEditorOpen, setThresholdEditorOpen] = useState(false);
  const [thresholdName, setThresholdName] = useState("Horse-specific limits");
  const [thresholdWarning, setThresholdWarning] = useState("");
  const [thresholdCritical, setThresholdCritical] = useState("");
  const [thresholdSpeed, setThresholdSpeed] = useState("");
  const [savingThreshold, setSavingThreshold] = useState(false);
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
      if (["Health", "Injuries", "Treatment"].includes(item))
        return permissionsResource.data?.canViewMedicalTab === true;
      if (item === "Performance") return permissionsResource.data?.canViewPerformanceTab === true;
      if (item === "Training") return permissionsResource.data?.canViewTrainingTab === true;
      if (item === "Racing") return ["manager", "trainer", "owner"].includes(roleId);
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
        visibleTab === "Injuries" ||
        visibleTab === "Treatment" ||
        visibleTab === "Costs"),
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
  const loadRaceResults = useCallback(
    () => racingService.listHorseResults(token!, id),
    [id, token],
  );
  const racingResource = useApiResource(
    loadRaceResults,
    Boolean(
      token &&
      isUuid(id) &&
      ["manager", "trainer", "owner"].includes(roleId) &&
      visibleTab === "Racing",
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
      racingResource.revalidate,
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
    racingResource.revalidate,
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

  const saveHorseThresholds = async () => {
    if (!token || !isUuid(id) || !thresholdName.trim() || savingThreshold) return;
    const warning = Number(thresholdWarning);
    const critical = Number(thresholdCritical);
    const maxSpeed = Number(thresholdSpeed);
    if (
      !Number.isInteger(warning) ||
      warning < 1 ||
      warning > 300 ||
      !Number.isInteger(critical) ||
      critical < 1 ||
      critical > 300 ||
      critical <= warning ||
      !Number.isFinite(maxSpeed) ||
      maxSpeed < 1 ||
      maxSpeed > 30
    ) {
      Alert.alert(
        "Check threshold values",
        "Enter warning and critical heart-rate limits from 1–300 bpm with critical above warning, and maximum speed from 1–30 m/s.",
      );
      return;
    }
    setSavingThreshold(true);
    try {
      await performanceService.setThresholds(token, id, {
        profileName: thresholdName.trim(),
        effectiveFrom: new Date().toISOString(),
        limits: {
          heartRateWarningBpm: warning,
          heartRateCriticalBpm: critical,
          maxSpeedMps: maxSpeed,
        },
      });
      setThresholdEditorOpen(false);
      await performanceResource.refresh();
      Alert.alert(
        "Threshold version saved",
        "The new horse-specific limits are now available from the Backend.",
      );
    } catch (error) {
      Alert.alert("Could not save thresholds", extractErrorMessage(error));
    } finally {
      setSavingThreshold(false);
    }
  };

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
      Alert.alert("Health status updated", "The Backend history has been refreshed.");
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
      )} · ${t(horseResource.data ? "Backend profile" : "Demo profile")}`}
      back
      fallbackHref={`/${roleId}/horses` as any}
      refreshing={
        horseResource.isRefreshing ||
        trainingResource.isRefreshing ||
        permissionsResource.isRefreshing ||
        medicalResource.isRefreshing ||
        performanceResource.isRefreshing ||
        racingResource.isRefreshing ||
        careResource.isRefreshing
      }
      onRefresh={() =>
        void Promise.all([
          horseResource.refresh(),
          trainingResource.refresh(),
          permissionsResource.refresh(),
          medicalResource.refresh(),
          performanceResource.refresh(),
          racingResource.refresh(),
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
      <Panel style={styles.hero}>
        <View style={uiStyles.row}>
          {horseResource.data && photoResource.data?.url ? (
            <Image
              source={{ uri: photoResource.data.url }}
              accessibilityLabel={`${horse.name} portrait`}
              style={styles.photo}
            />
          ) : null}
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
              {horse.name}
            </Text>
            {horseResource.data ? (
              <Text style={styles.horseId} numberOfLines={1} ellipsizeMode="middle">
                Horse ID · {horse.id}
              </Text>
            ) : null}
            <Text style={uiStyles.muted} numberOfLines={1}>
              {horse.age ? `${horse.age} yo ` : ""}
              {horse.sex} · {horse.breed} · {horse.color}
            </Text>
            <Text style={uiStyles.muted} numberOfLines={1}>
              Stall {horse.stall} ·{" "}
              {horse.weight ? formatWeight(horse.weight) : "Weight not recorded"} · {horse.owner}
            </Text>
          </View>
          <StatusBadge status={locked ? "LOCKED" : horse.status} />
        </View>
        {horse.note ? (
          <View style={uiStyles.alert}>
            <Text style={uiStyles.muted}>{horse.note}</Text>
          </View>
        ) : null}
        <View style={uiStyles.metricGrid}>
          <Metric
            label="Fitness"
            value={horseResource.data ? "—" : `${horse.fitness}%`}
            tone={horse.fitness >= 80 ? "good" : "warning"}
          />
          <Metric
            label="Readiness"
            value={
              horseResource.data
                ? horseResource.data.eligibility.trainingEligible
                  ? "Eligible"
                  : "Restricted"
                : horse.readiness
            }
          />
          <Metric
            label="Resting HR"
            value={horseResource.data || !horse.hr ? "—" : horse.hr}
            hint={horseResource.data || !horse.hr ? undefined : "bpm"}
          />
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
                  ["Date of birth", horseResource.data.dateOfBirth ?? t("Not recorded")],
                  ["Owner", horseResource.data.owner?.fullName ?? t("Unassigned")],
                  ["Barn", horseResource.data.location?.barn?.name ?? t("Not assigned")],
                  ["Stall", horseResource.data.location?.stall?.code ?? t("Not assigned")],
                  ["Groom", horseResource.data.groom?.fullName ?? t("Not assigned")],
                  [
                    "Race aptitude",
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
                    const dam = ancestors.find(
                      (a) => a.generation === 1 && a.parentRole === "DAM",
                    );
                    const paternalGrandsire = ancestors.find(
                      (a) => a.generation === 2 && a.childId === sire?.id && a.parentRole === "SIRE",
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
                      paternalGrandsire || paternalGranddam || maternalGrandsire || maternalGranddam,
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
                    • {formatEnum(reason)}
                  </Text>
                ))}
                <Text style={[uiStyles.value, { marginTop: space.xs }]}>
                  Racing:{" "}
                  <Text
                    style={{
                      color: horseResource.data.eligibility.racingEligible
                        ? colors.fit
                        : colors.injured,
                      fontWeight: "700",
                    }}
                  >
                    {horseResource.data.eligibility.racingEligible ? "Eligible" : "Restricted"}
                  </Text>
                </Text>
                {horseResource.data.eligibility.racingReasons.map((reason) => (
                  <Text
                    key={`racing-${reason}`}
                    style={[uiStyles.muted, { color: colors.mutedForeground }]}
                  >
                    • {formatEnum(reason)}
                  </Text>
                ))}
              </Panel>
              <PrimaryButton
                label="Body measurements"
                icon="stats-chart"
                onPress={() => router.push(`/${roleId}/horse/${horse.id}/measurements` as Href)}
              />
              <PrimaryButton
                label="Ownership history"
                icon="people-outline"
                onPress={() => router.push(`/${roleId}/horse/${horse.id}/ownership` as Href)}
              />
              <PrimaryButton
                label="Stable care and feeding"
                icon="leaf-outline"
                onPress={() => router.push(`/${roleId}/horse/${horse.id}/stable-care` as Href)}
              />
              {["trainer", "groom", "manager"].includes(roleId) && !horseResource.data.isDeleted ? (
                <PrimaryButton
                  label="Request examination"
                  icon="medkit-outline"
                  onPress={() =>
                    router.push(`/${roleId}/medical/requests?horseId=${horse.id}` as Href)
                  }
                />
              ) : null}
              {permissionsResource.data?.canEditProfile &&
              roleId === "manager" &&
              !horseResource.data.isDeleted ? (
                <PrimaryButton
                  label="Edit horse profile"
                  icon="create-outline"
                  onPress={() => router.push(`/manager/edit-horse/${horse.id}` as Href)}
                />
              ) : null}
              {permissionsResource.data?.canEditRaceAptitude && !horseResource.data.isDeleted ? (
                <Panel style={{ gap: space.md }}>
                  <Field label="Race aptitude · Head Trainer">
                    <Chips
                      options={["SPRINTER", "MILER", "STAYER"]}
                      value={raceAptitudeValue}
                      onChange={setRaceAptitudeDraft}
                    />
                  </Field>
                  <PrimaryButton
                    style={{ marginTop: space.xs }}
                    label={savingAptitude ? "Saving…" : "Save race aptitude"}
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
                          Alert.alert("Race aptitude updated", "Horse profile has been refreshed.");
                        } catch (error) {
                          Alert.alert("Could not update race aptitude", extractErrorMessage(error));
                        } finally {
                          setSavingAptitude(false);
                        }
                      })()
                    }
                  />
                </Panel>
              ) : null}
              {((permissionsResource.data?.canAssignBarn && roleId === "manager") ||
                (permissionsResource.data?.canAssignStallAndGroom && roleId === "trainer")) &&
              !horseResource.data.isDeleted ? (
                <PrimaryButton
                  label="Manage barn, stall and Groom"
                  icon="business-outline"
                  onPress={() => router.push(`/${roleId}/horse/${horse.id}/placement` as Href)}
                />
              ) : null}
              {roleId === "manager" &&
              (permissionsResource.data?.canChangeLifecycle ||
                permissionsResource.data?.canDelete ||
                permissionsResource.data?.canRestore) ? (
                <PrimaryButton
                  label="Lifecycle, delete or restore"
                  icon="repeat"
                  onPress={() => router.push(`/manager/lifecycle/${horse.id}` as Href)}
                />
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
              <ChartSection
                title="Fitness trend"
                data={fitnessTrend}
                valueKey="v"
                color={colors.primary}
              />
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
                  onPress={() =>
                    router.push(
                      `/trainer/plan/${session.classId}/session/${session.sessionId}` as Href,
                    )
                  }
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
                        {session.status.replaceAll("_", " ")}
                      </Text>
                    </View>
                    <Text style={uiStyles.muted}>
                      {session.scheduledStartLabel}
                      {session.distanceM == null ? "" : ` · ${formatDistance(session.distanceM)}`}
                      {session.surface ? ` · ${session.surface}` : ""}
                    </Text>
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
              emptyLabel="Training sessions are loaded for horse profiles returned by the backend."
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
          <AsyncStateView
            isLoading={medicalResource.isLoading}
            error={medicalResource.error}
            onRetry={() => void medicalResource.retry()}
          />
          <Info
            title="Health and latest measurements"
            items={[
              ["Health status", formatEnum(horseResource.data.healthStatus)],
              [
                "Training eligibility",
                horseResource.data.eligibility.trainingEligible
                  ? "Eligible"
                  : horseResource.data.eligibility.trainingReasons
                      .map((reason) => formatEnum(reason))
                      .join(", ") || "Restricted",
              ],
              ...horseResource.data.latestMeasurements.map(
                (measurement) =>
                  [
                    formatEnum(measurement.type),
                    `${measurement.value} ${measurement.unit} · ${new Date(measurement.measuredAt).toLocaleDateString()}${measurement.isAbnormal ? " · abnormal" : ""}`,
                  ] as [string, string],
              ),
            ]}
          />
          <PrimaryButton
            label="Body measurements"
            icon="stats-chart"
            onPress={() => router.push(`/${roleId}/horse/${horse.id}/measurements` as Href)}
          />
          {roleId === "vet" ? (
            <>
              <PrimaryButton
                label="Record examination"
                icon="medkit-outline"
                onPress={() => router.push(`/vet/medical/visit?horseId=${horse.id}` as Href)}
              />
              <PrimaryButton
                label={
                  horseResource.data.activeTrainingLock ? "Manage training lock" : "Lock training"
                }
                icon="lock-closed"
                onPress={() => router.push(`/vet/lock/${horse.id}` as Href)}
              />
              <PrimaryButton
                label="Manage care schedule"
                icon="calendar-outline"
                onPress={() => router.push(`/vet/medical/care?horseId=${horse.id}` as Href)}
              />
              {permissionsResource.data?.canChangeHealth ? (
                <View style={uiStyles.section}>
                  <SectionTitle>Update health status</SectionTitle>
                  <Chips
                    options={["ELIGIBLE", "UNDER_OBSERVATION", "INJURED", "QUARANTINED"]}
                    value={healthStatusDraft || horseResource.data.healthStatus}
                    onChange={setHealthStatusDraft}
                  />
                  {healthStatusDraft && healthStatusDraft !== horseResource.data.healthStatus ? (
                    <>
                      <Field label="Reason for this change">
                        <NativeInput
                          value={healthReason}
                          onChangeText={setHealthReason}
                          multiline
                        />
                      </Field>
                      <PrimaryButton
                        style={{ marginTop: space.xs }}
                        label={savingHealth ? "Saving…" : "Save health status"}
                        disabled={savingHealth || !isValidRequiredText(healthReason, 500)}
                        onPress={() => void saveHealthStatus()}
                      />
                    </>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
          {medicalResource.data ? (
            <View style={uiStyles.section}>
              <SectionTitle>Medical cases</SectionTitle>
              {medicalResource.data.cases.items.length ? (
                medicalResource.data.cases.items.map((medicalCase) => (
                  <Pressable
                    key={medicalCase.id}
                    onPress={() =>
                      router.push(`/${roleId}/medical/cases/${medicalCase.id}` as Href)
                    }
                  >
                    <Panel>
                      <Text style={uiStyles.value}>{medicalCase.initialDiagnosis}</Text>
                      <Text style={uiStyles.muted}>
                        {medicalCase.status} · opened{" "}
                        {new Date(medicalCase.openedAt).toLocaleDateString()}
                      </Text>
                      {medicalCase.closedAt ? (
                        <Text style={uiStyles.muted}>
                          Closed {new Date(medicalCase.closedAt).toLocaleDateString()}
                        </Text>
                      ) : null}
                      {medicalCase.finalConclusion ? (
                        <Text>{medicalCase.finalConclusion}</Text>
                      ) : null}
                      {"totalCost" in medicalCase ? (
                        <Text>
                          Medical cost:{" "}
                          {medicalCase.totalCost == null
                            ? "Hidden or not yet closed"
                            : `${medicalCase.totalCost.toLocaleString()} VND`}
                        </Text>
                      ) : null}
                    </Panel>
                  </Pressable>
                ))
              ) : (
                <AsyncStateView
                  isLoading={false}
                  error={null}
                  onRetry={() => void medicalResource.retry()}
                  empty
                  emptyLabel="No medical cases are recorded."
                />
              )}
              <SectionTitle>Medical visits</SectionTitle>
              {medicalResource.data.records.length ? (
                medicalResource.data.records.slice(0, 12).map((record) => (
                  <Pressable
                    key={record.id}
                    onPress={() => router.push(`/${roleId}/medical/visits/${record.id}` as Href)}
                  >
                    <Panel>
                      <Text style={uiStyles.value}>
                        {record.conclusion ?? record.diagnosis ?? record.kind}
                      </Text>
                      <Text style={uiStyles.muted}>
                        {new Date(record.examDate).toLocaleString()} · {record.resultingStatus}
                        {record.voidedAt
                          ? ` · voided: ${record.voidReason ?? "no reason returned"}`
                          : ""}
                      </Text>
                      {record.careInstructions ? <Text>{record.careInstructions}</Text> : null}
                    </Panel>
                  </Pressable>
                ))
              ) : (
                <Text style={uiStyles.muted}>No medical visits are recorded.</Text>
              )}
              <SectionTitle>Care schedule history</SectionTitle>
              {medicalResource.data.careSchedules.length ? (
                medicalResource.data.careSchedules.map((schedule) => (
                  <Panel key={schedule.id}>
                    <View style={uiStyles.row}>
                      <Text style={[uiStyles.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                        {schedule.type.replaceAll("_", " ")}
                      </Text>
                      <Text style={[uiStyles.label, { flexShrink: 0 }]}>
                        {schedule.status.replaceAll("_", " ")}
                      </Text>
                    </View>
                    <Text style={uiStyles.muted}>
                      Due {new Date(schedule.dueAt).toLocaleString()}
                    </Text>
                    {schedule.completedAt ? (
                      <Text style={uiStyles.muted}>
                        Completed {new Date(schedule.completedAt).toLocaleString()}
                      </Text>
                    ) : null}
                    {schedule.cancelReason ? (
                      <Text style={uiStyles.muted}>Cancelled: {schedule.cancelReason}</Text>
                    ) : null}
                    {schedule.notes ? <Text>{schedule.notes}</Text> : null}
                  </Panel>
                ))
              ) : (
                <Text style={uiStyles.muted}>No care schedules are recorded.</Text>
              )}
              <PrimaryButton
                label="Open care schedule details"
                icon="calendar-outline"
                onPress={() => router.push(`/${roleId}/medical/care?horseId=${horse.id}` as Href)}
              />
              <SectionTitle>Health status history</SectionTitle>
              {medicalResource.data.healthHistory.length ? (
                medicalResource.data.healthHistory.map((item, index) => (
                  <Panel key={`${item.changedAt}-${index}`}>
                    <Text style={uiStyles.value}>
                      {item.from ?? "Initial"} → {item.to}
                    </Text>
                    <Text style={uiStyles.muted}>
                      {new Date(item.changedAt).toLocaleString()}
                      {item.feature ? ` · ${item.feature}` : ""}
                      {item.actorId ? ` · staff ${item.actorId.slice(0, 8)}` : " · system"}
                    </Text>
                    {item.reason ? <Text>{item.reason}</Text> : null}
                  </Panel>
                ))
              ) : (
                <Text style={uiStyles.muted}>No health status changes are recorded.</Text>
              )}
            </View>
          ) : null}
        </>
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
                  <View style={uiStyles.metricGrid}>
                    <Metric
                      label="Sessions tracked"
                      value={performanceResource.data.summary.sessionsTracked}
                    />
                    <Metric
                      label="Latest heart rate"
                      value={performanceResource.data.summary.latestMetric?.heartRateBpm ?? "—"}
                      hint={
                        performanceResource.data.summary.latestMetric
                          ? "bpm · latest sample"
                          : undefined
                      }
                    />
                    <Metric
                      label="Latest speed"
                      value={
                        performanceResource.data.summary.latestMetric
                          ? `${(performanceResource.data.summary.latestMetric.speedMps * 3.6).toFixed(1)} km/h`
                          : "—"
                      }
                    />
                    <Metric
                      label="Evaluation score"
                      value={performanceResource.data.summary.latestEvaluation?.score ?? "—"}
                    />
                  </View>
                  {performanceResource.data.summary.latestEvaluation?.comment ? (
                    <Panel>
                      <Text>{performanceResource.data.summary.latestEvaluation.comment}</Text>
                    </Panel>
                  ) : null}
                  {performanceResource.data.summary.recentMetrics.length > 1 ? (
                    <ChartSection
                      title="Recent speed history"
                      data={performanceResource.data.summary.recentMetrics.map((point) => ({
                        speed: point.speedMps * 3.6,
                      }))}
                      valueKey="speed"
                      color={colors.primary}
                    />
                  ) : null}
                </>
              ) : (
                <Panel>
                  <Text style={uiStyles.muted}>
                    Horse Owners receive per-session performance summaries. Raw sensor points are
                    restricted to staff roles.
                  </Text>
                </Panel>
              )}

              {performanceResource.data.workload ? (
                <View style={uiStyles.section}>
                  <SectionTitle>
                    Training workload · {performanceResource.data.workload.from ?? "—"} to{" "}
                    {performanceResource.data.workload.to ?? "—"}
                  </SectionTitle>
                  <Panel>
                    <Text style={uiStyles.value}>
                      {performanceResource.data.workload.sessionsCompleted ?? 0} completed sessions ·{" "}
                      {performanceResource.data.workload.byIntensity?.LIGHT ?? 0} light ·{" "}
                      {performanceResource.data.workload.byIntensity?.HEAVY ?? 0} heavy
                    </Text>
                    <Text style={uiStyles.muted}>
                      Planned {(performanceResource.data.workload.plannedDistanceM ?? 0).toLocaleString()} m
                      · actual {(performanceResource.data.workload.actualDistanceM ?? 0).toLocaleString()} m
                      · {Math.round((performanceResource.data.workload.actualDurationSeconds ?? 0) / 60)}{" "}
                      actual minutes
                    </Text>
                  </Panel>
                </View>
              ) : null}

              {performanceResource.data.thresholds ? (
                <View style={uiStyles.section}>
                  <SectionTitle>Heart-rate and speed thresholds</SectionTitle>
                  <Panel style={{ gap: 6 }}>
                    <Text style={uiStyles.label}>
                      Source: {formatEnum(performanceResource.data.thresholds.source)}
                    </Text>
                    <Text style={uiStyles.muted}>
                      Warning {performanceResource.data.thresholds.activeLimits.heartRateWarningBpm}{" "}
                      bpm · critical{" "}
                      {performanceResource.data.thresholds.activeLimits.heartRateCriticalBpm} bpm ·
                      max speed {performanceResource.data.thresholds.activeLimits.maxSpeedMps} m/s
                    </Text>
                    {performanceResource.data.thresholds.profiles.map((profile) => (
                      <Text key={profile.id} style={uiStyles.label}>
                        {profile.profileName} · v{profile.ruleVersion} ·{" "}
                        {formatDateTime(profile.effectiveFrom)}
                        {profile.effectiveTo ? ` – ${formatDateTime(profile.effectiveTo)}` : ""}
                      </Text>
                    ))}
                    {roleId === "trainer" ? (
                      <SecondaryButton
                        label="Set horse-specific thresholds"
                        icon="options-outline"
                        onPress={() => {
                          setThresholdWarning(
                            String(
                              performanceResource.data?.thresholds?.activeLimits
                                .heartRateWarningBpm ?? 220,
                            ),
                          );
                          setThresholdCritical(
                            String(
                              performanceResource.data?.thresholds?.activeLimits
                                .heartRateCriticalBpm ?? 240,
                            ),
                          );
                          setThresholdSpeed(
                            String(
                              performanceResource.data?.thresholds?.activeLimits.maxSpeedMps ?? 18,
                            ),
                          );
                          setThresholdEditorOpen((value) => !value);
                        }}
                      />
                    ) : null}
                  </Panel>
                  {thresholdEditorOpen && roleId === "trainer" ? (
                    <Panel style={{ gap: 10 }}>
                      <Field label="Profile name">
                        <NativeInput value={thresholdName} onChangeText={setThresholdName} />
                      </Field>
                      <Field label="Heart rate warning (1–300 bpm)">
                        <NativeInput
                          value={thresholdWarning}
                          onChangeText={setThresholdWarning}
                          keyboardType="number-pad"
                        />
                      </Field>
                      <Field label="Heart rate critical (1–300 bpm)">
                        <NativeInput
                          value={thresholdCritical}
                          onChangeText={setThresholdCritical}
                          keyboardType="number-pad"
                        />
                      </Field>
                      <Field label="Maximum speed (1–30 m/s)">
                        <NativeInput
                          value={thresholdSpeed}
                          onChangeText={setThresholdSpeed}
                          keyboardType="decimal-pad"
                        />
                      </Field>
                      <PrimaryButton
                        label={savingThreshold ? "Saving…" : "Create threshold version"}
                        disabled={savingThreshold}
                        onPress={() => void saveHorseThresholds()}
                      />
                    </Panel>
                  ) : null}
                </View>
              ) : null}

              {performanceResource.data.alerts.length ? (
                <View style={uiStyles.section}>
                  <SectionTitle>Recent sensor alerts</SectionTitle>
                  {performanceResource.data.alerts.map((alert, index) => (
                    <Panel key={`${alert.sessionParticipantId}:${alert.recordedAt}:${index}`}>
                      <View style={uiStyles.row}>
                        <Text
                          style={[
                            uiStyles.value,
                            {
                              flex: 1,
                              minWidth: 0,
                              color:
                                alert.alertLevel === "CRITICAL"
                                  ? colors.destructive
                                  : colors.monitor,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {alert.alertLevel}
                        </Text>
                        <Text style={[uiStyles.label, { flexShrink: 0 }]}>
                          {formatDateTime(alert.recordedAt)}
                        </Text>
                      </View>
                      <Text style={uiStyles.muted}>
                        {alert.sessionName ?? "Training session"} · {alert.heartRateBpm} bpm ·{" "}
                        {alert.speedMps.toFixed(2)} m/s
                      </Text>
                    </Panel>
                  ))}
                </View>
              ) : null}

              <View style={uiStyles.section}>
                <SectionTitle>Session performance summaries</SectionTitle>
                {performanceResource.data.sessions.length ? (
                  performanceResource.data.sessions.map((session) => (
                    <Panel key={session.sessionId}>
                      <Text style={uiStyles.value}>{formatDateTime(session.scheduledAt)}</Text>
                      <Text style={uiStyles.muted}>
                        Heart rate {session.avgHeartRateBpm} avg / {session.maxHeartRateBpm} max ·
                        Speed {(session.avgSpeedMps * 3.6).toFixed(1)} avg /{" "}
                        {(session.maxSpeedMps * 3.6).toFixed(1)} km/h max
                      </Text>
                      {session.alertCount ? (
                        <Text style={{ color: colors.destructive }}>
                          {session.alertCount} performance alerts
                        </Text>
                      ) : null}
                    </Panel>
                  ))
                ) : (
                  <AsyncStateView
                    isLoading={false}
                    error={null}
                    onRetry={() => void performanceResource.retry()}
                    empty
                    emptyLabel="No session performance summaries are available."
                  />
                )}
              </View>
            </>
          ) : null}
        </>
      ) : null}
      {visibleTab === "Racing" && horseResource.data ? (
        <>
          <Info
            title="Racing eligibility"
            items={[
              [
                "Can register",
                horseResource.data.eligibility.racingEligible ? "Eligible" : "Restricted",
              ],
              [
                "Reasons",
                horseResource.data.eligibility.racingReasons
                  .map((reason) => formatEnum(reason))
                  .join(", ") || "None returned",
              ],
            ]}
          />
          <AsyncStateView
            isLoading={racingResource.isLoading}
            error={racingResource.error}
            onRetry={() => void racingResource.retry()}
          />
          {racingResource.data?.length ? (
            racingResource.data.map((result) => (
              <Panel key={result.registrationId}>
                <Text style={uiStyles.value}>{result.raceName}</Text>
                <Text style={uiStyles.muted}>
                  {new Date(result.scheduledAt).toLocaleString()} · {result.raceStatus} ·{" "}
                  {result.registrationStatus}
                </Text>
                <Text>
                  {result.placing == null ? "Result not recorded" : `Place ${result.placing}`}
                  {result.timeSeconds == null ? "" : ` · ${result.timeSeconds}s`}
                </Text>
              </Panel>
            ))
          ) : racingResource.data ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => void racingResource.retry()}
              empty
              emptyLabel="No race results are recorded for this horse."
            />
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
            <>
              <Info
                title="Medical costs · VND"
                items={[
                  [
                    "Total of closed cases",
                    medicalResource.data.cases.totalCost === undefined
                      ? "Not returned for this role"
                      : medicalResource.data.cases.totalCost.toLocaleString(),
                  ],
                  ["Medical cases", String(medicalResource.data.cases.items.length)],
                  [
                    "Other horse costs",
                    "Daily fees and care surcharges appear in owner cost reports; supplies are reported for the club",
                  ],
                ]}
              />
              {medicalResource.data.cases.items.map((medicalCase) => (
                <Panel key={medicalCase.id}>
                  <Text style={uiStyles.value}>{medicalCase.initialDiagnosis}</Text>
                  <Text style={uiStyles.muted}>
                    {medicalCase.status} ·{" "}
                    {medicalCase.closedAt
                      ? new Date(medicalCase.closedAt).toLocaleDateString()
                      : "Not closed"}
                  </Text>
                  {medicalCase.totalCost === undefined ? (
                    <Text>Cost is not returned for this role.</Text>
                  ) : (
                    <Text>
                      {medicalCase.totalCost == null
                        ? "Hidden or not closed"
                        : `${medicalCase.totalCost.toLocaleString()} VND`}
                    </Text>
                  )}
                </Panel>
              ))}
            </>
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
      (["Health", "Injuries", "Treatment"] as string[]).includes(visibleTab) ? (
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
                onPress={() => router.push(`/vet/exam/${horse.id}`)}
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
      {visibleTab === "Racing" && !horseResource.data ? (
        <View style={uiStyles.section}>
          <SectionTitle>Racing</SectionTitle>
          <Panel>
            <Text style={uiStyles.value}>{horse.nextRace ?? "No entry scheduled"}</Text>
            <Text style={uiStyles.muted}>
              Readiness {horse.readiness} · fitness {horse.fitness}%
            </Text>
          </Panel>
          {raceResults.map((result) => (
            <Panel key={result.name}>
              <View style={uiStyles.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={uiStyles.value} numberOfLines={1}>
                    {result.name}
                  </Text>
                  <Text style={uiStyles.muted}>{result.date}</Text>
                </View>
                <Text style={{ ...uiStyles.value, color: colors.primary, flexShrink: 0 }}>
                  {result.place} · {result.prize}
                </Text>
              </View>
            </Panel>
          ))}
        </View>
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
  });
