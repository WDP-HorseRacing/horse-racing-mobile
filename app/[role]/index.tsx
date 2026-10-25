import { Redirect, useLocalSearchParams, type Href } from "expo-router";
import { useCallback } from "react";
import { isRole, roles } from "@/features/auth/roles";
import {
  RoleDashboard,
  type DashboardPayload,
} from "@/features/dashboard/components/RoleDashboard";
import { Screen } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { horseService } from "@/services/horse.service";
import { stableService } from "@/services/stable.service";
import { stableCareService } from "@/services/stable-care.service";
import { trainingService } from "@/services/training.service";
import { suppliesService } from "@/services/supplies.service";
import { groomService } from "@/services/groom.service";
import { medicalService } from "@/services/medical.service";
import { notificationsService } from "@/services/notifications.service";
import { mapHorseSummary } from "@/adapters/horse.adapter";
import type { MedicalDashboardDto } from "@/adapters/medical.adapter";

export default function RoleHome() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const auth = useAuth();
  const roleId = isRole(role) ? role : "trainer";
  const loadDashboard = useCallback(async (): Promise<DashboardPayload> => {
    const token = auth.token!;
    if (roleId === "manager") {
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, idx) => {
        const i = 5 - idx;
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const pad = (n: number) => String(n).padStart(2, "0");
        const from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
        const to = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
        const label = `T${d.getMonth() + 1}`;
        return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label, from, to };
      });

      const [
        horses,
        barns,
        stalls,
        medical,
        checkups,
        costs,
        incidents,
        lowStock,
        pendingSupplyRequests,
        classes,
      ] = await Promise.all([
        horseService.list(token),
        stableService.listBarns(token),
        stableService.listStalls(token).catch(() => []),
        medicalService.getDashboard(token),
        medicalService.listCheckups(token).catch(() => []),
        Promise.all(
          months.map((m) =>
            medicalService
              .getCostReport(token, { from: m.from, to: m.to })
              .then((r) => ({
                key: m.key,
                label: m.label,
                total: r.totalCost,
                count: r.visitCount,
              }))
              .catch(() => ({ key: m.key, label: m.label, total: 0, count: 0 })),
          ),
        ),
        stableCareService.listIncidents(token, { status: "OPEN" }).catch(() => []),
        suppliesService
          .listItems(token)
          .then((items) =>
            items.filter(
              (s) =>
                s.lowStock || (s.reorderThreshold > 0 && s.quantityOnHand <= s.reorderThreshold),
            ),
          )
          .catch(() => []),
        suppliesService.listRequests(token, { status: "PENDING" }).catch(() => []),
        trainingService.listClasses(token).catch(() => []),
      ]);

      const openClasses = classes.filter((c) => c.status === "ACTIVE");
      const sessionGroups = await Promise.all(
        openClasses.map((c) => trainingService.listClassSessions(token, c.id).catch(() => [])),
      );

      return {
        kind: "manager_ops",
        data: {
          horses,
          barns,
          stalls,
          medical,
          checkups,
          costs,
          stable: {
            incidents,
            lowStock,
            pendingSupply: pendingSupplyRequests.length,
          },
          classes,
          sessions: sessionGroups.flat(),
        },
      };
    }
    if (roleId === "trainer") {
      const [horses, barns, stalls, medical, checkups, incidents, lowStock, classes] =
        await Promise.all([
          horseService.list(token, "", { myBarns: true }),
          stableService.listBarns(token),
          stableService.listStalls(token).catch(() => []),
          medicalService.getDashboard(token, { mine: true }),
          medicalService.listCheckups(token).catch(() => []),
          stableCareService.listIncidents(token, { status: "OPEN" }).catch(() => []),
          suppliesService
            .listItems(token)
            .then((items) =>
              items.filter(
                (s) =>
                  s.lowStock || (s.reorderThreshold > 0 && s.quantityOnHand <= s.reorderThreshold),
              ),
            )
            .catch(() => []),
          trainingService.listClasses(token).catch(() => []),
        ]);

      const openClasses = classes.filter((c) => c.status === "ACTIVE");
      const sessionGroups = await Promise.all(
        openClasses.map((c) => trainingService.listClassSessions(token, c.id).catch(() => [])),
      );

      return {
        kind: "trainer_ops",
        data: {
          horses,
          barns,
          stalls,
          medical,
          checkups,
          stable: {
            incidents,
            lowStock,
            pendingSupply: 0,
          },
          classes,
          sessions: sessionGroups.flat(),
        },
      };
    }
    if (roleId === "groom") {
      const [today, supplies] = await Promise.all([
        groomService.getToday(token),
        suppliesService.listItems(token).catch(() => []),
      ]);
      return { kind: "groom", today, supplies };
    }
    if (roleId === "vet") {
      const fallbackDashboard: MedicalDashboardDto = {
        herd: {
          counts: { QUARANTINED: 0, INJURED: 0, UNDER_OBSERVATION: 0, ELIGIBLE: 0 },
          horses: [],
        },
        checkups: [],
        careSchedules: [],
        openCases: [],
        horsesWithoutCase: [],
        todayPrescriptions: [],
        pendingRequests: [],
      };
      const [dashboard, horses, checkups, supplies, notifications, classes] = await Promise.all([
        medicalService.getDashboard(token).catch(() => fallbackDashboard),
        horseService.list(token).catch(() => []),
        medicalService.listCheckups(token).catch(() => []),
        suppliesService.listItems(token).catch(() => []),
        notificationsService.list(token).catch(() => undefined),
        trainingService.listClasses(token).catch(() => []),
      ]);
      const openClasses = classes.filter((c) => c.status === "ACTIVE");
      const sessionGroups = await Promise.all(
        openClasses.map((c) => trainingService.listClassSessions(token, c.id).catch(() => [])),
      );
      const allSessions = sessionGroups.flat();
      return {
        kind: "medical",
        dashboard,
        horses,
        checkups,
        supplies,
        notifications: notifications?.items,
        activeSessions: allSessions.filter((s) => s.status === "IN_PROGRESS"),
      };
    }
    const horses = await horseService.list(token);
    return { kind: "horses", horses: horses.map(mapHorseSummary) };
  }, [auth.token, roleId]);
  const resource = useApiResource(loadDashboard, Boolean(auth.token) && isRole(role));
  useRefreshOnFocus(resource.revalidate);
  if (!isRole(role)) return <Redirect href="/" />;
  if (auth.role !== role)
    return <Redirect href={(auth.role ? `/${auth.role}` : "/login") as Href} />;
  const firstName = auth.user?.fullName.split(" ")[0] ?? "there";
  const title =
    role === "trainer"
      ? `Good morning, ${firstName}`
      : role === "groom"
        ? `Good morning, ${firstName}`
        : role === "owner"
          ? "My horses"
          : role === "vet"
            ? "Health overview"
            : "Club overview";
  return (
    <Screen
      role={role}
      title={title}
      subtitle={auth.user?.email ?? roles[role].scope}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {resource.data ? (
        <RoleDashboard
          role={role}
          payload={resource.data}
          token={auth.token!}
          onRefresh={resource.refresh}
        />
      ) : null}
    </Screen>
  );
}
