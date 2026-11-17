import { type Href, Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { getHorse } from "@/lib/raceos-data";
import type { RoleId } from "@/lib/raceos-data";
import { useRaceOS } from "@/context/RaceOSContext";
import {
  Chips,
  Panel,
  getUiStyles,
} from "@/components/ui";
import { TimelineItem, Screen, SectionTitle } from "@/components/common";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { isRole } from "@/features/auth/roles";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { formatEnum } from "@/utils/formatters";
import { trainingService } from "@/services/training.service";
import { horseService } from "@/services/horse.service";
import { mapHorseDetailToPrototype } from "@/adapters/horse.adapter";
import { medicalService } from "@/services/medical.service";
import { performanceService } from "@/services/performance.service";
import { auditService } from "@/services/audit.service";
import { stableCareService } from "@/services/stable-care.service";
import { HorseTimelineTab } from "@/features/horses/components/tabs/HorseTimelineTab";
import { HorseTrainingTab } from "@/features/horses/components/tabs/HorseTrainingTab";
import { HorseNutritionTab } from "@/features/horses/components/tabs/HorseNutritionTab";
import { HorseCostsTab } from "@/features/horses/components/tabs/HorseCostsTab";
import { HorsePerformanceTab } from "@/features/horses/components/tabs/HorsePerformanceTab";
import { HorseMedicalTab } from "@/features/horses/components/tabs/HorseMedicalTab";
import { HorseOverviewTab } from "@/features/horses/components/tabs/HorseOverviewTab";

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
        <HorseOverviewTab
          horseId={id}
          roleId={roleId}
          isRealData={Boolean(horseResource.data)}
          horseData={horseResource.data}
          mockHorse={mockHorse}
          token={token}
          pedigreeResource={pedigreeResource}
          permissionsResource={permissionsResource}
          onHorseRefresh={horseResource.refresh}
          onSelectTab={setTab}
        />
      ) : null}

      {visibleTab === "Training" ? (
        <HorseTrainingTab
          trainingResource={trainingResource}
          roleId={roleId}
          horseLifecycleStatus={horseResource.data?.lifecycleStatus}
          isUuidId={isUuid(id)}
        />
      ) : null}

      {(visibleTab === "Nutrition" || (roleId === "groom" && visibleTab === "Care")) && horseResource.data ? (
        <HorseNutritionTab
          horseId={horse.id}
          roleId={roleId}
          surchargesResource={surchargesResource}
        />
      ) : null}

      {["Care", "Health", "Medical", "Injuries", "Treatment"].includes(visibleTab) &&
      (roleId !== "groom" || visibleTab !== "Care" || !horseResource.data) ? (
        <HorseMedicalTab
          tab={visibleTab}
          horseId={id}
          roleId={roleId}
          isRealData={Boolean(horseResource.data)}
          horseData={horseResource.data}
          mockHorse={mockHorse}
          locked={locked}
          plan={plan}
          nextSession={nextSession}
          token={token}
          medicalResource={medicalResource}
          careResource={careResource}
          permissionsResource={permissionsResource}
          onHorseRefresh={horseResource.refresh}
        />
      ) : null}

      {visibleTab === "Performance" ? (
        <HorsePerformanceTab
          isRealData={Boolean(horseResource.data)}
          performanceResource={performanceResource}
        />
      ) : null}

      {visibleTab === "Costs" ? (
        <HorseCostsTab
          horseId={id}
          roleId={roleId}
          isRealData={Boolean(horseResource.data)}
          medicalResource={medicalResource}
          surchargesResource={surchargesResource}
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
        <HorseTimelineTab auditResource={auditResource} />
      ) : null}
    </Screen>
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
  });

export default HorseDetailScreen;
