import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getHorse, trainingPlans, type RoleId } from "@/lib/raceos-data";
import { mapHorseDetailToPrototype } from "@/adapters/horse.adapter";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { auditService } from "@/services/audit.service";
import { horseService } from "@/services/horse.service";
import { medicalService } from "@/services/medical.service";
import { performanceService } from "@/services/performance.service";
import { stableCareService } from "@/services/stable-care.service";
import { trainingService } from "@/services/training.service";

const tabsByRole: Record<RoleId, string[]> = {
  trainer: ["Overview", "Training", "Health", "Medical", "Nutrition", "Performance"],
  vet: ["Overview", "Training", "Health", "Medical", "Nutrition", "Injuries", "Treatment"],
  groom: ["Overview", "Nutrition"],
  owner: ["Overview", "Training", "Health", "Medical", "Nutrition", "Performance", "Costs"],
  manager: ["Overview", "Health", "Medical", "Nutrition", "Performance", "Costs", "Timeline"],
};

export function useHorseDetailData({
  id,
  roleId,
  requestedTabValue,
}: {
  id: string;
  roleId: RoleId;
  requestedTabValue?: string;
}) {
  const [tab, setTab] = useState(() =>
    requestedTabValue && tabsByRole[roleId].includes(requestedTabValue)
      ? requestedTabValue
      : tabsByRole[roleId][0],
  );
  const { token } = useAuth();
  const isUuidId = isUuid(id);

  const loadHorse = useCallback(() => horseService.get(token!, id), [id, token]);
  const horseResource = useApiResource(loadHorse, Boolean(token) && isUuidId);
  const loadPermissions = useCallback(() => horseService.getPermissions(token!, id), [id, token]);
  const permissionsResource = useApiResource(loadPermissions, Boolean(token) && isUuidId);
  const tabs = useMemo(() => {
    const base = tabsByRole[roleId];
    if (!isUuidId || !permissionsResource.data) return base;
    return base.filter((item) => {
      if (["Health", "Medical", "Injuries", "Treatment"].includes(item))
        return permissionsResource.data?.canViewMedicalTab === true;
      if (item === "Nutrition") return true;
      if (item === "Performance") return permissionsResource.data?.canViewPerformanceTab === true;
      if (item === "Training") return permissionsResource.data?.canViewTrainingTab === true;
      if (item === "Costs") return permissionsResource.data?.canViewMedicalTab === true;
      return true;
    });
  }, [isUuidId, permissionsResource.data, roleId]);
  const visibleTab = tabs.includes(tab) ? tab : (tabs[0] ?? "Overview");

  const loadPedigree = useCallback(() => horseService.getPedigree(token!, id), [id, token]);
  const pedigreeResource = useApiResource(
    loadPedigree,
    Boolean(token) && isUuidId && visibleTab === "Overview",
  );
  const loadPhoto = useCallback(() => horseService.getPhotoUrl(token!, id), [id, token]);
  const photoResource = useApiResource(
    loadPhoto,
    Boolean(token && isUuidId && horseResource.data?.mediaId),
  );
  const loadHorseSessions = useCallback(
    () => trainingService.listHorseSessions(token!, id),
    [id, token],
  );
  const trainingResource = useApiResource(
    loadHorseSessions,
    Boolean(
      token &&
        isUuidId &&
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
        isUuidId &&
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
        isUuidId &&
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
        isUuidId &&
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
    Boolean(token && isUuidId && visibleTab === "Care"),
  );
  const loadAuditLog = useCallback(
    () => auditService.list(token!, 20, { entityId: id }),
    [id, token],
  );
  const auditResource = useApiResource(
    loadAuditLog,
    Boolean(token && isUuidId && roleId === "manager" && visibleTab === "Timeline"),
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

  const mockHorse = getHorse(id);
  const horse = horseResource.data ? mapHorseDetailToPrototype(horseResource.data) : mockHorse;
  const plan = trainingPlans.find((item) => item.horseId === horse.id && item.status === "active");
  const currentPhase =
    plan?.phases.find((phase) =>
      phase.sessions.some((session) => ["scheduled", "in_progress"].includes(session.status)),
    ) ?? plan?.phases[0];
  const nextSession = currentPhase?.sessions.find((session) =>
    ["planned", "scheduled", "in_progress"].includes(session.status),
  );
  const locked = horseResource.data
    ? Boolean(horseResource.data.activeTrainingLock)
    : horse.id === "thunder-king";

  return {
    token,
    tab,
    setTab,
    tabs,
    visibleTab,
    isUuidId,
    horse,
    mockHorse,
    plan,
    nextSession,
    locked,
    horseResource,
    permissionsResource,
    pedigreeResource,
    photoResource,
    trainingResource,
    medicalResource,
    surchargesResource,
    performanceResource,
    careResource,
    auditResource,
  };
}

function isUuid(value: string | string[] | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
